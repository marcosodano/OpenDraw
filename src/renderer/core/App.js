/**
 * App.js — Main application entry point.
 * 
 * Initializes all managers and controllers, wires up IPC
 * communication with the main process, and handles drag-and-drop
 * from the stencil panel onto the canvas.
 */

// =========================================
// INITIALIZATION
// =========================================

/** @type {CanvasManager} */
let canvasManager;
/** @type {ToolbarController} */
let toolbarController;
/** @type {StatusBarController} */
let statusBarController;
/** @type {PanelController} */
let panelController;

/** Current file path (null if unsaved) */
let currentFilePath = null;

/**
 * Boot the application once the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    // 1. Canvas engine
    canvasManager = new CanvasManager();
    canvasManager.init();
    window.canvasManager = canvasManager;

    // 2. UI Controllers
    toolbarController = new ToolbarController(canvasManager);
    statusBarController = new StatusBarController(canvasManager);
    panelController = new PanelController(canvasManager);
    window.toolbarController = toolbarController;
    window.statusBarController = statusBarController;
    window.panelController = panelController;
    contextMenuManager = canvasManager.contextMenuManager;
    window.contextMenuManager = contextMenuManager;

    // 3. Wire up IPC from main process menu + global shortcuts
    setupMenuIPC();
    setupGlobalShortcuts();

    // 4. Enable drag-and-drop from stencil panel to canvas
    setupStencilDrop();

    // 5. Wire object:modified for live property updates
    setupObjectModifiedTracking();

    // 6. Wire shortcuts modal controls
    setupShortcutsModal();

    // 7. Wire window titlebar controls
    setupWindowTitlebarControls();

    // 8. Wire Format Shape button
    setupFormatShapeButton();

    // 9. Wire Visio Start Screen & Backstage + Version Metadata
    hydrateAppVersionUI();
    setupVisioStartScreen();

    // 10. Check if an initial file was passed via command line
    if (window.openDraw && window.openDraw.getInitialFile) {
      window.openDraw.getInitialFile().then((initFile) => {
        if (initFile && !currentFilePath) {
          window.__openDrawHasInitialFile = true;
          handleFileOpen(initFile);
        } else if (!initFile && !currentFilePath) {
          showVisioStartScreen();
        }
      });
    } else if (!currentFilePath) {
      showVisioStartScreen();
    }

    console.log('OpenDraw initialized successfully');
  } catch (err) {
    console.error('Failed to initialize OpenDraw:', err);
  }
});

const OD_SYSTEM_TYPES = new Set([
  'grid-line', 'page-background', 'connector-arrow',
  'connector-handle', 'autoconnect-trigger', 'port-marker',
  'guide-line', 'preview-rect'
]);
const OD_SERIALIZE_PROPS = [
  'objectType', 'shapeType', 'shapeData', 'layerId',
  'connectionPoints', 'hyperlink', 'screenTip', 'visioFill',
  'visioStroke', 'isContainer', 'commentAuthor', 'commentDate'
];

function isSystemCanvasObject(obj) {
  return !obj || obj.isGridLine || obj.isPageBg || obj.isGuide || OD_SYSTEM_TYPES.has(obj.objectType);
}

// =========================================
// MENU IPC — Bridge from Electron menus
// =========================================

function setupMenuIPC() {
  if (!window.openDraw) {
    console.warn('openDraw API not available (not running in Electron)');
    return;
  }

  window.openDraw.onMenuAction((channel, data) => {
    switch (channel) {
      // --- File ---
      case 'menu:new':
        handleNew();
        break;
      case 'menu:save':
        handleSave();
        break;
      case 'menu:save-as':
        handleSaveAs();
        break;
      case 'menu:file-opened':
        handleFileOpen(data);
        break;
      case 'menu:files-opened':
        handleFilesOpen(data);
        break;
      case 'menu:export-png':
        handleExport('png');
        break;
      case 'menu:export-svg':
        handleExport('svg');
        break;
      case 'menu:export-pdf':
        handleExport('pdf');
        break;

      // --- Edit ---
      case 'menu:undo':
        window.undoManager.undo();
        break;
      case 'menu:redo':
        window.undoManager.redo();
        break;
      case 'menu:delete':
        canvasManager._deleteSelected();
        break;
      case 'menu:select-all':
        selectAll();
        break;
      case 'menu:cut':
        handleCut();
        break;
      case 'menu:copy':
        handleCopy();
        break;
      case 'menu:paste':
        handlePaste();
        break;

      // --- View ---
      case 'menu:zoom-in':
        canvasManager.zoomIn();
        break;
      case 'menu:zoom-out':
        canvasManager.zoomOut();
        break;
      case 'menu:zoom-fit':
        canvasManager.zoomToFit();
        break;
      case 'menu:zoom-100':
        canvasManager.zoom100();
        break;
      case 'menu:toggle-grid':
        canvasManager.gridManager.toggleGrid();
        break;
      case 'menu:toggle-rulers':
        canvasManager.rulerManager.toggle();
        break;
      case 'menu:toggle-snap':
        canvasManager.gridManager.toggleSnap();
        break;
      case 'menu:toggle-shapes-panel':
        if (window.panelController) {
          window.panelController.toggleShapesPanel();
        } else {
          document.getElementById('shapes-panel').classList.toggle('collapsed');
        }
        break;
      case 'menu:toggle-properties-panel':
        if (window.panelController) {
          window.panelController.togglePropertiesPanel();
        } else {
          document.getElementById('properties-panel').classList.toggle('collapsed');
        }
        break;

      // --- View & Theme ---
      case 'theme:change':
        if (canvasManager.themeManager) {
          canvasManager.themeManager.applyUITheme(data);
        }
        break;

      // --- Insert ---
      case 'insert:rectangle':
      case 'insert:ellipse':
      case 'insert:diamond':
      case 'insert:triangle':
      case 'insert:textbox':
        canvasManager.setTool(channel);
        break;

      // --- Arrange ---
      case 'arrange:bring-front':
        bringToFront();
        break;
      case 'arrange:send-back':
        sendToBack();
        break;
      case 'arrange:group':
        groupSelected();
        break;
      case 'arrange:ungroup':
        ungroupSelected();
        break;

      // --- Auto-Layout ---
      case 'layout:hierarchical-tb':
        if (canvasManager.autoLayoutManager) {
          canvasManager.autoLayoutManager.layoutTopToBottom();
        }
        break;
      case 'layout:hierarchical-lr':
        if (canvasManager.autoLayoutManager) {
          canvasManager.autoLayoutManager.layoutLeftToRight();
        }
        break;

      // --- Align ---
      case 'align:left':
      case 'align:center-h':
      case 'align:right':
      case 'align:top':
      case 'align:center-v':
      case 'align:bottom':
        alignObjects(channel.replace('align:', ''));
        break;

      // --- Distribute ---
      case 'distribute:h':
        canvasManager.distributeHorizontal();
        break;
      case 'distribute:v':
        canvasManager.distributeVertical();
        break;

      // --- Help ---
      case 'menu:shortcuts':
        showShortcutsModal();
        break;
    }
  });
}

function setupGlobalShortcuts() {
  // Global keyboard shortcuts (registered unconditionally, even outside Electron IPC)
  document.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      activeEl.isContentEditable ||
      activeEl.id === 'inline-text-editor'
    );

    // Escape always closes modals, backstage, or cancels text edit
    if (e.key === 'Escape') {
      hideShortcutsModal();
      const backstage = document.getElementById('backstage-menu');
      if (backstage) backstage.style.display = 'none';
      if (canvasManager.inlineTextEditor) canvasManager.inlineTextEditor.cancel();
      if (document.body.classList.contains('presentation-mode') && window.toolbarController && window.toolbarController._exitPresentationMode) {
        window.toolbarController._exitPresentationMode();
      }
      return;
    }

    if (e.key === 'F5' && !isTyping) {
      e.preventDefault();
      if (window.toolbarController && window.toolbarController._togglePresentationMode) {
        window.toolbarController._togglePresentationMode();
      }
      return;
    }

    if (isTyping) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (isCtrl && !e.shiftKey && key === 'z') { e.preventDefault(); window.undoManager.undo(); return; }
    if ((isCtrl && key === 'y') || (isCtrl && e.shiftKey && key === 'z')) { e.preventDefault(); window.undoManager.redo(); return; }
    if (isCtrl && !e.shiftKey && key === 's') { e.preventDefault(); handleSave(); return; }
    if (isCtrl && e.shiftKey && key === 's') { e.preventDefault(); handleSaveAs(); return; }
    if (isCtrl && !e.shiftKey && key === 'o') { e.preventDefault(); handleOpen(); return; }
    if (isCtrl && !e.shiftKey && key === 'n') { e.preventDefault(); handleNew(); return; }
    if (isCtrl && !e.shiftKey && key === 'a') { e.preventDefault(); selectAll(); return; }
    if (isCtrl && !e.shiftKey && key === 'c') { e.preventDefault(); handleCopy(); return; }
    if (isCtrl && !e.shiftKey && key === 'v') { e.preventDefault(); handlePaste(); return; }
    if (isCtrl && !e.shiftKey && key === 'x') { e.preventDefault(); handleCut(); return; }
    if (isCtrl && !e.shiftKey && key === 'd') { e.preventDefault(); duplicateSelected(); return; }
    if (isCtrl && e.shiftKey && key === 'c') { e.preventDefault(); copyStyle(); return; }
    if (isCtrl && e.shiftKey && key === 'v') { e.preventDefault(); pasteStyle(); return; }
    if (isCtrl && e.shiftKey && key === 'f') { e.preventDefault(); canvasManager.zoomToFit(); return; }
    if (isCtrl && !e.shiftKey && key === 'f') { e.preventDefault(); if (window.toolbarController && window.toolbarController._showFindReplaceDialog) window.toolbarController._showFindReplaceDialog(); return; }
    if (isCtrl && !e.shiftKey && key === 'k') { e.preventDefault(); if (window.toolbarController && window.toolbarController._insertLink) window.toolbarController._insertLink(); return; }
    if (isCtrl && !e.shiftKey && key === 'g') { e.preventDefault(); groupSelected(); return; }
    if ((isCtrl && e.shiftKey && key === 'u') || (isCtrl && e.shiftKey && key === 'g')) { e.preventDefault(); ungroupSelected(); return; }
    if (isCtrl && !e.shiftKey && key === ']') { e.preventDefault(); bringForward(); return; }
    if (isCtrl && !e.shiftKey && key === '[') { e.preventDefault(); sendBackward(); return; }
    if (isCtrl && e.shiftKey && (key === ']' || key === '}')) { e.preventDefault(); bringToFront(); return; }
    if (isCtrl && e.shiftKey && (key === '[' || key === '{')) { e.preventDefault(); sendToBack(); return; }
    if (isCtrl && !e.shiftKey && key === 'b' && window.toolbarController) { e.preventDefault(); window.toolbarController._toggleSelectedFontStyle('bold'); return; }
    if (isCtrl && !e.shiftKey && key === 'i' && window.toolbarController) { e.preventDefault(); window.toolbarController._toggleSelectedFontStyle('italic'); return; }
    if (isCtrl && !e.shiftKey && key === 'u' && window.toolbarController) { e.preventDefault(); window.toolbarController._toggleSelectedFontStyle('underline'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); canvasManager._deleteSelected(); return; }

    // --- Function keys ---
    if (e.key === 'F1') {
      e.preventDefault();
      showShortcutsModal();
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      const active = canvasManager.canvas.getActiveObject();
      if (active && canvasManager.inlineTextEditor) {
        canvasManager.inlineTextEditor.edit(active);
      }
      return;
    }

    // --- Tools switching ---
    // Pointer Tool: Ctrl+1 or 'v'
    if ((isCtrl && e.key === '1') || (!isCtrl && key === 'v')) {
      e.preventDefault();
      canvasManager.setTool('select');
      return;
    }
    // Text Tool: Ctrl+2 or 't'
    if ((isCtrl && e.key === '2') || (!isCtrl && key === 't')) {
      e.preventDefault();
      canvasManager.setTool('insert:textbox');
      return;
    }
    // Connector Tool: Ctrl+3
    if (isCtrl && e.key === '3') {
      e.preventDefault();
      canvasManager.setTool('insert:connector');
      return;
    }
    // Pan Tool: 'h' or Ctrl+Shift+W
    if ((!isCtrl && key === 'h') || (isCtrl && e.shiftKey && key === 'w')) {
      e.preventDefault();
      canvasManager.setTool('pan');
      return;
    }

    // --- Zoom shortcuts ---
    if (isCtrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      canvasManager.zoomIn();
      return;
    }
    if (isCtrl && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      canvasManager.zoomOut();
      return;
    }
    if (isCtrl && e.key === '0') {
      e.preventDefault();
      canvasManager.zoom100();
      return;
    }

    // --- Arrow key nudging ---
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const active = canvasManager.canvas.getActiveObject();
      if (active) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
        const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
        const members = active.type === 'activeselection' ? active.getObjects().slice() : [active];

        const applyDelta = (mx, my) => {
          if (active.type === 'activeselection') {
            canvasManager.canvas.discardActiveObject();
          }
          members.forEach((m) => {
            m.set({ left: m.left + mx, top: m.top + my });
            m.setCoords();
            if (canvasManager.connectorManager) canvasManager.connectorManager._onShapeTransform(m);
          });
          if (members.length > 1) {
            const sel = new fabric.ActiveSelection(members, { canvas: canvasManager.canvas });
            canvasManager.canvas.setActiveObject(sel);
          }
          canvasManager.canvas.requestRenderAll();
        };

        applyDelta(dx, dy);
        if (window.undoManager) {
          window.undoManager.record({
            name: 'Nudge Object',
            execute: () => applyDelta(dx, dy),
            undo: () => applyDelta(-dx, -dy),
          });
        }
        return;
      }
    }
  });
}

// =========================================
// STENCIL DRAG-AND-DROP TO CANVAS
// =========================================

function setupStencilDrop() {
  const container = document.getElementById('canvas-container');

  // Prevent default drag/drop navigation across entire window
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);

  window.addEventListener('drop', (e) => {
    e.preventDefault();
  }, false);

  if (!container) return;

  container.addEventListener('dragenter', (e) => {
    e.preventDefault();
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if user dropped Visio or OpenDraw file(s) from OS
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedPaths = [];
      for (const file of e.dataTransfer.files) {
        const filePath = (window.openDraw && window.openDraw.getPathForFile)
          ? window.openDraw.getPathForFile(file)
          : file.path;
        if (filePath) droppedPaths.push(filePath);
      }
      if (droppedPaths.length > 0) {
        const hasSupported = droppedPaths.some(fp => /\.(vssx?|vssm|vsdx?|vsdm|vstx?|vstm|odraw)$/i.test(fp));
        if (hasSupported) {
          await handleFilesOpen(droppedPaths);
          return;
        }
      }
    }

    const customSvgData = e.dataTransfer.getData('application/opendraw-custom-svg');
    const shapeType = e.dataTransfer.getData('application/opendraw-shape') || e.dataTransfer.getData('text/plain');
    if (!shapeType && !customSvgData) return;

    // Convert screen coordinates to page coordinates
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Account for zoom and pan
    const vpt = canvasManager.canvas.viewportTransform;
    const zoom = canvasManager.canvas.getZoom();
    const pageX = (screenX - vpt[4]) / zoom;
    const pageY = (screenY - vpt[5]) / zoom;

    const snappedX = canvasManager.gridManager.snapToGrid(pageX);
    const snappedY = canvasManager.gridManager.snapToGrid(pageY);

    if (customSvgData) {
      try {
        const parsed = JSON.parse(customSvgData);
        await insertCustomSvgShape(parsed.svg, parsed.name, snappedX, snappedY, parsed.width, parsed.height, parsed.imageUrl || null, parsed.connectionPoints || []);
        return;
      } catch (err) {
        console.warn('Failed to parse custom SVG data:', err);
      }
    }

    if (shapeType === 'comment-card' || shapeType === 'insert:comment' || shapeType === 'comment') {
      if (window.toolbarController) {
        window.toolbarController.createCommentCardAt(snappedX, snappedY);
      }
      return;
    }

    if (shapeType === 'dynamic-connector') {
      const dropPoint = { x: snappedX, y: snappedY };
      const targetShape = canvasManager.connectorManager ? canvasManager.connectorManager._findTargetShape(dropPoint) : null;
      let conn;
      if (targetShape && canvasManager.connectorManager) {
        const port = canvasManager.connectorManager.getClosestPort(targetShape, dropPoint);
        conn = canvasManager.connectorManager.createConnector(
          targetShape,
          port.id,
          null,
          null,
          canvasManager.connectorManager.defaultStyle,
          [{ x: port.x, y: port.y }, { x: port.x + 120, y: port.y }]
        );
      } else if (canvasManager.connectorManager) {
        conn = canvasManager.connectorManager.createConnector(
          null,
          null,
          null,
          null,
          canvasManager.connectorManager.defaultStyle,
          [{ x: snappedX - 60, y: snappedY }, { x: snappedX + 60, y: snappedY }]
        );
      }
      if (conn) {
        canvasManager.canvas.setActiveObject(conn.line);
        if (canvasManager.connectorManager) {
          canvasManager.connectorManager._showEndpointHandles(conn);
        }
        canvasManager.canvas.requestRenderAll();
        return;
      }
    }

    canvasManager._insertShape(shapeType, snappedX, snappedY);
    canvasManager.canvas.requestRenderAll();
  });
}

// =========================================
// OBJECT MODIFICATION TRACKING & UNDO ENGINE
// =========================================

function _captureObjectSceneState(obj) {
  const m = obj.calcTransformMatrix();
  const d = fabric.util.qrDecompose(m);
  return {
    obj,
    cx: d.translateX,
    cy: d.translateY,
    scaleX: d.scaleX,
    scaleY: d.scaleY,
    angle: d.angle
  };
}

function _applyObjectSceneState(st) {
  st.obj.set({ scaleX: st.scaleX, scaleY: st.scaleY, angle: st.angle });
  st.obj.setPositionByOrigin(new fabric.Point(st.cx, st.cy), 'center', 'center');
  st.obj.setCoords();
}

function setupObjectModifiedTracking() {
  let transformInitialState = null;

  // Capture initial state before any transform begins (mouse drag, resize, rotate)
  canvasManager.canvas.on('before:transform', (e) => {
    const target = (e && e.transform) ? e.transform.target : canvasManager.canvas.getActiveObject();
    if (!target || isSystemCanvasObject(target)) {
      transformInitialState = null;
      return;
    }

    if (target.type === 'activeselection') {
      transformInitialState = {
        isMulti: true,
        items: target.getObjects().map(_captureObjectSceneState),
      };
    } else {
      transformInitialState = {
        isMulti: false,
        obj: target,
        left: target.left,
        top: target.top,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        angle: target.angle,
      };
    }
  });

  // When modification finishes, record in undoManager if geometry actually changed
  canvasManager.canvas.on('object:modified', (e) => {
    const obj = e.target;
    if (!obj || isSystemCanvasObject(obj)) return;

    if (transformInitialState && window.undoManager) {
      if (transformInitialState.isMulti) {
        const items = transformInitialState.items;
        const initialStates = items.map(it => ({ ...it }));
        const finalStates = items.map(it => _captureObjectSceneState(it.obj));

        const changed = items.some((it, idx) =>
          Math.abs(it.cx - finalStates[idx].cx) > 0.05 ||
          Math.abs(it.cy - finalStates[idx].cy) > 0.05 ||
          Math.abs(it.scaleX - finalStates[idx].scaleX) > 0.001 ||
          Math.abs(it.scaleY - finalStates[idx].scaleY) > 0.001 ||
          Math.abs(it.angle - finalStates[idx].angle) > 0.05
        );

        if (changed) {
          const runApply = (list) => {
            canvasManager.canvas.discardActiveObject();
            list.forEach((st) => {
              _applyObjectSceneState(st);
              if (canvasManager.connectorManager) canvasManager.connectorManager._onShapeTransform(st.obj);
            });
            if (canvasManager.connectorManager) canvasManager.connectorManager.updateAllConnectors();
            canvasManager.canvas.requestRenderAll();
          };
          window.undoManager.record({
            name: 'Transform Multiple Objects',
            execute: () => runApply(finalStates),
            undo: () => runApply(initialStates),
          });
        }
      } else if (transformInitialState.obj === obj) {
        const prev = {
          left: transformInitialState.left,
          top: transformInitialState.top,
          scaleX: transformInitialState.scaleX,
          scaleY: transformInitialState.scaleY,
          angle: transformInitialState.angle,
        };
        const next = {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
        };

        const changed = prev.left !== next.left || prev.top !== next.top ||
                        prev.scaleX !== next.scaleX || prev.scaleY !== next.scaleY ||
                        prev.angle !== next.angle;

        if (changed) {
          window.undoManager.record({
            name: 'Transform Object',
            execute: () => {
              obj.set(next);
              obj.setCoords();
              if (canvasManager.connectorManager) {
                canvasManager.connectorManager._onShapeTransform(obj);
                canvasManager.connectorManager.updateAllConnectors();
              }
              canvasManager.canvas.requestRenderAll();
            },
            undo: () => {
              obj.set(prev);
              obj.setCoords();
              if (canvasManager.connectorManager) {
                canvasManager.connectorManager._onShapeTransform(obj);
                canvasManager.connectorManager.updateAllConnectors();
              }
              canvasManager.canvas.requestRenderAll();
            },
          });
        }
      }
      transformInitialState = null;
    }

    // Emit selection update so properties panel stays in sync
    window.eventBus.emit('selection:changed', {
      objects: [obj],
      count: 1,
    });
  });
}

// =========================================
// VISIO START SCREEN & RECENT DOCUMENTS
// =========================================

function _escapeHtmlText(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getRecentFilesList() {
  try {
    const raw = localStorage.getItem('opendraw_recent_files');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
}

function recordRecentFile(filePath) {
  try {
    let list = getRecentFilesList();
    const fileName = filePath.split(/[\\/]/).pop();
    list = list.filter(item => item.path.toLowerCase() !== filePath.toLowerCase());
    list.unshift({
      path: filePath,
      name: fileName,
      tag: 'OpenDraw Drawing',
      date: 'Just now'
    });
    if (list.length > 8) list = list.slice(0, 8);
    localStorage.setItem('opendraw_recent_files', JSON.stringify(list));
  } catch (e) {}
}

function showVisioStartScreen() {
  const backstage = document.getElementById('backstage-menu');
  if (!backstage) return;

  backstage.style.display = 'flex';
  const creditsView = document.getElementById('backstage-view-credits');
  const mainStartArea = document.querySelector('.visio-start-columns');
  const startHeader = document.querySelector('.visio-start-header');
  const tabRecent = document.getElementById('backstage-tab-recent');
  const tabCredits = document.getElementById('backstage-tab-credits');
  if (creditsView) creditsView.style.display = 'none';
  if (mainStartArea) mainStartArea.style.display = 'flex';
  if (startHeader) startHeader.style.display = 'block';
  if (tabCredits) tabCredits.classList.remove('active');
  if (tabRecent) tabRecent.classList.add('active');
  renderRecentFiles();
}

function hydrateAppVersionUI() {
  const info = (window.openDraw && window.openDraw.getAppInfo) ? window.openDraw.getAppInfo() : {
    version: '1.0.0',
    edition: 'Standard Edition',
    channel: 'stable',
    build: '',
    releaseDate: '',
    releaseNotes: [],
  };
  const ver = info.version || '1.0.0';
  const buildMeta = info.build ? ` • Build ${info.build}` : '';
  const dateMeta = info.releaseDate ? ` (${info.releaseDate})` : '';

  const sidebarVerEl = document.getElementById('backstage-sidebar-version');
  if (sidebarVerEl) sidebarVerEl.textContent = `OpenDraw v${ver}`;

  const creditsLineEl = document.getElementById('credits-version-line');
  if (creditsLineEl) {
    creditsLineEl.textContent = `Version ${ver}${buildMeta}${dateMeta} • ${info.edition || 'Standard Edition'}`;
  }

  const overviewVerEl = document.getElementById('credits-overview-version');
  if (overviewVerEl) {
    const channelLabel = info.channel ? info.channel.charAt(0).toUpperCase() + info.channel.slice(1) : 'Stable';
    overviewVerEl.textContent = `${ver} (${channelLabel}${info.build ? ', Build ' + info.build : ''})`;
  }

  const relHeading = document.getElementById('credits-release-heading');
  if (relHeading) {
    relHeading.textContent = `Release Notes — Version ${ver}${info.releaseDate ? ` (${info.releaseDate})` : ''}`;
  }

  const relNotesEl = document.getElementById('credits-release-notes');
  if (relNotesEl && Array.isArray(info.releaseNotes) && info.releaseNotes.length > 0) {
    relNotesEl.innerHTML = '';
    info.releaseNotes.forEach((note) => {
      const li = document.createElement('li');
      li.textContent = note;
      relNotesEl.appendChild(li);
    });
  }
}

function renderRecentFiles() {
  const container = document.getElementById('recent-files-container');
  if (!container) return;

  const files = getRecentFilesList();
  container.innerHTML = '';

  if (files.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding: 18px 16px; border: 1px dashed var(--border); border-radius: 4px; color: var(--text-muted); font-size: 12.5px; line-height: 1.5; background: var(--bg-secondary);';
    empty.textContent = 'No recent diagrams yet. Pick a template on the right or open an existing .vsdx, .vsd, or .odraw file.';
    container.appendChild(empty);
    return;
  }

  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'recent-file-item';
    item.title = `Open ${file.name}\n${file.path}`;
    item.innerHTML = `
      <div class="recent-file-icon">
        <img class="od-brand-dark" src="../../assets/icons/opendraw-small-dark.svg" width="28" height="28" alt="" draggable="false">
        <img class="od-brand-light" src="../../assets/icons/opendraw-small-light.svg" width="28" height="28" alt="" draggable="false">
      </div>
      <div class="recent-file-details">
        <div class="recent-file-title">${_escapeHtmlText(file.name)}</div>
        <div class="recent-file-path">${_escapeHtmlText(file.path)}</div>
        <div class="recent-file-tag">${_escapeHtmlText(file.tag || 'OpenDraw Drawing')}</div>
      </div>
    `;

    item.addEventListener('click', async () => {
      const backstage = document.getElementById('backstage-menu');
      if (backstage) backstage.style.display = 'none';
      await handleFileOpen(file.path);
    });

    container.appendChild(item);
  });
}

function setupVisioStartScreen() {
  renderRecentFiles();

  // Wire template card: flowchart
  const fcCard = document.querySelector('.visio-template-card[data-template="flowchart"]');
  if (fcCard) {
    fcCard.addEventListener('click', () => {
      const backstage = document.getElementById('backstage-menu');
      if (backstage) backstage.style.display = 'none';
      handleNew();
      const fcHeader = document.querySelector('.stencil-category[data-category="flowchart"] .stencil-category-header');
      const fcGrid = document.querySelector('.stencil-category[data-category="flowchart"] .stencil-grid');
      if (fcHeader && fcGrid) {
        fcGrid.style.display = 'grid';
        fcHeader.classList.add('active');
        fcHeader.textContent = '▾ Flowchart';
      }
    });
  }

  // Wire backstage exit button
  const exitBtn = document.getElementById('win-btn-backstage-exit');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      if (window.openDraw && window.openDraw.closeWindow) {
        window.openDraw.closeWindow();
      } else {
        window.close();
      }
    });
  }

  // Wire backstage tab navigation
  const tabRecent = document.getElementById('backstage-tab-recent');
  const tabCredits = document.getElementById('backstage-tab-credits');
  const versionBadge = document.getElementById('backstage-version-badge');
  const creditsView = document.getElementById('backstage-view-credits');
  const mainStartArea = document.querySelector('.visio-start-columns');
  const startHeader = document.querySelector('.visio-start-header');

  if (versionBadge && tabCredits) {
    versionBadge.addEventListener('click', () => tabCredits.click());
  }

  if (tabCredits) {
    tabCredits.addEventListener('click', () => {
      document.querySelectorAll('.backstage-sidebar .backstage-btn').forEach(b => b.classList.remove('active'));
      tabCredits.classList.add('active');
      if (mainStartArea) mainStartArea.style.display = 'none';
      if (startHeader) startHeader.style.display = 'none';
      if (creditsView) creditsView.style.display = 'block';
    });
  }

  if (tabRecent) {
    tabRecent.addEventListener('click', () => {
      document.querySelectorAll('.backstage-sidebar .backstage-btn').forEach(b => b.classList.remove('active'));
      tabRecent.classList.add('active');
      if (creditsView) creditsView.style.display = 'none';
      if (mainStartArea) mainStartArea.style.display = 'flex';
      if (startHeader) startHeader.style.display = 'block';
      renderRecentFiles();
    });
  }
}

// =========================================
// FILE OPERATIONS
// =========================================

function handleNew() {
  const backstage = document.getElementById('backstage-menu');
  if (backstage) backstage.style.display = 'none';

  if (canvasManager.inlineTextEditor) canvasManager.inlineTextEditor.cancel();
  if (canvasManager.alignmentGuideManager) canvasManager.alignmentGuideManager.clearGuides();
  if (canvasManager.connectorManager) {
    canvasManager.connectorManager.hideAutoConnect();
    canvasManager.connectorManager._hidePorts();
    canvasManager.connectorManager._hideEndpointHandles();
    canvasManager.connectorManager.connectors = [];
  }

  // Remove all non-grid/page objects
  const objects = canvasManager.canvas.getObjects().filter(o => !isSystemCanvasObject(o) || !o.isPageBg && !o.isGridLine);
  objects.forEach((obj) => canvasManager.canvas.remove(obj));
  canvasManager.canvas.discardActiveObject();

  if (canvasManager.gridManager) {
    canvasManager.gridManager.setPageColor('#ffffff');
    canvasManager.gridManager.setPageSize(11.69 * 96, 8.27 * 96);
    canvasManager.gridManager._createGrid();
  }
  if (canvasManager.layerManager) {
    canvasManager.layerManager.setLayers(null);
  }
  if (canvasManager.pageManager) {
    canvasManager.pageManager.pages = [{
      id: 'page_1',
      name: 'Page-1',
      objects: [],
      connectors: [],
      connectorSpecs: [],
      pixelWidth: 11.69 * 96,
      pixelHeight: 8.27 * 96,
      pageColor: '#ffffff',
      layers: canvasManager.layerManager ? canvasManager.layerManager.layers.map(l => ({ ...l })) : [],
      zoom: 1,
      vpt: [1, 0, 0, 1, 50, 30]
    }];
    canvasManager.pageManager.currentPageIndex = 0;
    canvasManager.pageManager.renderTabs();
  }
  if (canvasManager.zoomToFit) canvasManager.zoomToFit();
  canvasManager.canvas.requestRenderAll();
  if (window.undoManager) window.undoManager.clear();
  currentFilePath = null;
  const titleEl = document.getElementById('window-title');
  if (titleEl) titleEl.textContent = 'Drawing1 - OpenDraw by Marco Sodano';
  document.title = 'Drawing1 - OpenDraw by Marco Sodano';
  if (window.openDraw && window.openDraw.setTitle) window.openDraw.setTitle('Drawing1 - OpenDraw by Marco Sodano');
}

async function handleSave() {
  if (currentFilePath) {
    await saveToFile(currentFilePath);
  } else {
    await handleSaveAs();
  }
}

async function handleSaveAs() {
  if (!window.openDraw) return;
  const filePath = await window.openDraw.showSaveDialog(currentFilePath || 'Drawing1.odraw');
  if (filePath) {
    await saveToFile(filePath);
  }
}

async function saveToFile(filePath) {
  try {
    if (filePath.toLowerCase().endsWith('.vsdx') && window.VisioConverter) {
      const vsdxBlob = await window.VisioConverter.exportVsdx(canvasManager);
      const arrayBuffer = await vsdxBlob.arrayBuffer();
      await window.openDraw.writeBinaryFile(filePath, new Uint8Array(arrayBuffer));
    } else {
      const data = serializeDiagram();
      await window.openDraw.writeFile(filePath, JSON.stringify(data, null, 2));
    }
    currentFilePath = filePath;
    const fileName = filePath.split(/[\\/]/).pop();
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const titleText = `${baseName} - OpenDraw by Marco Sodano`;
    if (window.openDraw && window.openDraw.setTitle) window.openDraw.setTitle(titleText);
    const titleEl = document.getElementById('window-title');
    if (titleEl) titleEl.textContent = titleText;
    recordRecentFile(filePath);
    console.log('Saved to:', filePath);
  } catch (err) {
    console.error('Save failed:', err);
  }
}

function isCurrentWorkspaceOccupied() {
  if (currentFilePath || window.__openDrawImporting) return true;
  if (canvasManager && canvasManager.canvas) {
    const userObjs = canvasManager.canvas.getObjects().filter(o => !isSystemCanvasObject(o));
    if (userObjs.length > 0) return true;
  }
  if (canvasManager && canvasManager.pageManager && canvasManager.pageManager.pages.length > 1) {
    return true;
  }
  return false;
}

async function handleFileOpen(filePath, opts = {}) {
  if (!filePath) return;
  const lower = filePath.toLowerCase();

  // 1. Stencils ALWAYS load into the current window's Stencil panel
  if (lower.endsWith('.vss') || lower.endsWith('.vssx') || lower.endsWith('.vssm')) {
    const backstage = document.getElementById('backstage-menu');
    if (backstage) backstage.style.display = 'none';
    if (window.panelController && window.panelController.loadStencil) {
      await window.panelController.loadStencil(filePath);
    }
    return;
  }

  // 2. If this window already holds a diagram (or is importing one), open in a separate window like Microsoft Visio
  if (!opts.replaceCurrent && isCurrentWorkspaceOccupied() && window.openDraw && window.openDraw.openFileInNewWindow) {
    const backstage = document.getElementById('backstage-menu');
    if (backstage) backstage.style.display = 'none';
    window.openDraw.openFileInNewWindow(filePath);
    return;
  }

  window.__openDrawImporting = true;
  try {
    const backstage = document.getElementById('backstage-menu');
    if (backstage) backstage.style.display = 'none';

    // If file is a Visio diagram or template (.vsdx, .vsdm, .vstx, .vstm, .vsd, .vst)
    if ((lower.endsWith('.vsdx') || lower.endsWith('.vsdm') || lower.endsWith('.vstx') || lower.endsWith('.vstm') || lower.endsWith('.vsd') || lower.endsWith('.vst')) && window.VisioConverter) {
      let buffer = null;
      if (window.openDraw && window.openDraw.loadDiagramFile) {
        const res = await window.openDraw.loadDiagramFile(filePath);
        buffer = res.buffer;
      } else {
        buffer = await window.openDraw.readBinaryFile(filePath);
      }
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      await window.VisioConverter.importVsdx(bytes, canvasManager);
    } else {
      const content = await window.openDraw.readFile(filePath);
      const data = JSON.parse(content);
      await deserializeDiagram(data);
    }
    currentFilePath = filePath;
    const fileName = filePath.split(/[\\/]/).pop();
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const titleText = `${baseName} - OpenDraw by Marco Sodano`;
    document.title = titleText;
    if (window.openDraw && window.openDraw.setTitle) {
      window.openDraw.setTitle(titleText);
    }
    const titleEl = document.getElementById('window-title');
    if (titleEl) {
      titleEl.textContent = titleText;
    }
    recordRecentFile(filePath);
    console.log('Opened:', filePath);
  } catch (err) {
    console.error('Open failed:', err);
    if (window.openDrawDialog) {
      await window.openDrawDialog.alert(`Failed to open diagram:\n${err.message}`, 'Open File Error');
    }
  } finally {
    window.__openDrawImporting = false;
  }
}

async function handleFilesOpen(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) return;
  for (const fp of filePaths) {
    await handleFileOpen(fp);
  }
}

/**
 * Serialize the multi-page diagram to a JSON-compatible object.
 */
