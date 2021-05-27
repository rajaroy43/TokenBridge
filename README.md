env=$1
// First time or if: "Error on oz deployment" during 7_deploy_bridge_v0.js deployment
then run `truffle comiple --all ` and then execute

1. truffle migrate --reset --network development
2. truffle migrate --reset --network rskregtest

Reason :

Truffle artifacts (the JSON files in build/contracts) contain the AST (abstract syntax tree) for each of your contracts. Our plugin uses this information to validate that your contracts are upgrade safe

# https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#what-does-it-mean-for-a-contract-to-be-upgrade-safe

Truffle sometimes partially recompiles only the contracts that have changed. We will ask you to trigger a full recompilation either using truffle compile --all or deleting the build/contracts directory when this happens. The technical reason is that since Solidity does not produce deterministic ASTs, the plugins are unable to resolve references correctly if they are not from the same compiler run.
