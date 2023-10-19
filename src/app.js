import './stylesheets/main.css';

import { ipcRenderer } from 'electron';

document.querySelector('#app').style.display = 'block';

ipcRenderer.send('need-app-path');