function serializeDiagram() {
  const pm = canvasManager.pageManager;
  if (pm && pm._saveCurrentPageState) pm._saveCurrentPageState();

  if (pm && pm.pages && pm.pages.length > 0) {
    return {
      version: '2.0.0',
      format: 'opendraw',
      gridSize: canvasManager.gridManager.gridSize,
      currentPageIndex: pm.currentPageIndex,
      pages: pm.pages.map(p => ({
        id: p.id,
        name: p.name,
        pixelWidth: p.pixelWidth,
        pixelHeight: p.pixelHeight,
        pageColor: p.pageColor || '#ffffff',
        layers: p.layers || [],
        objects: p.objects || [],
        connectorSpecs: p.connectorSpecs || [],
        pendingPageModel: p.pendingPageModel || null,
        zoom: p.zoom || 1,
        vpt: p.vpt || [1, 0, 0, 1, 50, 30]
      }))
    };
  }

  const objects = canvasManager.canvas.getObjects().filter(o => !isSystemCanvasObject(o) && o.objectType !== 'connector');
  return {
    version: '2.0.0',
    format: 'opendraw',
    pageSize: canvasManager.gridManager.pageSize,
    gridSize: canvasManager.gridManager.gridSize,
    objects: objects.map((obj) => obj.toObject(OD_SERIALIZE_PROPS)),
    connectors: [],
  };
}

