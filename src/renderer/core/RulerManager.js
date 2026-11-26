/**
 * RulerManager — Draws horizontal and vertical rulers that track
 * the canvas viewport (zoom + pan).
 * 
 * Rulers show tick marks and numeric labels in page coordinates,
 * with a position indicator following the mouse cursor.
 */
class RulerManager {
  /**
   * @param {fabric.Canvas} fabricCanvas - The main Fabric.js canvas
   * @param {HTMLCanvasElement} hRulerEl - Horizontal ruler canvas element
   * @param {HTMLCanvasElement} vRulerEl - Vertical ruler canvas element
   */
  constructor(fabricCanvas, hRulerEl, vRulerEl) {
    this._fabricCanvas = fabricCanvas;
    this._hRulerEl = hRulerEl;
    this._vRulerEl = vRulerEl;
    this._hCtx = hRulerEl.getContext('2d');
    this._vCtx = vRulerEl.getContext('2d');

    this._visible = true;
    this._mouseX = 0;
    this._mouseY = 0;

    // Style config — Visio 2016 Black Theme
    this._bgColor = '#2b2b2b';
    this._textColor = '#a6a6a6';
    this._tickColor = '#555555';
    this._indicatorColor = '#0078d4';
    this._fontSize = 9;

    this._resizeRulers();

    // Listen for resize
    const ro = new ResizeObserver(() => this._resizeRulers());
    ro.observe(hRulerEl.parentElement);
  }

  /**
   * Resize ruler canvases to match their container.
   */
  _resizeRulers() {
    const parent = this._hRulerEl.parentElement;
    if (!parent) return;
    
    // Get the canvas container dimensions
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    
    // Horizontal ruler matches canvas width
    this._hRulerEl.width = rect.width;
    this._hRulerEl.height = 25;
    
    // Vertical ruler matches canvas height
    this._vRulerEl.width = 25;
    this._vRulerEl.height = rect.height;

    this.draw();
  }

  /**
   * Draw both rulers based on current viewport state.
   */
  draw() {
    if (!this._visible) {
      this._clearBoth();
      return;
    }

    const vpt = this._fabricCanvas.viewportTransform;
    const zoom = this._fabricCanvas.getZoom();
    const panX = vpt[4];
    const panY = vpt[5];

    this._drawHorizontalRuler(zoom, panX);
    this._drawVerticalRuler(zoom, panY);
  }

  _refreshThemeColors() {
    if (typeof getComputedStyle === 'undefined') return;
    const cs = getComputedStyle(document.documentElement);
    this._bgColor = cs.getPropertyValue('--bg-secondary').trim() || '#2b2b2b';
    this._textColor = cs.getPropertyValue('--text-secondary').trim() || '#a6a6a6';
    this._tickColor = cs.getPropertyValue('--border').trim() || '#555555';
    this._indicatorColor = cs.getPropertyValue('--accent').trim() || '#0078d4';
  }

