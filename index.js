const express = require('express');
const app = express();
var cors = require('cors');
const fetch = require('node-fetch');
const ethers = require("ethers");
const pcsAbi = new ethers.utils.Interface(require("./abi.json"));
const bodyParser = require("body-parser");
const abiDecoder = require('abi-decoder');
const HttpsProxyAgent = require('https-proxy-agent');

const swapETHForExactTokens = new RegExp("^0xfb3bdb41");
const swapExactETHForTokens = new RegExp("^0x7ff36ab5");
const swapExactTokensForETH = new RegExp("^0x18cbafe5");
const swapExactTokensForTokens = new RegExp("^0x38ed1739");
const swapExactTokensForTokensSupportingFeeOnTransferTokens = new RegExp("^0x5c11d795");
const swapExactETHForTokensSupportingFeeOnTransferTokens = new RegExp("^0xb6f9de95");
const swapTokensForExactTokens = new RegExp("^0x8803dbee");
const buy = new RegExp("^0xa6f2ae3a");

app.set('port', process.env.PORT || 3001);
app.set('json spaces', 2);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.post('/check-buysell', cors(), async function (req, res) {
  res.contentType('application/json');
  let results = [];
  let errorTransaction = null;

  const WBNB_CONTRACT = ethers.utils.getAddress('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c');
  const USDT_CONTRACT = ethers.utils.getAddress('0x55d398326f99059fF775485246999027B3197955');
  const BUSD_CONTRACT = ethers.utils.getAddress('0xe9e7cea3dedca5984780bafc599bd69add087d56');

  provider = new ethers.providers.WebSocketProvider('ws://localhost:8546');
  wallet = new ethers.Wallet('0xf0e72b4e27ea3f7542c8d1c3b1420865b7066f1767e20181fa513b47c625d1c0');
  account = wallet.connect(provider);

  console.log(`---------------------------------------`);
  console.log(`New petition ${new Date().toISOString()}`);

  if (!req.body.hashes || req.body.hashes.length <= 0 || !req.body.address) {
    respuesta = {
      error: true,
      codigo: 501,
      mensaje: 'Hashes vacíos!'
    };

    res.send(respuesta);
    console.log(`Algun dato vacío`);
    console.log(`---------------------------------------`);
  }

  const address = ethers.utils.getAddress(req.body.address);

  for (let hash of req.body.hashes) {
    await provider.getTransaction(hash).then(async (tx) => {
      if (tx && tx.to) {
        try {
          if (isBuyMethod(tx)) {
            const decodedData = pcsAbi.parseTransaction({ data: tx.data, value: tx.value });
            const indexAddress = (decodedData.args['path']).findIndex(add => add === address);

            const walletObject = { address: tx.from, sell: false, buy: false };
            const exists = results.find(wallet => wallet.address === tx.from);
            const walletIndex = results.findIndex(wallet => wallet.address === tx.from);

            if (indexAddress === 0) { // Es una venta
              if (exists) {
                exists.sell = true;
                results[walletIndex] = exists;
              } else {
                results.push({ ...walletObject, sell: true });
              }
            } else { // Es una compra u otra cosa
              if (exists) {
                exists.buy = true;
                results[walletIndex] = exists;
              } else {
                results.push({ ...walletObject, buy: true });
              }
            }

          }
        } catch (error) {
          console.log(error);
        }
      }
    })
  }

  res.send(JSON.stringify(results));
});

