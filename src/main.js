import path from 'path';
import url from 'url';
import { app, Menu, ipcMain, shell, BrowserWindow } from 'electron';
import appMenuTemplate from './menu/app_menu_template';
import devMenuTemplate from './menu/dev_menu_template';
import env from 'env';

import server from './server';

const portToConnect = 6678;

if (env.name !== 'production') {
  const userDataPath = app.getPath('userData');
  app.setPath('userData', `${userDataPath} (${env.name})`);
}

const setApplicationMenu = () => {
  const menus = [appMenuTemplate];
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
};

app.on('ready', () => {
  setApplicationMenu();
  initIpc();
  server.listen(portToConnect);
  let mainWindow = new BrowserWindow({
    width: 100,
    height: 100,
    resizable: false,
  });

  mainWindow.setMenu(null);

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'app.html'),
      protocol: 'file:',
      slashes: true,
    })
  );

  // if (env.name === "development") {
  //   mainWindow.openDevTools();
  // }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
