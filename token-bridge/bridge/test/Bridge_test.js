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
	describe("Main Bridge", async function() {
		it("should retrieve the version", async function() {
			const result = await this.bridge.version();
			assert.equal(result, "v0");
		});

		describe("recieveEth without any initiation", async function() {
			it("should revert if weth address called by non-admin", async function() {
				await utils.expectThrow(this.bridge.setWETHAddress(this.weth.address, { from: accounts[6] }));
			});

			it("should not be able to set weth address with zero address", async function() {
				await utils.expectThrow(this.bridge.setWETHAddress(ZERO_ADDRESS, { from: bridgeManager }));
			});

			it("should revert if weth address is zero address", async function() {
				const amount = web3.utils.toWei("2");
				await utils.expectThrow(this.bridge.receiveEthAt(accounts[6], Buffer.from(""), { from: accounts[7], value: amount }));
			});

			it("should be able to change weth address before first eth received", async function() {
				await this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager });
				await this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager });
			});

			it("should not be able to set weth address after first set attempted", async function() {
				await this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager });
				const amount = web3.utils.toWei("2");
				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.weth.address, fee, fee, { from: bridgeManager });
				await this.bridge.receiveEthAt(accounts[6], Buffer.from(""), { from: accounts[7], value: amount });
				await utils.expectThrow(this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager }));
			});

			it("should revert if value sent is 0", async function() {
				await this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager });
				const amount = web3.utils.toWei("0");
				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.weth.address, fee, fee, { from: bridgeManager });
				await utils.expectThrow(this.bridge.receiveEthAt(accounts[6], Buffer.from(""), { from: accounts[7], value: amount }));
			});

			it("should revert if sender is contract address", async function() {
				await this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager });
				const amount = web3.utils.toWei("5");
				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.weth.address, fee, fee, { from: bridgeManager });
				await utils.expectThrow(this.bridge.receiveEthAt(accounts[6], Buffer.from(""), { from: this.weth.address, value: amount }));
			});
		});

		describe("recieveEth", async function() {
			beforeEach(async function() {
				const nativeTokenSymbol = await this.weth.symbol();
				await this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager });
				await this.bridge.setNativeTokenSymbol(nativeTokenSymbol, { from: bridgeManager });
			});

			it("recieveEth and emit cross event", async function() {
				const fee = web3.utils.toWei("0.5");
				const amount = web3.utils.toWei("2");
				const sender = accounts[2];

				await this.allowTokens.setFeeAndMinPerToken(this.weth.address, fee, fee, { from: bridgeManager });

				const bridgeBalanceETHBF = await web3.eth.getBalance(this.bridge.address);
				const senderETHBalanceBF = await web3.eth.getBalance(sender);
				const ethFeeCollectedBF = await this.bridge.ethFeeCollected();

				receipt = await this.bridge.receiveEthAt(tokenOwner, Buffer.from(""), { from: sender, value: amount });
				utils.checkRcpt(receipt);

				const etherGasCost = await utils.etherGasCost(receipt);
				const bridgeBalanceETHAF = await web3.eth.getBalance(this.bridge.address);
				const senderETHBalanceAF = await web3.eth.getBalance(sender);
				const ethFeeCollectedAF = await this.bridge.ethFeeCollected();

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(receipt.logs[0].args[0], this.weth.address);
				assert.equal(receipt.logs[0].args[1], tokenOwner);
				assert.equal(receipt.logs[0].args[2].toString(), new BN(amount).sub(new BN(fee)).toString());
				assert.equal(receipt.logs[0].args[3], await this.weth.symbol());
				assert.equal(receipt.logs[0].args[4], null);
				assert.equal(receipt.logs[0].args[5].toString(), (await this.weth.decimals()).toString());
				assert.equal(receipt.logs[0].args[6].toString(), "1");
				assert.equal(amount.toString(), new BN(bridgeBalanceETHBF).add(new BN(bridgeBalanceETHAF)).toString());
				assert.equal(ethFeeCollectedAF.toString(), new BN(fee).add(ethFeeCollectedBF).toString());
				assert.equal(
					senderETHBalanceAF.toString(),
					new BN(senderETHBalanceBF)
						.sub(new BN(amount))
						.sub(new BN(etherGasCost))
						.toString(),
				);
				const isKnownToken = await this.bridge.knownTokens(this.weth.address);
				assert.equal(isKnownToken, true);
			});

			it("should generate cross event with extra data in recievedEthAt", async function() {
				const extraData = "Extra data";
				const amount = web3.utils.toWei("2");
				const fee = web3.utils.toWei("0.5");

				await this.allowTokens.setFeeAndMinPerToken(this.weth.address, fee, fee, { from: bridgeManager });

				receipt = await this.bridge.receiveEthAt(tokenOwner, Buffer.from(extraData), { from: accounts[1], value: amount });
				utils.checkRcpt(receipt);
				const result = utils.hexaToString(receipt.logs[0].args[4]);
				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(result, extraData);
			});

			it("rejects to receive tokens lesser than  min eth allowed", async function() {
				await this.allowTokens.setFeeAndMinPerToken(this.weth.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});
				let minTokensAllowed = await this.allowTokens.getMinPerToken(this.weth.address);
				let amount = minTokensAllowed.sub(new BN(web3.utils.toWei("0.2")));

				await utils.expectThrow(this.bridge.receiveEthAt(tokenOwner, Buffer.from(""), { from: accounts[1], value: amount.toString() }));

				const isKnownToken = await this.bridge.knownTokens(this.weth.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await this.weth.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), 0);
			});

			// it("clear spent today and successfully receives eth", async function() {
			//   const amount = web3.utils.toWei("2");
			//   let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
			//   let dailyLimit = await this.allowTokens.dailyLimit();
			//   const fee = web3.utils.toWei("0.5");
			//   await this.allowTokens.setFeeAndMinPerToken(this.weth.address, fee, fee, { from: bridgeManager });
			//   for (let tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
			//     await this.bridge.receiveEthAt(tokenOwner, Buffer.from(""), { from: accounts[1], value: maxTokensAllowed });
			//   }
			//   await utils.increaseTimestamp(web3, ONE_DAY + 1);
			//   let receipt = await this.bridge.receiveEthAt(tokenOwner, Buffer.from(""), { from: accounts[1], value: amount });
			//   utils.checkRcpt(receipt);
			// });
		});
		describe("withdraw All Eth Fees from the bridge", async function() {
			beforeEach(async function() {
					const nativeTokenSymbol =  await this.weth.symbol();
					await this.bridge.setWETHAddress(this.weth.address, { from: bridgeManager });
					await this.bridge.setNativeTokenSymbol(nativeTokenSymbol, { from: bridgeManager });
				});
				it("withdrawAllEthFees", async function() {
					const fee = web3.utils.toWei("0.5");
					const amount = web3.utils.toWei("2");
					const sender = accounts[2];
					const receiver = accounts[3];

					await this.allowTokens.setFeeAndMinPerToken(this.weth.address, fee, fee, { from: bridgeManager });

					const bridgeBalanceETHBF = new BN(await web3.eth.getBalance(this.bridge.address));
					const senderETHBalanceBF = await web3.eth.getBalance(sender);
					const ethFeeCollectedBF = new BN(await this.bridge.ethFeeCollected());

					await this.bridge.receiveEthAt(tokenOwner, Buffer.from(""), { from: sender, value: amount });

					const bridgeBalanceETHAF = new BN(await web3.eth.getBalance(this.bridge.address));
					console.log("bridgeBalanceETHBF " + bridgeBalanceETHBF + ".   bridgeBalanceETHAF " + bridgeBalanceETHAF);

					const OwnerETHBalanceAF = new BN(await web3.eth.getBalance(receiver));
					const senderETHBalanceAF = await web3.eth.getBalance(sender);
					const ethFeeCollectedAF = new BN(await this.bridge.ethFeeCollected());
					console.log("ethFeeCollectedBF " + ethFeeCollectedBF + ".   ethFeeCollectedAF " + ethFeeCollectedAF);
					assert.equal(amount.toString(), bridgeBalanceETHAF.sub(bridgeBalanceETHBF).toString());
					assert.equal(fee.toString(), ethFeeCollectedAF.sub(ethFeeCollectedBF).toString());

					await this.bridge.withdrawAllEthFees(receiver, { from: bridgeManager });

					const bridgeBalanceETHAF1 = new BN(await web3.eth.getBalance(this.bridge.address));
					const OwnerETHBalanceAF1 = new BN(await web3.eth.getBalance(receiver));
					const ethFeeCollectedAF1 = new BN(await this.bridge.ethFeeCollected());

					assert.equal(bridgeBalanceETHAF.sub(bridgeBalanceETHAF1).toString(), OwnerETHBalanceAF1.sub(OwnerETHBalanceAF).toString());
					assert.equal(ethFeeCollectedAF1.toString(), (0).toString());
			
				});
		});
		describe("Set Prefix", async function() {
			it("Shoul set prefix", async function() {
				const amount = web3.utils.toWei("2");
				const isSuffix = true;
				const symbolPrefix = "FFF";
				await this.bridge.initialSymbolPrefixSetup(isSuffix, symbolPrefix, { from: bridgeManager });
				let receipt = await this.bridge.acceptTransferAt(
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
					{ from: federation },
				);
				utils.checkRcpt(receipt);
				let sideTokenAddress = await this.bridge.mappedTokens(this.token.address);
				let sideToken = await SideToken.at(sideTokenAddress);
				const sideTokenSymbol = await sideToken.symbol();
				assert.equal(sideTokenSymbol, "MAINFFF");
			});
			it("cannot set prefix after first transfer to the bridge", async function() {
				const amount = web3.utils.toWei("2");
				const isSuffix = false;
				const symbolPrefix = "ff";
				await this.bridge.initialSymbolPrefixSetup(isSuffix, symbolPrefix, { from: bridgeManager });

				let receipt = await this.bridge.acceptTransferAt(
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
					{ from: federation },
				);

				const isSuffix1 = true;
				const symbolPrefix1 = "kk";
				await utils.expectThrow(this.bridge.initialSymbolPrefixSetup(isSuffix1, symbolPrefix1, { from: bridgeManager }));

				let sideTokenAddress = await this.bridge.mappedTokens(this.token.address);
				let sideToken = await SideToken.at(sideTokenAddress);
				const sideTokenSymbol = await sideToken.symbol();
				assert.equal(sideTokenSymbol, "ffMAIN");
			});
		});

		describe("owner", async function() {
			it("check manager", async function() {
				const manager = await this.bridge.owner();
				assert.equal(manager, bridgeManager);
			});

			it("change manager", async function() {
				const receipt = await this.bridge.transferOwnership(newBridgeManager, { from: bridgeManager });
				utils.checkRcpt(receipt);
				const manager = await this.bridge.owner();
				assert.equal(manager, newBridgeManager);
			});

			it("only manager can change manager", async function() {
				await utils.expectThrow(this.bridge.transferOwnership(newBridgeManager));
				const manager = await this.bridge.owner();
				assert.equal(manager, bridgeManager);
			});

			it("check federation", async function() {
				const fedAddress = await this.bridge.getFederation();
				assert.equal(fedAddress, federation);
			});

			it("change federation", async function() {
				const newfederation = anAccount;
				const receipt = await this.bridge.changeFederation(newfederation, { from: bridgeManager });
				utils.checkRcpt(receipt);
				const fedAddress = await this.bridge.getFederation();
				assert.equal(fedAddress, newfederation);
			});

			it("only manager can change the federation", async function() {
				const newfederation = anAccount;
				await utils.expectThrow(this.bridge.changeFederation(newfederation));
				const fedAddress = await this.bridge.getFederation();
				assert.equal(fedAddress, federation);
			});

			it("change federation new fed cant be null", async function() {
				await utils.expectThrow(this.bridge.changeFederation(utils.NULL_ADDRESS, { from: bridgeManager }));
				const fedAddress = await this.bridge.getFederation();
				assert.equal(fedAddress, federation);
			});
		});

		describe("receiveTokens", async function() {
			it("receiveTokens approve and transferFrom for ERC20", async function() {
				const amount = web3.utils.toWei("1000");
				const fee = web3.utils.toWei("0.5");
				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				let receipt = await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });
				receipt = await this.bridge.receiveTokens(this.token.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(receipt.logs[0].args[0], this.token.address);
				assert.equal(receipt.logs[0].args[1], tokenOwner);
				assert.equal(receipt.logs[0].args[2].toString(), new BN(amount).sub(new BN(fee)).toString());
				assert.equal(receipt.logs[0].args[3], await this.token.symbol());
				assert.equal(receipt.logs[0].args[4], null);
				assert.equal(receipt.logs[0].args[5].toString(), (await this.token.decimals()).toString());
				assert.equal(receipt.logs[0].args[6].toString(), "1");

				const tokenBalance = await this.token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokens approve and transferFrom for ERC20 Max allowed tokens 18 decimals", async function() {
				const amount = await this.allowTokens.getMaxTokensAllowed();
				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });
				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				let receipt = await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);
				receipt = await this.bridge.receiveTokens(this.token.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await this.token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokens approve and transferFrom for ERC20 Min allowed tokens 18 decimals", async function() {
				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });

				const amount = await this.allowTokens.getMinPerToken(this.token.address);

				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				let receipt = await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);
				receipt = await this.bridge.receiveTokens(this.token.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await this.token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokens approve and transferFrom for ERC20 Max allowed tokens 8 decimals", async function() {
				const maxTokens = await this.allowTokens.getMaxTokensAllowed();
				const amount = new BN(maxTokens).div(new BN((10 ** 10).toString()));
				const fee = new BN(10 ** 8 * 0.5);
				let token = await AlternativeERC20Detailed.new("AlternativeERC20Detailed", utils.ascii_to_hexa("x"), "8", amount, {
					from: tokenOwner,
				});
				this.allowTokens.addAllowedToken(token.address, { from: bridgeManager });
				const originalTokenBalance = await token.balanceOf(tokenOwner);
				let receipt = await token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				await this.allowTokens.setFeeAndMinPerToken(token.address, fee, fee, { from: bridgeManager });
				receipt = await this.bridge.receiveTokens(token.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(fee).toString());
				const isKnownToken = await this.bridge.knownTokens(token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokens approve and transferFrom for ERC20 Min allowed tokens 8 decimals", async function() {
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, new BN(10 ** 8 * 0.5), new BN(10 ** 8 * 0.5), {
					from: bridgeManager,
				});

				const minTokens = await this.allowTokens.getMinPerToken(this.token.address);
				const amount = minTokens;
				let token = await AlternativeERC20Detailed.new("AlternativeERC20Detailed", utils.ascii_to_hexa("x"), "8", amount, {
					from: tokenOwner,
				});
				this.allowTokens.addAllowedToken(token.address, { from: bridgeManager });
				const originalTokenBalance = await token.balanceOf(tokenOwner);
				let receipt = await token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				await this.allowTokens.setFeeAndMinPerToken(token.address, new BN(10 ** 8 * 0.5), new BN(10 ** 8 * 0.5), { from: bridgeManager });
				receipt = await this.bridge.receiveTokens(token.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(10 ** 8 * 0.5)).toString());
				const isKnownToken = await this.bridge.knownTokens(token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokens approve and transferFrom Alternative ERC20 Detailed", async function() {
				const amount = web3.utils.toWei("1000", "gwei");
				const decimals = "10";
				const fee = new BN(10 ** parseInt(decimals) * 0.5);
				const symbol = "ERC20";
				let erc20Alternative = await AlternativeERC20Detailed.new(
					"AlternativeERC20Detailed",
					utils.ascii_to_hexa(symbol),
					decimals,
					amount,
					{ from: tokenOwner },
				);
				await this.allowTokens.addAllowedToken(erc20Alternative.address, { from: bridgeManager });
				const originalTokenBalance = await erc20Alternative.balanceOf(tokenOwner);
				let receipt = await erc20Alternative.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				await this.allowTokens.setFeeAndMinPerToken(erc20Alternative.address, fee, fee, { from: bridgeManager });
				receipt = await this.bridge.receiveTokens(erc20Alternative.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(receipt.logs[0].args[0], erc20Alternative.address);
				assert.equal(receipt.logs[0].args[1], tokenOwner);
				assert.equal(receipt.logs[0].args[2].toString(), new BN(amount).sub(fee).toString());
				assert.equal(receipt.logs[0].args[3], symbol);
				assert.equal(receipt.logs[0].args[4], null);
				assert.equal(receipt.logs[0].args[5].toString(), decimals);
				assert.equal(receipt.logs[0].args[6].toString(), "1");

				const tokenBalance = await erc20Alternative.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await erc20Alternative.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(fee).toString());
				const isKnownToken = await this.bridge.knownTokens(erc20Alternative.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokens approve and transferFrom for ERC777", async function() {
				const amount = web3.utils.toWei("1000");
				const granularity = "1000";
				let erc777 = await SideToken.new("ERC777", "777", tokenOwner, granularity, { from: tokenOwner });
				const fee = new BN(10 ** 15 * 0.5);
				await this.allowTokens.addAllowedToken(erc777.address, { from: bridgeManager });
				await erc777.mint(tokenOwner, amount, "0x", "0x", { from: tokenOwner });
				await this.allowTokens.setFeeAndMinPerToken(erc777.address, fee, fee, { from: bridgeManager });

				const originalTokenBalance = await erc777.balanceOf(tokenOwner);
				let receipt = await erc777.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);
				receipt = await this.bridge.receiveTokens(erc777.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(receipt.logs[0].args[0], erc777.address);
				assert.equal(receipt.logs[0].args[1], tokenOwner);
				assert.equal(receipt.logs[0].args[2].toString(), new BN(amount).sub(new BN(fee)).toString());
				assert.equal(receipt.logs[0].args[3], await erc777.symbol());
				assert.equal(receipt.logs[0].args[4], null);
				assert.equal(receipt.logs[0].args[5].toString(), (await erc777.decimals()).toString());
				assert.equal(receipt.logs[0].args[6].toString(), granularity);

				const tokenBalance = await erc777.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await erc777.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(erc777.address);
				assert.equal(isKnownToken, true);
			});
			it("receiveTokens should  calling from a user created contract", async function() {
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});
				let otherContract = await mockReceiveTokensCall.new(this.bridge.address);
				const amount = web3.utils.toWei("10");
				await this.token.transfer(otherContract.address, amount, { from: tokenOwner });
				await otherContract.approveTokensForBridge(this.token.address, amount, { from: tokenOwner });
				const receipt = await otherContract.callReceiveTokens(this.token.address, amount);
				utils.checkRcpt(receipt);
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert(isKnownToken, true);
			});
			it("tokensReceived for ERC777", async function() {
				const amount = web3.utils.toWei("1000");
				const granularity = "100";
				let erc777 = await SideToken.new("ERC777", "777", tokenOwner, granularity, { from: tokenOwner });

				await this.allowTokens.addAllowedToken(erc777.address, { from: bridgeManager });
				await erc777.mint(tokenOwner, amount, "0x", "0x", { from: tokenOwner });

				const fee = new BN(10 ** 16 * 0.5);
				await this.allowTokens.setFeeAndMinPerToken(erc777.address, fee, fee, { from: bridgeManager });
				const originalTokenBalance = await erc777.balanceOf(tokenOwner);
				let userData = "0x1100";
				let result = await erc777.send(this.bridge.address, amount, userData, { from: tokenOwner });
				utils.checkRcpt(result);
				let eventSignature = web3.eth.abi.encodeEventSignature("Cross(address,address,uint256,string,bytes,uint8,uint256)");
				assert.equal(result.receipt.rawLogs[4].topics[0], eventSignature);
				let decodedLog = web3.eth.abi.decodeLog(
					[
						{
							indexed: true,
							name: "_tokenAddress",
							type: "address",
						},
						{
							indexed: true,
							name: "_to",
							type: "address",
						},
						{
							indexed: false,
							name: "_amount",
							type: "uint256",
						},
						{
							indexed: false,
							name: "_symbol",
							type: "string",
						},
						{
							indexed: false,
							name: "_userData",
							type: "bytes",
						},
						{
							indexed: false,
							name: "_decimals",
							type: "uint8",
						},
						{
							indexed: false,
							name: "_granularity",
							type: "uint256",
						},
					],
					result.receipt.rawLogs[4].data,
					result.receipt.rawLogs[4].topics.slice(1),
				);

				assert.equal(decodedLog._tokenAddress, erc777.address);
				assert.equal(decodedLog._to, tokenOwner);
				assert.equal(decodedLog._amount.toString(), new BN(amount).sub(new BN(fee)).toString());
				assert.equal(decodedLog._symbol, await erc777.symbol());
				assert.equal(decodedLog._userData, userData);
				assert.equal(decodedLog._decimals.toString(), (await erc777.decimals()).toString());
				assert.equal(decodedLog._granularity.toString(), (await erc777.granularity()).toString());

				const tokenBalance = await erc777.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await erc777.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(erc777.address);
				assert.equal(isKnownToken, true);
			});

			it("tokensReceived should fail if not a token contract", async function() {
				const amount = web3.utils.toWei("1000");
				const granularity = "100";
				let erc777 = await SideToken.new("ERC777", "777", tokenOwner, granularity, { from: tokenOwner });

				await this.allowTokens.addAllowedToken(erc777.address, { from: bridgeManager });
				await erc777.mint(tokenOwner, amount, "0x", "0x", { from: tokenOwner });
				let userData = "0x1100";
				await utils.expectThrow(
					this.bridge.tokensReceived(tokenOwner, tokenOwner, this.bridge.address, amount, userData, "0x", { from: tokenOwner }),
				);
			});

			it("tokensReceived should fail if not directed to bridge", async function() {
				const amount = web3.utils.toWei("1000");
				const granularity = "100";
				let erc777 = await SideToken.new("ERC777", "777", tokenOwner, granularity, { from: tokenOwner });

				await this.allowTokens.addAllowedToken(erc777.address, { from: bridgeManager });
				await erc777.mint(tokenOwner, amount, "0x", "0x", { from: tokenOwner });
				let userData = "0x1100";
				await utils.expectThrow(
					this.bridge.tokensReceived(erc777.address, erc777.address, tokenOwner, amount, userData, "0x", { from: tokenOwner }),
				);
			});

			it("send money to contract should fail", async function() {
				const payment = new BN("10");
				await utils.expectThrow(web3.eth.sendTransaction({ from: tokenOwner, to: this.bridge.address, value: payment }));
			});

			it("receiveTokens should reject token not allowed", async function() {
				let newToken = await MainToken.new("MAIN", "MAIN", 18, web3.utils.toWei("1000000000"), { from: tokenOwner });
				const fee = web3.utils.toWei("0.5");

				await this.allowTokens.setFeeAndMinPerToken(newToken.address, fee, fee, { from: bridgeManager });
				const amount = web3.utils.toWei("1000");
				await newToken.approve(this.bridge.address, amount, { from: tokenOwner });
				await utils.expectThrow(this.bridge.receiveTokens(newToken.address, amount, { from: tokenOwner }));
			});

			it("rejects to receive tokens greater than  max tokens allowed 18 decimals", async function() {
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let amount = maxTokensAllowed.add(new BN("1"));
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});

				await this.token.approve(this.bridge.address, amount.toString(), { from: tokenOwner });

				await utils.expectThrow(this.bridge.receiveTokens(this.token.address, amount.toString(), { from: tokenOwner }));

				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens greater than  max tokens allowed 8 decimals", async function() {
				let newToken = await MainToken.new("MAIN", "MAIN", 8, web3.utils.toWei("1000000000"), { from: tokenOwner });
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let amount = maxTokensAllowed.div(new BN((10 ** 10).toString()).add(new BN("1")));
				await this.allowTokens.setFeeAndMinPerToken(
					this.token.address,
					web3.utils.toWei("0.00000000005"),
					web3.utils.toWei("0.00000000005"),
					{ from: bridgeManager },
				);

				await newToken.approve(this.bridge.address, amount.toString(), { from: tokenOwner });

				await utils.expectThrow(this.bridge.receiveTokens(newToken.address, amount.toString(), { from: tokenOwner }));

				const isKnownToken = await this.bridge.knownTokens(newToken.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await newToken.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens lesser than  min tokens allowed 18 decimals", async function() {
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.8"), {
					from: bridgeManager,
				});

				let minTokensAllowed = await this.allowTokens.getMinPerToken(this.token.address);
				let amount = minTokensAllowed.sub(new BN(web3.utils.toWei("0.2")));

				await this.token.approve(this.bridge.address, amount.toString(), { from: tokenOwner });

				await utils.expectThrow(this.bridge.receiveTokens(this.token.address, amount.toString(), { from: tokenOwner }));

				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens greater than  min tokens allowed 8 decimals", async function() {
				let newToken = await MainToken.new("MAIN", "MAIN", 8, web3.utils.toWei("1000000000"), { from: tokenOwner });
				await this.allowTokens.setFeeAndMinPerToken(
					this.token.address,
					web3.utils.toWei("0.00000000005"),
					web3.utils.toWei("0.00000000008"),
					{ from: bridgeManager },
				);

				let maxTokensAllowed = await this.allowTokens.getMinPerToken(this.token.address);
				let amount = maxTokensAllowed.div(new BN((10 ** 10).toString()).sub(new BN("0.2")));

				await newToken.approve(this.bridge.address, amount.toString(), { from: tokenOwner });

				await utils.expectThrow(this.bridge.receiveTokens(newToken.address, amount.toString(), { from: tokenOwner }));

				const isKnownToken = await this.bridge.knownTokens(newToken.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await newToken.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens over the daily limit 18 decimals", async function() {
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let dailyLimit = await this.allowTokens.dailyLimit();
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});

				for (var tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await this.token.approve(this.bridge.address, maxTokensAllowed, { from: tokenOwner });
					await this.bridge.receiveTokens(this.token.address, maxTokensAllowed, { from: tokenOwner });
				}
				await utils.expectThrow(this.bridge.receiveTokens(this.token.address, maxTokensAllowed, { from: tokenOwner }));
			});

			it("rejects to receive tokens over the daily limit 8 decimals", async function() {
				const newToken = await MainToken.new("MAIN", "MAIN", 8, web3.utils.toWei("1000000000"), { from: tokenOwner });
				this.allowTokens.addAllowedToken(newToken.address, { from: bridgeManager });
				const maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				const amount = BigInt(maxTokensAllowed) / BigInt(10 ** 10);
				const dailyLimit = await this.allowTokens.dailyLimit();
				const decimals = "8";
				const fee = new BN(10 ** parseInt(decimals) * 0.5);
				await this.allowTokens.setFeeAndMinPerToken(newToken.address, fee, fee, { from: bridgeManager });

				for (var tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await newToken.approve(this.bridge.address, amount.toString(), { from: tokenOwner });
					await this.bridge.receiveTokens(newToken.address, amount.toString(), { from: tokenOwner });
				}
				await utils.expectThrow(this.bridge.receiveTokens(newToken.address, amount.toString(), { from: tokenOwner }));
			});

			it("clear spent today after 24 hours", async function() {
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let dailyLimit = await this.allowTokens.dailyLimit();
				let maxWidthdraw = await this.bridge.calcMaxWithdraw();
				assert.equal(maxWidthdraw.toString(), maxTokensAllowed.toString());
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});

				for (var tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await this.token.approve(this.bridge.address, maxTokensAllowed, { from: tokenOwner });
					await this.bridge.receiveTokens(this.token.address, maxTokensAllowed, { from: tokenOwner });
				}
				maxWidthdraw = await this.bridge.calcMaxWithdraw();
				assert.equal(maxWidthdraw.toString(), "0");
				await utils.increaseTimestamp(web3, ONE_DAY + 1);
				maxWidthdraw = await this.bridge.calcMaxWithdraw();
				assert.equal(maxWidthdraw.toString(), maxTokensAllowed.toString());
			});

			it("clear spent today and successfully receives tokens", async function() {
				const amount = web3.utils.toWei("1000");
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let dailyLimit = await this.allowTokens.dailyLimit();
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});

				for (let tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await this.token.approve(this.bridge.address, maxTokensAllowed, { from: tokenOwner });
					await this.bridge.receiveTokens(this.token.address, maxTokensAllowed, { from: tokenOwner });
				}
				await utils.increaseTimestamp(web3, ONE_DAY + 1);

				await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				let receipt = await this.bridge.receiveTokens(this.token.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);
			});
		});

		describe("receiveTokensAt", async function() {
			it("receiveTokensAt approve and transferFrom for ERC20", async function() {
				const amount = web3.utils.toWei("1000");
				const fee = web3.utils.toWei("0.5");
				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				let receipt = await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });

				receipt = await this.bridge.receiveTokensAt(this.token.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(receipt.logs[0].args[0], this.token.address);
				assert.equal(receipt.logs[0].args[1], tokenOwner);
				assert.equal(receipt.logs[0].args[2].toString(), new BN(amount).sub(new BN(fee)).toString());
				assert.equal(receipt.logs[0].args[3], await this.token.symbol());
				assert.equal(receipt.logs[0].args[4], null);
				assert.equal(receipt.logs[0].args[5].toString(), (await this.token.decimals()).toString());
				assert.equal(receipt.logs[0].args[6].toString(), "1");

				const tokenBalance = await this.token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt approve and transferFrom for ERC20 Max allowed tokens 18 decimals", async function() {
				const amount = await this.allowTokens.getMaxTokensAllowed();
				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				const fee = web3.utils.toWei("0.5");
				let receipt = await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});

				utils.checkRcpt(receipt);
				receipt = await this.bridge.receiveTokensAt(this.token.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await this.token.balanceOf(tokenOwner);
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);

				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt approve and transferFrom for ERC20 Min allowed tokens 18 decimals", async function() {
				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, web3.utils.toWei("0.8"), { from: bridgeManager });
				const amount = await this.allowTokens.getMinPerToken(this.token.address);
				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				let receipt = await this.token.approve(this.bridge.address, amount, { from: tokenOwner });

				utils.checkRcpt(receipt);
				receipt = await this.bridge.receiveTokensAt(this.token.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await this.token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt approve and transferFrom for ERC20 Max allowed tokens 8 decimals", async function() {
				const maxTokens = await this.allowTokens.getMaxTokensAllowed();
				const amount = new BN(maxTokens).div(new BN((10 ** 10).toString()));
				const fee = web3.utils.toWei("0.00000000005");
				let token = await AlternativeERC20Detailed.new("AlternativeERC20Detailed", utils.ascii_to_hexa("x"), "8", amount, {
					from: tokenOwner,
				});
				this.allowTokens.addAllowedToken(token.address, { from: bridgeManager });
				const originalTokenBalance = await token.balanceOf(tokenOwner);
				let receipt = await token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);
				await this.allowTokens.setFeeAndMinPerToken(token.address, fee, fee, { from: bridgeManager });

				receipt = await this.bridge.receiveTokensAt(token.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt approve and transferFrom for ERC20 Min allowed tokens 8 decimals", async function() {
				await this.allowTokens.setFeeAndMinPerToken(
					this.token.address,
					web3.utils.toWei("0.00000000005"),
					web3.utils.toWei("0.00000000008"),
					{ from: bridgeManager },
				);
				const minTokens = await this.allowTokens.getMinPerToken(this.token.address);
				// const amount = new BN(minTokens).div(new BN((10**10).toString()));
				const amount = minTokens;
				let token = await AlternativeERC20Detailed.new("AlternativeERC20Detailed", utils.ascii_to_hexa("x"), "8", amount, {
					from: tokenOwner,
				});
				this.allowTokens.addAllowedToken(token.address, { from: bridgeManager });
				const originalTokenBalance = await token.balanceOf(tokenOwner);
				let receipt = await token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				await this.allowTokens.setFeeAndMinPerToken(token.address, web3.utils.toWei("0.00000000005"), web3.utils.toWei("0.00000000008"), {
					from: bridgeManager,
				});
				receipt = await this.bridge.receiveTokensAt(token.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);

				const tokenBalance = await token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(10 ** 8 * 0.5)).toString());
				const isKnownToken = await this.bridge.knownTokens(token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt approve and transferFrom Alternative ERC20 Detailed", async function() {
				const amount = web3.utils.toWei("1000", "gwei");
				const decimals = "10";
				const fee = new BN(10 ** parseInt(decimals) * 0.5);
				const symbol = "ERC20";
				let erc20Alternative = await AlternativeERC20Detailed.new(
					"AlternativeERC20Detailed",
					utils.ascii_to_hexa(symbol),
					decimals,
					amount,
					{ from: tokenOwner },
				);
				await this.allowTokens.addAllowedToken(erc20Alternative.address, { from: bridgeManager });
				const originalTokenBalance = await erc20Alternative.balanceOf(tokenOwner);
				let receipt = await erc20Alternative.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				await this.allowTokens.setFeeAndMinPerToken(erc20Alternative.address, fee, fee, { from: bridgeManager });
				receipt = await this.bridge.receiveTokensAt(erc20Alternative.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(receipt.logs[0].args[0], erc20Alternative.address);
				assert.equal(receipt.logs[0].args[1], tokenOwner);
				assert.equal(receipt.logs[0].args[2].toString(), new BN(amount).sub(fee).toString());
				assert.equal(receipt.logs[0].args[3], symbol);
				assert.equal(receipt.logs[0].args[4], null);
				assert.equal(receipt.logs[0].args[5].toString(), decimals);
				assert.equal(receipt.logs[0].args[6].toString(), "1");

				const tokenBalance = await erc20Alternative.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await erc20Alternative.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(fee).toString());
				const isKnownToken = await this.bridge.knownTokens(erc20Alternative.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt approve and transferFrom for ERC777", async function() {
				const amount = web3.utils.toWei("1000");
				const granularity = "1000";
				let erc777 = await SideToken.new("ERC777", "777", tokenOwner, granularity, { from: tokenOwner });

				await this.allowTokens.addAllowedToken(erc777.address, { from: bridgeManager });
				await erc777.mint(tokenOwner, amount, "0x", "0x", { from: tokenOwner });

				const originalTokenBalance = await erc777.balanceOf(tokenOwner);
				let receipt = await erc777.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(erc777.address, fee, fee, { from: bridgeManager });
				receipt = await this.bridge.receiveTokensAt(erc777.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(receipt.logs[0].args[0], erc777.address);
				assert.equal(receipt.logs[0].args[1], tokenOwner);
				assert.equal(receipt.logs[0].args[2].toString(), new BN(amount).sub(new BN(fee)).toString());
				assert.equal(receipt.logs[0].args[3], await erc777.symbol());
				assert.equal(receipt.logs[0].args[4], null);
				assert.equal(receipt.logs[0].args[5].toString(), (await erc777.decimals()).toString());
				assert.equal(receipt.logs[0].args[6].toString(), granularity);

				const tokenBalance = await erc777.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), new BN(originalTokenBalance).sub(new BN(amount)).toString());
				const bridgeBalance = await erc777.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), new BN(amount).sub(new BN(fee)).toString());
				const isKnownToken = await this.bridge.knownTokens(erc777.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt with payment successful", async function() {
				const amount = new BN(web3.utils.toWei("1000"));
				const fees = new BN(web3.utils.toWei("10"));
				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fees, fees, { from: bridgeManager });
				await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				let receipt = await this.bridge.receiveTokensAt(this.token.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);
				const ownerBalance = await this.token.balanceOf(bridgeManager);
				//FEES goes to bridge manager(or Multisig  wallet)
				assert.equal(ownerBalance.toString(), fees.toString());
				const tokenBalance = await this.token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), originalTokenBalance.sub(amount));
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), amount.sub(fees).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt with payment and granularity successful", async function() {
				const amount = new BN(web3.utils.toWei("1000"));
				const granularity = "100";
				let erc777 = await SideToken.new("ERC777", "777", tokenOwner, granularity, { from: tokenOwner });
				await this.allowTokens.addAllowedToken(erc777.address, { from: bridgeManager });
				await erc777.mint(tokenOwner, amount, "0x", "0x", { from: tokenOwner });
				const fees = new BN(web3.utils.toWei("0.01"));
				const originalTokenBalance = await erc777.balanceOf(tokenOwner);
				await this.allowTokens.setFeeAndMinPerToken(erc777.address, fees, fees, { from: bridgeManager });
				await erc777.approve(this.bridge.address, amount, { from: tokenOwner });
				let receipt = await this.bridge.receiveTokensAt(erc777.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);
				//FEES goes to BridgeManager
				const ownerBalance = await erc777.balanceOf(bridgeManager);
				assert.equal(ownerBalance.toString(), fees.toString());
				const tokenBalance = await erc777.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), originalTokenBalance.sub(amount));
				const bridgeBalance = await erc777.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), amount.sub(fees).toString());
				const isKnownToken = await this.bridge.knownTokens(erc777.address);
				assert.equal(isKnownToken, true);
			});

			it("receiveTokensAt can specify the address where want to receive the tokens", async function() {
				const amount = new BN(web3.utils.toWei("1000"));
				const fees = new BN(web3.utils.toWei("10"));
				const originalTokenBalance = await this.token.balanceOf(tokenOwner);
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fees, fees, { from: bridgeManager });
				await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				let receipt = await this.bridge.receiveTokensAt(this.token.address, amount, anAccount, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);
				const ownerBalance = await this.token.balanceOf(bridgeManager);
				assert.equal(ownerBalance.toString(), fees.toString());
				const tokenBalance = await this.token.balanceOf(tokenOwner);
				assert.equal(tokenBalance.toString(), originalTokenBalance.sub(amount));
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance.toString(), amount.sub(fees).toString());
				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, true);
				const logs = receipt.receipt.logs;
				assert.equal(logs.length, 1);
				const crossEvent = logs[0];
				assert.equal(crossEvent.event, "Cross");
				const to = crossEvent.args._to;
				assert.equal(to, anAccount);
			});

			it("receiveTokensAt should reject token not allowed", async function() {
				let newToken = await MainToken.new("MAIN", "MAIN", 18, web3.utils.toWei("1000000000"), { from: tokenOwner });
				const amount = web3.utils.toWei("1000");
				await newToken.approve(this.bridge.address, amount, { from: tokenOwner });
				await utils.expectThrow(this.bridge.receiveTokensAt(newToken.address, amount, anAccount, Buffer.from(""), { from: tokenOwner }));
			});

			it("rejects to receive tokens greater than  max tokens allowed 18 decimals", async function() {
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let amount = maxTokensAllowed.add(new BN("1"));
				await this.token.approve(this.bridge.address, amount.toString(), { from: tokenOwner });
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("1"), web3.utils.toWei("1"), {
					from: bridgeManager,
				});

				await utils.expectThrow(
					this.bridge.receiveTokensAt(this.token.address, amount.toString(), tokenOwner, Buffer.from(""), { from: tokenOwner }),
				);

				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens greater than  max tokens allowed 8 decimals", async function() {
				let newToken = await MainToken.new("MAIN", "MAIN", 8, web3.utils.toWei("1000000000"), { from: tokenOwner });
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let amount = maxTokensAllowed.div(new BN((10 ** 10).toString()).add(new BN("1")));
				await this.allowTokens.setFeeAndMinPerToken(
					this.token.address,
					web3.utils.toWei("0.00000000000011"),
					web3.utils.toWei("0.00000000000011"),
					{
						from: bridgeManager,
					},
				);
				await newToken.approve(this.bridge.address, amount.toString(), { from: tokenOwner });

				await utils.expectThrow(
					this.bridge.receiveTokensAt(newToken.address, amount.toString(), tokenOwner, Buffer.from(""), { from: tokenOwner }),
				);

				const isKnownToken = await this.bridge.knownTokens(newToken.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await newToken.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens lesser than  min tokens allowed 18 decimals", async function() {
				await this.allowTokens.setFeeAndMinPerToken(
					this.token.address,
					web3.utils.toWei("0.00000000005"),
					web3.utils.toWei("0.00000000005"),
					{ from: bridgeManager },
				);
				let minTokensAllowed = await this.allowTokens.getMinPerToken(this.token.address);
				let amount = minTokensAllowed.sub(new BN(web3.utils.toWei("0.00000000002")));
				await this.token.approve(this.bridge.address, amount.toString(), { from: tokenOwner });

				await utils.expectThrow(
					this.bridge.receiveTokensAt(this.token.address, amount.toString(), tokenOwner, Buffer.from(""), { from: tokenOwner }),
				);

				const isKnownToken = await this.bridge.knownTokens(this.token.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens greater than  min tokens allowed 8 decimals", async function() {
				let newToken = await MainToken.new("MAIN", "MAIN", 8, web3.utils.toWei("1000000000"), { from: tokenOwner });
				let maxTokensAllowed = await this.allowTokens.getMinPerToken(newToken.address);
				let amount = maxTokensAllowed.div(new BN((10 ** 10).toString()).sub(new BN("1")));
				await newToken.approve(this.bridge.address, amount.toString(), { from: tokenOwner });

				await utils.expectThrow(
					this.bridge.receiveTokensAt(newToken.address, amount.toString(), tokenOwner, Buffer.from(""), { from: tokenOwner }),
				);

				const isKnownToken = await this.bridge.knownTokens(newToken.address);
				assert.equal(isKnownToken, false);
				const bridgeBalance = await newToken.balanceOf(this.bridge.address);
				assert.equal(bridgeBalance, 0);
			});

			it("rejects to receive tokens over the daily limit 18 decimals", async function() {
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let dailyLimit = await this.allowTokens.dailyLimit();

				await this.allowTokens.setFeeAndMinPerToken(this.token.address, web3.utils.toWei("0.5"), web3.utils.toWei("0.5"), {
					from: bridgeManager,
				});

				for (let tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await this.token.approve(this.bridge.address, maxTokensAllowed, { from: tokenOwner });
					await this.bridge.receiveTokensAt(this.token.address, maxTokensAllowed, tokenOwner, Buffer.from(""), { from: tokenOwner });
				}
				await utils.expectThrow(
					this.bridge.receiveTokensAt(this.token.address, maxTokensAllowed, tokenOwner, Buffer.from(""), { from: tokenOwner }),
				);
			});

			it("rejects to receive tokens over the daily limit 8 decimals", async function() {
				const newToken = await MainToken.new("MAIN", "MAIN", 8, web3.utils.toWei("1000000000"), { from: tokenOwner });
				this.allowTokens.addAllowedToken(newToken.address, { from: bridgeManager });
				const maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				const amount = BigInt(maxTokensAllowed) / BigInt(10 ** 10);
				const dailyLimit = await this.allowTokens.dailyLimit();
				const decimals = "8";
				const fee = new BN(10 ** parseInt(decimals) * 0.5);

				await this.allowTokens.setFeeAndMinPerToken(newToken.address, fee, fee, { from: bridgeManager });

				for (var tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await newToken.approve(this.bridge.address, amount.toString(), { from: tokenOwner });
					await this.bridge.receiveTokensAt(newToken.address, amount.toString(), tokenOwner, Buffer.from(""), { from: tokenOwner });
				}
				await utils.expectThrow(
					this.bridge.receiveTokensAt(newToken.address, amount.toString(), tokenOwner, Buffer.from(""), { from: tokenOwner }),
				);
			});

			it("clear spent today after 24 hours", async function() {
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let dailyLimit = await this.allowTokens.dailyLimit();
				let maxWidthdraw = await this.bridge.calcMaxWithdraw();
				assert.equal(maxWidthdraw.toString(), maxTokensAllowed.toString());

				const fee = web3.utils.toWei("0.5");

				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });
				for (var tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await this.token.approve(this.bridge.address, maxTokensAllowed, { from: tokenOwner });
					await this.bridge.receiveTokensAt(this.token.address, maxTokensAllowed, tokenOwner, Buffer.from(""), { from: tokenOwner });
				}
				maxWidthdraw = await this.bridge.calcMaxWithdraw();
				assert.equal(maxWidthdraw.toString(), "0");
				await utils.increaseTimestamp(web3, ONE_DAY + 1);
				maxWidthdraw = await this.bridge.calcMaxWithdraw();
				assert.equal(maxWidthdraw.toString(), maxTokensAllowed.toString());
			});

			it("clear spent today and successfully receives tokens", async function() {
				const amount = web3.utils.toWei("1000");
				let maxTokensAllowed = await this.allowTokens.getMaxTokensAllowed();
				let dailyLimit = await this.allowTokens.dailyLimit();
				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });

				for (let tokensSent = 0; tokensSent < dailyLimit; tokensSent = BigInt(maxTokensAllowed) + BigInt(tokensSent)) {
					await this.token.approve(this.bridge.address, maxTokensAllowed, { from: tokenOwner });
					await this.bridge.receiveTokensAt(this.token.address, maxTokensAllowed, tokenOwner, Buffer.from(""), { from: tokenOwner });
				}
				await utils.increaseTimestamp(web3, ONE_DAY + 1);

				await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				let receipt = await this.bridge.receiveTokensAt(this.token.address, amount, tokenOwner, Buffer.from(""), { from: tokenOwner });
				utils.checkRcpt(receipt);
			});

			it("should generate cross event with extra data", async function() {
				const extraData = "Extra data";
				const amount = web3.utils.toWei("1000");

				let receipt = await this.token.approve(this.bridge.address, amount, { from: tokenOwner });
				utils.checkRcpt(receipt);

				const fee = web3.utils.toWei("0.5");
				await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });

				receipt = await this.bridge.receiveTokensAt(this.token.address, amount, tokenOwner, Buffer.from(extraData), { from: tokenOwner });
				const result = utils.hexaToString(receipt.logs[0].args[4]);

				assert.equal(receipt.logs[0].event, "Cross");
				assert.equal(result, extraData);
			});
		});
	});

	describe("Mirror Side", async function() {
		beforeEach(async function() {
			this.mirrorAllowTokens = await AllowTokens.new(bridgeManager);
			this.mirrorSideTokenFactory = await SideTokenFactory.new();
			const proxy = await this.project.createProxy(Bridge, {
				initMethod: "initialize",
				initArgs: [bridgeManager, federation, this.mirrorAllowTokens.address, this.mirrorSideTokenFactory.address, "r"],
			});
			await this.project.upgradeProxy(proxy.address, Bridge);
			this.mirrorBridge = await BridgeArtifact.at(proxy.address);
			await this.mirrorSideTokenFactory.transferPrimary(this.mirrorBridge.address);
			this.amount = web3.utils.toWei("1000");
			this.decimals = (await this.token.decimals()).toString();
			this.granularity = 1;
			await this.token.approve(this.bridge.address, this.amount, { from: tokenOwner });
			const fee = web3.utils.toWei("0.5");
			this.fee = fee;
			await this.allowTokens.setFeeAndMinPerToken(this.token.address, fee, fee, { from: bridgeManager });
			this.txReceipt = await this.bridge.receiveTokens(this.token.address, this.amount, { from: tokenOwner });
		});
		it("should retrieve the version", async function() {
			const result = await this.mirrorBridge.version();
			assert.equal(result, "v0");
		});
		describe("Cross the tokens", async function() {
			//Here we are asuming that federation is a user address .
			it("accept transfer first time for the token", async function() {
				let receipt = await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					this.granularity,
					Buffer.from(""),
					{ from: federation },
				);
				utils.checkRcpt(receipt);
				let sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);
				let sideToken = await SideToken.at(sideTokenAddress);
				const sideTokenSymbol = await sideToken.symbol();
				assert.equal(sideTokenSymbol, "rMAIN");
				//If we set suffix
				// assert.equal(sideTokenSymbol, "MAINr");
				let originalTokenAddress = await this.mirrorBridge.originalTokens(sideTokenAddress);
				assert.equal(originalTokenAddress, this.token.address);
				const mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
				assert.equal(mirrorBridgeBalance, 0);
				const mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
				assert.equal(mirrorAnAccountBalance, this.amount);
			});
			it("accept transfer second time for the token if fedration get hacked(taking random blockhash and tx hash)", async function() {
				await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					this.granularity,
					Buffer.from(""),
					{ from: federation },
				);
				let receipt = await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					randomHex(32),
					randomHex(32),
					1,
					this.decimals,
					this.granularity,
					Buffer.from(""),
					{ from: federation },
				);
				utils.checkRcpt(receipt);
				let sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);
				let sideToken = await SideToken.at(sideTokenAddress);
				const sideTokenSymbol = await sideToken.symbol();
				assert.equal(sideTokenSymbol, "rMAIN");
				// assert.equal(sideTokenSymbol, "MAINr");
				let originalTokenAddress = await this.mirrorBridge.originalTokens(sideTokenAddress);
				assert.equal(originalTokenAddress, this.token.address);
				const mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
				assert.equal(mirrorBridgeBalance, 0);
				const mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
				assert.equal(mirrorAnAccountBalance, this.amount * 2);
			});
			it("Call receiver onTokenMinted if the receiver is a contract", async function() {
				const tokenReceiver = await TokenReceiver.new();
				const receiver = tokenReceiver.address;
				const converterReceiver = Buffer.from("Converter Receiver");
				const result = await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					receiver,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					this.granularity,
					converterReceiver,
					{ from: federation },
				);
				utils.checkRcpt(result);
				const eventSignature = web3.eth.abi.encodeEventSignature("onTokenMintedCall(uint256,address,bytes)");
				//How event is logged
				//1 and 2 log are setting erc1820 interface(erc20 and erc777)
				//3 is SideTokenCreated
				//4 is NewSideToken
				//5 is Minted (when calling sidetoken.mint())
				//6 is Transfer
				//7 is onTokenMintedCall
				//8 is AcceptedCrossTransfer
				assert.equal(result.receipt.rawLogs[7].topics[0], eventSignature);
			});
			it("accept transfer with decimals other than 18", async function() {
				let decimals = 6;
				let tokenWithDecimals = await MainToken.new("MAIN", "MAIN", decimals, web3.utils.toWei("1000000000"), { from: tokenOwner });
				await this.allowTokens.addAllowedToken(tokenWithDecimals.address, { from: bridgeManager });
				let receipt = await this.mirrorBridge.acceptTransferAt(
					tokenWithDecimals.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					decimals,
					1,
					Buffer.from(""),
					{ from: federation },
				);
				utils.checkRcpt(receipt);
				let sideTokenAddress = await this.mirrorBridge.mappedTokens(tokenWithDecimals.address);
				let sideToken = await SideToken.at(sideTokenAddress);
				const sideTokenSymbol = await sideToken.symbol();
				assert.equal(sideTokenSymbol, "rMAIN");
				// assert.equal(sideTokenSymbol, "MAINr");
				let originalTokenAddress = await this.mirrorBridge.originalTokens(sideTokenAddress);
				assert.equal(originalTokenAddress, tokenWithDecimals.address);
				const mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
				assert.equal(mirrorBridgeBalance, 0);
				const mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
				let expectedAmount = new BN(this.amount.toString());
				expectedAmount = expectedAmount.mul(new BN(10).pow(new BN(18 - decimals)));
				assert.equal(mirrorAnAccountBalance.toString(), expectedAmount.toString());
			});
			it("fail accept transfer with decimals bigger than 18", async function() {
				let decimals = 19;
				let tokenWithDecimals = await MainToken.new("MAIN", "MAIN", decimals, web3.utils.toWei("1000000000"), { from: tokenOwner });
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						tokenWithDecimals.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						decimals,
						1,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("fail accept transfer with receiver empty address", async function() {
				let decimals = 18;
				let tokenWithDecimals = await MainToken.new("MAIN", "MAIN", decimals, web3.utils.toWei("1000000000"), { from: tokenOwner });
				await this.allowTokens.addAllowedToken(tokenWithDecimals.address, { from: bridgeManager });
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						tokenWithDecimals.address,
						utils.NULL_ADDRESS,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						decimals,
						1,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("accept transfer first time from ERC777 with granularity", async function() {
				const granularity = "100";
				let tokenWithGranularity = await SideToken.new("MAIN", "MAIN", tokenOwner, granularity, { from: tokenOwner });
				tokenWithGranularity.mint(tokenOwner, this.amount, "0x", "0x", { from: tokenOwner });
				await this.allowTokens.addAllowedToken(tokenWithGranularity.address, { from: bridgeManager });
				let receipt = await this.mirrorBridge.acceptTransferAt(
					tokenWithGranularity.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					granularity,
					Buffer.from(""),
					{ from: federation },
				);
				utils.checkRcpt(receipt);
				let sideTokenAddress = await this.mirrorBridge.mappedTokens(tokenWithGranularity.address);
				let sideToken = await SideToken.at(sideTokenAddress);
				const sideTokenSymbol = await sideToken.symbol();
				assert.equal(sideTokenSymbol, "rMAIN");
				// assert.equal(sideTokenSymbol, "MAINr");
				const sideTokenGranularity = await sideToken.granularity();
				assert.equal(sideTokenGranularity.toString(), granularity);
				let originalTokenAddress = await this.mirrorBridge.originalTokens(sideTokenAddress);
				assert.equal(originalTokenAddress, tokenWithGranularity.address);
				const mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
				assert.equal(mirrorBridgeBalance, 0);
				const mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
				assert.equal(mirrorAnAccountBalance.toString(), this.amount.toString());
			});
			it("accept transfer second time from ERC777 with granularity if federator get hacked by using random tx hash and block hash", async function() {
				const granularity = "100";
				let tokenWithGranularity = await SideToken.new("MAIN", "MAIN", tokenOwner, granularity, { from: tokenOwner });
				tokenWithGranularity.mint(tokenOwner, new BN(this.amount).mul(new BN("2")).toString(), "0x", "0x", { from: tokenOwner });
				await this.mirrorBridge.acceptTransferAt(
					tokenWithGranularity.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					granularity,
					Buffer.from(""),
					{ from: federation },
				);
				let receipt = await this.mirrorBridge.acceptTransferAt(
					tokenWithGranularity.address,
					anAccount,
					this.amount,
					"MAIN",
					randomHex(32),
					randomHex(32),
					1,
					this.decimals,
					granularity,
					Buffer.from(""),
					{ from: federation },
				);
				utils.checkRcpt(receipt);
				let sideTokenAddress = await this.mirrorBridge.mappedTokens(tokenWithGranularity.address);
				let sideToken = await SideToken.at(sideTokenAddress);
				const sideTokenSymbol = await sideToken.symbol();
				assert.equal(sideTokenSymbol, "rMAIN");
				// assert.equal(sideTokenSymbol, "MAINr");
				const sideTokenGranularity = await sideToken.granularity();
				assert.equal(sideTokenGranularity.toString(), granularity);
				let originalTokenAddress = await this.mirrorBridge.originalTokens(sideTokenAddress);
				assert.equal(originalTokenAddress, tokenWithGranularity.address);
				const mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
				assert.equal(mirrorBridgeBalance, 0);
				const mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
				assert.equal(mirrorAnAccountBalance.toString(), new BN(this.amount).mul(new BN("2")).toString());
			});
			it("accept transfer from ERC777 with granularity not power of 10", async function() {
				const granularity = "20";
				let tokenWithGranularity = await SideToken.new("MAIN", "MAIN", tokenOwner, "1", { from: tokenOwner });
				tokenWithGranularity.mint(tokenOwner, this.amount, "0x", "0x", { from: tokenOwner });
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						tokenWithGranularity.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("accept transfer from ERC777 with granularity bigger than  10^18", async function() {
				const granularity = "10000000000000000000";
				let tokenWithGranularity = await SideToken.new("MAIN", "MAIN", tokenOwner, "1", { from: tokenOwner });
				tokenWithGranularity.mint(tokenOwner, this.amount, "0x", "0x", { from: tokenOwner });
				await this.allowTokens.addAllowedToken(tokenWithGranularity.address, { from: bridgeManager });
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						tokenWithGranularity.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("accept transfer from ERC777 with granularity less than 1", async function() {
				const granularity = "0";
				let tokenWithGranularity = await SideToken.new("MAIN", "MAIN", tokenOwner, "1", { from: tokenOwner });
				tokenWithGranularity.mint(tokenOwner, this.amount, "0x", "0x", { from: tokenOwner });
				await this.allowTokens.addAllowedToken(tokenWithGranularity.address, { from: bridgeManager });
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						tokenWithGranularity.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("accept transfer only federation", async function() {
				await utils.expectThrow(
					this.bridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: bridgeOwner },
					),
				);
				const anAccountBalance = await this.token.balanceOf(anAccount);
				assert.equal(anAccountBalance, 0);
				const newBridgeBalance = await this.token.balanceOf(this.bridge.address);
				assert.equal(newBridgeBalance.toString(), new BN(this.amount).sub(new BN(this.fee)).toString());
				let sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);
				assert.equal(sideTokenAddress, 0);
			});
			it("dont accept transfer the same transaction", async function() {
				await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					this.granularity,
					Buffer.from(""),
					{ from: federation },
				);
				const sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);
				const sideToken = await SideToken.at(sideTokenAddress);
				let mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
				assert.equal(mirrorAnAccountBalance, this.amount);
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail null token address", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						"0x",
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail null amount address", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						0,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail null symbol", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail null blockhash", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"MAIN",
						"0x",
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail null transaction hash", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						"0x",
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail invalid decimals", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						"19",
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail granularity 0", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						new BN("0"),
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should fail more than max granularity", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amount,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						new BN("10000000000000000000"),
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("should overflow granularity multiplication", async function() {
				await utils.expectThrow(
					this.mirrorBridge.acceptTransferAt(
						this.token.address,
						anAccount,
						web3.utils.toWei("100000000000000000000000000000000000000000000000000"),
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						0,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					),
				);
			});
			it("crossback with amount lower than granularity and burining of sidetokens", async function() {
				const granularity = "10000000000000000";
				const decimals = 18;
				await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					decimals,
					granularity,
					Buffer.from(""),
					{ from: federation },
				);
				const amountToCrossBack = new BN(web3.utils.toWei("1"));
				const payment = new BN("33");
				const sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);
				const sideToken = await SideToken.at(sideTokenAddress);
				const originalTokenBalance = await sideToken.balanceOf(anAccount);
				await this.mirrorAllowTokens.setFeeAndMinPerToken(sideTokenAddress, payment, payment, { from: bridgeManager });
				await sideToken.approve(this.mirrorBridge.address, amountToCrossBack, { from: anAccount });
				let receipt = await this.mirrorBridge.receiveTokens(sideToken.address, amountToCrossBack, { from: anAccount });
				utils.checkRcpt(receipt);
				const tokenBalance = await sideToken.balanceOf(anAccount);
				assert.equal(tokenBalance.toString(), originalTokenBalance.sub(amountToCrossBack));
				const bridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
				assert.equal(bridgeBalance.toString(), "0");
			});
			it("accept transfer with extra data", async function() {
				const extraData = "Extra data";
				let receipt = await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					this.granularity,
					Buffer.from(extraData),
					{ from: federation },
				);
				utils.checkRcpt(receipt);
				assert.equal(receipt.logs[1].event, "AcceptedCrossTransfer");
				const result = utils.hexaToString(receipt.logs[1].args[8]);
				assert.equal(result, extraData);
			});
		it("revoke transaction processed from true to false", async function() {
			//// Try and fail to process same tx twice.
			await this.mirrorBridge.acceptTransferAt(
				this.token.address,
				anAccount,
				this.amount,
				"MAIN",
				this.txReceipt.receipt.blockHash,
				this.txReceipt.tx,
				this.txReceipt.receipt.logs[0].logIndex,
				this.decimals,
				this.granularity,
				Buffer.from(""),
				{ from: federation },
			);
			let transactionId = await this.mirrorBridge.getTransactionId(
				this.txReceipt.receipt.blockHash,
				this.txReceipt.tx,
				anAccount,
				this.amount,
				this.txReceipt.receipt.logs[0].logIndex,
			);

			const sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);
			const sideToken = await SideToken.at(sideTokenAddress);

			let mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
			assert.equal(mirrorAnAccountBalance, this.amount);

			await utils.expectThrow(
				this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					this.granularity,
					Buffer.from(""),
					{ from: federation },
				),
			);

			await this.mirrorBridge.setRevokeTransaction(transactionId, { from: bridgeManager });

			await this.mirrorBridge.acceptTransferAt(
				this.token.address,
				anAccount,
				this.amount,
				"MAIN",
				this.txReceipt.receipt.blockHash,
				this.txReceipt.tx,
				this.txReceipt.receipt.logs[0].logIndex,
				this.decimals,
				this.granularity,
				Buffer.from(""),
				{ from: federation },
			);

			mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
			assert.equal(mirrorAnAccountBalance, 2 * this.amount);
		});
	});
		describe("Cross back the tokens", async function() {
			beforeEach(async function() {
				await this.mirrorBridge.acceptTransferAt(
					this.token.address,
					anAccount,
					this.amount,
					"MAIN",
					this.txReceipt.receipt.blockHash,
					this.txReceipt.tx,
					this.txReceipt.receipt.logs[0].logIndex,
					this.decimals,
					this.granularity,
					Buffer.from(""),
					{ from: federation },
				);
				this.amountToCrossBack = web3.utils.toWei("100");
				this.decimals = (await this.token.decimals()).toString();
				this.granularity = 1;
				this.fee = web3.utils.toWei("0.5");
			});

			describe("Should burn the side tokens when transfered to the bridge", function() {
				it("using IERC20 approve and transferFrom", async function() {
					let sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);

					let sideToken = await SideToken.at(sideTokenAddress);
					let mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
					assert.equal(mirrorAnAccountBalance.toString(), this.amount.toString());
					let receipt = await sideToken.approve(this.mirrorBridge.address, this.amountToCrossBack, { from: anAccount });
					utils.checkRcpt(receipt);

					await this.mirrorAllowTokens.setFeeAndMinPerToken(sideTokenAddress, this.fee, this.fee, { from: bridgeManager });

					//Transfer the Side tokens to the bridge, the bridge burns them and creates an event

					receipt = await this.mirrorBridge.receiveTokens(sideTokenAddress, this.amountToCrossBack, { from: anAccount });
					utils.checkRcpt(receipt);

					mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
					assert.equal(mirrorAnAccountBalance.toString(), new BN(this.amount).sub(new BN(this.amountToCrossBack)).toString());

					let mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
					assert.equal(mirrorBridgeBalance.toString(), "0");
				});

				it("using ERC777 tokensReceived", async function() {
					let sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);

					let sideToken = await SideToken.at(sideTokenAddress);
					let mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
					assert.equal(mirrorAnAccountBalance.toString(), this.amount.toString());

					await this.mirrorAllowTokens.setFeeAndMinPerToken(sideToken.address, this.amountToCrossBack, this.amountToCrossBack, {
						from: bridgeManager,
					});
					//Transfer the Side tokens to the bridge, the bridge burns them and creates an event
					let receipt = await sideToken.send(this.mirrorBridge.address, this.amountToCrossBack, "0x", { from: anAccount });
					utils.checkRcpt(receipt);

					mirrorAnAccountBalance = await sideToken.balanceOf(anAccount);
					assert.equal(mirrorAnAccountBalance.toString(), new BN(this.amount).sub(new BN(this.amountToCrossBack)).toString());

					let mirrorBridgeBalance = await sideToken.balanceOf(this.mirrorBridge.address);
					assert.equal(mirrorBridgeBalance.toString(), "0");
				});
			});

			describe("After the mirror Bridge burned the tokens", function() {
				beforeEach(async function() {
					this.sideTokenAddress = await this.mirrorBridge.mappedTokens(this.token.address);

					this.sideToken = await SideToken.at(this.sideTokenAddress);

					//Transfer the Side tokens to the bridge, the bridge burns them and creates an event
					await this.sideToken.approve(this.mirrorBridge.address, this.amountToCrossBack, { from: anAccount });
					const fee = web3.utils.toWei("0.5");
					this.fee = fee;
					await this.mirrorAllowTokens.setFeeAndMinPerToken(this.sideTokenAddress, fee, fee, { from: bridgeManager });
					await this.mirrorBridge.receiveTokens(this.sideTokenAddress, this.amountToCrossBack, { from: anAccount });
				});

				it("main Bridge should release the tokens", async function() {
					let tx = await this.bridge.acceptTransferAt(
						this.token.address,
						anAccount,
						this.amountToCrossBack,
						"MAIN",
						this.txReceipt.receipt.blockHash,
						this.txReceipt.tx,
						this.txReceipt.receipt.logs[0].logIndex,
						this.decimals,
						this.granularity,
						Buffer.from(""),
						{ from: federation },
					);
					utils.checkRcpt(tx);

					let bridgeBalance = await this.token.balanceOf(this.bridge.address);
					const temp = new BN(this.amount).sub(new BN(this.amountToCrossBack));
					assert.equal(bridgeBalance.toString(), temp.sub(new BN(this.fee)).toString());

					let anAccountBalance = await this.token.balanceOf(anAccount);
					assert.equal(anAccountBalance.toString(), this.amountToCrossBack);
				});
			});
		});
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
				"r",
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
					this.granularity,
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
					this.granularity,
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
					{ from: federation },
				),
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