/**
 * Deserialize a diagram from JSON data (v1 single-page or v2 multi-page).
 * @param {Object} data
 */
async function deserializeDiagram(data) {
  handleNew();

  if (data.gridSize) {
    canvasManager.gridManager.setGridSize(data.gridSize);
  }

  const pm = canvasManager.pageManager;
  if (data.pages && Array.isArray(data.pages) && data.pages.length > 0 && pm) {
    pm.pages = data.pages.map((p, idx) => ({
      id: p.id || `page_${idx + 1}`,
      name: p.name || `Page-${idx + 1}`,
      objects: p.objects || [],
      connectors: [],
      connectorSpecs: p.connectorSpecs || [],
      pendingPageModel: p.pendingPageModel || null,
      pixelWidth: p.pixelWidth || 11.69 * 96,
      pixelHeight: p.pixelHeight || 8.27 * 96,
      pageColor: p.pageColor || '#ffffff',
      layers: p.layers || [{ id: 'layer_default', name: 'Default', visible: true, locked: false, color: '#0078d4' }],
      zoom: p.zoom || 1,
      vpt: p.vpt || [1, 0, 0, 1, 50, 30]
    }));
    const idx = Math.max(0, Math.min(data.currentPageIndex || 0, pm.pages.length - 1));
    await pm.switchToPage(idx, false);
    if (window.undoManager) window.undoManager.clear();
    return;
  }

  if (data.pageSize) {
    canvasManager.gridManager.setPageSize(data.pageSize.width, data.pageSize.height);
  }

  if (data.objects && Array.isArray(data.objects)) {
    const enlivenedObjects = await fabric.util.enlivenObjects(data.objects);
    enlivenedObjects.forEach((obj) => {
      obj.set({
        cornerStyle: 'circle',
        cornerColor: '#0078d4',
        cornerStrokeColor: '#ffffff',
        cornerSize: 8,
        transparentCorners: false,
        borderColor: '#0078d4',
        borderScaleFactor: 1.5,
        padding: 2,
      });
      if (obj.getObjects) {
        const kids = obj.getObjects();
        obj.geometryObject = kids.find(c => !['text', 'i-text', 'textbox'].includes(c.type)) || kids[0];
        obj.labelObject = kids.find(c => ['text', 'i-text', 'textbox'].includes(c.type)) || null;
      }
      canvasManager.canvas.add(obj);
    });

    if (data.connectors && Array.isArray(data.connectors) && canvasManager.connectorManager) {
      data.connectors.forEach((connData) => {
        const src = connData.sourceShapeId ? enlivenedObjects.find((o) => o.shapeData && o.shapeData.id === connData.sourceShapeId) : null;
        const tgt = connData.targetShapeId ? enlivenedObjects.find((o) => o.shapeData && o.shapeData.id === connData.targetShapeId) : null;
        const pts = connData.points && connData.points.length >= 2
          ? connData.points
          : ((connData.sourcePoint || connData.targetPoint)
            ? [connData.sourcePoint || { x: 100, y: 100 }, connData.targetPoint || { x: 250, y: 100 }]
            : null);
        canvasManager.connectorManager.createConnector(
          src || null,
          connData.sourcePortId || null,
          tgt || null,
          connData.targetPortId || null,
          {
            ...(connData.style || {}),
            routingType: connData.routingType || (connData.style && connData.style.routingType) || 'orthogonal',
            preserveGeometry: !!connData.preserveGeometry,
            label: connData.label || '',
            textStyle: connData.textStyle || null,
            skipUndo: true
          },
          pts
        );
      });
    }

    canvasManager.canvas.requestRenderAll();
    if (window.undoManager) window.undoManager.clear();
  }
}

