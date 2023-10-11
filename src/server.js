const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const cors = require('cors');
const adb = require('adbkit');

const client = adb.createClient();
let deviceId;

client.listDevices().then((device) => {
  deviceId = device[0]?.id;
});

const app = express();
const PORT = 6677;

app.use(cors());
app.use(express.json());

const API_KEY = '2f7f29d4-e1bd-4681-a89e-33980e0643a8';
const deviceJsonPath = '/data/SIMPLE/Uplink/device.json';

const jsonCheckCmd = `
  cat ${deviceJsonPath} | \
  grep -q '"project_id":"bytebeam"' && echo 'true' || echo 'false'
`;

const apiConfig = {
  method: 'post',
  url: 'https://simpleenergy.bytebeam.io/api/v1/devices/provision?dedup=true',
  headers: {
    'x-bytebeam-tenant': 'bytebeam',
    'Content-Type': 'application/json',
    'x-bytebeam-api-key': API_KEY,
  },
};

app.get('/checkConnection', (req, res) => {
  client.listDevices().then((device) => {
    console.log('deveic', device);
    if (device.length < 1) res.send({ isConnected: false });
    else res.send({ isConnected: true });

    deviceId = device[0]?.id;
  });
});

app.get('/killConnection', (req, res) => {
  client.kill((err) => {
    console.log('erroror', err);
    if (err === null) {
      res.send({ connectionkilled: true, error: null });
    } else {
      res.send({ connectionkilled: false, error: null });
    }
  });
});

app.post('/startProvision', async (req, res) => {
  console.log('Request:', req.body);

  if (!req.body.vin) {
    return res
      .status(500)
      .send({ provisionStatus: null, error: 'VIN not found' });
  }

  try {
    const devices = await client.listDevices();

    if (devices.length === 0) {
      return res.send({ provisionStatus: false });
    }

    const deviceId = devices[0].id;

    try {
      await client.root(deviceId);
    } catch (rootError) {
      console.error('Error switching to root:', rootError);
    }

    const metadata = {
      metadata: {
        VIN: req.body.vin,
      },
    };

    const result = await provisionDevice(deviceId, req.body.vin, apiConfig);

    if (result === 'true') {
      checkDeviceJson(res);
    } else {
      return res.send({ provisionStatus: false });
    }
  } catch (error) {
    console.error('Error during provisioning:', error);
    client.kill();
    return res
      .status(500)
      .send({ provisionStatus: null, error: 'Something went wrong!' });
  }
});

async function checkDeviceJson(res) {
  client
    .shell(deviceId, jsonCheckCmd)
    .then(adb.util.readAll)
    .then((output) => {
      const result = output.toString().trim();
      console.log(`[${deviceId}] Result: ${result}`);

      if (result === 'true') {
        client.reboot(deviceId);
        res.send({ provisionStatus: true });
      } else {
        res.send({ provisionStatus: false });
      }
      client.kill();
    })
    .catch((error) => {
      console.error(
        `[${deviceId}] Error checking device.json: ${error.message}`
      );
      res.status(500).send(false);
    });
}

async function pushFileToDevice(deviceId, sourcePath, destinationPath) {
  await client
    .push(deviceId, sourcePath, destinationPath)
    .then(function (transfer) {
      return new Promise(function (resolve, reject) {
        transfer.on('progress', function (stats) {
          console.log(
            '[%s] Pushed %d bytes so far',
            deviceId,
            stats.bytesTransferred
          );
        });
        transfer.on('end', function () {
          console.log('[%s] Push complete', deviceId);
          console.log('enterred function');
          resolve();
        });
        transfer.on('error', reject);
      });
    });
}

async function provisionDevice(deviceId, vin, apiConfig) {
  try {
    const DATA_FOLDER = 'data/SIMPLE/Uplink';

    // Reset current configuration
    await client.shell(deviceId, `rm -rf ${DATA_FOLDER} || true`);

    await client.shell(deviceId, `mkdir -p ${DATA_FOLDER}`);
    console.log('created file');
    // Download device.json
    const postData = JSON.stringify({
      metadata: {
        VIN: vin,
      },
    });

    const response = await fetch(apiConfig.url, {
      method: apiConfig.method,
      headers: apiConfig.headers,
      body: postData,
    });

    if (response.status !== 200) {
      console.error('Failed to download device.json:', response.statusText);
      return 'false';
    }

    const deviceJson = await response.json();

    console.log(deviceJson);
    fs.writeFileSync('.device.json', JSON.stringify(deviceJson));

    console.log('started');

    await pushFileToDevice(
      deviceId,
      `.device.json`,
      `${DATA_FOLDER}/device.json`
    );
    fs.unlinkSync('.device.json');
    console.log('ended');

    return 'true';
  } catch (provisionError) {
    console.error(`[${deviceId}] Provisioning Error:`, provisionError);
    return 'false';
  }
}

module.exports = app;
