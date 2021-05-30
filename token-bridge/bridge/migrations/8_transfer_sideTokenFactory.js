const Bridge = artifacts.require("Bridge");
const SideTokenFactory = artifacts.require("SideTokenFactory");

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    const sideTokenFactory = await SideTokenFactory.deployed();
    const bridge = await Bridge.deployed();
    console.log("Bridge Address", bridge.address);
    await sideTokenFactory.transferPrimary(bridge.address);
  });
};