// =========================================
// EXPORT
// =========================================

async function _capturePageDataUrlAtUnityZoom(width, height) {
  const c = canvasManager.canvas;
  const savedVpt = [...c.viewportTransform];
  const savedZoom = c.getZoom();
  const savedBg = c.backgroundColor;
  const cm = canvasManager.connectorManager;
  const ag = canvasManager.alignmentGuideManager;
  if (cm) { cm.hideAutoConnect(); cm._hidePorts(); cm._hideEndpointHandles(); }
  if (ag) ag.clearGuides();
  if (canvasManager.gridManager) canvasManager.gridManager.setExportVisibility(true);

  const hiddenGridLines = [];
  c.getObjects().forEach(o => {
    if (o.isGridLine || o.objectType === 'grid-line' || o.objectType === 'guide-line') {
      if (o.visible) { o.set('visible', false); hiddenGridLines.push(o); }
    }
  });
  c.discardActiveObject();
  c.setViewportTransform([1, 0, 0, 1, 0, 0]);
  c.backgroundColor = '#ffffff';
  c.renderAll();

  try {
    return c.toDataURL({
      format: 'png',
      left: 0,
      top: 0,
      width,
      height,
      multiplier: 2,
    });
  } finally {
    hiddenGridLines.forEach(o => o.set('visible', true));
    if (canvasManager.gridManager) canvasManager.gridManager.setExportVisibility(false);
    c.backgroundColor = savedBg;
    c.setViewportTransform(savedVpt);
    c.setZoom(savedZoom);
    c.requestRenderAll();
  }
}

