/**
 * CanvasManager — Core canvas engine wrapping Fabric.js.
 * 
 * Handles:
 * - Canvas initialization and sizing
 * - Zoom (mouse wheel, buttons, pinch)
 * - Pan (middle-click drag, space+drag)
 * - Object snapping to grid
 * - Selection management
 * - Mouse coordinate tracking
 */

// High-Contrast Dual-Tone Cursors — fully visible over both white sheets and dark canvas
const CURSOR_CROSSHAIR = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cline x1=\'12\' y1=\'2\' x2=\'12\' y2=\'22\' stroke=\'%23ffffff\' stroke-width=\'3.5\' stroke-linecap=\'round\'/%3E%3Cline x1=\'2\' y1=\'12\' x2=\'22\' y2=\'12\' stroke=\'%23ffffff\' stroke-width=\'3.5\' stroke-linecap=\'round\'/%3E%3Cline x1=\'12\' y1=\'2\' x2=\'12\' y2=\'22\' stroke=\'%23000000\' stroke-width=\'1.5\' stroke-linecap=\'round\'/%3E%3Cline x1=\'2\' y1=\'12\' x2=\'22\' y2=\'12\' stroke=\'%23000000\' stroke-width=\'1.5\' stroke-linecap=\'round\'/%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'1.5\' fill=\'%23ffffff\' stroke=\'%23000000\' stroke-width=\'0.8\'/%3E%3C/svg%3E") 12 12, crosshair';

const CURSOR_GRAB = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M10 5V3.5a1.5 1.5 0 0 1 3 0V7h.5a1.5 1.5 0 0 1 3 0v2h.5a1.5 1.5 0 0 1 3 0v4.5c0 3.5-3 6.5-6.5 6.5H13c-2.5 0-4.8-1.5-5.8-3.7l-2-4.5a1.5 1.5 0 0 1 2.7-1.3l1.1 2.5V5a1.5 1.5 0 0 1 1-1.5z\' fill=\'%23ffffff\' stroke=\'%23000000\' stroke-width=\'2.2\' stroke-linejoin=\'round\' stroke-linecap=\'round\'/%3E%3C/svg%3E") 10 10, grab';

const CURSOR_GRABBING = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M13.5 10.5V9a1.5 1.5 0 0 0-3 0v.5a1.5 1.5 0 0 0-2 0V11a1.5 1.5 0 0 0-2 0v2.5c0 3.5 2.5 6.5 6 6.5h1c3.5 0 6-3 6-6.5V12a1.5 1.5 0 0 0-3 0v-1a1.5 1.5 0 0 0-3-.5z\' fill=\'%23ffffff\' stroke=\'%23000000\' stroke-width=\'2.2\' stroke-linejoin=\'round\' stroke-linecap=\'round\'/%3E%3C/svg%3E") 10 10, grabbing';

window.OPENDRAW_CURSORS = {
  CROSSHAIR: CURSOR_CROSSHAIR,
  GRAB: CURSOR_GRAB,
  GRABBING: CURSOR_GRABBING,
};

class CanvasManager {
  constructor() {
    /** @type {fabric.Canvas|null} */
    this.canvas = null;
    /** @type {GridManager|null} */
    this.gridManager = null;
    /** @type {RulerManager|null} */
    this.rulerManager = null;

    // Zoom config
    this._zoom = 1;
    this._minZoom = 0.1;
    this._maxZoom = 4;
    this._zoomStep = 0.1;

    // Pan state
    this._isPanning = false;
    this._panStartX = 0;
    this._panStartY = 0;
    this._spaceHeld = false;

    // Current tool
    this._activeTool = 'select'; // 'select' | 'pan' | 'insert:*'

    // Container reference
    this._container = null;
  }

  /**
   * Initialize the canvas and all supporting systems.
   */
  init() {
    this._container = document.getElementById('canvas-container');
    const canvasEl = document.getElementById('drawing-canvas');

    // Size canvas to container
    const rect = this._container.getBoundingClientRect();
    canvasEl.width = rect.width;
    canvasEl.height = rect.height;

    // Create Fabric.js canvas
    this.canvas = new fabric.Canvas('drawing-canvas', {
      width: rect.width,
      height: rect.height,
      backgroundColor: '#1e1e1e', // Visio 2016 Black Theme workspace background
      selection: true,
      selectionKey: ['ctrlKey', 'shiftKey', 'metaKey'],
      selectionColor: 'rgba(0, 120, 212, 0.1)',
      selectionBorderColor: '#0078d4',
      selectionLineWidth: 1,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      targetFindTolerance: 8,
    });

    // Initialize grid
    this.gridManager = new GridManager(this.canvas);

    // Initialize rulers
    const hRuler = document.getElementById('ruler-horizontal');
    const vRuler = document.getElementById('ruler-vertical');
    this.rulerManager = new RulerManager(this.canvas, hRuler, vRuler);

    // Initialize smart alignment guides
    this.alignmentGuideManager = new AlignmentGuideManager(this.canvas);

    // Initialize inline text editor
    this.inlineTextEditor = new InlineTextEditor(this);

    // Initialize connector engine
    this.connectorManager = new ConnectorManager(this);

    // Initialize context menu
    this.contextMenuManager = new ContextMenuManager(this);

    // Initialize multi-page architecture
    this.pageManager = new PageManager(this);

    // Initialize layer system
    this.layerManager = new LayerManager(this);

    // Initialize auto-layout engine
    this.autoLayoutManager = new AutoLayoutManager(this);

    // Initialize themes & palettes
    this.themeManager = new ThemeManager(this);

    // Center the page in the viewport
    this._centerPage();

    // Setup event handlers
    this._setupZoom();
    this._setupPan();
    this._setupSelection();
    this._setupKeyboard();
    this._setupResize();
    this._setupMouseTracking();
    this._setupSnapping();

    // Initial ruler draw
    this.rulerManager.draw();

    // Setup interactive canvas scrollbars
    this._setupScrollbars();
    this._updateScrollbars();

    console.log('CanvasManager initialized');
  }

