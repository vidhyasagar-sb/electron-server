import { app } from "electron";

export default {
  label: "App",
  submenu: [
    {
      label: "Reload",
      accelerator: "CmdOrCtrl+R",
      click: () => {
        BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
      },
    },
    {
      label: "Quit",
      accelerator: "CmdOrCtrl+Q",
      click: () => {
        app.quit();
      },
    },
  ],
};
