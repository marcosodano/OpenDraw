/**
 * OpenDraw — Preload Script
 * 
 * Exposes a safe API to the renderer process via contextBridge.
 * This is the ONLY bridge between Node.js and the browser context.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const path = require('path');
const fs = require('fs');

function readAppInfoSync() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const verPath = path.join(__dirname, '..', 'shared', 'version.json');
    const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
    const ver = fs.existsSync(verPath) ? JSON.parse(fs.readFileSync(verPath, 'utf8')) : {};
    return {
      name: ver.name || 'OpenDraw',
      author: ver.author || 'Marco Sodano',
      monogram: ver.monogram || 'MS',
      edition: ver.edition || 'Standard Edition',
      version: pkg.version || ver.version || '1.0.0',
      channel: ver.channel || 'stable',
      build: ver.build || '',
      releaseDate: ver.releaseDate || '',
      releaseNotes: Array.isArray(ver.releaseNotes) ? ver.releaseNotes : [],
      electron: process.versions.electron || '',
      chrome: process.versions.chrome || '',
    };
  } catch (_) {
    return {
      name: 'OpenDraw',
      author: 'Marco Sodano',
      monogram: 'MS',
      edition: 'Standard Edition',
      version: '1.0.0',
      channel: 'stable',
      build: '',
      releaseDate: '',
      releaseNotes: [],
    };
  }
}

const CACHED_APP_INFO = readAppInfoSync();

contextBridge.exposeInMainWorld('openDraw', {
  // --- Menu event listeners ---
  onMenuAction: (callback) => {
    const channels = [
      'menu:new', 'menu:save', 'menu:save-as',
      'menu:undo', 'menu:redo',
      'menu:cut', 'menu:copy', 'menu:paste', 'menu:delete',
      'menu:select-all',
      'menu:zoom-in', 'menu:zoom-out', 'menu:zoom-fit', 'menu:zoom-100',
      'menu:toggle-grid', 'menu:toggle-rulers', 'menu:toggle-snap',
      'menu:toggle-shapes-panel', 'menu:toggle-properties-panel',
      'menu:export-png', 'menu:export-svg', 'menu:export-pdf',
      'menu:file-opened', 'menu:files-opened', 'menu:shortcuts',
      'theme:change', 'theme:system-updated',
      'layout:hierarchical-tb', 'layout:hierarchical-lr',
      'insert:rectangle', 'insert:ellipse', 'insert:diamond',
      'insert:triangle', 'insert:textbox', 'insert:image',
      'arrange:bring-front', 'arrange:send-back',
      'arrange:group', 'arrange:ungroup',
      'align:left', 'align:center-h', 'align:right',
      'align:top', 'align:center-v', 'align:bottom',
      'distribute:h', 'distribute:v',
    ];

    channels.forEach((channel) => {
      ipcRenderer.on(channel, (event, data) => {
        callback(channel, data);
      });
    });
  },

  // --- Dialogs & Export ---
  showOpenDialog: () => ipcRenderer.invoke('dialog:open'),
  showOpenFilesDialog: () => ipcRenderer.invoke('dialog:open-files'),
  showOpenStencilDialog: () => ipcRenderer.invoke('dialog:open-stencil'),
  loadDiagramFile: (filePath) => ipcRenderer.invoke('diagram:load', filePath),
  loadStencilFile: (filePath) => ipcRenderer.invoke('stencil:load', filePath),
  showSaveDialog: (defaultName) => ipcRenderer.invoke('dialog:save', defaultName),
  showExportDialog: (format) => ipcRenderer.invoke('dialog:export', format),
  exportPDF: (args) => ipcRenderer.invoke('export:pdf', args),
  convertEmfBatch: (files) => ipcRenderer.invoke('vsdx:convert-emf-batch', files),
  getInitialFile: () => ipcRenderer.invoke('app:get-initial-file'),
  getAppInfo: () => CACHED_APP_INFO,
  fetchAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getSystemTheme: () => ipcRenderer.invoke('theme:get-system'),
  setWindowTheme: (mode) => ipcRenderer.send('theme:set-window-icon', mode),
  getPathForFile: (file) => {
    try {
      return webUtils && webUtils.getPathForFile ? webUtils.getPathForFile(file) : (file && file.path) || '';
    } catch (_) {
      return (file && file.path) || '';
    }
  },

  // --- Window controls ---
  setTitle: (title) => ipcRenderer.send('title:update', title),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  newWindow: () => ipcRenderer.send('window:new'),
  openFileInNewWindow: (filePath) => ipcRenderer.send('window:open-file', filePath),
  arrangeAllWindows: () => ipcRenderer.send('window:arrange-all'),

  // --- File system (for save/load) ---
  readFile: (filePath) => {
    const fs = require('fs');
    return fs.promises.readFile(filePath, 'utf-8');
  },
  writeFile: (filePath, content) => {
    const fs = require('fs');
    return fs.promises.writeFile(filePath, content, 'utf-8');
  },
  readBinaryFile: (filePath) => {
    const fs = require('fs');
    return fs.promises.readFile(filePath);
  },
  writeBinaryFile: (filePath, buffer) => {
    const fs = require('fs');
    return fs.promises.writeFile(filePath, Buffer.from(buffer));
  },
});

