env=$1
// First time or if: "Error on oz deployment" during 7_deploy_bridge_v0.js deployment
then run ` truffle comiple run--all  ` and then execute 

1. truffle migrate --reset --network development 
2.  truffle migrate --reset --network rskregtest 