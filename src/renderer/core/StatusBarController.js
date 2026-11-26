/**
 * StatusBarController — Updates the status bar with current app state.
 * 
 * Shows: active tool, selection info, mouse coordinates, zoom level.
 */
class StatusBarController {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this._canvasManager = canvasManager;

    // DOM references
    this._toolEl = document.getElementById('status-tool');
    this._selectionEl = document.getElementById('status-selection');
    this._coordsEl = document.getElementById('status-coords');
    this._pageEl = document.getElementById('status-page');
    this._zoomLevelEl = document.getElementById('status-zoom-level');
    this._zoomSlider = document.getElementById('status-zoom-slider');
    this._zoomInBtn = document.getElementById('status-zoom-in');
    this._zoomOutBtn = document.getElementById('status-zoom-out');

    this._setupEventListeners();
    this._setupZoomControls();
    this._setupToolControls();
    this._syncInitialState();
  }

  _syncInitialState() {
    if (this._canvasManager) {
      const pct = Math.round((this._canvasManager._zoom || 1) * 100);
      if (this._zoomLevelEl) this._zoomLevelEl.textContent = `${pct}%`;
      if (this._zoomSlider) this._zoomSlider.value = pct;
      window.eventBus.emit('tool:changed', this._canvasManager.activeTool || 'select');
    }
    if (this._selectionEl) this._selectionEl.textContent = 'Ready';
  }

  _setupToolControls() {
    const pointerBtn = document.getElementById('status-tool-pointer');
    const panBtn = document.getElementById('status-tool-pan');
    const fitBtn = document.getElementById('status-fit-btn');

    if (pointerBtn) {
      pointerBtn.addEventListener('click', () => {
        this._canvasManager.setTool('select');
      });
    }

    if (panBtn) {
      panBtn.addEventListener('click', () => {
        this._canvasManager.setTool('pan');
      });
    }

    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        this._canvasManager.zoomToFit();
      });
    }
  }

  _setupEventListeners() {
    // Tool changes
    window.eventBus.on('tool:changed', (tool) => {
      const toolNames = {
        'select': 'Pointer Tool',
        'pan': 'Pan',
        'insert:rectangle': 'Insert Rectangle',
        'insert:rounded-rect': 'Insert Rounded Rectangle',
        'insert:ellipse': 'Insert Ellipse',
        'insert:circle': 'Insert Circle',
        'insert:diamond': 'Insert Diamond',
        'insert:triangle': 'Insert Triangle',
        'insert:connector': 'Connector',
        'insert:textbox': 'Text Box',
        'insert:container': 'Insert Container',
        'insert:callout': 'Insert Callout',
        'insert:chart': 'Insert Chart',
        'insert:cad': 'Insert CAD Drawing',
        'review:new-comment': 'New Comment',
      };
      if (this._toolEl) this._toolEl.textContent = toolNames[tool] || tool || 'Ready';
    });

    // Selection changes
    window.eventBus.on('selection:changed', ({ objects, count }) => {
      if (this._selectionEl) {
        if (count === 0) {
          this._selectionEl.textContent = 'No selection';
        } else if (count === 1) {
          const obj = objects[0];
          let type = '';
          if (obj.objectType === 'connector' || obj.shapeType === 'connector' || obj.connectorData) {
            type = 'Connector';
            if (obj.shapeData && obj.shapeData.name) {
              type += ` (${obj.shapeData.name})`;
            }
          } else if (obj.objectType === 'container') {
            type = 'Container';
            if (obj.shapeData && obj.shapeData.name && obj.shapeData.name !== 'Container') {
              type += ` (${obj.shapeData.name})`;
            }
          } else if (obj.shapeData && obj.shapeData.name) {
            type = obj.shapeData.name;
          } else {
            const rawType = obj.objectType || obj.type || 'Object';
            type = rawType.charAt(0).toUpperCase() + rawType.slice(1);
          }
          this._selectionEl.textContent = `Selected: ${type}`;
        } else {
          this._selectionEl.textContent = `Selected: ${count} objects`;
        }
      }
    });

    // Mouse position
    window.eventBus.on('mouse:moved', ({ pageX, pageY }) => {
      if (this._coordsEl) this._coordsEl.textContent = `X: ${pageX}, Y: ${pageY}`;
    });

    // Zoom level
    window.eventBus.on('zoom:changed', (percent) => {
      if (this._zoomLevelEl) this._zoomLevelEl.textContent = `${percent}%`;
      if (this._zoomSlider) this._zoomSlider.value = percent;
    });
  }

  _setupZoomControls() {
    if (this._zoomSlider) {
      this._zoomSlider.addEventListener('input', (e) => {
        this._canvasManager.setZoomPercent(parseInt(e.target.value, 10));
      });
    }
    if (this._zoomInBtn) {
      this._zoomInBtn.addEventListener('click', () => {
        this._canvasManager.zoomIn();
      });
    }
    if (this._zoomOutBtn) {
      this._zoomOutBtn.addEventListener('click', () => {
        this._canvasManager.zoomOut();
      });
    }
    if (this._zoomLevelEl) {
      this._zoomLevelEl.title = 'Click to reset zoom to 100%';
      this._zoomLevelEl.addEventListener('click', () => {
        this._canvasManager.setZoomPercent(100);
      });
    }
  }
}