  /**
   * Center the page in the viewport.
   */
  _centerPage() {
    const containerRect = this._container.getBoundingClientRect();
    const pageSize = this.gridManager.pageSize;
    
    const offsetX = (containerRect.width - pageSize.width) / 2;
    const offsetY = (containerRect.height - pageSize.height) / 2;
    
    const vpt = this.canvas.viewportTransform;
    vpt[4] = Math.max(50, offsetX);
    vpt[5] = Math.max(30, offsetY);
    this.canvas.setViewportTransform(vpt);
    if (this._updateScrollbars) this._updateScrollbars();
  }

  // =====================
  // ZOOM
  // =====================

  _setupZoom() {
    // Mouse wheel navigation matching standard diagramming workstations:
    // - Ctrl + Wheel = Zoom in / out toward mouse pointer
    // - Shift + Wheel = Scroll horizontally
    // - Wheel alone = Scroll vertically
    this.canvas.on('mouse:wheel', (opt) => {
      const evt = opt.e;
      evt.preventDefault();
      evt.stopPropagation();

      if (evt.ctrlKey || evt.metaKey) {
        const delta = evt.deltaY;
        let newZoom = this._zoom * Math.pow(0.998, delta);
        newZoom = Math.max(this._minZoom, Math.min(this._maxZoom, newZoom));

        const vptPoint = (typeof this.canvas.getViewportPoint === 'function')
          ? this.canvas.getViewportPoint(opt.e)
          : new fabric.Point(evt.offsetX, evt.offsetY);
        this.canvas.zoomToPoint(vptPoint, newZoom);

        this._zoom = newZoom;
        this._emitZoomChanged();
        this.rulerManager.draw();
        this._updateScrollbars();
        return;
      }

      const vpt = this.canvas.viewportTransform;
      if (evt.shiftKey) {
        const delta = evt.deltaY || evt.deltaX;
        vpt[4] -= delta;
      } else {
        vpt[4] -= (evt.deltaX || 0);
        vpt[5] -= (evt.deltaY || 0);
      }
      this.canvas.setViewportTransform(vpt);
      this.rulerManager.draw();
      this._updateScrollbars();
    });
  }

  /**
   * Zoom in by one step.
   */
  zoomIn() {
    this._setZoomCenter(this._zoom + this._zoomStep);
  }

  /**
   * Zoom out by one step.
   */
  zoomOut() {
    this._setZoomCenter(this._zoom - this._zoomStep);
  }

  /**
   * Set zoom to 100%.
   */
  zoom100() {
    this._setZoomCenter(1);
  }

  /**
   * Zoom to fit the page width in the viewport.
   */
  zoomToPageWidth() {
    const containerRect = this._container.getBoundingClientRect();
    const pageSize = this.gridManager.pageSize;
    if (containerRect.width <= 40 || pageSize.width <= 0) return;
    const rawScale = (containerRect.width - 80) / pageSize.width;
    const newZoom = Math.max(this._minZoom, Math.min(rawScale, this._maxZoom));
    this._zoom = newZoom;
    this.canvas.setZoom(newZoom);
    const vpt = this.canvas.viewportTransform;
    vpt[4] = (containerRect.width - pageSize.width * newZoom) / 2;
    vpt[5] = 30;
    this.canvas.setViewportTransform(vpt);
    this._emitZoomChanged();
    this.rulerManager.draw();
    this._updateScrollbars();
  }

  /**
   * Zoom to fit the page in the viewport.
   */
  zoomToFit() {
    const containerRect = this._container.getBoundingClientRect();
    const pageSize = this.gridManager.pageSize;
    if (containerRect.width <= 40 || containerRect.height <= 40) return;

    const scaleX = (containerRect.width - 80) / Math.max(1, pageSize.width);
    const scaleY = (containerRect.height - 80) / Math.max(1, pageSize.height);
    const newZoom = Math.max(this._minZoom, Math.min(scaleX, scaleY, this._maxZoom));

    this._zoom = newZoom;
    this.canvas.setZoom(newZoom);

    // Center after zoom
    const vpt = this.canvas.viewportTransform;
    vpt[4] = (containerRect.width - pageSize.width * newZoom) / 2;
    vpt[5] = (containerRect.height - pageSize.height * newZoom) / 2;
    this.canvas.setViewportTransform(vpt);

    this._emitZoomChanged();
    this.rulerManager.draw();
    this._updateScrollbars();
  }

