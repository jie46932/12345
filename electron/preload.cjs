const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__electronOffline', true);
