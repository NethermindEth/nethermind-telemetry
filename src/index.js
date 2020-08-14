const axios = require('axios');
const fs = require('fs');
const WebSocketClient = require('websocket').client;
const chalk = require('chalk');

labelColorizer = (options) => {
    return (input) => {
        const label = input.slice(options.labelPrefix.length, -options.labelSuffix.length).toLowerCase();
        return typeof options.colorFuncs[label] === 'function' ? options.colorFuncs[label](input) : input;
    };
}

require('console-stamp')(console, {
    pattern: 'dd/mm/yyyy HH:MM:ss.l', 
    colors: {
        label: labelColorizer({
            labelPrefix: "[",
            labelSuffix: "]",
            colorFuncs: {
                info: chalk.green,
                warn: chalk.yellow,
                error: chalk.red
            }
        }),
        stamp: chalk.yellow
    },
});


const wsUrl = process.env.WSURL ? process.env.WSURL : 'ws://localhost:8545/ws/json-rpc';
const httpUrl = process.env.HTTPURL ? process.env.HTTPURL : 'http://localhost:8545';
const pipeName = process.env.PIPENAME ? process.env.PIPENAME : './logger.txt';

console.info('Nethermind telemetry started');
console.info('Using Websocket at ' + wsUrl);
console.info('Using JSON RPC at ' + httpUrl);
console.info('Writing to ' + pipeName);

// Websocket
const ws = new WebSocketClient();
ws.on('connectFailed', function(error) {
    console.error('Error during websocket connect: ' + error.toString());
});
ws.on('connect', function(connection) {

    console.info('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.error("Websocket Connection Error: " + error.toString());
    });

    connection.on('close', function() {
        console.warn('Websocket Connection Closed. Exiting...');
    });

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            const wsData = JSON.parse(message.utf8Data);
            if(wsData && wsData.result) {
                processNewBlock(wsData.result);
            }
        }
    });
    
    function subscribeToNewBlocks() {
        if (connection.connected) {
            console.info('Websocket connected. Collecting new blocks data from stream.');

            const sleep = time => new Promise(resolve => setTimeout(resolve, time))
            
            const poll = (fn, time) => fn()
                .then(sleep(time).then(() => poll(fn, time)))

            poll(() => new Promise(() => connection.sendUTF("{\"method\":\"eth_getBlockByNumber\",\"params\": [\"latest\",false],\"id\":1,\"jsonrpc\":\"2.0\"}")), 1000)
        }
    }

    subscribeToNewBlocks();
});

console.info('Connecting to Nethermind...');
ws.connect(wsUrl);

const queryHttp = async (method) => {
    try {
        const httpResponse = await axios.post(httpUrl, 
            "{\"method\":\""+method+"\",\"params\":[],\"id\":1,\"jsonrpc\":\"2.0\"}",
            {headers:  {'Content-Type': 'application/json'}});
        if(httpResponse.data) {
            return httpResponse.data.result;
        } else {
            console.error('Unable to query over HTTP for ' + method);
            return null;
        }
    } catch (error) {
        console.error('Unable to query over HTTP for ' + method + ':' + error.toString());
        return null;
    }
}

// Parse Block
const processNewBlock = async (blockData) => {

    console.info("Got new Block: " + parseInt(blockData.number, 16));

    // Query extra data
    const clientVersion = await queryHttp('web3_clientVersion');
    const numPeers = await queryHttp('net_peerCount');

    const telemetry = {
        client: clientVersion ? clientVersion : 'N/A',
        blockNum: parseInt(blockData.number, 16),
        blockHash: blockData.hash,
        blockTs: parseInt(blockData.timestamp, 16),
        blockReceived: Date.now(),
        timekey: Date.now(),
        numPeers: numPeers ? parseInt(numPeers, 16) : -1,
        numTxInBlock: blockData.transactions.length,
        gasLimit: parseInt(blockData.gasLimit,16),
        gasUsed: parseInt(blockData.gasUsed,16)
    }

    // Write to named pipe
    fs.appendFileSync(pipeName, JSON.stringify(telemetry) + '\n');
}