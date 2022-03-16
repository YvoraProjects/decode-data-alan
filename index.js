const express = require('express');
const app = express();
var cors = require('cors');
const fetch = require('node-fetch');
const ethers = require("ethers");
const pcsAbi = new ethers.utils.Interface(require("./abi.json"));
const bodyParser = require("body-parser");
const abiDecoder = require('abi-decoder');

app.set('port', process.env.PORT || 3001);
app.set('json spaces', 2);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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

app.listen(app.get('port'), () => {
  console.log(`Server listening on port ${app.get('port')}`);
});