async function handleExport(format) {
  if (!window.openDraw) return;
  const filePath = await window.openDraw.showExportDialog(format);
  if (!filePath) return;

  try {
    const pageSize = canvasManager.gridManager.pageSize;

    if (format === 'png') {
      const dataURL = await _capturePageDataUrlAtUnityZoom(pageSize.width, pageSize.height);
      const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
      const binaryString = atob(base64);
      const buffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) buffer[i] = binaryString.charCodeAt(i);
      await window.openDraw.writeBinaryFile(filePath, buffer);
      console.log(`Exported PNG to: ${filePath}`);
    } else if (format === 'svg') {
      const c = canvasManager.canvas;
      const savedVpt = [...c.viewportTransform];
      const savedBg = c.backgroundColor;
      if (canvasManager.gridManager) canvasManager.gridManager.setExportVisibility(true);
      const hidden = [];
      c.getObjects().forEach(o => {
        if (o.isGridLine || o.objectType === 'grid-line' || o.objectType === 'guide-line') {
          if (o.visible) { o.set('visible', false); hidden.push(o); }
        }
      });
      c.setViewportTransform([1, 0, 0, 1, 0, 0]);
      c.backgroundColor = '#ffffff';
      let svgData;
      try {
        svgData = c.toSVG({
          viewBox: { x: 0, y: 0, width: pageSize.width, height: pageSize.height },
          width: pageSize.width,
          height: pageSize.height,
        });
      } finally {
        hidden.forEach(o => o.set('visible', true));
        if (canvasManager.gridManager) canvasManager.gridManager.setExportVisibility(false);
        c.backgroundColor = savedBg;
        c.setViewportTransform(savedVpt);
        c.requestRenderAll();
      }
      await window.openDraw.writeFile(filePath, svgData);
      console.log(`Exported SVG to: ${filePath}`);
    } else if (format === 'pdf') {
      if (canvasManager.pageManager && canvasManager.pageManager.pages.length > 1) {
        canvasManager.pageManager._saveCurrentPageState();
        const originalIdx = canvasManager.pageManager.currentPageIndex;
        const exportedPages = [];
        try {
          for (let i = 0; i < canvasManager.pageManager.pages.length; i++) {
            await canvasManager.pageManager.switchToPage(i);
            const pSize = canvasManager.gridManager.pageSize;
            const dataURL = await _capturePageDataUrlAtUnityZoom(pSize.width, pSize.height);
            exportedPages.push({ dataUrl: dataURL, width: pSize.width, height: pSize.height });
          }
        } finally {
          await canvasManager.pageManager.switchToPage(originalIdx);
        }
        await window.openDraw.exportPDF({ filePath, pages: exportedPages });
      } else {
        const dataURL = await _capturePageDataUrlAtUnityZoom(pageSize.width, pageSize.height);
        await window.openDraw.exportPDF({
          filePath,
          dataUrl: dataURL,
          width: pageSize.width,
          height: pageSize.height,
        });
      }
      console.log(`Exported PDF to: ${filePath}`);
    }
  } catch (err) {
    console.error(`Export ${format} failed:`, err);
  }
}

// =========================================
// SHORTCUTS MODAL
// =========================================

function showShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function setupShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  const closeBtn = document.getElementById('shortcuts-close-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', hideShortcutsModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideShortcutsModal();
      }
    });
  }
}

window.showShortcutsModal = showShortcutsModal;
window.hideShortcutsModal = hideShortcutsModal;

// =========================================
// WINDOW TITLEBAR CONTROLS & FORMAT SHAPE
// =========================================

