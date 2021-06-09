//How i integerate all test in a single file .
const { TestHelper } = require("@openzeppelin/cli");
const { Contracts, ZWeb3 } = require("@openzeppelin/upgrades");

ZWeb3.initialize(web3.currentProvider);

const Bridge = Contracts.getFromLocal("Bridge");
const BridgeArtifact = artifacts.require("./Bridge");
const Federation = artifacts.require("Federation");
const MainToken = artifacts.require("./MainToken");
const AlternativeERC20Detailed = artifacts.require("./AlternativeERC20Detailed");
const SideToken = artifacts.require("./SideToken");
const AllowTokens = artifacts.require("./AllowTokens");
const SideTokenFactory = artifacts.require("./SideTokenFactory");
const MultiSigWallet = artifacts.require("./MultiSigWallet");
const mockReceiveTokensCall = artifacts.require("./mockReceiveTokensCall");
const TokenReceiver = artifacts.require("./TokenReceiverImpl");
const Utils = artifacts.require("./Utils");
const utils = require("./utils");
const BN = web3.utils.BN;
const randomHex = web3.utils.randomHex;
const ONE_DAY = 24 * 3600;

contract("Bridge", async function(accounts) {
  const bridgeOwner = accounts[0];
  const tokenOwner = accounts[1];
  const bridgeManager = accounts[2];
  const anAccount = accounts[3];
  const newBridgeManager = accounts[4];
  const federation = accounts[5];
  const ZERO_ADDRESS = utils.NULL_ADDRESS;

  beforeEach(async function() {
    this.allowTokens = await AllowTokens.new(bridgeManager);
    this.token = await MainToken.new("MAIN", "MAIN", 18, web3.utils.toWei("1000000000"), { from: tokenOwner });
    await this.allowTokens.addAllowedToken(this.token.address, { from: bridgeManager });

    this.weth = await MainToken.new("WETH", "WETH", 18, 0, { from: tokenOwner });
    await this.allowTokens.addAllowedToken(this.weth.address, { from: bridgeManager });

    this.sideTokenFactory = await SideTokenFactory.new();
    this.project = await TestHelper();
    this.utilsContract = await Utils.new();
    Bridge.link({ Utils: this.utilsContract.address });
    const proxy = await this.project.createProxy(Bridge, {
      initMethod: "initialize",
      initArgs: [bridgeManager, federation, this.allowTokens.address, this.sideTokenFactory.address, "e"],
    });
    this.bridge = await BridgeArtifact.at(proxy.address);

    await this.sideTokenFactory.transferPrimary(this.bridge.address);
  });
  describe("Calls from MultiSig", async function() {
    const multiSigOnwerA = accounts[7];
    const multiSigOnwerB = accounts[8];

    beforeEach(async function() {
      this.granularity = 1;
      this.multiSig = await MultiSigWallet.new([multiSigOnwerA, multiSigOnwerB], 2);
      this.fedMultiSig = await MultiSigWallet.new([multiSigOnwerA, multiSigOnwerB], 2);
      const fee = web3.utils.toWei("0.5");
      //Allowtokens setting fee for Source Chain
      await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });
      this.allowTokensmulSIg = await AllowTokens.new(this.multiSig.address);
      this.mirrorSideTokenFactory = await SideTokenFactory.new();
      // TODO: See if it is possible do it easily with proxy using Bridge's actual version
      this.mirrorBridge = await Bridge.new();
      this.decimals = "18";

      let data = this.mirrorBridge.methods["initialize(address,address,address,address,string)"](
        this.multiSig.address,
        this.fedMultiSig.address,
        this.allowTokensmulSIg.address,
        this.mirrorSideTokenFactory.address,
        "r"
      ).encodeABI();
      await this.multiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.multiSig.confirmTransaction(0, { from: multiSigOnwerB });

      let tx = await this.multiSig.transactions(0);
      assert.equal(tx.executed, true);

      await this.mirrorSideTokenFactory.transferPrimary(this.mirrorBridge.address);
      this.amount = web3.utils.toWei("1000");
      await this.token.approve(this.bridge.address, this.amount, { from: tokenOwner });
      this.txReceipt = await this.bridge.receiveTokens(this.token.address, this.amount, { from: tokenOwner });
    });

    it("should not accept a transfer due to missing signatures", async function() {
      let data = this.mirrorBridge.methods
        .acceptTransfer(
          this.token.address,
          anAccount,
          this.amount,
          "MAIN",
          this.txReceipt.receipt.blockHash,
          this.txReceipt.tx,
          this.txReceipt.receipt.logs[0].logIndex,
          this.decimals,
          this.granularity
        )
        .encodeABI();
      await this.fedMultiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });

      let tx = await this.fedMultiSig.transactions(0);
      assert.equal(tx.executed, false);
    });

    it("should accept a transfer", async function() {
      let data = this.mirrorBridge.methods
        .acceptTransfer(
          this.token.address,
          anAccount,
          this.amount,
          "MAIN",
          this.txReceipt.receipt.blockHash,
          this.txReceipt.tx,
          this.txReceipt.receipt.logs[0].logIndex,
          this.decimals,
          this.granularity
        )
        .encodeABI();
      await this.fedMultiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.fedMultiSig.confirmTransaction(0, { from: multiSigOnwerB });

      let tx = await this.fedMultiSig.transactions(0);
      assert.equal(tx.executed, true);

      let sideTokenAddress = await this.mirrorBridge.methods.mappedTokens(this.token.address).call();
      let sideToken = await SideToken.at(sideTokenAddress);
      const mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
      assert.equal(mirrorBridgeBalance, 0);
    });

    it("should allow to set a new federation", async function() {
      let data = this.mirrorBridge.methods.changeFederation(federation).encodeABI();
      await this.multiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.multiSig.confirmTransaction(1, { from: multiSigOnwerB });

      let tx = await this.multiSig.transactions(1);
      assert.equal(tx.executed, true);

      let federationAfter = await this.mirrorBridge.methods.getFederation().call();
      assert.equal(federationAfter, federation);
    });

    it("should pause the bridge contract", async function() {
      let isPaused = await this.mirrorBridge.methods.paused().call();
      assert.equal(isPaused, false);

      let data = this.mirrorBridge.methods.pause().encodeABI();
      await this.multiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.multiSig.confirmTransaction(1, { from: multiSigOnwerB });

      isPaused = await this.mirrorBridge.methods.paused().call();
      assert.equal(isPaused, true);
    });

    it("should unpause the bridge contract", async function() {
      //1st pause the contract
      let isPaused = await this.mirrorBridge.methods.paused().call();
      assert.equal(isPaused, false);

      let data = this.mirrorBridge.methods.pause().encodeABI();
      await this.multiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.multiSig.confirmTransaction(1, { from: multiSigOnwerB });

      isPaused = await this.mirrorBridge.methods.paused().call();
      assert.equal(isPaused, true);

      //Now unpausing
      data = this.mirrorBridge.methods.unpause().encodeABI();
      await this.multiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.multiSig.confirmTransaction(2, { from: multiSigOnwerB });

      isPaused = await this.mirrorBridge.methods.paused().call();
      assert.equal(isPaused, false);
    });

    it("should renounce ownership", async function() {
      let data = this.mirrorBridge.methods.renounceOwnership().encodeABI();
      await this.multiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.multiSig.confirmTransaction(1, { from: multiSigOnwerB });

      let owner = await this.mirrorBridge.methods.owner().call();
      assert.equal(BigInt(owner), 0);
    });

    it("should transfer ownership", async function() {
      let data = this.mirrorBridge.methods.transferOwnership(bridgeManager).encodeABI();
      await this.multiSig.submitTransaction(this.mirrorBridge.address, 0, data, { from: multiSigOnwerA });
      await this.multiSig.confirmTransaction(1, { from: multiSigOnwerB });

      let owner = await this.mirrorBridge.methods.owner().call();
      assert.equal(owner, bridgeManager);
    });
  });

  describe("Pausable methods for source chain", async function() {
    it("Should pause the bridge contract", async function() {
      let isPaused = await this.bridge.paused();
      assert.equal(isPaused, false);

      await this.bridge.pause({ from: bridgeManager });
      isPaused = await this.bridge.paused();
      assert.equal(isPaused, true);
    });

    it("Should not pause the bridge contract without pauser role", async function() {
      let isPaused = await this.bridge.paused();
      assert.equal(isPaused, false);

      await utils.expectThrow(this.bridge.pause());
      assert.equal(isPaused, false);
    });

    it("Should unpause the bridge contract", async function() {
      await this.bridge.pause({ from: bridgeManager });
      let isPaused = await this.bridge.paused();
      assert.equal(isPaused, true);

      await this.bridge.unpause({ from: bridgeManager });
      isPaused = await this.bridge.paused();
      assert.equal(isPaused, false);
    });

    it("Should not unpause the bridge contract without pauser role", async function() {
      await this.bridge.pause({ from: bridgeManager });
      let isPaused = await this.bridge.paused();
      assert.equal(isPaused, true);

      await utils.expectThrow(this.bridge.unpause());
      assert.equal(isPaused, true);
    });
  });

  describe("Ownable methods", async function() {
    const anotherOwner = accounts[7];

    it("Should renounce ownership", async function() {
      await this.bridge.renounceOwnership({ from: bridgeManager });
      let owner = await this.bridge.owner();
      assert.equal(BigInt(owner), 0);
    });

    it("Should not renounce ownership when not called by the owner", async function() {
      let owner = await this.bridge.owner();
      await utils.expectThrow(this.bridge.renounceOwnership());
      let ownerAfter = await this.bridge.owner();

      assert.equal(owner, ownerAfter);
    });

    it("Should transfer ownership", async function() {
      await this.bridge.transferOwnership(anotherOwner, { from: bridgeManager });
      let owner = await this.bridge.owner();
      assert.equal(owner, anotherOwner);
    });

    it("Should not transfer ownership when not called by the owner", async function() {
      let owner = await this.bridge.owner();
      await utils.expectThrow(this.bridge.transferOwnership(anotherOwner));
      let ownerAfter = await this.bridge.owner();

      assert.equal(owner, ownerAfter);
    });
  });

  describe("pausing/unpausing Bridge methods", async function() {
    beforeEach(async function() {
      await this.bridge.pause({ from: bridgeManager });
    });

    it("should reject receiveTokens ERC20", async function() {
      const amount = web3.utils.toWei("1000");
      await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
      await utils.expectThrow(this.bridge.receiveTokens(this.token.address, amount, { from: tokenOwner }));
    });

    it("should reject tokensReceived for ERC777", async function() {
      const amount = web3.utils.toWei("1000");
      const granularity = "100";
      let erc777 = await SideToken.new("ERC777", "777", tokenOwner, granularity, { from: tokenOwner });

      await this.allowTokens.addAllowedToken(erc777.address, { from: bridgeManager });
      await erc777.mint(tokenOwner, amount, "0x", "0x", { from: tokenOwner });
      await utils.expectThrow(erc777.send(this.bridge.address, amount, "0x1100", { from: tokenOwner }));
    });

    it("should accept transfer for the token", async function() {
      const amount = web3.utils.toWei("1000");
      await utils.expectThrow(
        this.bridge.acceptTransferAt(
          this.token.address,
          anAccount,
          amount,
          "MAIN",
          randomHex(32),
          randomHex(32),
          1,
          "18",
          "1",
          Buffer.from(""),
          { from: federation }
        )
      );
    });
  });

  describe("change SideTokenFactory", async function() {
    it("should reject empty address", async function() {
      await utils.expectThrow(this.bridge.changeSideTokenFactory(utils.NULL_ADDRESS, { from: bridgeManager }));
    });

    it("should be successful", async function() {
      let newAddress = randomHex(20);
      await this.bridge.changeSideTokenFactory(newAddress, { from: bridgeManager });
      let result = await this.bridge.sideTokenFactory();
      assert.equal(result.toLowerCase(), newAddress.toLowerCase());
    });
  });
});
