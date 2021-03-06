const log4js = require('log4js');
const web3 = require('web3');

// Configurations
const config = require('../config/config.js');
const logConfig = require('../config/log-config.json');
log4js.configure(logConfig);

// Services
const Scheduler = require('./services/Scheduler.js');
const Federator = require('./lib/Federator.js');
const {TelegramBot, NullBot} = require('./lib/chatBots.js');

const logger = log4js.getLogger('Federators');
logger.info('RSK Host', config.mainchain.host);
logger.info('ETH Host', config.sidechain.host);

if(!config.mainchain || !config.sidechain) {
    logger.error('Mainchain and Sidechain configuration are required');
    process.exit();
}

let chatBot;
if(config.telegramBot && config.telegramBot.token && config.telegramBot.groupId) {
    chatBot = new TelegramBot(
        config.telegramBot.token,
        config.telegramBot.groupId,
        log4js.getLogger('CHATBOT'),
        config.federatorInstanceId,
    );
} else {
    chatBot = new NullBot(
        log4js.getLogger('CHATBOT')
    );
}

const mainFederator = new Federator(
    config,
    log4js.getLogger('MAIN-FEDERATOR'),
    web3,
    chatBot,
);
const sideFederator = new Federator(
    {
        ...config,
        mainchain: config.sidechain,
        sidechain: config.mainchain,
        storagePath: `${config.storagePath}/side-fed`
    },
    log4js.getLogger('SIDE-FEDERATOR'),
    web3,
    chatBot,
);

let pollingInterval = config.runEvery * 1000 * 60; // Minutes
let scheduler = new Scheduler(pollingInterval, logger, { run: () => run() });

scheduler.start().catch((err) => {
    logger.error('Unhandled Error on start()', err);
});

async function run() {
    try {
        await mainFederator.run();
        await sideFederator.run();
    } catch(err) {
        logger.error('Unhandled Error on run()', err);
        process.exit();
    }
}

async function exitHandler() {
    process.exit();
}

// catches ctrl+c event
process.on('SIGINT', exitHandler);

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);

// export so we can test it
module.exports = { scheduler };
