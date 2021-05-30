const MultiSigWallet = artifacts.require("MultiSigWallet");
const Bridge = artifacts.require("Bridge");

module.exports = async (callback) => {
  try {
    const receiverAddress = process.argv[6];
    if (!receiverAddress) console.error("You need to pass the token address");

    const net = process.argv[5];
    console.log("net is:" + net);

    const gasPrice = await web3.eth.getGasPrice();
    console.log("gas price is: " + gasPrice);
    let gasPriceNow = gasPrice;
    if (net == "mainnet") {
      gasPriceNow = Number.parseInt(gasPrice * 1.5);
    }
    console.log("gas price now is: " + gasPriceNow);

    const deployer = (await web3.eth.getAccounts())[0];
    //const deployer = (await web3.eth.getAccounts())[3];
    console.log("deployer is " + deployer);

    const bridge = await Bridge.deployed();

    const multiSigAddress = await bridge.contract.methods.owner().call();
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multiSigAddress);
    const withdrawFees = parseInt((await bridge.ethFeeCollected()).toString());
    if (withdrawFees > 0) {
      console.log(`Transferring ${withdrawFees} Wei to ${receiverAddress}`);
      const withdrawFeesToReceiverData = bridge.contract.methods.withdrawAllEthFees(receiverAddress).encodeABI();
      const result = await multiSig.methods
        .submitTransaction(bridge.address, 0, withdrawFeesToReceiverData)
        .send({ from: deployer, gasPrice: gasPriceNow, gas: 6300000 });
      console.log(result);
    } else console.log("Bridge Proxy have 0 fee collected");
  } catch (e) {
    callback(e);
  }
  callback();
};