app.post('/txs', cors(), async function (req, res) {
  res.contentType('application/json');
  let results = [];
  let errorTransaction = null;

  provider = new ethers.providers.WebSocketProvider('ws://localhost:8546');
  wallet = new ethers.Wallet('0xf0e72b4e27ea3f7542c8d1c3b1420865b7066f1767e20181fa513b47c625d1c0');
  account = wallet.connect(provider);

  console.log(`---------------------------------------`);
  console.log(`New petition ${new Date().toISOString()}`);

  if (!req.body.hashes || req.body.hashes.length <= 0) {
    respuesta = {
      error: true,
      codigo: 501,
      mensaje: 'Hashes vacíos!'
    };

    res.send(respuesta);
    console.log(`Algun dato vacío`);
    console.log(`---------------------------------------`);
  }

  const apikey = req.body.apikey;
  const address = req.body.address;

  let abi;

  if (apikey && address) {
    const abiResponse = await fetch(`https://api.bscscan.com/api?module=contract&action=getabi&address=${address}&apikey=${apikey}`);
    const data = await abiResponse.json();
    abi = data?.result ? new ethers.utils.Interface(data.result) : pcsAbi;

    try {
      abiDecoder.addABI(data?.result ? JSON.parse(data.result) : require("./test-abi.json"));
    } catch (error) {
      console.log(error);
    }

    console.log(`ApiKey: ${req.body.apikey}`);
    console.log(`Address: ${req.body.address}`);
  }

  console.log(`Hashes: ${req.body.hashes.length}`);
  console.log(`---------------------------------------`);

  var startTime = performance.now()

  for (let hash of req.body.hashes) {

    await provider.getTransaction(hash).then(async (tx) => {
      if (tx && tx.to) {
        let decodedInput;

        try {
          decodedInput = abi.parseTransaction({ data: tx.data, value: tx.value });
        } catch (error) {
          try {
            decodedInput = pcsAbi.parseTransaction({ data: tx.data, value: tx.value });
          } catch (error) {
            //console.log(error);
          }
        }

        const decodedLogsArray = [];
        await provider.getTransactionReceipt(hash).then(async (tx) => {
          try {
            if (tx.logs && tx.logs.length > 0) {
              for (let log of tx.logs) {
                errorTransaction = tx.transactionHash;
                const _log = abi.parseLog(log);
                decodedLogsArray.push(_log);
              }
            }
          } catch (error) {
            // console.log(error);
          }
        })

        results.push({ decodedInput, decodedLogsArray });
      }
    })
  }

  var endTime = performance.now()
  console.log(`---------------------------------------`);
  console.log(`Execution time ${((endTime - startTime) / 1000).toFixed(2)} sec.`);
  console.log(`---------------------------------------`);

  try {
    res.send(JSON.stringify(results));
  } catch (error) {
    console.log('Error tx', errorTransaction);

    if (errorTransaction) {

      respuesta = {
        error: true,
        codigo: 700,
        mensaje: `${errorTransaction}`
      };

      console.log(results.length);
      res.send(respuesta);
    }

  } finally {
    errorTransaction = null;
  }
});

app.post('/binance', cors(), async function (req, res) {
  res.contentType('application/json');
  let results = [];

  console.log(`---------------------------------------`);
  console.log(`New petition ${new Date().toISOString()}`);

  if ((!req.body.proxies || req.body.proxies.length <= 0) || !req.body.tokens || req.body.tokens.length <= 0) {
    respuesta = {
      error: true,
      codigo: 501,
      mensaje: 'Proxies / Tokens vacíos!!'
    };

    res.send(respuesta);
    console.log(`Algun dato vacío`);
    console.log(`---------------------------------------`);
  }

  var startTime = performance.now();

  const promisePool = [];
  for (let i = 0; i < req.body.tokens.length; i++) {
    const random = Math.floor(Math.random() * 99) + 1;
    const proxyAgent = new HttpsProxyAgent(`http://${req.body.proxies[random]}`);
    promisePool.push(
      fetch(`https://www.binance.com/bapi/capital/v2/public/capital/config/getOne?coin=${req.body.tokens[i]}&lang=en`, { agent: proxyAgent })
        .then((res) => res.json())
        .catch((error) => console.log(error))
    );
  }

  Promise.all(promisePool)
    .then((res) => {
      console.log(`Call to promisePool took ${(performance.now() - startTime) / 1000.0} seconds`);
      res.map((x, index) => results.push({ token: req.body.tokens[index], hasData: x.data != null && x.data.length > 0, info: x }));
    }, (error) => {
      console.log(error);
    }).finally(() => res.send(JSON.stringify(results)));
});

app.listen(app.get('port'), () => {
  console.log(`Server listening on port ${app.get('port')}`);
});

function isBuyMethod(tx) {
  return swapETHForExactTokens.test(tx.data) || swapExactETHForTokens.test(tx.data) ||
    swapExactTokensForETH.test(tx.data) || swapExactTokensForTokens.test(tx.data) ||
    swapExactTokensForTokensSupportingFeeOnTransferTokens.test(tx.data) || swapTokensForExactTokens.test(tx.data) ||
    swapExactETHForTokensSupportingFeeOnTransferTokens.test(tx.data) || buy.test(tx.data);
}