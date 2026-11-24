// Puente mínimo y seguro: el renderizador solo puede pedir texto a fuentes médicas autorizadas.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ses', {
  fetchText: (url) => ipcRenderer.invoke('ses:fetch-text', url),
});
