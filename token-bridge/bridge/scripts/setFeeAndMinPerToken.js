const AllowTokens = artifacts.require("AllowTokens");
const MultiSigWallet = artifacts.require("MultiSigWallet");
const Bridge = artifacts.require("Bridge_v0");
const Bridge_v1 = artifacts.require("Bridge");

module.exports = async (callback) => {
  try {
    const tokenAddress = process.argv[6];
    const _feeConst = process.argv[7];
    const _minAmount = process.argv[8];
    if (!_minAmount && !tokenAddress && !_feeConst) {
      console.error("You need to pass token address feeconst and minAmount");
      callback();
      return;
    }
    //const maximumTokenAmount = Number.parseInt(maxTokenAmount);
    const net = process.argv[5];
    console.log("net is:" + net);

    const gasPrice = await web3.eth.getGasPrice();
    console.log("gas price is: " + gasPrice);
    let gasPriceNow = gasPrice;
    if (net == "mainnet") {
      gasPriceNow = Number.parseInt(gasPrice * 1.5);
    }
    console.log("gas price now is: " + gasPriceNow);

    const minAmount = web3.utils.toWei(_minAmount);
    const feeConst = web3.utils.toWei(_feeConst);
    const deployer = (await web3.eth.getAccounts())[0];
    //const deployer = (await web3.eth.getAccounts())[3];
    console.log("deployer is " + deployer);

    const bridge_v0 = await Bridge.deployed();
    const bridgeAddress = bridge_v0.address;
    const bridge_v1 = new web3.eth.Contract(Bridge_v1.abi, bridgeAddress);

    const allowTokensAddress = await bridge_v1.methods.allowTokens().call();
    const allowTokens = await AllowTokens.at(allowTokensAddress);
    console.log(`Configuring AllowTokens contract ${allowTokens.address}`);

    const multiSigAddress = await allowTokens.contract.methods.owner().call();
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multiSigAddress);

    const setFeeAndMinPerToken = allowTokens.contract.methods.setFeeAndMinPerToken(tokenAddress, feeConst, minAmount).encodeABI();
    console.log(setFeeAndMinPerToken);
    console.log(`Setting  Fee ${feeConst} for Address   ${tokenAddress}`);
    console.log(`Setting Min Amount  ${minAmount} Per Token   ${tokenAddress} `);

    const result = await multiSig.methods
      .submitTransaction(allowTokens.address, 0, setFeeAndMinPerToken)
      .send({ from: deployer, gasPrice: gasPriceNow, gas: 6300000 });
    console.log(result);
  } catch (e) {
    console.error(e);
    callback(e);
  }
  callback();
};