function setupWindowTitlebarControls() {
  const btnMin = document.getElementById('win-btn-minimize');
  const btnMax = document.getElementById('win-btn-maximize');
  const btnClose = document.getElementById('win-btn-close');

  if (btnMin && window.openDraw && window.openDraw.minimizeWindow) {
    btnMin.addEventListener('click', () => window.openDraw.minimizeWindow());
  }
  if (btnMax && window.openDraw && window.openDraw.maximizeWindow) {
    btnMax.addEventListener('click', async () => {
      window.openDraw.maximizeWindow();
      if (window.openDraw.isMaximized) {
        const isMax = await window.openDraw.isMaximized();
        btnMax.title = isMax ? 'Restore Down' : 'Maximize';
      }
    });
  }
  if (btnClose && window.openDraw && window.openDraw.closeWindow) {
    btnClose.addEventListener('click', () => window.openDraw.closeWindow());
  }
}

function setupFormatShapeButton() {
  const btn = document.getElementById('btn-format-shape');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const panel = document.getElementById('properties-panel');
    if (panel) {
      panel.classList.toggle('collapsed');
      const collapseBtn = panel.querySelector('.panel-collapse-btn');
      if (collapseBtn) {
        collapseBtn.textContent = panel.classList.contains('collapsed') ? '◀' : '▶';
        collapseBtn.title = panel.classList.contains('collapsed') ? 'Expand' : 'Collapse';
      }
      setTimeout(() => {
        const container = document.getElementById('canvas-container');
        if (container && canvasManager && canvasManager.canvas) {
          const rect = container.getBoundingClientRect();
          canvasManager.canvas.setDimensions({
            width: rect.width,
            height: rect.height,
          });
          if (canvasManager.rulerManager) {
            canvasManager.rulerManager.draw();
          }
        }
      }, 250);
    }
  });
}

// =========================================
// CLIPBOARD
// =========================================

let clipboardData = null;

function handleCopy() {
  const active = canvasManager.canvas.getActiveObject();
  if (!active) return;

  const isMulti = active.type === 'activeselection';
  const members = isMulti ? active.getObjects().slice() : [active];
  const toClone = members.filter(o => !isSystemCanvasObject(o) && o.objectType !== 'connector');
  if (toClone.length === 0) return;

  // Temporarily discard ActiveSelection so serialized left/top are in world page coords
  if (isMulti) canvasManager.canvas.discardActiveObject();
  clipboardData = toClone.map((obj) => obj.toObject(OD_SERIALIZE_PROPS));
  if (isMulti) {
    const sel = new fabric.ActiveSelection(members, { canvas: canvasManager.canvas });
    canvasManager.canvas.setActiveObject(sel);
  }
}

function handleCut() {
  handleCopy();
  canvasManager._deleteSelected();
}

function handlePaste() {
  if (!clipboardData || clipboardData.length === 0) return;

  fabric.util.enlivenObjects(clipboardData).then((objects) => {
    objects.forEach((obj) => {
      obj.set({
        left: (obj.left || 0) + 20,
        top: (obj.top || 0) + 20,
        cornerStyle: 'circle',
        cornerColor: '#0078d4',
        cornerStrokeColor: '#ffffff',
        cornerSize: 8,
        transparentCorners: false,
        borderColor: '#0078d4',
        borderScaleFactor: 1.5,
        padding: 4,
      });
      if (obj.shapeData) {
        obj.shapeData = { ...obj.shapeData, id: 'shape_' + Math.random().toString(36).substr(2, 9) };
      }
      if (obj.getObjects) {
        const kids = obj.getObjects();
        obj.geometryObject = kids.find(c => !['text', 'i-text', 'textbox'].includes(c.type)) || kids[0];
        obj.labelObject = kids.find(c => ['text', 'i-text', 'textbox'].includes(c.type)) || null;
      }
      canvasManager.canvas.add(obj);
    });
    if (objects.length > 1) {
      const sel = new fabric.ActiveSelection(objects, { canvas: canvasManager.canvas });
      canvasManager.canvas.setActiveObject(sel);
    } else if (objects.length === 1) {
      canvasManager.canvas.setActiveObject(objects[0]);
    }
    canvasManager.canvas.requestRenderAll();

    clipboardData = clipboardData.map((d) => ({
      ...d,
      left: (d.left || 0) + 20,
      top: (d.top || 0) + 20,
    }));

    window.undoManager.record({
      name: `Paste ${objects.length} object(s)`,
      execute: () => {
        objects.forEach((obj) => canvasManager.canvas.add(obj));
        canvasManager.canvas.requestRenderAll();
      },
      undo: () => {
        objects.forEach((obj) => canvasManager.canvas.remove(obj));
        canvasManager.canvas.discardActiveObject();
        canvasManager.canvas.requestRenderAll();
      },
    });
  });
}

// =========================================
// SELECTION & ARRANGE
// =========================================

function selectAll() {
  const objects = canvasManager.canvas.getObjects().filter(
    (obj) => !isSystemCanvasObject(obj) && obj.selectable !== false
  );
  if (objects.length === 0) return;

  canvasManager.canvas.discardActiveObject();
  const selection = new fabric.ActiveSelection(objects, {
    canvas: canvasManager.canvas,
  });
  canvasManager.canvas.setActiveObject(selection);
  canvasManager.canvas.requestRenderAll();
}

function _getMinDiagramZIndex(canvas) {
  const objs = canvas.getObjects();
  let minIdx = 0;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.isGridLine || o.isPageBg || o.isGuide || o.objectType === 'grid-line' || o.objectType === 'page-background') {
      minIdx = i + 1;
    }
  }
  return minIdx;
}

function _getZOrderUnitParts(obj) {
  if (!obj) return [];
  const c = obj.connectorData;
  if (c && c.line) {
    return [c.line, c.arrow, c.sourceArrowHead, c.labelObj].filter(Boolean);
  }
  return [obj];
}

function _isOverlayOrBgObject(o) {
  if (!o) return true;
  if (o.isGridLine || o.isPageBg || o.isGuide) return true;
  return ['grid-line', 'page-background', 'guide-line', 'connector-handle', 'autoconnect-trigger', 'port-marker', 'connector-preview', 'preview-rect'].includes(o.objectType);
}

function _expandZOrderUnits(targets) {
  const seen = new Set();
  const units = [];
  targets.forEach((t) => {
    _getZOrderUnitParts(t).forEach((p) => {
      if (!seen.has(p)) { seen.add(p); units.push(p); }
    });
  });
  return units;
}

function _boxesOverlap(a, b) {
  if (!a || !b) return false;
  const ra = a.getBoundingRect ? a.getBoundingRect() : null;
  const rb = b.getBoundingRect ? b.getBoundingRect() : null;
  if (!ra || !rb) return false;
  return !(ra.left + ra.width < rb.left || rb.left + rb.width < ra.left || ra.top + ra.height < rb.top || rb.top + rb.height < ra.top);
}

function _recordZOrderChange(name, targets, mutateFn) {
  const canvas = canvasManager.canvas;
  const unitParts = _expandZOrderUnits(targets);
  if (unitParts.length === 0) return;
  const all = canvas.getObjects();
  const prevIndices = new Map(unitParts.map(t => [t, all.indexOf(t)]));
  mutateFn(unitParts);
  if (canvasManager.connectorManager) {
    canvasManager.connectorManager._keepGridAtBack();
    if (canvasManager.connectorManager.selectedConnector) {
      canvasManager.connectorManager._showEndpointHandles(canvasManager.connectorManager.selectedConnector, { preserveDragState: true });
    }
  }
  canvas.requestRenderAll();
  const nextIndices = new Map(unitParts.map(t => [t, canvas.getObjects().indexOf(t)]));
  if (window.undoManager) {
    const moveTo = (idxMap) => {
      [...idxMap.entries()].sort((a, b) => a[1] - b[1]).forEach(([o, idx]) => {
        if (idx >= 0 && canvas.moveObjectTo) canvas.moveObjectTo(o, idx);
      });
      if (canvasManager.connectorManager) {
        canvasManager.connectorManager._keepGridAtBack();
        if (canvasManager.connectorManager.selectedConnector) {
          canvasManager.connectorManager._showEndpointHandles(canvasManager.connectorManager.selectedConnector, { preserveDragState: true });
        }
      }
      canvas.requestRenderAll();
    };
    window.undoManager.record({ name, execute: () => moveTo(nextIndices), undo: () => moveTo(prevIndices) });
  }
}

function bringToFront() {
  const canvas = canvasManager.canvas;
  const active = canvas.getActiveObject();
  if (!active) return;
  const targets = active.type === 'activeselection' ? active.getObjects().slice() : [active];
  _recordZOrderChange('Bring to Front', targets, (units) => {
    const objs = canvas.getObjects();
    let maxIdx = objs.length - 1;
    for (let i = objs.length - 1; i >= 0; i--) {
      if (!['connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line'].includes(objs[i].objectType)) {
        maxIdx = i;
        break;
      }
    }
    units.forEach(t => canvas.moveObjectTo(t, maxIdx));
  });
}

function sendToBack() {
  const canvas = canvasManager.canvas;
  const active = canvas.getActiveObject();
  if (!active) return;
  const targets = active.type === 'activeselection' ? active.getObjects().slice() : [active];
  _recordZOrderChange('Send to Back', targets, (units) => {
    const minIdx = _getMinDiagramZIndex(canvas);
    units.slice().reverse().forEach(t => canvas.moveObjectTo(t, minIdx));
  });
}

