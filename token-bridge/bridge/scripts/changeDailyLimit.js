const AllowTokens = artifacts.require("AllowTokens");
const MultiSigWallet = artifacts.require("MultiSigWallet");
const Bridge = artifacts.require("Bridge");

module.exports = async (callback) => {
  try {
    const dailyLimit = process.argv[6];
    if (!dailyLimit) {
      console.error("You need to pass the dailyLimit of the bridge");
      callback();
      return;
    }
    //const dailyLimit = Number.parseInt(dailyLimit);
    const net = process.argv[5];
    console.log("net is:" + net);

    const gasPrice = await web3.eth.getGasPrice();
    console.log("gas price is: " + gasPrice);
    let gasPriceNow = gasPrice;
    if (net == "mainnet") {
      gasPriceNow = Number.parseInt(gasPrice * 1.5);
    }
    console.log("gas price now is: " + gasPriceNow);

    const dailyLimitWei = web3.utils.toWei(dailyLimit);

    const deployer = (await web3.eth.getAccounts())[0];
    //const deployer = (await web3.eth.getAccounts())[3];
    console.log("deployer is " + deployer);

    const bridge = await Bridge.deployed();
    const allowTokensAddress = await bridge.allowTokens();
    const allowTokens = await AllowTokens.at(allowTokensAddress);
    console.log(`Configuring AllowTokens contract ${allowTokens.address}`);

    const multiSigAddress = await allowTokens.contract.methods.owner().call();
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multiSigAddress);

    const changeDailyLimitData = allowTokens.contract.methods.changeDailyLimit(dailyLimitWei).encodeABI();

    console.log(`Setting dailyLimit tokens allowed in ${dailyLimitWei}`);

    const result = await multiSig.methods
      .submitTransaction(allowTokens.address, 0, changeDailyLimitData)
      .send({ from: deployer, gasPrice: gasPriceNow });
    console.log(result);
  } catch (e) {
    console.error(e);
    callback(e);
  }
  callback();
};
