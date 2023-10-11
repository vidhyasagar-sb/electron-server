import './stylesheets/main.css';

// Everything below is just a demo. You can delete all of it.

import { ipcRenderer } from 'electron';
import jetpack from 'fs-jetpack';
import { greet } from './hello_world/hello_world';
import env from 'env';

document.querySelector('#app').style.display = 'block';
// document.querySelector('#greet').innerHTML = greet();
// // document.querySelector('#env').innerHTML = env.name;
// document.querySelector('#electron-version').innerHTML =
//   process.versions.electron;

// const osMap = {
//   win32: 'Windows',
//   darwin: 'macOS',
//   linux: 'Linux',
// };
// document.querySelector('#os').innerHTML = osMap[process.platform];

// We can communicate with main process through messages.
// ipcRenderer.on('app-path', (event, appDirPath) => {
//   // Holy crap! This is browser window with HTML and stuff, but I can read
//   // files from disk like it's node.js! Welcome to Electron world :)
//   const appDir = jetpack.cwd(appDirPath);
//   const manifest = appDir.read('package.json', 'json');
//   document.querySelector('#author').innerHTML = manifest.author;
// });
ipcRenderer.send('need-app-path');

// document.querySelector('.electron-website-link').addEventListener(
//   'click',
//   (event) => {
//     ipcRenderer.send('open-external-link', event.target.href);
//     event.preventDefault();
//   },
//   false
// );

const makeLogs = (messageText) => {
  const logsWindow = document.getElementById('logsWindow');
  const message = document.createElement('div');
  message.innerText = messageText;
  logsWindow.appendChild(message);
};

const startServerButton = document.querySelector('.startServerBtn');
const serverBtn = document.getElementById('serverInteractionButton');

startServerButton.addEventListener('click', () => {
  console.log('workss');
  try {
    console.log(
      serverBtn.value == 'start-server',
      serverBtn.innerText,
      serverBtn
    );
    if (serverBtn.innerText == 'Start Server') {
      ipcRenderer.send('start-server');
      makeLogs('Server Started');

      serverBtn.innerText = 'Stop Server';
    } else {
      ipcRenderer.send('stop-server');
      makeLogs('Server Stopped');
      serverBtn.innerText = 'Start Server';
    }
  } catch (error) {
    makeLogs('Something went wrong when starting server');
    console.log(error);
  }
});
