const fs = require("fs");
let telegramToken;
try {
  telegramToken = fs.readFileSync(`${__dirname}/telegram.key`, "utf8").trim();
} catch (e) {
  console.debug(`Cannot load telegram token from ${__dirname}/telegram.key, bot disabled`);
  telegramToken = "";
}
module.exports = {
  mainchain: require("./rinkeby.json"), //the json containing the smart contract addresses in rsk
  sidechain: require("./btestnet.json"), //the json containing the smart contract addresses in eth
  runEvery: 2, // In minutes,
  //confirmations: 0, // Number of blocks before processing it, if working with ganache set as 0
  //now we have confirmation table ,so we don't use confirmations
  privateKey: fs.readFileSync(`${__dirname}/federator.key`, "utf8").trim(),
  storagePath: "./db",
  federatorInstanceId: "",
  telegramBot: {
    token: telegramToken,
    groupId: 1247432371, // Telegram group id to send the messages to
  },
  confirmationTable: {
    1: {
      default: 5760,
      minConfirmation: 10,
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
    4: {
      default: 12,
      minConfirmation: 10,
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 11,
        },
        {
          amount: 0.5,
          confirmations: 12,
        },
      ],
      MAIN: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
    97: {
      default: 12,
      minConfirmation: 10,
      MAIN: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 11,
        },
        {
          amount: 0.5,
          confirmations: 12,
        },
      ],
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
    33: {
      default: 0,
      minConfirmation: 0,
      MAIN: [
        {
          amount: 0,
          confirmations: 0,
        },
        {
          amount: 0.2,
          confirmations: 0,
        },
        {
          amount: 0.5,
          confirmations: 0,
        },
      ],
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
    5777: {
      default: 0,
      minConfirmation: 0,
      MAIN: [
        {
          amount: 0,
          confirmations: 0,
        },
        {
          amount: 0.2,
          confirmations: 0,
        },
        {
          amount: 0.5,
          confirmations: 0,
        },
      ],
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },

    3: {
      default: 5760,
      minConfirmation: 10,
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
    30: {
      default: 2880,
      minConfirmation: 10,
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
    31: {
      default: 10,
      minConfirmation: 10,
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
    42: {
      default: 10,
      minConfirmation: 10,
      WETH: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      WBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
      DAI: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 50,
          confirmations: 30,
        },
        {
          amount: 100,
          confirmations: 50,
        },
      ],
      renBTC: [
        {
          amount: 0,
          confirmations: 10,
        },
        {
          amount: 0.2,
          confirmations: 30,
        },
        {
          amount: 0.5,
          confirmations: 50,
        },
      ],
    },
  },
};
