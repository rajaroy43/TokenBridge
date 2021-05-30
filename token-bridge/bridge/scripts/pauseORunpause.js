const MultiSigWallet = artifacts.require("MultiSigWallet");
const Bridge = artifacts.require("Bridge");
module.exports = async (callback) => {
  try {
    const net = process.argv[5];
    console.log("net is:" + net);
    const pauseORUnpause = process.argv[6].toLowerCase();
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
    const bridgeAddress = bridge.address;
    const multiSigAddress = await bridge.contract.methods.owner().call();
    console.log("Multisig Address", multiSigAddress);
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multiSigAddress);
    const isBridgePaused = await bridge.paused();
    if (pauseORUnpause == "pause") {
      if (!isBridgePaused) {
        console.log("Pausing Bridge Contracts");
        const pauseData = bridge.contract.methods.pause().encodeABI();
        const result = await multiSig.methods
          .submitTransaction(bridgeAddress, 0, pauseData)
          .send({ from: deployer, gas: 300000, gasPrice: gasPriceNow });
        console.log("Bridge is now  paused");
        console.log(result);
      } else console.log("Bridge is already paused");
    } else if (pauseORUnpause == "unpause") {
      if (isBridgePaused) {
        console.log("UnPausing Bridge Contracts");
        const UnpauseData = bridge.contract.methods.unpause().encodeABI();
        const result = await multiSig.methods
          .submitTransaction(bridgeAddress, 0, UnpauseData)
          .send({ from: deployer, gas: 300000, gasPrice: gasPriceNow });
        console.log("Bridge is now  Unpaused");
        console.log(result);
      } else console.log("Bridge is already unpaused");
    } else {
      console.log(`You need to paas pause or unpause as argument instead of ${pauseORUnpause}`);
    }
  } catch (e) {
    callback(e);
  }
  callback();
};