  /**
   * Draw the horizontal ruler.
   * @param {number} zoom - Current zoom level
   * @param {number} panX - Current horizontal pan offset
   */
  _drawHorizontalRuler(zoom, panX) {
    if (!this._hCtx || !isFinite(zoom) || zoom <= 0.005) return;
    this._refreshThemeColors();
    const ctx = this._hCtx;
    const w = this._hRulerEl.width;
    const h = this._hRulerEl.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this._bgColor;
    ctx.fillRect(0, 0, w, h);

    const baseSpacing = this._getTickSpacing(zoom);
    const spacing = baseSpacing * zoom;
    if (!isFinite(spacing) || spacing <= 0.5) return;

    const startPage = -panX / zoom;
    const startTick = Math.floor(startPage / baseSpacing) * baseSpacing;

    ctx.fillStyle = this._textColor;
    ctx.strokeStyle = this._tickColor;
    ctx.font = `${this._fontSize}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let guard = 0;
    for (let pagePx = startTick; guard++ < 400; pagePx += baseSpacing) {
      const screenX = pagePx * zoom + panX;
      if (screenX > w) break;
      if (screenX < -50) continue;

      ctx.beginPath();
      ctx.moveTo(screenX, h - 10);
      ctx.lineTo(screenX, h);
      ctx.stroke();

      ctx.fillText(Math.round(pagePx).toString(), screenX, 3);

      for (let i = 1; i < 5; i++) {
        const minorX = screenX + (spacing / 5) * i;
        if (minorX > w) break;
        ctx.beginPath();
        ctx.moveTo(minorX, h - 5);
        ctx.lineTo(minorX, h);
        ctx.stroke();
      }
    }

    if (this._mouseX > 0 && this._mouseX <= w) {
      ctx.strokeStyle = this._indicatorColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this._mouseX, 0);
      ctx.lineTo(this._mouseX, h);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.strokeStyle = this._tickColor;
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();
  }

  /**
   * Draw the vertical ruler.
   * @param {number} zoom - Current zoom level
   * @param {number} panY - Current vertical pan offset
   */
  _drawVerticalRuler(zoom, panY) {
    if (!this._vCtx || !isFinite(zoom) || zoom <= 0.005) return;
    const ctx = this._vCtx;
    const w = this._vRulerEl.width;
    const h = this._vRulerEl.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this._bgColor;
    ctx.fillRect(0, 0, w, h);

    const baseSpacing = this._getTickSpacing(zoom);
    const spacing = baseSpacing * zoom;
    if (!isFinite(spacing) || spacing <= 0.5) return;

    const startPage = -panY / zoom;
    const startTick = Math.floor(startPage / baseSpacing) * baseSpacing;

    ctx.fillStyle = this._textColor;
    ctx.strokeStyle = this._tickColor;
    ctx.font = `${this._fontSize}px Segoe UI, sans-serif`;

    let guard = 0;
    for (let pagePy = startTick; guard++ < 400; pagePy += baseSpacing) {
      const screenY = pagePy * zoom + panY;
      if (screenY > h) break;
      if (screenY < -50) continue;

      ctx.beginPath();
      ctx.moveTo(w - 10, screenY);
      ctx.lineTo(w, screenY);
      ctx.stroke();

      ctx.save();
      ctx.translate(8, screenY);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(pagePy).toString(), 0, 0);
      ctx.restore();

      for (let i = 1; i < 5; i++) {
        const minorY = screenY + (spacing / 5) * i;
        if (minorY > h) break;
        ctx.beginPath();
        ctx.moveTo(w - 5, minorY);
        ctx.lineTo(w, minorY);
        ctx.stroke();
      }
    }

    if (this._mouseY > 0 && this._mouseY <= h) {
      ctx.strokeStyle = this._indicatorColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, this._mouseY);
      ctx.lineTo(w, this._mouseY);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.strokeStyle = this._tickColor;
    ctx.beginPath();
    ctx.moveTo(w - 0.5, 0);
    ctx.lineTo(w - 0.5, h);
    ctx.stroke();
  }

  /**
   * Calculate appropriate tick spacing based on zoom level.
   * @param {number} zoom 
   * @returns {number} Spacing in page pixels
   */
  _getTickSpacing(zoom) {
    const minScreenSpacing = 50; // Minimum pixels between labels on screen
    const baseOptions = [10, 20, 50, 100, 200, 500, 1000, 2000];
    
    for (const spacing of baseOptions) {
      if (spacing * zoom >= minScreenSpacing) {
        return spacing;
      }
    }
    return baseOptions[baseOptions.length - 1];
  }

  /**
   * Update mouse position for the indicator line.
   * @param {number} screenX - Mouse X relative to canvas container
   * @param {number} screenY - Mouse Y relative to canvas container
   */
  updateMousePosition(screenX, screenY) {
    this._mouseX = screenX;
    this._mouseY = screenY;
    this.draw();
  }

  /**
   * Toggle ruler visibility.
   */
  toggle() {
    this._visible = !this._visible;
    const area = document.querySelector('.canvas-area');
    const corner = document.getElementById('ruler-corner');
    if (this._hRulerEl) this._hRulerEl.style.display = this._visible ? '' : 'none';
    if (this._vRulerEl) this._vRulerEl.style.display = this._visible ? '' : 'none';
    if (corner) corner.style.display = this._visible ? '' : 'none';
    if (area) {
      area.style.gridTemplateColumns = this._visible ? '' : '0px 1fr 16px';
      area.style.gridTemplateRows = this._visible ? '' : '0px 1fr 24px';
    }
    this.resize();
    if (!this._visible) this._clearBoth();
    return this._visible;
  }

  /**
   * Clear both rulers.
   */
  _clearBoth() {
    this._hCtx.clearRect(0, 0, this._hRulerEl.width, this._hRulerEl.height);
    this._vCtx.clearRect(0, 0, this._vRulerEl.width, this._vRulerEl.height);
  }
}

