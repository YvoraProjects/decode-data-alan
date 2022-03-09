const express = require('express');
const app = express();
var cors = require('cors');
const ethers = require("ethers");
const pcsAbi = new ethers.utils.Interface(require("./abi.json"));
const bodyParser = require("body-parser");
const abiDecoder = require('abi-decoder');
const { decodeLogs } = require('abi-decoder');

app.set('port', process.env.PORT || 3001);
app.set('json spaces', 2);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.post('/txs', cors(), async function (req, res) {
  res.contentType('application/json');

  // https://bscscan.com/tx/0x15841cb11a8e62f691c7a49b0bde85b22ecff3281745cc35c641b19cb8493a13

  provider = new ethers.providers.WebSocketProvider('ws://localhost:8546');
  wallet = new ethers.Wallet('0xf0e72b4e27ea3f7542c8d1c3b1420865b7066f1767e20181fa513b47c625d1c0');
  account = wallet.connect(provider);

  let abi = req.body.abi ? new ethers.utils.Interface(req.body.abi) : pcsAbi;
  let results = [];
  abiDecoder.addABI(req.body.abi ? JSON.parse(req.body.abi) : require("./test-abi.json"));

  if (!req.body.hashes) {
    res.send(JSON.stringify(results));
    return;
  }

  for (let hash of req.body.hashes) {

    await provider.getTransaction(hash)
      .then(async (tx) => {
        if (tx && tx.to) {
          let decodedInput;

          try {
            decodedInput = abi.parseTransaction({
              data: tx.data,
              value: tx.value,
            });
          } catch (error) {
            // console.log(error);
            try {
              decodedInput = pcsAbi.parseTransaction({
                data: tx.data,
                value: tx.value,
              });
            } catch (error) {
              //console.log(error);
            }
          }

          const decodedLogsArray = [];
          await provider.getTransactionReceipt(hash)
            .then(async (tx) => {

              try {
                const decodedLogs = abiDecoder.decodeLogs(tx.logs);

                for (let log of decodedLogs) {
                  const newLog = Object.assign({}, log);
                  const eventArray = [];

                  for (let event of log.events) {
                    eventArray.push(event);
                  }

                  newLog.events = eventArray;
                  decodedLogsArray.push(newLog);
                }
              } catch (error) {
                // console.log(error);
              }
            });

          results.push({ decodedInput, decodedLogsArray });
        }
      })
      .catch((error) => { console.log(error) });


  }

  res.send(JSON.stringify(results));
});

app.listen(app.get('port'), () => {
  console.log(`Server listening on port ${app.get('port')}`);
});
