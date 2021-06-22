const MultiSigWallet = artifacts.require("MultiSigWallet");
const Bridge = artifacts.require("Bridge");

module.exports = async (callback) => {
  try {
    const nativeSymbol = process.argv[6];
    if (!nativeSymbol) console.error("You need to pass nativeSymbol");

    const net = process.argv[5];
    console.log("net is:" + net);

    const gasPrice = await web3.eth.getGasPrice();
    console.log("gas price is: " + gasPrice);
    let gasPriceNow = gasPrice;
    if (net == "mainnet") {
      gasPriceNow = Number.parseInt(gasPrice * 1.5);
    }

    console.log("gas price now is: " + gasPriceNow);
    const bridge = await Bridge.deployed();
    const bridgeAddress = bridge.address;

    const deployer = (await web3.eth.getAccounts())[0];

    console.log(`Set nativeSymbol ${nativeSymbol} by deployer ${deployer}`);

    console.log("Bridge address", bridgeAddress);
    const nativeSymbolData = bridge.contract.methods.setNativeTokenSymbol(nativeSymbol).encodeABI();

    const multisigAddress = await bridge.owner();
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multisigAddress);
    console.log("MultiSig address", multisigAddress);
    const result = await multiSig.methods
      .submitTransaction(bridge.address, 0, nativeSymbolData)
      .send({ from: deployer, gasPrice: gasPriceNow });

    console.log("nativeSymbol updated");
    console.log(result);
  } catch (e) {
    console.error(e);
    callback(e);
  }
  callback();
};
