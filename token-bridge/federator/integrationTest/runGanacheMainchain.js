const { execSync } = require("child_process");
const { networks } = require("../../bridge/truffle-config");

const rskConfig = networks.development2;
execSync(
  `npx ganache-cli \
        -p ${rskConfig.port} \
        -i ${rskConfig.network_id} \
        --chainId ${rskConfig.network_id} \
        -g ${rskConfig.gasPrice} \
        -l ${rskConfig.gas} \
        -b 0.1`,
  { stdio: "inherit" }
);
