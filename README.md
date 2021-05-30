Make sure are in `./token-bridge/bride` directory

For Checking all contract size run - `node .\calculateSize.js`

First time or if: "Error on oz deployment" during 7_deploy_bridge.js deployment
then run `truffle comiple --all ` and then execute

1. `truffle migrate --reset --network development`
2. `truffle migrate --reset --network development2`

Reason :

Truffle artifacts (the JSON files in build/contracts) contain the AST (abstract syntax tree) for each of your contracts. Our plugin uses this information to validate that your contracts are upgrade safe

## https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#what-does-it-mean-for-a-contract-to-be-upgrade-safe

Truffle sometimes partially recompiles only the contracts that have changed. We will ask you to trigger a full recompilation either using truffle compile --all or deleting the build/contracts directory when this happens. The technical reason is that since Solidity does not produce deterministic ASTs, the plugins are unable to resolve references correctly if they are not from the same compiler run.

`Transferring Funds Through the bridge -`

1.  Setting WEth for transferring eth through the bridge - :
    NETWORK_NAME =Network where your contract is deploying/deployed and you are interacting to deployed contract

            a. Deploy WETH token - ` truffle exec .\scripts\deployWETHToken.js --network NETWORK_NAME `
            b. Set Weth token in bridge - `truffle exec .\scripts\setWETHAddress.js --network NETWORK_NAME   WETH_TOKEN_ADDRESS ` .
            c. Allowing WETH token for moving through the bridge - ` truffle exec .\scripts\allowToken.js --network NETWORK_NAME  WETH_TOKEN_ADDRESS  `
            d. Setting Fee and minimum allowed per token - ` truffle exec .\scripts\setFeeAndMinPerToken.js  --network  NETWORK_NAME  WETH_TOKEN_ADDRESS  FEE(in eth)  minAmount (in eth) `

2.  Setting TestTokens for transferring tokens through the bridge :

            a. truffle exec .\scripts\test\deploySovrynTestTokens.js --network  NETWORK_NAME
            b.Allowing test token for moving through the bridge - truffle exec .\scripts\allowToken.js --network
               NETWORK_NAME  Test_Token_Address
            c. Setting Fee and minimum allowed per token -  truffle exec .\scripts\setFeeAndMinPerToken.js  --network  NETWORK_NAME  Test_Token_Address  FEE(in eth)  minAmount (in eth) `

3.  Withdrawing fee to specific User :

            truffle exec .\scripts\withDrawFees.js --network NETWORK_NAME RECEIVER_ADDRESS

4.  Pausing/Unpausing Bridge functionality :

            a) For pausing : truffle exec .\scripts\pauseORunpause.js --network NETWORK_NAME pause
            b) For Unpausing :truffle exec .\scripts\pauseORunpause.js --network NETWORK_NAME unpause
