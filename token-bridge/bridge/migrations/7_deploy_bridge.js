const { scripts, ConfigManager } = require("@openzeppelin/cli");
const MultiSigWallet = artifacts.require("MultiSigWallet");
const Federation = artifacts.require("Federation");
const AllowTokens = artifacts.require("AllowTokens");
const SideTokenFactory = artifacts.require("SideTokenFactory");
const Bridge = artifacts.require("Bridge");

//example https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/examples/truffle-migrate/migrations
async function ozDeploy(options, name, alias, initArgs) {
  try {
    // Register v0 of MyContract in the zos project
    scripts.add({ contractsData: [{ name: name, alias: alias }] });
    console.log("oz add done");
    // Push implementation contracts to the network
    await scripts.push(options);
    console.log("oz push done");

    // Create an instance of MyContract, setting initial values
    await scripts.create(Object.assign({ contractAlias: alias, methodName: "initialize", methodArgs: initArgs }, options));
    console.log("oz create done");
  } catch (err) {
    throw new Error(`Error on oz deployment ${err.stack}`);
  }
}

module.exports = function(deployer, networkName, accounts) {
  let symbol = "e";

  if (networkName == "btestnet" || networkName == "bmainnet") symbol = "b";

  if (networkName == "development2" || networkName == "ethtestnet" || networkName == "rthmainnet") symbol = "bs";

  deployer.then(async () => {
    const multiSig = await MultiSigWallet.deployed();
    const allowTokens = await AllowTokens.deployed();
    const sideTokenFactory = await SideTokenFactory.deployed();
    const federation = await Federation.deployed();
    const { network, txParams } = await ConfigManager.initNetworkConfiguration({ network: networkName, from: accounts[0] });
    console.log(networkName);
    console.log(network);
    let initArgs = [multiSig.address, federation.address, allowTokens.address, sideTokenFactory.address, symbol];
    console.log(initArgs);
    if (networkName === "soliditycoverage") {
      //soldity coverage doesn't play along with oppen zeppelin sdk
      //so we deploy the un initialized contract just to create the objects
      return deployer.deploy(Bridge);
    }

    try {
      //running truffle test re runs migrations and OZ exploits if aleready upgraded the contract, check if we already have run a migration
      await Bridge.deployed();
    } catch (err) {
      //If we haven't deployed it then re deploy.
      await ozDeploy({ network, txParams }, "Bridge", "Bridge", initArgs);

      //Set the multisig as the Owner of the ProxyAdmin
      await scripts.setAdmin({ newAdmin: multiSig.address, network: network, txParams: txParams });
    }
  });
};
