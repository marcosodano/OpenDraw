/**
 * OpenDraw — Main Process
 * 
 * Electron main process: creates the browser window, sets up menus,
 * and handles IPC communication with the renderer.
 */

const { app, BrowserWindow, Menu, ipcMain, dialog, screen, nativeTheme, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

app.commandLine.appendSwitch('disable-http-cache');

/** @type {Set<BrowserWindow>} */
const windows = new Set();

nativeTheme.on('updated', () => {
  const sysTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme:system-updated', sysTheme);
    }
  }
});
/** @type {BrowserWindow|null} */
let mainWindow = null;
let initialTargetFile = null;

const SUPPORTED_OPEN_EXTS = new Set(['.vsdx', '.vsdm', '.vstx', '.vstm', '.vssx', '.vssm', '.vsd', '.vst', '.vss', '.odraw']);

function isSupportedOpenExtension(filePath) {
  return filePath && SUPPORTED_OPEN_EXTS.has(path.extname(filePath).toLowerCase());
}

function extractSupportedFileFromArgv(argsList) {
  if (!Array.isArray(argsList) || argsList.length === 0) return null;
  const nonFlags = [];
  for (let i = 0; i < argsList.length; i++) {
    const a = argsList[i];
    if (a === '--screenshot' || a === '--open') { i++; continue; }
    if (a && a.startsWith('--screenshot=')) continue;
    if (a && a.startsWith('--open=')) {
      nonFlags.push(a.slice('--open='.length));
      continue;
    }
    if (!a || a === '.' || a.startsWith('--')) continue;
    nonFlags.push(a);
  }
  for (const arg of nonFlags) {
    const cleaned = arg.replace(/^["']+|["']+$/g, '');
    if (cleaned && fs.existsSync(cleaned) && isSupportedOpenExtension(cleaned)) {
      return path.resolve(cleaned);
    }
  }
  for (let i = 0; i < nonFlags.length; i++) {
    for (let j = i + 1; j <= nonFlags.length; j++) {
      const joined = nonFlags.slice(i, j).join(' ').replace(/^["']+|["']+$/g, '');
      if (joined && fs.existsSync(joined) && isSupportedOpenExtension(joined)) {
        return path.resolve(joined);
      }
    }
  }
  return null;
}

function getSenderWindow(event) {
  const win = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null;
  if (win && !win.isDestroyed()) return win;
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  for (const w of windows) {
    if (w && !w.isDestroyed()) return w;
  }
  return null;
}

function debugLog(line) {
  if (process.env.OPENDRAW_DEBUG !== '1') return;
  try {
    const logPath = path.join(app.getPath('userData'), 'main_debug.log');
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (_) {}
}

function getAppMetadata() {
  let meta = {};
  try {
    const verFile = path.join(__dirname, '..', 'shared', 'version.json');
    if (fs.existsSync(verFile)) {
      meta = JSON.parse(fs.readFileSync(verFile, 'utf8'));
    }
  } catch (_) {}
  const version = (typeof app?.getVersion === 'function' && app.getVersion()) || meta.version || '1.0.0';
  return {
    name: meta.name || 'OpenDraw',
    author: meta.author || 'Marco Sodano',
    monogram: meta.monogram || 'MS',
    edition: meta.edition || 'Standard Edition',
    version,
    channel: meta.channel || 'stable',
    build: meta.build || '',
    releaseDate: meta.releaseDate || '',
    releaseNotes: Array.isArray(meta.releaseNotes) ? meta.releaseNotes : [],
    electron: process.versions.electron || '',
    chrome: process.versions.chrome || '',
  };
}

let currentWindowIconTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';

function getWindowIconPath(mode = currentWindowIconTheme) {
  const file = mode === 'light' ? 'opendraw_light.ico' : 'opendraw_dark.ico';
  const candidate = path.join(__dirname, '..', '..', 'assets', 'icons', file);
  if (fs.existsSync(candidate)) return candidate;
  return path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.ico');
}

function getAboutIconImage() {
  const file = currentWindowIconTheme === 'light' ? 'opendraw-light-256.png' : 'opendraw-dark-256.png';
  const candidate = path.join(__dirname, '..', '..', 'assets', 'icons', file);
  if (fs.existsSync(candidate)) return nativeImage.createFromPath(candidate);
  return undefined;
}

/**
 * Create a main application window, optionally seeded with an initial file path.
 */
function createWindow(openFilePath = null) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'OpenDraw by Marco Sodano',
    frame: false,
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: true,
  });
  win._initialTargetFile = openFilePath ? path.resolve(openFilePath) : null;

  windows.add(win);
  mainWindow = win;
  win.on('focus', () => { mainWindow = win; });

  win.webContents.session.clearCache();

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
    debugLog(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Failed Load] ${errorCode}: ${errorDescription} (${validatedURL})`);
    debugLog(`[Renderer Failed Load] ${errorCode}: ${errorDescription} (${validatedURL})`);
  });

  // Prevent drag-and-drop or accidental links from navigating away from the application
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  const argsList = process.argv.slice(1);
  let screenshotPath = null;
  for (let i = 0; i < argsList.length; i++) {
    const a = argsList[i];
    if (a === '--screenshot' && argsList[i + 1]) {
      screenshotPath = argsList[i + 1].replace(/^["']+|["']+$/g, '');
      break;
    }
    if (a.startsWith('--screenshot=')) {
      screenshotPath = a.slice('--screenshot='.length).replace(/^["']+|["']+$/g, '');
      break;
    }
  }
  const isScreenshotMode = !!screenshotPath;

  // Parse CLI startup file BEFORE loadFile so app:get-initial-file sees it on DOMContentLoaded!
  const targetFile = win._initialTargetFile || (windows.size === 1 ? extractSupportedFileFromArgv(argsList) : null);
  debugLog(`[Main args] ${JSON.stringify(argsList)}, targetFile: ${targetFile}`);
  if (targetFile) {
    win._initialTargetFile = targetFile;
    if (windows.size === 1 && !initialTargetFile) {
      initialTargetFile = targetFile;
    }
    console.log('Opening file:', targetFile);
  }

  win.webContents.once('did-finish-load', () => {
    if (isScreenshotMode) {
      const expectFileLoad = !!targetFile;
      win.setSize(1600, 1000);
      win.show();
      const captureWhenReady = async () => {
        try {
          const deadline = Date.now() + 25000;
          while (Date.now() < deadline) {
            const done = await win.webContents.executeJavaScript(`
              (() => {
                if (window.__openDrawImporting) return false;
                const lo = document.getElementById('loading-overlay');
                if (lo && getComputedStyle(lo).display !== 'none') return false;
                const bs = document.getElementById('backstage-menu');
                if (${expectFileLoad}) {
                  return (!bs || bs.style.display === 'none') && window.canvasManager && window.canvasManager.canvas.getObjects().length > 2;
                }
                return true;
              })()
            `).catch(() => false);
            if (done) break;
            await new Promise(r => setTimeout(r, 250));
          }
          await new Promise(r => setTimeout(r, 350));
          if (process.argv.includes('--zoom-detail')) {
            await win.webContents.executeJavaScript(`
              if (window.canvasManager) {
                window.canvasManager.canvas.setViewportTransform([0.85, 0, 0, 0.85, -500, -750]);
                window.canvasManager.canvas.requestRenderAll();
              }
            `);
            await new Promise(r => setTimeout(r, 350));
          }
          const image = await win.webContents.capturePage();
          const pngBuf = image.toPNG();
          console.log('[Main] capturePage size:', image.getSize(), 'PNG bytes:', pngBuf.length);
          fs.writeFileSync(screenshotPath, pngBuf);
          console.log('[Main] Saved screenshot to:', screenshotPath);
        } catch (err) {
          console.error('[Main] Failed to capture screenshot:', err);
        }
        try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
        app.exit(0);
      };
      setTimeout(captureWhenReady, 600);
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  if (!isScreenshotMode) {
    win.maximize();
  } else {
    win.setSize(1600, 1000);
  }

  win.on('closed', () => {
    windows.delete(win);
    if (mainWindow === win) {
      mainWindow = windows.size > 0 ? windows.values().next().value : null;
    }
  });

  setupMenu();
}

/**
 * Build the application menu bar.
 */
function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('menu:new'),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleFileOpen(),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('menu:save-as'),
        },
        { type: 'separator' },
        {
          label: 'Export as PNG...',
          click: () => sendToRenderer('menu:export-png'),
        },
        {
          label: 'Export as SVG...',
          click: () => sendToRenderer('menu:export-svg'),
        },
        {
          label: 'Export as PDF...',
          click: () => sendToRenderer('menu:export-pdf'),
        },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToRenderer('menu:undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => sendToRenderer('menu:redo'),
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => sendToRenderer('menu:cut'),
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => sendToRenderer('menu:copy'),
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => sendToRenderer('menu:paste'),
        },
        {
          label: 'Delete',
          accelerator: 'Delete',
          click: () => sendToRenderer('menu:delete'),
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => sendToRenderer('menu:select-all'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendToRenderer('menu:zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendToRenderer('menu:zoom-out'),
        },
        {
          label: 'Zoom to Fit',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => sendToRenderer('menu:zoom-fit'),
        },
        {
          label: 'Zoom 100%',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendToRenderer('menu:zoom-100'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Grid',
          accelerator: 'CmdOrCtrl+G',
          click: () => sendToRenderer('menu:toggle-grid'),
        },
        {
          label: 'Toggle Rulers',
          click: () => sendToRenderer('menu:toggle-rulers'),
        },
        {
          label: 'Toggle Snap to Grid',
          click: () => sendToRenderer('menu:toggle-snap'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Shapes Panel',
          click: () => sendToRenderer('menu:toggle-shapes-panel'),
        },
        {
          label: 'Toggle Properties Panel',
          click: () => sendToRenderer('menu:toggle-properties-panel'),
        },
        { type: 'separator' },
        {
          label: 'Theme',
          submenu: [
            { label: 'Follow Operating System', click: () => sendToRenderer('theme:change', 'system') },
            { label: 'Light', click: () => sendToRenderer('theme:change', 'light') },
            { label: 'Dark', click: () => sendToRenderer('theme:change', 'dark') },
            { type: 'separator' },
            { label: 'Office Colorful (Blue)', click: () => sendToRenderer('theme:change', 'office-blue') },
            { label: 'Office Dark Gray', click: () => sendToRenderer('theme:change', 'office-dark-gray') },
          ],
        },
        { type: 'separator' },
        { label: 'Toggle Dev Tools', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Insert',
      submenu: [
        {
          label: 'Rectangle',
          click: () => sendToRenderer('insert:rectangle'),
        },
        {
          label: 'Ellipse',
          click: () => sendToRenderer('insert:ellipse'),
        },
        {
          label: 'Diamond',
          click: () => sendToRenderer('insert:diamond'),
        },
        {
          label: 'Triangle',
          click: () => sendToRenderer('insert:triangle'),
        },
        { type: 'separator' },
        {
          label: 'Text Box',
          click: () => sendToRenderer('insert:textbox'),
        },
        {
          label: 'Image...',
          click: () => sendToRenderer('insert:image'),
        },
      ],
    },
    {
      label: 'Arrange',
      submenu: [
        {
          label: 'Bring to Front',
          accelerator: 'CmdOrCtrl+Shift+]',
          click: () => sendToRenderer('arrange:bring-front'),
        },
        {
          label: 'Send to Back',
          accelerator: 'CmdOrCtrl+Shift+[',
          click: () => sendToRenderer('arrange:send-back'),
        },
        { type: 'separator' },
        {
          label: 'Align Left',
          click: () => sendToRenderer('align:left'),
        },
        {
          label: 'Align Center',
          click: () => sendToRenderer('align:center-h'),
        },
        {
          label: 'Align Right',
          click: () => sendToRenderer('align:right'),
        },
        { type: 'separator' },
        {
          label: 'Align Top',
          click: () => sendToRenderer('align:top'),
        },
        {
          label: 'Align Middle',
          click: () => sendToRenderer('align:center-v'),
        },
        {
          label: 'Align Bottom',
          click: () => sendToRenderer('align:bottom'),
        },
        { type: 'separator' },
        {
          label: 'Distribute Horizontally',
          click: () => sendToRenderer('distribute:h'),
        },
        {
          label: 'Distribute Vertically',
          click: () => sendToRenderer('distribute:v'),
        },
        { type: 'separator' },
        {
          label: 'Group',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendToRenderer('arrange:group'),
        },
        {
          label: 'Ungroup',
          accelerator: 'CmdOrCtrl+Shift+U',
          click: () => sendToRenderer('arrange:ungroup'),
        },
        { type: 'separator' },
        {
          label: 'Auto-Layout (Top-to-Bottom)',
          click: () => sendToRenderer('layout:hierarchical-tb'),
        },
        {
          label: 'Auto-Layout (Left-to-Right)',
          click: () => sendToRenderer('layout:hierarchical-lr'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'F1',
          click: () => sendToRenderer('menu:shortcuts'),
        },
        { type: 'separator' },
        {
          label: 'About OpenDraw',
          click: () => {
            const info = getAppMetadata();
            const buildSuffix = info.build ? ` (Build ${info.build})` : '';
            const dateLine = info.releaseDate ? `\nRelease Date: ${info.releaseDate}` : '';
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: `About OpenDraw v${info.version}`,
              message: `${info.name} v${info.version}`,
              detail: `Version ${info.version}${buildSuffix} — ${info.edition}${dateLine}\nA powerful vector diagramming workstation.\nCreated by ${info.author}.`,
              icon: getAboutIconImage(),
            });
          },
        },
      ],
    },
  ];

  // Disable redundant Electron window menu bar (Ribbon is the menu)
  Menu.setApplicationMenu(null);
}

/**
 * Send a message to the renderer process.
 * @param {string} channel - IPC channel name
 * @param {*} [data] - Optional data payload
 */
function sendToRenderer(channel, data) {
  const win = getSenderWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}

/**
 * Handle the File > Open dialog.
 */
async function handleFileOpen() {
  const win = getSenderWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Diagram(s) or Stencil(s)',
    filters: OPEN_DIAGRAM_FILTERS,
    properties: ['openFile', 'multiSelections'],
  });

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    if (result.filePaths.length === 1) {
      sendToRenderer('menu:file-opened', result.filePaths[0]);
    } else {
      sendToRenderer('menu:files-opened', result.filePaths);
    }
  }
}

// --- IPC Handlers ---

ipcMain.handle('vsdx:convert-emf-batch', async (event, files) => {
  const os = require('os');
  if (!files || files.length === 0) return [];

  const cacheDir = path.join(app.getPath('userData'), 'emf_cache_v3');
  fs.mkdirSync(cacheDir, { recursive: true });

  const results = [];
  const toConvert = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || !f.base64) continue;
    const rawBuf = Buffer.from(f.base64, 'base64');
    const sha = crypto.createHash('sha256').update(rawBuf).digest('hex');
    const cachedPng = path.join(cacheDir, sha + '.png');
    if (fs.existsSync(cachedPng)) {
      const pngBuf = fs.readFileSync(cachedPng);
      results.push({
        name: f.name,
        dataUrl: 'data:image/png;base64,' + pngBuf.toString('base64'),
      });
    } else {
      toConvert.push({ name: f.name, rawBuf, sha, cachedPng });
    }
  }

  if (toConvert.length === 0) return results;

  const tempDir = path.join(os.tmpdir(), 'opendraw_emf_' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const manifest = [];
    for (let i = 0; i < toConvert.length; i++) {
      const item = toConvert[i];
      const ext = path.extname(item.name || '').toLowerCase() || '.emf';
      const safeExt = ['.emf', '.wmf', '.bmp', '.dib'].includes(ext) ? ext : '.emf';
      const srcPath = path.join(tempDir, `file_${i}${safeExt}`);
      const pngPath = path.join(tempDir, `file_${i}.png`);
      fs.writeFileSync(srcPath, item.rawBuf);
      manifest.push({ srcPath, ext: safeExt, pngPath, cachedPng: item.cachedPng, name: item.name });
    }

    const manifestPath = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');

    const psScript = path.join(tempDir, 'convert.ps1');
    const psCode = [
      '$ErrorActionPreference = "SilentlyContinue"',
      'Add-Type -AssemblyName System.Drawing',
      '$items = Get-Content -LiteralPath $args[0] -Raw | ConvertFrom-Json',
      '$smooth = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias',
      '$interp = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
      '$pixel = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality',
      '$comp = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality',
      '$format = [System.Drawing.Imaging.ImageFormat]::Png',
      '$pFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb',
      'foreach ($it in $items) {',
      '  try {',
      '    $meta = [System.Drawing.Image]::FromFile($it.srcPath)',
      '    if ($it.ext -eq ".bmp" -or $it.ext -eq ".dib") {',
      '      $meta.Save($it.pngPath, $format)',
      '      $meta.Dispose()',
      '    } else {',
      '      $mw = [Math]::Max(1, $meta.Width)',
      '      $mh = [Math]::Max(1, $meta.Height)',
      '      $maxDim = [Math]::Min(1600, [Math]::Max(768, [Math]::Max($mw, $mh) * 6))',
      '      if ($mw -ge $mh) {',
      '        $tw = $maxDim',
      '        $th = [Math]::Max(1, [int][Math]::Round($tw * $mh / $mw))',
      '      } else {',
      '        $th = $maxDim',
      '        $tw = [Math]::Max(1, [int][Math]::Round($th * $mw / $mh))',
      '      }',
      '      $bmp = New-Object System.Drawing.Bitmap($tw, $th, $pFormat)',
      '      $bmp.SetResolution(300, 300)',
      '      $g = [System.Drawing.Graphics]::FromImage($bmp)',
      '      $g.SmoothingMode = $smooth',
      '      $g.InterpolationMode = $interp',
      '      $g.PixelOffsetMode = $pixel',
      '      $g.CompositingQuality = $comp',
      '      $g.Clear([System.Drawing.Color]::Transparent)',
      '      $rect = New-Object System.Drawing.Rectangle(0, 0, $tw, $th)',
      '      $g.DrawImage($meta, $rect)',
      '      $g.Dispose()',
      '      $meta.Dispose()',
      '      $bmp.Save($it.pngPath, $format)',
      '      $bmp.Dispose()',
      '    }',
      '  } catch {}',
      '}'
    ].join('\r\n');
    fs.writeFileSync(psScript, psCode, 'utf8');

    await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript, manifestPath], {
      windowsHide: true,
      timeout: 45000,
      maxBuffer: 16 * 1024 * 1024,
    });

    for (const item of manifest) {
      if (fs.existsSync(item.pngPath)) {
        const pngBuf = fs.readFileSync(item.pngPath);
        try { fs.writeFileSync(item.cachedPng, pngBuf); } catch (_) {}
        results.push({
          name: item.name,
          dataUrl: 'data:image/png;base64,' + pngBuf.toString('base64'),
        });
      }
    }
    return results;
  } catch (err) {
    console.error('Failed to batch convert EMF:', err);
    return results;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
});

ipcMain.handle('theme:get-system', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

ipcMain.handle('app:get-info', () => getAppMetadata());

ipcMain.handle('app:get-initial-file', (event) => {
  const win = getSenderWindow(event);
  if (win && win._initialTargetFile) {
    const target = win._initialTargetFile;
    win._initialTargetFile = null;
    return target;
  }
  const target = initialTargetFile;
  initialTargetFile = null;
  return target;
});

let lastStencilDir = null;

const OPEN_DIAGRAM_FILTERS = [
  { name: 'All Supported Visio & OpenDraw Files (*.vsdx, *.vsdm, *.vstx, *.vstm, *.vssx, *.vssm, *.vsd, *.vst, *.vss, *.odraw)', extensions: ['vsdx', 'vsdm', 'vstx', 'vstm', 'vssx', 'vssm', 'vsd', 'vst', 'vss', 'odraw'] },
  { name: 'Visio Diagrams (*.vsdx, *.vsdm, *.vsd)', extensions: ['vsdx', 'vsdm', 'vsd'] },
  { name: 'Visio Templates (*.vstx, *.vstm, *.vst)', extensions: ['vstx', 'vstm', 'vst'] },
  { name: 'Visio Stencils (*.vssx, *.vssm, *.vss)', extensions: ['vssx', 'vssm', 'vss'] },
  { name: 'OpenDraw Files (*.odraw)', extensions: ['odraw'] },
  { name: 'All Files (*.*)', extensions: ['*'] },
];

ipcMain.handle('dialog:open', async (event) => {
  const result = await dialog.showOpenDialog(getSenderWindow(event), {
    title: 'Open Diagram or Stencil',
    filters: OPEN_DIAGRAM_FILTERS,
    properties: ['openFile'],
  });
  return (result.canceled || !result.filePaths || result.filePaths.length === 0) ? null : result.filePaths[0];
});

ipcMain.handle('dialog:open-files', async (event) => {
  const result = await dialog.showOpenDialog(getSenderWindow(event), {
    title: 'Open Diagram(s) or Stencil(s)',
    filters: OPEN_DIAGRAM_FILTERS,
    properties: ['openFile', 'multiSelections'],
  });
  return (result.canceled || !result.filePaths) ? [] : result.filePaths;
});

ipcMain.handle('dialog:open-stencil', async (event) => {
  let defaultDir = lastStencilDir;
  if (!defaultDir || !fs.existsSync(defaultDir)) {
    try {
      const myShapesDir = path.join(app.getPath('documents'), 'My Shapes');
      if (fs.existsSync(myShapesDir)) {
        defaultDir = myShapesDir;
      } else {
        defaultDir = app.getPath('documents');
      }
    } catch (e) {
      const visioDir = 'C:\\Program Files\\Microsoft Office\\root\\Office16\\Visio Content\\1033';
      defaultDir = fs.existsSync(visioDir) ? visioDir : undefined;
    }
  }

  const result = await dialog.showOpenDialog(getSenderWindow(event), {
    title: 'Open Stencil (.vssx, .vss)',
    defaultPath: defaultDir,
    filters: [
      { name: 'Stencil Files (*.vssx, *.vss, *.vstx, *.vst)', extensions: ['vssx', 'vss', 'vstx', 'vst'] },
      { name: 'Modern Stencils (*.vssx)', extensions: ['vssx'] },
      { name: 'Binary Stencils (*.vss)', extensions: ['vss'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    lastStencilDir = path.dirname(result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

async function _loadOrConvertVisioContainer(filePath, cacheSubdir, outExt, errorLabel) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('File not found: ' + filePath);
  }

  const stats = fs.statSync(filePath);
  const header = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, header, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }

  const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
  const isOle = header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0;

  if (isZip || !isOle) {
    return {
      buffer: fs.readFileSync(filePath),
      fileName: path.basename(filePath),
      isConverted: false
    };
  }

  const hash = crypto.createHash('sha256').update(filePath + stats.size + stats.mtimeMs).digest('hex');
  const cacheDir = path.join(app.getPath('userData'), cacheSubdir);
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachedFile = path.join(cacheDir, hash + outExt);

  if (fs.existsSync(cachedFile)) {
    return {
      buffer: fs.readFileSync(cachedFile),
      fileName: path.basename(filePath),
      isConverted: true,
      fromCache: true
    };
  }

  const scriptPath = path.join(cacheDir, 'convert_' + Date.now() + '.ps1');
  const psContent = [
    '$src = $args[0]',
    '$dst = $args[1]',
    '$app = New-Object -ComObject "Visio.InvisibleApp"',
    '$app.AlertResponse = 1',
    'try {',
    '  $doc = $app.Documents.OpenEx($src, 2 + 128)',
    '  $doc.SaveAsEx($dst, 0)',
    '  $doc.Saved = $true',
    '  $doc.Close()',
    '} finally {',
    '  try { $app.Quit() } catch {}',
    '  try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null } catch {}',
    '}'
  ].join('\r\n');

  fs.writeFileSync(scriptPath, psContent, 'utf8');

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, filePath, cachedFile], {
      windowsHide: true,
      timeout: 60000
    });
  } catch (err) {
    console.error(`Failed to convert legacy ${errorLabel}:`, err);
    throw new Error(`Failed to convert legacy ${errorLabel}: ` + err.message);
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (_) {}
  }

  if (!fs.existsSync(cachedFile)) {
    throw new Error(`Conversion to modern Visio format failed for ${errorLabel}.`);
  }

  return {
    buffer: fs.readFileSync(cachedFile),
    fileName: path.basename(filePath),
    isConverted: true,
    fromCache: false
  };
}

ipcMain.handle('stencil:load', async (event, filePath) => {
  return _loadOrConvertVisioContainer(filePath, 'stencil_cache', '.vssx', 'binary stencil (.vss)');
});

ipcMain.handle('diagram:load', async (event, filePath) => {
  return _loadOrConvertVisioContainer(filePath, 'diagram_cache', '.vsdx', 'binary Visio drawing');
});

ipcMain.handle('dialog:save', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(getSenderWindow(event), {
    title: 'Save Diagram',
    defaultPath: defaultName || 'Untitled.odraw',
    filters: [
      { name: 'OpenDraw Files (*.odraw)', extensions: ['odraw'] },
      { name: 'Drawing Files (*.vsdx)', extensions: ['vsdx'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('dialog:export', async (event, format) => {
  const filters = {
    png: [{ name: 'PNG Image', extensions: ['png'] }],
    svg: [{ name: 'SVG Vector', extensions: ['svg'] }],
    pdf: [{ name: 'PDF Document', extensions: ['pdf'] }],
  };

  const result = await dialog.showSaveDialog(getSenderWindow(event), {
    title: `Export as ${format.toUpperCase()}`,
    defaultPath: `Untitled.${format}`,
    filters: filters[format] || [{ name: 'All Files', extensions: ['*'] }],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('export:pdf', async (event, args) => {
  const os = require('os');
  const filePath = typeof args === 'string' ? args : (args && args.filePath);
  if (!filePath) return false;

  const pages = (args && args.pages) ? args.pages : (args && args.dataUrl ? [{ dataUrl: args.dataUrl, width: args.width, height: args.height }] : null);

  if (pages && pages.length > 0) {
    const isFirstLandscape = (pages[0].width || 1100) >= (pages[0].height || 850);
    const pdfWin = new BrowserWindow({
      show: false,
      width: 1200,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    const tmpHtmlPath = path.join(os.tmpdir(), `opendraw_pdf_${Date.now()}.html`);

    try {
      const pageRules = pages.map((p, idx) => {
        const land = (p.width || 1100) >= (p.height || 850);
        return `@page page_${idx} { size: ${land ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }`;
      }).join('\n');

      const pagesHtml = pages.map((p, idx) => `
        <div class="page-container" style="page: page_${idx}; ${idx > 0 ? 'break-before: page;' : ''} width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 0;">
          <img src="${p.dataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
        </div>
      `).join('');

      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    ${pageRules}
    html, body { margin: 0; padding: 0; background: #ffffff; }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

      await fs.promises.writeFile(tmpHtmlPath, fullHtml, 'utf8');
      await pdfWin.loadFile(tmpHtmlPath);
      await pdfWin.webContents.executeJavaScript(`
        Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : img.decode().catch(() => {})))
      `);

      const pdfData = await pdfWin.webContents.printToPDF({
        preferCSSPageSize: true,
        pageSize: 'A4',
        landscape: isFirstLandscape,
        printBackground: true,
        margins: { marginType: 'none' },
      });

      await fs.promises.writeFile(filePath, pdfData);
      return true;
    } finally {
      try { if (!pdfWin.isDestroyed()) pdfWin.destroy(); } catch (_) {}
      try { fs.unlinkSync(tmpHtmlPath); } catch (_) {}
    }
  } else {
    const win = getSenderWindow(event);
    if (!win) return false;
    const data = await win.webContents.printToPDF({
      pageSize: 'A4',
      landscape: true,
      printBackground: true,
    });
    await fs.promises.writeFile(filePath, data);
    return true;
  }
});

ipcMain.on('title:update', (event, title) => {
  const win = getSenderWindow(event);
  if (win) {
    win.setTitle(`OpenDraw — ${title}`);
  }
});

ipcMain.on('theme:set-window-icon', (event, mode) => {
  const normalized = mode === 'light' ? 'light' : 'dark';
  currentWindowIconTheme = normalized;
  const win = getSenderWindow(event);
  if (win && !win.isDestroyed()) {
    try {
      const iconPath = getWindowIconPath(normalized);
      const img = nativeImage.createFromPath(iconPath);
      if (img && !img.isEmpty()) {
        win.setIcon(img);
      } else {
        win.setIcon(iconPath);
      }
    } catch (_) {}
  }
});

// Window controls IPC for frameless Office titlebar
ipcMain.on('window:minimize', (event) => {
  const win = getSenderWindow(event);
  if (win) win.minimize();
});

ipcMain.on('window:maximize', (event) => {
  const win = getSenderWindow(event);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window:close', (event) => {
  const win = getSenderWindow(event);
  if (win) win.close();
});

ipcMain.handle('window:isMaximized', (event) => {
  const win = getSenderWindow(event);
  return win ? win.isMaximized() : false;
});

ipcMain.on('window:new', () => {
  createWindow();
});

ipcMain.on('window:open-file', (_event, filePath) => {
  if (filePath && typeof filePath === 'string') {
    createWindow(filePath);
  }
});

let isWindowsArranged = false;
const savedWindowBoundsMap = new Map();

ipcMain.on('window:arrange-all', async () => {
  const windows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
  if (windows.length === 0) return;

  if (isWindowsArranged) {
    // Restore all windows to their previous bounds / maximized states
    for (const win of windows) {
      const saved = savedWindowBoundsMap.get(win.id);
      if (saved) {
        if (saved.wasMaximized) {
          win.maximize();
        } else if (saved.bounds) {
          win.setBounds(saved.bounds);
        }
      } else {
        win.maximize();
      }
    }
    isWindowsArranged = false;
    savedWindowBoundsMap.clear();
    return;
  }

  // Save current bounds / maximized state before arranging
  savedWindowBoundsMap.clear();
  await Promise.all(windows.map(win => {
    return new Promise(resolve => {
      savedWindowBoundsMap.set(win.id, {
        wasMaximized: win.isMaximized(),
        bounds: win.getBounds(),
      });
      if (win.isMaximized()) {
        const timeout = setTimeout(resolve, 150);
        win.once('unmaximize', () => {
          clearTimeout(timeout);
          resolve();
        });
        win.unmaximize();
      } else {
        resolve();
      }
    });
  }));

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  if (windows.length === 1) {
    // For single window: center it at 85% width x 88% height so it clearly arranges and floats
    const w = Math.round(width * 0.85);
    const h = Math.round(height * 0.88);
    const posX = x + Math.round((width - w) / 2);
    const posY = y + Math.round((height - h) / 2);
    windows[0].setBounds({ x: posX, y: posY, width: w, height: h });
    isWindowsArranged = true;
    return;
  }

  if (windows.length === 2) {
    const halfW = Math.floor(width / 2);
    windows[0].setBounds({ x, y, width: halfW, height });
    windows[1].setBounds({ x: x + halfW, y, width: halfW, height });
    isWindowsArranged = true;
    return;
  }

  const cols = Math.ceil(Math.sqrt(windows.length));
  const rows = Math.ceil(windows.length / cols);
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);

  windows.forEach((win, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    win.setBounds({
      x: x + c * cellW,
      y: y + r * cellH,
      width: cellW,
      height: cellH,
    });
  });
  isWindowsArranged = true;
});

// --- App Lifecycle ---

if (process.platform === 'win32') {
  app.setAppUserModelId('OpenDraw.ByMarcoSodano');
}

const isScreenshotLaunch = process.argv.some(a => a === '--screenshot' || (a && a.startsWith('--screenshot=')));

if (isScreenshotLaunch) {
  app.whenReady().then(() => createWindow());
} else {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, commandLine) => {
      const incomingFile = extractSupportedFileFromArgv(commandLine.slice(1));
      if (incomingFile) {
        createWindow(incomingFile);
        return;
      }
      const existing = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      if (existing) {
        if (existing.isMinimized()) existing.restore();
        existing.focus();
      } else {
        createWindow();
      }
    });
    app.whenReady().then(() => createWindow());
  }
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