  /**
   * Set zoom level, zooming toward center of viewport.
   * @param {number} newZoom 
   */
  _setZoomCenter(newZoom) {
    newZoom = Math.max(this._minZoom, Math.min(this._maxZoom, newZoom));
    
    const containerRect = this._container.getBoundingClientRect();
    const centerPoint = new fabric.Point(containerRect.width / 2, containerRect.height / 2);
    
    this.canvas.zoomToPoint(centerPoint, newZoom);
    this._zoom = newZoom;
    this._emitZoomChanged();
    this.rulerManager.draw();
    this._updateScrollbars();
  }

  /**
   * Set zoom to a specific percentage.
   * @param {number} percent - e.g., 100 for 100%
   */
  setZoomPercent(percent) {
    this._setZoomCenter(percent / 100);
  }

  _emitZoomChanged() {
    const percent = Math.round(this._zoom * 100);
    window.eventBus.emit('zoom:changed', percent);
  }

  // =====================
  // PAN
  // =====================

  _setupPan() {
    this.canvas.on('mouse:down', (opt) => {
      const evt = opt.e;

      // Middle mouse button OR space held OR pan tool active
      const shouldPan = evt.button === 1 || 
                        this._spaceHeld || 
                        this._activeTool === 'pan';

      if (shouldPan) {
        this._isPanning = true;
        this._panStartX = evt.clientX;
        this._panStartY = evt.clientY;
        this.canvas.selection = false;
        this.canvas.skipTargetFind = true;
        this._container.style.cursor = CURSOR_GRABBING;
        this.canvas.defaultCursor = CURSOR_GRABBING;
        this.canvas.hoverCursor = CURSOR_GRABBING;
        if (this.canvas.upperCanvasEl) this.canvas.upperCanvasEl.style.cursor = CURSOR_GRABBING;
        if (this.gridManager) this.gridManager.setPanActive(true);
        evt.preventDefault();
        evt.stopPropagation();
      }
    });

    let panRafId = null;
    let pendingDx = 0;
    let pendingDy = 0;

    this.canvas.on('mouse:move', (opt) => {
      if (this._isPanning) {
        const evt = opt.e;
        pendingDx += evt.clientX - this._panStartX;
        pendingDy += evt.clientY - this._panStartY;
        this._panStartX = evt.clientX;
        this._panStartY = evt.clientY;

        if (!panRafId) {
          panRafId = requestAnimationFrame(() => {
            panRafId = null;
            if (!this._isPanning && pendingDx === 0 && pendingDy === 0) return;
            const vpt = this.canvas.viewportTransform;
            vpt[4] += pendingDx;
            vpt[5] += pendingDy;
            pendingDx = 0;
            pendingDy = 0;
            this.canvas.setViewportTransform(vpt);
            this.canvas.requestRenderAll();
            this.rulerManager.draw();
            this._updateScrollbars();
          });
        }
      }
    });

    const endPan = () => {
      if (this._isPanning) {
        this._isPanning = false;
        if (panRafId) {
          cancelAnimationFrame(panRafId);
          panRafId = null;
        }
        if (pendingDx !== 0 || pendingDy !== 0) {
          const vpt = this.canvas.viewportTransform;
          vpt[4] += pendingDx;
          vpt[5] += pendingDy;
          pendingDx = 0;
          pendingDy = 0;
          this.canvas.setViewportTransform(vpt);
          this.canvas.requestRenderAll();
          this.rulerManager.draw();
          this._updateScrollbars();
        }
        this.canvas.selection = this._activeTool === 'select';
        this.canvas.skipTargetFind = this._activeTool === 'pan';
        this._updateCursor();
      }
    };

    this.canvas.on('mouse:up', endPan);
    window.addEventListener('mouseup', endPan);
    window.addEventListener('blur', () => {
      this._spaceHeld = false;
      endPan();
    });
  }

  // =====================
  // SELECTION
  // =====================

  _setupSelection() {
    this.canvas.on('selection:created', (e) => {
      this._emitSelection(e.selected);
    });

    this.canvas.on('selection:updated', (e) => {
      this._emitSelection(e.selected);
    });

    this.canvas.on('selection:cleared', () => {
      window.eventBus.emit('selection:changed', { objects: [], count: 0 });
    });
  }

  _emitSelection(objects) {
    // Filter out grid/page objects
    const shapes = (objects || []).filter(
      (obj) => obj.objectType !== 'grid-line' && obj.objectType !== 'page-background'
    );
    window.eventBus.emit('selection:changed', {
      objects: shapes,
      count: shapes.length,
    });
  }

