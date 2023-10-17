import path from 'path';
import url from 'url';
import { app, Menu, ipcMain, shell } from 'electron';
import appMenuTemplate from './menu/app_menu_template';
import editMenuTemplate from './menu/edit_menu_template';
import devMenuTemplate from './menu/dev_menu_template';
import createWindow from './helpers/window';
import env from 'env';

// Import the Express.js server
import express from 'express';
import server from './server'; // Change the path as needed

if (env.name !== 'production') {
  const userDataPath = app.getPath('userData');
  app.setPath('userData', `${userDataPath} (${env.name})`);
}

const port = 6678;

// Define a function to check if the server is running
function isServerRunning() {
  // Run a command to check if the server is listening on the port
  const checkServer = spawn('lsof', ['-i', `:${port}`]);

  return new Promise((resolve) => {
    checkServer.on('close', (code) => {
      resolve(code === 0); // Code 0 means the port is in use (server is running)
    });
  });
}

async function startServer() {
  const serverIsRunning = await isServerRunning();

  if (!serverIsRunning) {
    // Start the server if it's not running
    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } else {
    console.log('Server is already running.');
  }
}

const setApplicationMenu = () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([]));
};

const initIpc = () => {
  ipcMain.on('need-app-path', (event, arg) => {
    event.reply('app-path', app.getAppPath());
  });
  ipcMain.on('open-external-link', (event, href) => {
    shell.openExternal(href);
  });
};

app.on('ready', () => {
  setApplicationMenu();
  initIpc();
  startServer();

  // server.listen(6678);

  const mainWindow = createWindow('main', {
    // width: 10,
    // height: 60,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'app.html'),
      protocol: 'file:',
      slashes: true,
    })
  );

  if (env.name === 'development') {
    mainWindow.openDevTools();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
