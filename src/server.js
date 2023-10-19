var Promise = require('bluebird');
var adb = require('adbkit');
const express = require('express');
const { spawnSync } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');

let client;
let deviceId;
let newDeviceId;
const app = express();
var cors = require('cors');

app.use(cors());
app.use(express.json());

const deviceJsonPath = '/data/SIMPLE/Uplink/device.json';

app.get('/checkConnection', (req, res) => {
  client = adb.createClient();

  client.listDevices().then((device) => {
    console.log('deveic', device);
    if (device.length < 1) res.send({ isConnected: false });
    else res.send({ isConnected: true });

    deviceId = device[0]?.id;
  });
});

app.get('/killConnection', (req, res) => {
  const client = adb.createClient();

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
  let newClient;
  console.log('inside prov');
  newClient = await adb.createClient();

  if (!req.body.vin) {
    return res
      .status(500)
      .send({ provisionStatus: null, error: 'VIN not found' });
  }

  try {
    const devices = await newClient.listDevices();

    if (devices.length === 0) {
      return res.send({ provisionStatus: false });
    }

    deviceId = devices[0].id;
    console.log('check device name', deviceId);

    try {
      await newClient.root(deviceId);
      console.log('getting root access');
    } catch (rootError) {
      console.error('Error switching to root:', rootError);
    }

    const result = await provisionDevice(deviceId, req.body.vin, newClient);

    console.log('after provision func', result);

    if (result === 'true') {
      checkDeviceJson(res);
    } else if (result === 'invalidVin') {
      res.send({ provisionStatus: false, vinStatus: 'invalid' });
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
  try {
    const jsonCheckCmd = `cat ${deviceJsonPath} | grep -q '"project_id":"bytebeam"' && echo 'true' || echo 'false'`;
    const adbArguments = ['shell', jsonCheckCmd];

    const adbResult = spawnSync('adb', adbArguments);
    const result = adbResult.stdout.toString().trim();

    if (result === 'true') {
      try {
        spawnSync('adb', ['reboot']);

        res.send({ provisionStatus: true });
        client = null;
        deviceId = null;
        newDeviceId = null;
      } catch (error) {
        console.error('Error rebooting:', error);
        res.send({ provisionStatus: false });
      }
    } else {
      res.send({ provisionStatus: false });
    }
  } catch (error) {
    console.log('erroro', error);
    res.status(500).send({ provisionStatus: false });
  }
}

function pushFileToDevice() {
  const localFilePath = '.device.json';
  const remoteFolderPath = '/data/SIMPLE/Uplink';
  const remoteFilePath = '/data/SIMPLE/Uplink/device.json';

  const deviceListResult = spawnSync('adb', ['devices']);
  const deviceListOutput = deviceListResult.stdout.toString();
  const deviceList = deviceListOutput
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split('\t')[0]);

  if (deviceList.length === 0) {
    console.error('No ADB devices found.');
    return false;
  }

  const firstDevice = deviceList[0];

  const folderCheckResult = spawnSync('adb', [
    '-s',
    firstDevice,
    'shell',
    '[ -d ' + remoteFolderPath + ' ]',
  ]);

  if (folderCheckResult.status !== 0) {
    console.log('creating folder');
    const folderCreateResult = spawnSync('adb', [
      '-s',
      firstDevice,
      'shell',
      'mkdir',
      '-p',
      remoteFolderPath,
    ]);

    if (folderCreateResult.status !== 0) {
      console.error('Failed to create folder on the device.');
      return false;
    }
  }

  const pushResult = spawnSync('adb', [
    '-s',
    firstDevice,
    'push',
    localFilePath,
    remoteFilePath,
  ]);

  if (pushResult.status === 0) {
    console.log('File pushed successfully.');
    return true;
  } else {
    console.error('Failed to push the file to the device.');
    return false;
  }
}

async function provisionDevice(deviceId, vin, client) {
  return new Promise(async (resolve, reject) => {
    const DATA_FOLDER = 'data/SIMPLE/Uplink';

    async function restartAdbServerAndRetryShell() {
      try {
        client.shell(deviceId, 'ls');

        await client.shell(deviceId, `rm -rf ${DATA_FOLDER} || true`);
        await client.shell(deviceId, `mkdir -p ${DATA_FOLDER}`);
        console.log('working good');
      } catch (error) {
        console.log(error);

        const adbCommand = 'adb kill-server && adb start-server';
        const result = spawnSync(adbCommand, { shell: true });

        if (result.error) {
          console.error('Error:', result.error.message);
        } else {
          console.log('ADB server restarted successfully');
          client = await adb.createClient();

          client.listDevices().then((device) => {
            deviceId = device[0]?.id;
            console.log('new device name', deviceId);
          });

          await restartAdbServerAndRetryShell();
        }
      }
    }

    await restartAdbServerAndRetryShell();

    console.log('client should work');

    try {
      await client.shell(deviceId, `mkdir -p ${DATA_FOLDER}`);

      const postData = JSON.stringify({
        metadata: {
          VIN: vin,
        },
      });

      const response = await fetch(
        'https://simpleenergy.bytebeam.io/api/v1/devices/provision?dedup=true',
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Bytebeam-Api-Key': '242921af-e5e5-421d-af88-72423f0f9f7f',
            'X-Bytebeam-Tenant': 'bytebeam',
          },
          body: postData,
          method: 'POST',
        }
      );

      if (response.status !== 200 && response.status !== 401) {
        console.error('Failed to download device.json:', response.statusText);
        resolve('false');
      }

      if (response.status === 401) {
        const errRes = await response.text();

        if (errRes === "Inactive device can't be reprovisioned - inactive") {
          resolve('invalidVin');
        }
        return;
      }

      const deviceJson = await response.json();

      fs.writeFileSync('.device.json', JSON.stringify(deviceJson));

      newDeviceId = deviceId;

      const pushResult = pushFileToDevice();

      if (pushResult) {
        fs.unlinkSync('.device.json');
        resolve('true');
      } else {
        fs.unlinkSync('.device.json');
        reject('false');
      }
    } catch (error) {
      console.error('Error:', error);
      resolve('false');
    }
  });
}

module.exports = app;
