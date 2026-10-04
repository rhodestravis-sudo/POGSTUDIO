const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("planogramDesktop", {
  openWorkspace: () => ipcRenderer.invoke("workspace:open"),
  saveWorkspace: (contents) => ipcRenderer.invoke("workspace:save", contents),
  saveWorkspaceAs: (contents) => ipcRenderer.invoke("workspace:save-as", contents),
  chooseImageFolder: (products) => ipcRenderer.invoke("images:choose-folder", products),
  isDesktop: true,
});
