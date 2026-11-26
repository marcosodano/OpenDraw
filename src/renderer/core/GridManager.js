/**
 * GridManager — Draws the background grid and handles snap-to-grid.
 * 
 * Renders a page-like white rectangle on the gray canvas background,
 * with configurable grid lines that respect zoom and pan.
 */
class GridManager {
  /**
   * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._gridSize = 20;         // Grid spacing in pixels (at 100% zoom)
    this._pageWidth = 1100;      // Default page width (A4-ish landscape)
    this._pageHeight = 850;      // Default page height
    this._showGrid = true;
    this._snapEnabled = true;
    this._pageColor = '#ffffff'; // Base page color
    this._gridColor = '#e0e0e0';
    this._gridColorMajor = '#c8c8c8';
    this._majorGridEvery = 5;    // Major grid line every N minor lines
    this._pageRect = null;       // The white page background object
    this._gridLines = [];        // Grid line objects

    this._createPage();
    this._createGrid();
  }

  _isDarkColor(color) {
    if (!color || color === 'transparent') return false;
    if (typeof color === 'string' && color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substr(0, 2), 16) || 0;
      const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substr(2, 2), 16) || 0;
      const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substr(4, 2), 16) || 0;
      return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 140;
    }
    return false;
  }

  setPageColor(color) {
    this._pageColor = color || '#ffffff';
    this._createGrid();
  }

  /**
   * Create the white page rectangle (simulates a sheet of paper).
   */
  _createPage() {
    this._pageRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: this._pageWidth,
      height: this._pageHeight,
      fill: this._pageColor,
      stroke: '#383838',
      strokeWidth: 1,
      shadow: new fabric.Shadow({ color: 'rgba(0, 0, 0, 0.45)', blur: 16, offsetX: 0, offsetY: 4 }),
      selectable: false,
      evented: false,
      excludeFromExport: false,
      hoverCursor: 'default',
      objectCaching: false,
      objectType: 'page-background',
    });

    this._pageRect._gridManager = this;
    this._pageRect._render = function (ctx) {
      fabric.Rect.prototype._render.call(this, ctx);
      const gm = this._gridManager;
      if (!gm || !gm._showGrid || gm._isExporting) return;

      const w = this.width;
      const h = this.height;
      const hw = w / 2;
      const hh = h / 2;
      const gs = gm._gridSize || 20;
      const majorEvery = gm._majorGridEvery || 5;
      const isDark = gm._isDarkColor(gm._pageColor);
      const minorColor = isDark ? 'rgba(255, 255, 255, 0.11)' : '#e6e8ec';
      const majorColor = isDark ? 'rgba(255, 255, 255, 0.28)' : '#c9cdd4';

      const m = ctx.getTransform();
      const topLeft = m.transformPoint(new DOMPoint(-hw, -hh));
      const botRight = m.transformPoint(new DOMPoint(hw, hh));
      const ox = Math.min(topLeft.x, botRight.x);
      const oy = Math.min(topLeft.y, botRight.y);
      const pw = Math.abs(botRight.x - topLeft.x);
      const ph = Math.abs(botRight.y - topLeft.y);
      if (pw <= 1 || ph <= 1) return;

      const sx = pw / w;
      const sy = ph / h;
      const minorScreenPx = Math.min(gs * sx, gs * sy);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.rect(ox, oy, pw, ph);
      ctx.clip();
      ctx.lineWidth = 1;

      if (minorScreenPx >= 6) {
        ctx.strokeStyle = minorColor;
        ctx.beginPath();
        for (let x = gs; x < w; x += gs) {
          if (Math.round(x / gs) % majorEvery === 0) continue;
          const px = Math.round(ox + x * sx) + 0.5;
          ctx.moveTo(px, oy);
          ctx.lineTo(px, oy + ph);
        }
        for (let y = gs; y < h; y += gs) {
          if (Math.round(y / gs) % majorEvery === 0) continue;
          const py = Math.round(oy + y * sy) + 0.5;
          ctx.moveTo(ox, py);
          ctx.lineTo(ox + pw, py);
        }
        ctx.stroke();
      }

      const majorStep = gs * majorEvery;
      ctx.strokeStyle = majorColor;
      ctx.beginPath();
      for (let x = majorStep; x < w; x += majorStep) {
        const px = Math.round(ox + x * sx) + 0.5;
        ctx.moveTo(px, oy);
        ctx.lineTo(px, oy + ph);
      }
      for (let y = majorStep; y < h; y += majorStep) {
        const py = Math.round(oy + y * sy) + 0.5;
        ctx.moveTo(ox, py);
        ctx.lineTo(ox + pw, py);
      }
      ctx.stroke();
      ctx.restore();
    };
    
    this._canvas.add(this._pageRect);
    this._canvas.sendObjectToBack(this._pageRect);

    // Keep page background always at absolute back without redundant array re-sorting
    this._canvas.on('object:added', (opt) => {
      if (opt.target && opt.target !== this._pageRect && this._pageRect) {
        const objs = this._canvas._objects;
        if (objs && objs.length > 0 && objs[0] !== this._pageRect) {
          this._canvas.sendObjectToBack(this._pageRect);
        }
      }
    });
  }

  /**
   * Create grid pattern across the page without separate line objects.
   * Eliminates all flicker, grid disappearing on insert, and 100+ object overhead.
   */
  _createGrid() {
    this._removeGrid();

    if (!this._pageRect) return;

    if (!this._showGrid) {
      this._pageRect.set('fill', this._pageColor || '#ffffff');
      this._pageRect.dirty = true;
      this._canvas.requestRenderAll();
      return;
    }

    // Maintain a clean fabric.Pattern paper fill while crisp screen-aligned grid lines are drawn in _pageRect._render
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 20;
    pCanvas.height = 20;
    const ctx = pCanvas.getContext('2d');
    ctx.fillStyle = this._pageColor || '#ffffff';
    ctx.fillRect(0, 0, 20, 20);

    const pattern = new fabric.Pattern({
      source: pCanvas,
      repeat: 'repeat',
    });

    this._pageRect.set('fill', pattern);
    this._pageRect.dirty = true;
    this._canvas.sendObjectToBack(this._pageRect);
    this._canvas.requestRenderAll();
  }

  /**
   * Remove any remaining grid line objects from canvas.
   */
  _removeGrid() {
    if (this._gridLines && this._gridLines.length > 0) {
      this._gridLines.forEach((line) => {
        this._canvas.remove(line);
      });
      this._gridLines = [];
    }
  }

  setPanActive(active) {
    if (this._pageRect) {
      const grabCur = (window.OPENDRAW_CURSORS && window.OPENDRAW_CURSORS.GRAB) ? window.OPENDRAW_CURSORS.GRAB : 'grab';
      this._pageRect.hoverCursor = active ? grabCur : 'default';
    }
  }

  /**
   * Toggle grid visibility.
   */
  toggleGrid() {
    this._showGrid = !this._showGrid;
    this._createGrid();
    return this._showGrid;
  }

  toggle() {
    return this.toggleGrid();
  }

  /**
   * Toggle snap-to-grid.
   */
  toggleSnap() {
    this._snapEnabled = !this._snapEnabled;
    return this._snapEnabled;
  }

  /**
   * Snap a coordinate to the nearest grid point.
   * @param {number} value - The coordinate value
   * @returns {number} Snapped coordinate
   */
  snapToGrid(value) {
    if (!this._snapEnabled) return value;
    return Math.round(value / this._gridSize) * this._gridSize;
  }

  /**
   * Snap an object's position to the grid.
   * Called during object:moving events.
   * @param {fabric.Object} obj
   */
  snapObject(obj) {
    if (!this._snapEnabled || !obj) return;
    const t = obj.objectType;
    if (t === 'grid-line' || t === 'page-background' || t === 'connector' || t === 'connector-arrow' || t === 'connector-handle' || t === 'autoconnect-trigger' || t === 'guide-line') return;
    const halfW = obj.originX === 'center' ? obj.getScaledWidth() / 2 : 0;
    const halfH = obj.originY === 'center' ? obj.getScaledHeight() / 2 : 0;
    const newLeft = obj._guideSnappedX ? obj.left : (this.snapToGrid(obj.left - halfW) + halfW);
    const newTop = obj._guideSnappedY ? obj.top : (this.snapToGrid(obj.top - halfH) + halfH);
    obj.set({ left: newLeft, top: newTop });
  }

  getPageColor() {
    return this._pageColor || '#ffffff';
  }

  setExportVisibility(isExporting) {
    if (!this._pageRect) return;
    this._isExporting = !!isExporting;
    if (isExporting) {
      this._savedRectShadow = this._pageRect.shadow;
      this._savedShowGrid = this._showGrid;
      this._pageRect.set({
        shadow: null,
        fill: this._pageColor || '#ffffff',
        stroke: 'transparent'
      });
    } else {
      this._showGrid = this._savedShowGrid !== undefined ? this._savedShowGrid : this._showGrid;
      this._pageRect.set({
        shadow: this._savedRectShadow || new fabric.Shadow({ color: 'rgba(0,0,0,0.45)', blur: 18, offsetX: 0, offsetY: 3 }),
        stroke: '#3a3a3a'
      });
      this._createGrid();
    }
  }

  /**
   * Get grid configuration.
   */
  get config() {
    return {
      gridSize: this._gridSize,
      showGrid: this._showGrid,
      snapEnabled: this._snapEnabled,
      pageWidth: this._pageWidth,
      pageHeight: this._pageHeight,
    };
  }

  /**
   * Set grid size.
   * @param {number} size 
   */
  setGridSize(size) {
    this._gridSize = Math.max(5, Math.min(100, size));
    this._createGrid();
  }

  /**
   * Set page dimensions.
   * @param {number} width 
   * @param {number} height 
   */
  setPageSize(width, height) {
    this._pageWidth = width;
    this._pageHeight = height;
    
    if (this._pageRect) {
      this._pageRect.set({ width, height });
    }
    this._createGrid();
  }

  /** @returns {boolean} Whether grid is visible */
  get showGrid() { return this._showGrid; }
  
  /** @returns {boolean} Whether snap is enabled */
  get snapEnabled() { return this._snapEnabled; }

  /** @returns {number} Current grid size */
  get gridSize() { return this._gridSize; }

  /** @returns {{width: number, height: number}} Page dimensions */
  get pageSize() { return { width: this._pageWidth, height: this._pageHeight }; }
}

