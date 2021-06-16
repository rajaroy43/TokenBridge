# Token Bridge Contracts

## Install dependencies

Don't use Node 14 as it has issues with truffle, use node 8, 10 or 12.
Install node https://nodejs.org/es/
Then install dependencies

```
npm install
```

## Install and run ganache

https://www.trufflesuite.com/ganache

## Running test

```
npm run migrate
npm test
npm run lint
npm run coverage
```

## Configure networks

Edit the truffle configuration file

```js
module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!met
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "5777",
      gas: 6721975,
      gasPrice: 200000000,
    },
    //2nd ganache blockchain
    development2: {
      host: "127.0.0.1",
      port: 4444,
      network_id: "33",
      gas: 6300000,
      gasPrice: 60000000, // 0.06 gwei
    },
  },
};
```

## Deploy contracts

Launch the local network

```
ganache-cli --verbose
```

Deploy using truffle to the desire network

```
truffle migrate --network <network>
```

Examples

```
truffle migrate --network development
truffle migrate --network development2
```

For local direct deploy on both chain (development and development2) run - `yarn deployIntegrationTest`

This will also generate the json files for that network with the addresses of the deployed contracts that will be called by the federator.