  // =====================
  // KEYBOARD
  // =====================

  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input, textarea, select, button (for Space) or editable element
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        if (tag === 'BUTTON' || (e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button')) return;
        this._spaceHeld = true;
        this._container.style.cursor = CURSOR_GRAB;
        this.canvas.defaultCursor = CURSOR_GRAB;
        this.canvas.hoverCursor = CURSOR_GRAB;
        if (this.canvas.upperCanvasEl) this.canvas.upperCanvasEl.style.cursor = CURSOR_GRAB;
        e.preventDefault();
      }

      // F2 to edit shape text (Visio standard)
      if (e.key === 'F2') {
        const active = this.canvas.getActiveObject();
        const ed = this._inlineTextEditor || this.inlineTextEditor || window.inlineTextEditor;
        if (active && ed) {
          e.preventDefault();
          ed.edit(active);
        }
      }

      // Escape to cancel active tool and return to Pointer tool
      if (e.key === 'Escape') {
        if (this._activeTool !== 'select') {
          this.setTool('select');
        }
      }

      // Visio standard tool shortcuts (Ctrl+1 Pointer, Ctrl+2 Text Block, Ctrl+3 Connector)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          this.setTool('select');
        } else if (e.key === '2') {
          e.preventDefault();
          this.setTool('insert:textbox');
        } else if (e.key === '3') {
          e.preventDefault();
          this.setTool('insert:connector');
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._spaceHeld = false;
        if (!this._isPanning) this._updateCursor();
      }
    });
  }

  // =====================
  // RESIZE
  // =====================

  _setupResize() {
    const ro = new ResizeObserver(() => {
      const rect = this._container.getBoundingClientRect();
      this.canvas.setDimensions({ width: rect.width, height: rect.height });
      this.rulerManager.draw();
      this._updateScrollbars();
    });
    ro.observe(this._container);
  }

  // =====================
  // MOUSE TRACKING
  // =====================

  _setupMouseTracking() {
    this.canvas.on('mouse:move', (opt) => {
      if (this._isPanning) return; // Already handled in pan

      // Get page coordinates (accounting for zoom/pan)
      const pointer = this.canvas.getScenePoint(opt.e);
      window.eventBus.emit('mouse:moved', {
        pageX: Math.round(pointer.x),
        pageY: Math.round(pointer.y),
      });

      // Update ruler indicators
      const containerRect = this._container.getBoundingClientRect();
      const screenX = opt.e.clientX - containerRect.left;
      const screenY = opt.e.clientY - containerRect.top;
      this.rulerManager.updateMousePosition(screenX, screenY);
    });
  }

  // =====================
  // SNAPPING
  // =====================

  _setupSnapping() {
    this.canvas.on('object:moving', (e) => {
      if (this.gridManager) {
        this.gridManager.snapObject(e.target);
      }
    });
  }

  // =====================
  // TOOLS
  // =====================

  /**
   * Set the active tool.
   * @param {string} tool - Tool identifier
   */
  setTool(tool) {
    this._cleanupInsertMode();

    this._activeTool = tool;
    const isSelect = tool === 'select';
    this.canvas.selection = isSelect;
    this.canvas.skipTargetFind = tool === 'pan';

    const nonSelectableTypes = new Set([
      'grid-line', 'page-background', 'connector-arrow',
      'connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line'
    ]);
    const lockedLayerIds = new Set(
      (this.layerManager && this.layerManager.layers ? this.layerManager.layers : [])
        .filter(l => l.locked)
        .map(l => l.id)
    );

    this.canvas.forEachObject((obj) => {
      if (obj.isGridLine || obj.isPageBg || obj.isGuide || nonSelectableTypes.has(obj.objectType)) return;
      const isLayerLocked = lockedLayerIds.has(obj.layerId || 'layer_default');
      obj.selectable = isSelect && !isLayerLocked;
      obj.evented = !isLayerLocked;
    });

    if (!isSelect) {
      this.canvas.discardActiveObject();
      this.canvas._currentTransform = null;
    }

    if (this._container) {
      this._container.classList.toggle('tool-pan', tool === 'pan');
      this._container.classList.toggle('tool-insert', tool.startsWith('insert:'));
    }

    this._updateCursor();
    window.eventBus.emit('tool:changed', tool);

    // If it's a shape insert tool, handle shape insertion with drag-to-size
    if (tool.startsWith('insert:') && tool !== 'insert:connector') {
      this._setupInsertMode(tool);
    }
  }

  /**
   * Setup insert mode — supports both click-to-place and drag-to-size.
   * For text boxes, drag-to-size determines bounding box immediately and enters text editing.
   * @param {string} tool 
   */
  _setupInsertMode(tool) {
    this._cleanupInsertMode();

    let isDrawing = false;
    let startPt = null;

    const onMouseDown = (opt) => {
      if (this._spaceHeld || this._isPanning) return;
      if (opt.e && opt.e.button !== 0) return;

      isDrawing = true;
      startPt = this.canvas.getScenePoint(opt.e);

      this._previewRect = new fabric.Rect({
        left: startPt.x,
        top: startPt.y,
        width: 1,
        height: 1,
        fill: tool === 'insert:textbox' ? 'rgba(0, 120, 212, 0.05)' : 'rgba(0, 120, 212, 0.12)',
        stroke: '#0078d4',
        strokeWidth: 1.5,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        objectType: 'preview-rect',
      });
      this.canvas.add(this._previewRect);
      this.canvas.requestRenderAll();
    };

    const onMouseMove = (opt) => {
      if (!isDrawing || !this._previewRect || !startPt) return;
      const curPt = this.canvas.getScenePoint(opt.e);
      const left = Math.min(startPt.x, curPt.x);
      const top = Math.min(startPt.y, curPt.y);
      const width = Math.max(2, Math.abs(curPt.x - startPt.x));
      const height = Math.max(2, Math.abs(curPt.y - startPt.y));

      this._previewRect.set({ left, top, width, height });
      this.canvas.requestRenderAll();
    };

    const onMouseUp = (opt) => {
      if (!isDrawing) return;
      isDrawing = false;

      const endPt = this.canvas.getScenePoint(opt.e);
      const rawW = Math.abs(endPt.x - startPt.x);
      const rawH = Math.abs(endPt.y - startPt.y);

      this._cleanupInsertMode();

      const shapeType = tool.replace('insert:', '');

      if (shapeType === 'comment') {
        const posX = (rawW > 15) ? Math.min(startPt.x, endPt.x) : this.gridManager.snapToGrid(startPt.x);
        const posY = (rawH > 15) ? Math.min(startPt.y, endPt.y) : this.gridManager.snapToGrid(startPt.y);
        const customW = (rawW > 15 && rawH > 15) ? rawW : null;
        const customH = (rawW > 15 && rawH > 15) ? rawH : null;
        if (window.toolbarController) {
          window.toolbarController.createCommentCardAt(posX, posY, 'Type comment here...', customW, customH);
        }
        this.setTool('select');
        return;
      }

      const hasDrag = rawW > 15 && rawH > 15;
      const boxLeft = hasDrag ? Math.min(startPt.x, endPt.x) : (this.gridManager.snapToGrid(startPt.x) - 70);
      const boxTop = hasDrag ? Math.min(startPt.y, endPt.y) : (this.gridManager.snapToGrid(startPt.y) - 18);

      if (shapeType === 'textbox' || shapeType === 'textbox-vertical') {
        const isVert = shapeType === 'textbox-vertical';
        const width = hasDrag ? (isVert ? Math.max(80, rawH) : rawW) : 140;
        const textbox = new fabric.Textbox('Type text here', {
          left: isVert ? (hasDrag ? boxLeft + rawW / 2 : this.gridManager.snapToGrid(startPt.x)) : (boxLeft + width / 2),
          top: isVert ? (hasDrag ? boxTop + rawH / 2 : this.gridManager.snapToGrid(startPt.y)) : (boxTop + 18),
          originX: 'center',
          originY: 'center',
          width,
          angle: isVert ? -90 : 0,
          fontSize: 12,
          fontFamily: 'Calibri',
          fill: '#000000',
          textAlign: 'center',
          editable: false,
          borderColor: '#0078d4',
          cornerColor: '#0078d4',
          cornerSize: 8,
          transparentCorners: false,
        });
        textbox.objectType = 'textbox';
        textbox.shapeType = shapeType;
        textbox.shapeData = { id: 'txt_' + Math.random().toString(36).substr(2, 9), name: 'Text Box', properties: { text: 'Type text here' } };
        this.canvas.add(textbox);
        this.canvas.setActiveObject(textbox);
        this.canvas.requestRenderAll();

        window.undoManager.record({
          name: isVert ? 'Insert Vertical Text Box' : 'Insert Text Box',
          execute: () => { this.canvas.add(textbox); this.canvas.requestRenderAll(); },
          undo: () => { this.canvas.remove(textbox); this.canvas.requestRenderAll(); },
        });
        window.eventBus.emit('shape:added', textbox);

        if (this.inlineTextEditor) {
          this.inlineTextEditor.edit(textbox);
        }
        this.setTool('select');
        return;
      }

      if (hasDrag) {
        this._insertShape(shapeType, boxLeft + rawW / 2, boxTop + rawH / 2, { width: rawW, height: rawH });
      } else {
        this._insertShape(shapeType, this.gridManager.snapToGrid(startPt.x), this.gridManager.snapToGrid(startPt.y));
      }

      this.setTool('select');
    };

    this._insertDown = onMouseDown;
    this._insertMove = onMouseMove;
    this._insertUp = onMouseUp;

    this.canvas.on('mouse:down', this._insertDown);
    this.canvas.on('mouse:move', this._insertMove);
    this.canvas.on('mouse:up', this._insertUp);
  }

  _cleanupInsertMode() {
    if (this._previewRect) {
      this.canvas.remove(this._previewRect);
      this._previewRect = null;
      this.canvas.requestRenderAll();
    }
    if (this._insertDown) {
      this.canvas.off('mouse:down', this._insertDown);
      this._insertDown = null;
    }
    if (this._insertMove) {
      this.canvas.off('mouse:move', this._insertMove);
      this._insertMove = null;
    }
    if (this._insertUp) {
      this.canvas.off('mouse:up', this._insertUp);
      this._insertUp = null;
    }
  }

  /**
   * Insert a shape at the given page coordinates using ShapeFactory.
   * @param {string} shapeType 
   * @param {number} x 
   * @param {number} y 
   * @param {Object} [customOptions={}]
   */
  _insertShape(shapeType, x, y, customOptions = {}) {
    let shape = null;
    if (window.ShapeFactory) {
      shape = window.ShapeFactory.create(shapeType, x, y, customOptions);
    } else {
      shape = new fabric.Rect({
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        width: customOptions.width || 120,
        height: customOptions.height || 80,
        fill: '#D9E1F2',
        stroke: '#41719C',
        strokeWidth: 2,
      });
      shape.objectType = shapeType;
    }

    if (shape) {
      this.canvas.add(shape);
      if (shape.objectType === 'container' && this.connectorManager) {
        this.canvas.sendObjectToBack(shape);
        this.connectorManager._keepGridAtBack();
      }
      this.canvas.setActiveObject(shape);
      this.canvas.requestRenderAll();

      // Record undo command
      window.undoManager.record({
        name: `Insert ${shapeType}`,
        execute: () => {
          this.canvas.add(shape);
          this.canvas.requestRenderAll();
        },
        undo: () => {
          this.canvas.remove(shape);
          this.canvas.requestRenderAll();
        },
      });

      window.eventBus.emit('shape:added', shape);
    }
  }

  /**
   * Distribute selected objects horizontally with equal spacing.
   */
  distributeHorizontal() {
    const active = this.canvas.getActiveObject();
    if (!active || active.type !== 'activeselection') return;

    const objs = active.getObjects().slice();
    if (objs.length < 3) return;
    this.canvas.discardActiveObject();

    const items = objs.map(obj => ({ obj, rect: obj.getBoundingRect() })).sort((a, b) => a.rect.left - b.rect.left);
    const first = items[0];
    const last = items[items.length - 1];
    const totalWidth = items.reduce((sum, it) => sum + it.rect.width, 0);
    const span = (last.rect.left + last.rect.width) - first.rect.left;
    const space = (span - totalWidth) / (items.length - 1);

    const changes = [];
    let curX = first.rect.left;
    items.forEach((it, idx) => {
      const prevLeft = it.obj.left;
      if (idx > 0) {
        const dx = curX - it.rect.left;
        it.obj.set('left', prevLeft + dx);
        it.obj.setCoords();
      }
      changes.push({ obj: it.obj, prevLeft, nextLeft: it.obj.left });
      curX += it.rect.width + space;
    });

    const sel = new fabric.ActiveSelection(objs, { canvas: this.canvas });
    this.canvas.setActiveObject(sel);
    if (this.connectorManager) objs.forEach(o => this.connectorManager._onShapeTransform(o));
    this.canvas.requestRenderAll();

    if (window.undoManager) {
      window.undoManager.record({
        name: 'Distribute Horizontally',
        execute: () => {
          this.canvas.discardActiveObject();
          changes.forEach(c => { c.obj.set('left', c.nextLeft); c.obj.setCoords(); });
          if (this.connectorManager) changes.forEach(c => this.connectorManager._onShapeTransform(c.obj));
          this.canvas.requestRenderAll();
        },
        undo: () => {
          this.canvas.discardActiveObject();
          changes.forEach(c => { c.obj.set('left', c.prevLeft); c.obj.setCoords(); });
          if (this.connectorManager) changes.forEach(c => this.connectorManager._onShapeTransform(c.obj));
          this.canvas.requestRenderAll();
        }
      });
    }
  }

  /**
   * Distribute selected objects vertically with equal spacing.
   */
  distributeVertical() {
    const active = this.canvas.getActiveObject();
    if (!active || active.type !== 'activeselection') return;

    const objs = active.getObjects().slice();
    if (objs.length < 3) return;
    this.canvas.discardActiveObject();

    const items = objs.map(obj => ({ obj, rect: obj.getBoundingRect() })).sort((a, b) => a.rect.top - b.rect.top);
    const first = items[0];
    const last = items[items.length - 1];
    const totalHeight = items.reduce((sum, it) => sum + it.rect.height, 0);
    const span = (last.rect.top + last.rect.height) - first.rect.top;
    const space = (span - totalHeight) / (items.length - 1);

    const changes = [];
    let curY = first.rect.top;
    items.forEach((it, idx) => {
      const prevTop = it.obj.top;
      if (idx > 0) {
        const dy = curY - it.rect.top;
        it.obj.set('top', prevTop + dy);
        it.obj.setCoords();
      }
      changes.push({ obj: it.obj, prevTop, nextTop: it.obj.top });
      curY += it.rect.height + space;
    });

    const sel = new fabric.ActiveSelection(objs, { canvas: this.canvas });
    this.canvas.setActiveObject(sel);
    if (this.connectorManager) objs.forEach(o => this.connectorManager._onShapeTransform(o));
    this.canvas.requestRenderAll();

    if (window.undoManager) {
      window.undoManager.record({
        name: 'Distribute Vertically',
        execute: () => {
          this.canvas.discardActiveObject();
          changes.forEach(c => { c.obj.set('top', c.nextTop); c.obj.setCoords(); });
          if (this.connectorManager) changes.forEach(c => this.connectorManager._onShapeTransform(c.obj));
          this.canvas.requestRenderAll();
        },
        undo: () => {
          this.canvas.discardActiveObject();
          changes.forEach(c => { c.obj.set('top', c.prevTop); c.obj.setCoords(); });
          if (this.connectorManager) changes.forEach(c => this.connectorManager._onShapeTransform(c.obj));
          this.canvas.requestRenderAll();
        }
      });
    }
  }

  /**
   * Delete currently selected objects.
   */
  _deleteSelected() {
    const activeObjects = this.canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    const toDelete = activeObjects.filter(
      (obj) => !obj.isGridLine && !obj.isPageBg && !obj.isGuide &&
        !['grid-line', 'page-background', 'connector-arrow', 'connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line'].includes(obj.objectType)
    );
    if (toDelete.length === 0) return;

    const cm = this.connectorManager;
    const deletedSet = new Set(toDelete);
    const affectedConnectors = cm
      ? cm.connectors.filter(c => deletedSet.has(c.line) || deletedSet.has(c.sourceShape) || deletedSet.has(c.targetShape))
      : [];
    const nonConnectorShapes = toDelete.filter(o => !o.connectorData);

    const doDelete = () => {
      nonConnectorShapes.forEach((obj) => this.canvas.remove(obj));
      affectedConnectors.forEach((c) => cm && cm.removeConnector(c, { skipUndo: true }));
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    };

    const doRestore = () => {
      nonConnectorShapes.forEach((obj) => {
        if (!this.canvas.contains(obj)) this.canvas.add(obj);
      });
      affectedConnectors.forEach((c) => {
        if (!cm) return;
        if (!cm.connectors.includes(c)) cm.connectors.push(c);
        if (c.line && !this.canvas.contains(c.line)) this.canvas.add(c.line);
        if (c.arrow && !this.canvas.contains(c.arrow)) this.canvas.add(c.arrow);
        if (c.sourceArrowObj && !this.canvas.contains(c.sourceArrowObj)) this.canvas.add(c.sourceArrowObj);
        if (c.labelObj && !this.canvas.contains(c.labelObj)) this.canvas.add(c.labelObj);
        cm.updateConnector(c);
      });
      this.canvas.requestRenderAll();
    };

    doDelete();
    if (window.undoManager) {
      window.undoManager.record({
        name: `Delete ${toDelete.length} object(s)`,
        execute: doDelete,
        undo: doRestore
      });
    }
  }

  /**
   * Update cursor based on active tool.
   */
  _updateCursor() {
    switch (this._activeTool) {
      case 'pan':
        this._container.style.cursor = CURSOR_GRAB;
        this.canvas.defaultCursor = CURSOR_GRAB;
        this.canvas.hoverCursor = CURSOR_GRAB;
        if (this.canvas.upperCanvasEl) this.canvas.upperCanvasEl.style.cursor = CURSOR_GRAB;
        if (this.gridManager) this.gridManager.setPanActive(true);
        break;
      case 'select':
        this._container.style.cursor = 'default';
        this.canvas.defaultCursor = 'default';
        this.canvas.hoverCursor = 'move';
        if (this.canvas.upperCanvasEl) this.canvas.upperCanvasEl.style.cursor = 'default';
        if (this.gridManager) this.gridManager.setPanActive(false);
        break;
      default:
        if (this._activeTool.startsWith('insert:')) {
          this._container.style.cursor = CURSOR_CROSSHAIR;
          this.canvas.defaultCursor = CURSOR_CROSSHAIR;
          this.canvas.hoverCursor = CURSOR_CROSSHAIR;
          if (this.canvas.upperCanvasEl) this.canvas.upperCanvasEl.style.cursor = CURSOR_CROSSHAIR;
          if (this.gridManager) this.gridManager.setPanActive(false);
        } else {
          this._container.style.cursor = 'default';
          this.canvas.defaultCursor = 'default';
          this.canvas.hoverCursor = 'move';
          if (this.canvas.upperCanvasEl) this.canvas.upperCanvasEl.style.cursor = 'default';
          if (this.gridManager) this.gridManager.setPanActive(false);
        }
    }
  }

  // =====================
  // SCROLLBARS
  // =====================

  _setupScrollbars() {
    this._thumbV = document.getElementById('scrollbar-thumb-v');
    this._thumbH = document.getElementById('scrollbar-thumb-h');
    this._trackV = document.querySelector('.track-v');
    this._trackH = document.querySelector('.track-h');

    if (!this._thumbV || !this._thumbH) return;

    let isDraggingV = false;
    let isDraggingH = false;
    let startY = 0;
    let startX = 0;
    let startVpt5 = 0;
    let startVpt4 = 0;
    let suppressTrackClickUntil = 0;

    // Vertical drag
    this._thumbV.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingV = true;
      startY = e.clientY;
      startVpt5 = this.canvas.viewportTransform[5];
      document.body.style.cursor = 'default';
    });

    // Horizontal drag
    this._thumbH.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingH = true;
      startX = e.clientX;
      startVpt4 = this.canvas.viewportTransform[4];
      document.body.style.cursor = 'default';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDraggingV && !isDraggingH) return;
      const pageSize = this.gridManager.pageSize;
      const pageW = pageSize.width * this._zoom;
      const pageH = pageSize.height * this._zoom;
      const vpt = this.canvas.viewportTransform;

      if (isDraggingV && this._trackV && this._thumbV) {
        const delta = e.clientY - startY;
        const travel = Math.max(1, this._trackV.clientHeight - this._thumbV.clientHeight);
        const maxScrollY = Math.max(1, pageH);
        const rawVpt5 = startVpt5 - (delta / travel) * maxScrollY;
        vpt[5] = Math.max(50 - maxScrollY, Math.min(50, rawVpt5));
        this.canvas.setViewportTransform(vpt);
        this.rulerManager.draw();
        this._updateScrollbars();
      } else if (isDraggingH && this._trackH && this._thumbH) {
        const delta = e.clientX - startX;
        const travel = Math.max(1, this._trackH.clientWidth - this._thumbH.clientWidth);
        const maxScrollX = Math.max(1, pageW);
        const rawVpt4 = startVpt4 - (delta / travel) * maxScrollX;
        vpt[4] = Math.max(50 - maxScrollX, Math.min(50, rawVpt4));
        this.canvas.setViewportTransform(vpt);
        this.rulerManager.draw();
        this._updateScrollbars();
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDraggingV || isDraggingH) {
        suppressTrackClickUntil = Date.now() + 80;
        document.body.style.cursor = '';
      }
      isDraggingV = false;
      isDraggingH = false;
    });

    // Arrow buttons
    document.querySelectorAll('.scrollbar-arrow').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dir = btn.dataset.scroll;
        const vpt = this.canvas.viewportTransform;
        const step = 60;
        if (dir === 'up') vpt[5] += step;
        else if (dir === 'down') vpt[5] -= step;
        else if (dir === 'left') vpt[4] += step;
        else if (dir === 'right') vpt[4] -= step;
        this.canvas.setViewportTransform(vpt);
        this.rulerManager.draw();
        this._updateScrollbars();
      });
    });

    // Track clicks
    if (this._trackV) {
      this._trackV.addEventListener('click', (e) => {
        if (e.target === this._thumbV || Date.now() < suppressTrackClickUntil) return;
        const rect = this._trackV.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const thumbTop = parseFloat(this._thumbV.style.top || '0');
        const vpt = this.canvas.viewportTransform;
        vpt[5] += (clickY < thumbTop ? 150 : -150);
        this.canvas.setViewportTransform(vpt);
        this.rulerManager.draw();
        this._updateScrollbars();
      });
    }

    if (this._trackH) {
      this._trackH.addEventListener('click', (e) => {
        if (e.target === this._thumbH || Date.now() < suppressTrackClickUntil) return;
        const rect = this._trackH.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const thumbLeft = parseFloat(this._thumbH.style.left || '0');
        const vpt = this.canvas.viewportTransform;
        vpt[4] += (clickX < thumbLeft ? 150 : -150);
        this.canvas.setViewportTransform(vpt);
        this.rulerManager.draw();
        this._updateScrollbars();
      });
    }
  }

  _updateScrollbars() {
    if (!this._thumbV || !this._thumbH || !this._trackV || !this._trackH) {
      this._thumbV = document.getElementById('scrollbar-thumb-v');
      this._thumbH = document.getElementById('scrollbar-thumb-h');
      this._trackV = document.querySelector('.track-v');
      this._trackH = document.querySelector('.track-h');
      if (!this._thumbV || !this._thumbH) return;
    }

    const pageSize = this.gridManager.pageSize;
    const cw = this._container.clientWidth;
    const ch = this._container.clientHeight;
    const trackH = this._trackV.clientHeight;
    const trackW = this._trackH.clientWidth;
    const vpt = this.canvas.viewportTransform;

    const pageW = pageSize.width * this._zoom;
    const pageH = pageSize.height * this._zoom;

    // Vertical thumb
    const totalVirtualH = pageH + ch;
    const thumbH = Math.max(24, Math.min(trackH, (ch / totalVirtualH) * trackH));
    const maxScrollY = Math.max(1, pageH);
    const scrollOffsetY = Math.max(0, Math.min(maxScrollY, -vpt[5] + 50));
    const thumbTop = (scrollOffsetY / maxScrollY) * (trackH - thumbH);

    this._thumbV.style.height = `${thumbH}px`;
    this._thumbV.style.top = `${Math.max(0, Math.min(trackH - thumbH, thumbTop))}px`;

    // Horizontal thumb
    const totalVirtualW = pageW + cw;
    const thumbW = Math.max(24, Math.min(trackW, (cw / totalVirtualW) * trackW));
    const maxScrollX = Math.max(1, pageW);
    const scrollOffsetX = Math.max(0, Math.min(maxScrollX, -vpt[4] + 50));
    const thumbLeft = (scrollOffsetX / maxScrollX) * (trackW - thumbW);

    this._thumbH.style.width = `${thumbW}px`;
    this._thumbH.style.left = `${Math.max(0, Math.min(trackW - thumbW, thumbLeft))}px`;
  }

  /** @returns {number} Current zoom percentage */
  get zoomPercent() {
    return Math.round(this._zoom * 100);
  }

  /** @returns {string} Active tool name */
  get activeTool() {
    return this._activeTool;
  }
}

window.CanvasManager = CanvasManager;