function bringForward() {
  const canvas = canvasManager.canvas;
  const active = canvas.getActiveObject();
  if (!active) return;
  const targets = active.type === 'activeselection' ? active.getObjects().slice() : [active];
  _recordZOrderChange('Bring Forward', targets, (units) => {
    const unitSet = new Set(units);
    const objs = canvas.getObjects();
    const topUnitIdx = Math.max(...units.map(u => objs.indexOf(u)));
    let nextIdx = -1;
    for (let i = topUnitIdx + 1; i < objs.length; i++) {
      const cand = objs[i];
      if (unitSet.has(cand) || _isOverlayOrBgObject(cand)) continue;
      if (nextIdx === -1) nextIdx = i;
      if (units.some(u => _boxesOverlap(u, cand))) {
        nextIdx = i;
        break;
      }
    }
    if (nextIdx > topUnitIdx) {
      let dest = nextIdx;
      units.slice().reverse().forEach((u) => {
        canvas.moveObjectTo(u, dest);
        dest = Math.max(0, dest - 1);
      });
    }
  });
}

function sendBackward() {
  const canvas = canvasManager.canvas;
  const active = canvas.getActiveObject();
  if (!active) return;
  const targets = active.type === 'activeselection' ? active.getObjects().slice() : [active];
  _recordZOrderChange('Send Backward', targets, (units) => {
    const unitSet = new Set(units);
    const objs = canvas.getObjects();
    const minIdx = _getMinDiagramZIndex(canvas);
    const botUnitIdx = Math.min(...units.map(u => objs.indexOf(u)));
    let prevIdx = -1;
    for (let i = botUnitIdx - 1; i >= minIdx; i--) {
      const cand = objs[i];
      if (unitSet.has(cand) || _isOverlayOrBgObject(cand)) continue;
      if (prevIdx === -1) prevIdx = i;
      if (units.some(u => _boxesOverlap(u, cand))) {
        prevIdx = i;
        break;
      }
    }
    if (prevIdx >= minIdx && prevIdx < botUnitIdx) {
      let dest = prevIdx;
      units.forEach((u) => {
        canvas.moveObjectTo(u, dest);
        dest++;
      });
    }
  });
}

let formatPainterStyle = null;

function _findStyleTargets(obj) {
  const isText = ['text', 'i-text', 'textbox'].includes(obj.type);
  const geom = obj.geometryObject || (obj.getObjects ? obj.getObjects().find(c => !['text', 'i-text', 'textbox'].includes(c.type)) : (isText ? null : obj));
  const label = obj.labelObject || (obj.getObjects ? obj.getObjects().find(c => ['text', 'i-text', 'textbox'].includes(c.type)) : (isText ? obj : null));
  return { geom, label };
}

function copyStyle(target) {
  const obj = target || canvasManager.canvas.getActiveObject();
  if (!obj) return;
  const sample = obj.type === 'activeselection' ? obj.getObjects()[0] : obj;
  if (!sample) return;
  const { geom, label } = _findStyleTargets(sample);
  formatPainterStyle = {
    fill: geom ? geom.fill : undefined,
    stroke: geom ? geom.stroke : undefined,
    strokeWidth: geom ? geom.strokeWidth : undefined,
    strokeDashArray: geom ? geom.strokeDashArray : undefined,
    opacity: sample.opacity,
    fontSize: label ? label.fontSize : null,
    fontFamily: label ? label.fontFamily : null,
    fontColor: label ? label.fill : null,
  };
  window.formatPainterStyle = formatPainterStyle;
}

function pasteStyle(target) {
  const active = target || canvasManager.canvas.getActiveObject();
  if (!active || !formatPainterStyle) return;
  const items = active.type === 'activeselection' ? active.getObjects() : [active];
  const snapshots = items.map(item => {
    const { geom, label } = _findStyleTargets(item);
    return {
      item, geom, label,
      prevOpacity: item.opacity,
      prevGeom: geom ? { fill: geom.fill, stroke: geom.stroke, strokeWidth: geom.strokeWidth, strokeDashArray: geom.strokeDashArray } : null,
      prevLabel: label ? { fontSize: label.fontSize, fontFamily: label.fontFamily, fill: label.fill } : null,
    };
  });

  const applyNew = () => {
    snapshots.forEach(({ item, geom, label }) => {
      if (geom) {
        if (formatPainterStyle.fill !== undefined) geom.set('fill', formatPainterStyle.fill);
        if (formatPainterStyle.stroke !== undefined) geom.set('stroke', formatPainterStyle.stroke);
        if (formatPainterStyle.strokeWidth !== undefined) geom.set('strokeWidth', formatPainterStyle.strokeWidth);
        if (formatPainterStyle.strokeDashArray !== undefined) geom.set('strokeDashArray', formatPainterStyle.strokeDashArray);
        geom.dirty = true;
      }
      if (formatPainterStyle.opacity !== undefined) item.set('opacity', formatPainterStyle.opacity);
      if (label) {
        if (formatPainterStyle.fontSize) label.set('fontSize', formatPainterStyle.fontSize);
        if (formatPainterStyle.fontFamily) label.set('fontFamily', formatPainterStyle.fontFamily);
        if (formatPainterStyle.fontColor) label.set('fill', formatPainterStyle.fontColor);
        label.dirty = true;
      }
      item.dirty = true;
      item.setCoords();
    });
    canvasManager.canvas.requestRenderAll();
  };

  const restoreOld = () => {
    snapshots.forEach(({ item, geom, label, prevOpacity, prevGeom, prevLabel }) => {
      if (geom && prevGeom) { geom.set(prevGeom); geom.dirty = true; }
      item.set('opacity', prevOpacity);
      if (label && prevLabel) { label.set(prevLabel); label.dirty = true; }
      item.dirty = true;
      item.setCoords();
    });
    canvasManager.canvas.requestRenderAll();
  };

  applyNew();
  if (window.undoManager) {
    window.undoManager.record({ name: 'Format Painter', execute: applyNew, undo: restoreOld });
  }
}

async function insertCustomSvgShape(svgXml, name, x, y, width = 60, height = 40, imageUrl = null, connectionPoints = []) {
  let imgObj;
  if (imageUrl) {
    const imgEl = new Image();
    await new Promise((resolve) => {
      imgEl.onload = resolve;
      imgEl.onerror = resolve;
      imgEl.src = imageUrl;
    });
    const scaleX = (width || 60) / Math.max(1, imgEl.naturalWidth || width || 60);
    const scaleY = (height || 40) / Math.max(1, imgEl.naturalHeight || height || 40);
    imgObj = new fabric.Image(imgEl, {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      scaleX: scaleX,
      scaleY: scaleY,
      imageSmoothing: true,
      selectable: true,
      objectType: 'shape',
    });
  } else {
    imgObj = await VisioConverter._createSvgImage(svgXml, x, y, width, height, true);
  }
  imgObj.objectType = 'custom-svg';
  imgObj.shapeType = 'custom-svg';
  imgObj.connectionPoints = (connectionPoints && connectionPoints.length > 0) ? connectionPoints : [
    { id: 'top', x: 0.5, y: 0, normal: { x: 0, y: -1 } },
    { id: 'right', x: 1, y: 0.5, normal: { x: 1, y: 0 } },
    { id: 'bottom', x: 0.5, y: 1, normal: { x: 0, y: 1 } },
    { id: 'left', x: 0, y: 0.5, normal: { x: -1, y: 0 } },
  ];
  imgObj.shapeData = { name: name, id: 'shape_' + Math.random().toString(36).substr(2, 9), imageUrl: imageUrl || undefined };

  canvasManager.canvas.add(imgObj);
  canvasManager.canvas.setActiveObject(imgObj);
  canvasManager.canvas.requestRenderAll();

  window.undoManager.record({
    name: `Insert ${name}`,
    execute: () => {
      canvasManager.canvas.add(imgObj);
      canvasManager.canvas.requestRenderAll();
    },
    undo: () => {
      canvasManager.canvas.remove(imgObj);
      canvasManager.canvas.requestRenderAll();
    }
  });
}

function groupSelected() {
  const active = canvasManager.canvas.getActiveObject();
  if (!active || active.type !== 'activeselection') return;

  const objects = active.getObjects().slice();
  if (objects.length < 2) return;
  canvasManager.canvas.discardActiveObject();
  objects.forEach((obj) => canvasManager.canvas.remove(obj));

  const group = new fabric.Group(objects, {
    cornerStyle: 'circle',
    cornerColor: '#0078d4',
    cornerStrokeColor: '#ffffff',
    cornerSize: 8,
    transparentCorners: false,
    borderColor: '#0078d4',
    borderScaleFactor: 1.5,
    padding: 2,
  });
  group.objectType = 'group';

  canvasManager.canvas.add(group);
  canvasManager.canvas.setActiveObject(group);
  canvasManager.canvas.requestRenderAll();

  window.undoManager.record({
    name: 'Group Objects',
    execute: () => {
      canvasManager.canvas.discardActiveObject();
      objects.forEach((obj) => canvasManager.canvas.remove(obj));
      group.add(...objects);
      canvasManager.canvas.add(group);
      canvasManager.canvas.setActiveObject(group);
      canvasManager.canvas.requestRenderAll();
    },
    undo: () => {
      canvasManager.canvas.discardActiveObject();
      const released = group.removeAll();
      canvasManager.canvas.remove(group);
      released.forEach((obj) => canvasManager.canvas.add(obj));
      canvasManager.canvas.requestRenderAll();
    },
  });
}

