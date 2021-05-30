const MultiSigWallet = artifacts.require("MultiSigWallet");
const Bridge = artifacts.require("Bridge");

module.exports = async (callback) => {
  try {
    const WETHAddress = process.argv[6];
    if (!WETHAddress) console.error("You need to pass WETHAddress");

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

    const deployer = (await web3.eth.getAccounts())[0];

    console.log(`Set WETHAddress ${WETHAddress} by deployer ${deployer}`);
    const bridgeAddress = bridge.address;
    console.log("Bridge address", bridgeAddress);
    const WETHAddressData = bridge.contract.methods.setWETHAddress(WETHAddress).encodeABI();

    const multisigAddress = await bridge.contract.methods.owner().call();
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multisigAddress);
    console.log("MultiSig address", multisigAddress);
    const result = await multiSig.methods
      .submitTransaction(bridgeAddress, 0, WETHAddressData)
      .send({ from: deployer, gasPrice: gasPriceNow, gas: 5000000 });

    console.log("WETHAddress was updated");
    console.log(result);
  } catch (e) {
    console.error(e);
    callback(e);
  }
  callback();
};
