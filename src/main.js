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
import server from './server';

if (env.name !== 'production') {
  const userDataPath = app.getPath('userData');
  app.setPath('userData', `${userDataPath} (${env.name})`);
}

const setApplicationMenu = () => {
  const menus = [appMenuTemplate, editMenuTemplate];
  if (env.name !== 'production') {
    menus.push(devMenuTemplate);
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

const initIpc = () => {
  ipcMain.on('need-app-path', (event, arg) => {
    event.reply('app-path', app.getAppPath());
  });
  ipcMain.on('open-external-link', (event, href) => {
    shell.openExternal(href);
  });

  // ipcMain.on('start-server', () => {
  //   server.listen(6678);
  // });
};

app.on('ready', () => {
  setApplicationMenu();
  initIpc();

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: env.name === 'test',
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
