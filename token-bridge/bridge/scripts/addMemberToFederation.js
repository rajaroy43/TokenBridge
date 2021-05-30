const Federation = artifacts.require("Federation");
const MultiSigWallet = artifacts.require("MultiSigWallet");

module.exports = async (callback) => {
  try {
    const newMemberAddress = process.argv[6];
    if (!newMemberAddress) console.error("You need to pass new member address");
    console.log(`The address ${newMemberAddress} will be added to federation`);

    const net = process.argv[5];
    console.log("net is:" + net);

    const gasPrice = await web3.eth.getGasPrice();
    console.log("gas price is: " + gasPrice);
    let gasPriceNow = gasPrice;
    if (net == "mainnet") {
      gasPriceNow = Number.parseInt(gasPrice * 1.5);
    }
    console.log("gas price now is: " + gasPriceNow);

    //const deployer = (await web3.eth.getAccounts())[3];
    const deployer = (await web3.eth.getAccounts())[0];
    console.log("deployer is " + deployer);

    const federation = await Federation.deployed();
    console.log(`Federation address: ${federation.address}`);
    const multiSigAddress = await federation.contract.methods.owner().call();
    const multiSig = new web3.eth.Contract(MultiSigWallet.abi, multiSigAddress);
    console.log("Adding new member to federation");
    const addMemberData = federation.contract.methods.addMember(newMemberAddress).encodeABI();
    console.log(addMemberData);
    const result = await multiSig.methods
      .submitTransaction(federation.address, 0, addMemberData)
      .send({ from: deployer, gas: 300000, gasPrice: gasPriceNow });
    console.log(result);
    if (result.events.Execution) console.log("New member added");
    else if (result.events.ExecutionFailure) console.log("Tx execution failed");
    else console.log("Transaction submitted needed more confirmation to this transaction");
  } catch (e) {
    callback(e);
  }
  callback();
};