function ungroupSelected() {
  const active = canvasManager.canvas.getActiveObject();
  if (!active || active.type !== 'group') return;
  // Do not shatter built-in Visio/ShapeFactory atomic shapes unless user-created group
  if (active.objectType !== 'group') return;

  canvasManager.canvas.discardActiveObject();
  const objects = active.removeAll();
  canvasManager.canvas.remove(active);
  objects.forEach((obj) => canvasManager.canvas.add(obj));
  const selection = new fabric.ActiveSelection(objects, { canvas: canvasManager.canvas });
  canvasManager.canvas.setActiveObject(selection);
  canvasManager.canvas.requestRenderAll();

  window.undoManager.record({
    name: 'Ungroup Objects',
    execute: () => {
      canvasManager.canvas.discardActiveObject();
      const rel = active.removeAll();
      canvasManager.canvas.remove(active);
      rel.forEach((obj) => canvasManager.canvas.add(obj));
      canvasManager.canvas.requestRenderAll();
    },
    undo: () => {
      canvasManager.canvas.discardActiveObject();
      objects.forEach((obj) => canvasManager.canvas.remove(obj));
      active.add(...objects);
      canvasManager.canvas.add(active);
      canvasManager.canvas.setActiveObject(active);
      canvasManager.canvas.requestRenderAll();
    },
  });
}

/**
 * Align selected objects.
 * @param {string} alignment - 'left'|'center-h'|'right'|'top'|'center-v'|'bottom'
 */
function alignObjects(alignment) {
  const activeObj = canvasManager.canvas.getActiveObject();
  if (!activeObj) return;

  const isMulti = activeObj.type === 'activeselection';
  const objects = isMulti ? activeObj.getObjects().slice() : [activeObj];
  if (isMulti && objects.length < 2) return;

  if (isMulti) canvasManager.canvas.discardActiveObject();

  const pageSize = canvasManager.gridManager.pageSize;
  const changes = [];

  if (!isMulti) {
    const b = activeObj.getBoundingRect();
    const prevLeft = activeObj.left, prevTop = activeObj.top;
    let dx = 0, dy = 0;
    if (alignment === 'left') dx = -b.left;
    else if (alignment === 'center-h') dx = (pageSize.width - b.width) / 2 - b.left;
    else if (alignment === 'right') dx = (pageSize.width - b.width) - b.left;
    else if (alignment === 'top') dy = -b.top;
    else if (alignment === 'center-v') dy = (pageSize.height - b.height) / 2 - b.top;
    else if (alignment === 'bottom') dy = (pageSize.height - b.height) - b.top;
    activeObj.set({ left: prevLeft + dx, top: prevTop + dy });
    activeObj.setCoords();
    changes.push({ obj: activeObj, prevLeft, prevTop, nextLeft: activeObj.left, nextTop: activeObj.top });
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const bounds = objects.map((obj) => {
      const b = obj.getBoundingRect();
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
      return b;
    });
    objects.forEach((obj, idx) => {
      const b = bounds[idx];
      const prevLeft = obj.left, prevTop = obj.top;
      let dx = 0, dy = 0;
      if (alignment === 'left') dx = minX - b.left;
      else if (alignment === 'center-h') dx = (minX + maxX) / 2 - (b.left + b.width / 2);
      else if (alignment === 'right') dx = maxX - (b.left + b.width);
      else if (alignment === 'top') dy = minY - b.top;
      else if (alignment === 'center-v') dy = (minY + maxY) / 2 - (b.top + b.height / 2);
      else if (alignment === 'bottom') dy = maxY - (b.top + b.height);
      obj.set({ left: prevLeft + dx, top: prevTop + dy });
      obj.setCoords();
      changes.push({ obj, prevLeft, prevTop, nextLeft: obj.left, nextTop: obj.top });
    });
    const sel = new fabric.ActiveSelection(objects, { canvas: canvasManager.canvas });
    canvasManager.canvas.setActiveObject(sel);
  }

  if (canvasManager.connectorManager) objects.forEach(o => canvasManager.connectorManager._onShapeTransform(o));
  canvasManager.canvas.requestRenderAll();

  if (window.undoManager && changes.length > 0) {
    window.undoManager.record({
      name: `Align ${alignment}`,
      execute: () => {
        if (isMulti) canvasManager.canvas.discardActiveObject();
        changes.forEach(c => {
          c.obj.set({ left: c.nextLeft, top: c.nextTop });
          c.obj.setCoords();
          if (canvasManager.connectorManager) canvasManager.connectorManager._onShapeTransform(c.obj);
        });
        canvasManager.canvas.requestRenderAll();
      },
      undo: () => {
        if (isMulti) canvasManager.canvas.discardActiveObject();
        changes.forEach(c => {
          c.obj.set({ left: c.prevLeft, top: c.prevTop });
          c.obj.setCoords();
          if (canvasManager.connectorManager) canvasManager.connectorManager._onShapeTransform(c.obj);
        });
        canvasManager.canvas.requestRenderAll();
      }
    });
  }
}

async function handleOpen() {
  if (!window.openDraw || (!window.openDraw.showOpenFilesDialog && !window.openDraw.showOpenDialog)) {
    console.warn('showOpenDialog is not available on window.openDraw');
    return;
  }
  try {
    if (window.openDraw.showOpenFilesDialog) {
      const filePaths = await window.openDraw.showOpenFilesDialog();
      if (Array.isArray(filePaths) && filePaths.length > 0) {
        await handleFilesOpen(filePaths);
      }
      return;
    }
    const filePath = await window.openDraw.showOpenDialog();
    if (filePath) {
      await handleFileOpen(filePath);
    }
  } catch (err) {
    console.error('Failed to open file dialog:', err);
    if (window.openDrawDialog) {
      await window.openDrawDialog.alert(`Could not open file: ${err.message}`, 'Open File Error');
    }
  }
}

async function duplicateSelected() {
  const active = canvasManager.canvas.getActiveObject();
  if (!active) return;

  const isMulti = active.type === 'activeselection';
  const rawObjs = (isMulti ? active.getObjects() : [active]).filter(o => !isSystemCanvasObject(o) && o.objectType !== 'connector');
  if (rawObjs.length === 0) return;

  if (isMulti) canvasManager.canvas.discardActiveObject();
  const serialized = rawObjs.map(o => o.toObject(OD_SERIALIZE_PROPS));
  const clonedObjects = await fabric.util.enlivenObjects(serialized);

  clonedObjects.forEach((cloned) => {
    cloned.set({
      left: (cloned.left || 0) + 25,
      top: (cloned.top || 0) + 25,
      cornerStyle: 'circle',
      cornerColor: '#0078d4',
      cornerStrokeColor: '#ffffff',
      cornerSize: 8,
      transparentCorners: false,
      borderColor: '#0078d4',
      borderScaleFactor: 1.5,
      padding: 2,
    });
    if (cloned.shapeData) {
      cloned.shapeData = { ...cloned.shapeData, id: 'shape_' + Math.random().toString(36).substr(2, 9) };
    }
    if (cloned.getObjects) {
      const kids = cloned.getObjects();
      cloned.geometryObject = kids.find(c => !['text', 'i-text', 'textbox'].includes(c.type)) || kids[0];
      cloned.labelObject = kids.find(c => ['text', 'i-text', 'textbox'].includes(c.type)) || null;
    }
    canvasManager.canvas.add(cloned);
  });

  if (clonedObjects.length > 1) {
    const newSel = new fabric.ActiveSelection(clonedObjects, { canvas: canvasManager.canvas });
    canvasManager.canvas.setActiveObject(newSel);
  } else if (clonedObjects.length === 1) {
    canvasManager.canvas.setActiveObject(clonedObjects[0]);
  }
  canvasManager.canvas.requestRenderAll();

  if (window.undoManager) {
    window.undoManager.record({
      name: `Duplicate ${clonedObjects.length} object(s)`,
      execute: () => {
        clonedObjects.forEach((o) => canvasManager.canvas.add(o));
        canvasManager.canvas.requestRenderAll();
      },
      undo: () => {
        clonedObjects.forEach((o) => canvasManager.canvas.remove(o));
        canvasManager.canvas.discardActiveObject();
        canvasManager.canvas.requestRenderAll();
      },
    });
  }
}

// Expose actions to global scope for menus, ribbon, and shortcuts
window.handleNew = handleNew;
window.handleOpen = handleOpen;
window.handleFileOpen = handleFileOpen;
window.handleSave = handleSave;
window.handleSaveAs = handleSaveAs;
window.handleExport = handleExport;
window.handleCopy = handleCopy;
window.handleCut = handleCut;
window.handlePaste = handlePaste;
window.selectAll = selectAll;
window.duplicateSelected = duplicateSelected;
window.bringToFront = bringToFront;
window.bringForward = bringForward;
window.sendBackward = sendBackward;
window.sendToBack = sendToBack;
window.copyStyle = copyStyle;
window.pasteStyle = pasteStyle;
window.insertCustomSvgShape = insertCustomSvgShape;
window.groupSelected = groupSelected;
window.ungroupSelected = ungroupSelected;
window.alignObjects = alignObjects;
window.showVisioStartScreen = showVisioStartScreen;
window.renderRecentFiles = renderRecentFiles;

