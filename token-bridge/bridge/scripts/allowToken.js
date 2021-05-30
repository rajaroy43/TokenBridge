const AllowTokens = artifacts.require("AllowTokens");
const MultiSigWallet = artifacts.require("MultiSigWallet");
const Bridge = artifacts.require("Bridge");

module.exports = async (callback) => {
  try {
    const tokenToAllow = process.argv[6];
    if (!tokenToAllow) console.error("You need to pass the token address");
    console.log(`You will allow the token ${tokenToAllow}`);

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
    const allowTokensAddress = await bridge.allowTokens();

    const allowTokens = await AllowTokens.at(allowTokensAddress);
    console.log(`Configuring AllowTokens contract ${allowTokens.address}`);

    const multiSigAddress = await allowTokens.contract.methods.owner().call();
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multiSigAddress);

    const addAllowTokenData = allowTokens.contract.methods.addAllowedToken(tokenToAllow).encodeABI();
    console.log("Allowing token");
    const result = await multiSig.methods
      .submitTransaction(allowTokens.address, 0, addAllowTokenData)
      .send({ from: deployer, gasPrice: gasPriceNow, gas: 6300000 });
    console.log(result);
  } catch (e) {
    callback(e);
  }
  callback();
};
