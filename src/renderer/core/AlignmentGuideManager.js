/**
 * AlignmentGuideManager — Dynamic smart alignment guides (magnetic snapping)
 * matching modern diagramming behavior.
 * 
 * Draws temporary guideline overlays when dragging shapes to align
 * Left, Center, Right, Top, Middle, Bottom with other shapes on the canvas.
 */

class AlignmentGuideManager {
  /**
   * @param {fabric.Canvas} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.snapThreshold = 10; // Snap distance in pixels
    this.enabled = true;
    this.guideLines = [];
    this.guideColor = '#FF007F'; // Visio magenta dynamic guide color

    this._setupEvents();
  }

  _setupEvents() {
    this.canvas.on('object:moving', (e) => {
      if (!this.enabled || !e.target) return;
      this._handleMoving(e.target);
    });

    this.canvas.on('object:modified', () => {
      this.clearGuides();
    });

    this.canvas.on('mouse:up', () => {
      this.clearGuides();
    });

    this.canvas.on('selection:cleared', () => {
      this.clearGuides();
    });
  }

  /**
   * Handle object dragging and calculate alignment snaps.
   * @param {fabric.Object} movingObj
   */
  _handleMoving(movingObj) {
    this.clearGuides();
    movingObj._guideSnappedX = false;
    movingObj._guideSnappedY = false;

    const ignored = new Set([
      'grid-line', 'page-background', 'guide-line', 'connector-handle',
      'connector-preview', 'autoconnect-trigger', 'port-marker', 'connector',
      'connector-arrow', 'preview-rect', 'border-frame', 'title-block', 'container', 'comment-card'
    ]);
    if (movingObj.isGridLine || movingObj.isPageBg || movingObj.isGuide || ignored.has(movingObj.objectType)) return;

    const movingBounds = movingObj.getBoundingRect();
    const movingLeft = movingBounds.left;
    const movingCenterH = movingBounds.left + movingBounds.width / 2;
    const movingRight = movingBounds.left + movingBounds.width;

    const movingTop = movingBounds.top;
    const movingCenterV = movingBounds.top + movingBounds.height / 2;
    const movingBottom = movingBounds.top + movingBounds.height;

    const selectedObjects = (movingObj.type === 'activeselection' && typeof movingObj.getObjects === 'function')
      ? new Set(movingObj.getObjects())
      : new Set([movingObj]);

    const candidates = this.canvas.getObjects().filter((obj) => {
      return !selectedObjects.has(obj) &&
             obj.visible !== false &&
             !obj.isGridLine && !obj.isPageBg && !obj.isGuide &&
             !ignored.has(obj.objectType);
    });

    let bestX = null;
    let bestY = null;

    for (const target of candidates) {
      const tb = target.getBoundingRect();
      const txList = [tb.left, tb.left + tb.width / 2, tb.left + tb.width];
      const mxList = [movingLeft, movingCenterH, movingRight];
      for (const mx of mxList) {
        for (const tx of txList) {
          const d = Math.abs(mx - tx);
          if (d < this.snapThreshold && (!bestX || d < bestX.abs)) {
            bestX = { diff: tx - mx, abs: d, guideX: tx };
          }
        }
      }

      const tyList = [tb.top, tb.top + tb.height / 2, tb.top + tb.height];
      const myList = [movingTop, movingCenterV, movingBottom];
      for (const my of myList) {
        for (const ty of tyList) {
          const d = Math.abs(my - ty);
          if (d < this.snapThreshold && (!bestY || d < bestY.abs)) {
            bestY = { diff: ty - my, abs: d, guideY: ty };
          }
        }
      }
    }

    if (bestX) {
      movingObj.set('left', movingObj.left + bestX.diff);
      movingObj._guideSnappedX = true;
      this._drawVerticalGuide(bestX.guideX);
    }
    if (bestY) {
      movingObj.set('top', movingObj.top + bestY.diff);
      movingObj._guideSnappedY = true;
      this._drawHorizontalGuide(bestY.guideY);
    }

    if (bestX || bestY) {
      movingObj.setCoords();
      this.canvas.requestRenderAll();
    }
  }

  _drawVerticalGuide(x) {
    const zoom = Math.max(0.1, this.canvas.getZoom() || 1);
    const line = new fabric.Line([x, -10000, x, 10000], {
      stroke: this.guideColor,
      strokeWidth: 1 / zoom,
      strokeDashArray: [4 / zoom, 4 / zoom],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      isGuide: true,
      objectType: 'guide-line',
    });
    this.guideLines.push(line);
    this.canvas.add(line);
    this.canvas.bringObjectToFront(line);
  }

  _drawHorizontalGuide(y) {
    const zoom = Math.max(0.1, this.canvas.getZoom() || 1);
    const line = new fabric.Line([-10000, y, 10000, y], {
      stroke: this.guideColor,
      strokeWidth: 1 / zoom,
      strokeDashArray: [4 / zoom, 4 / zoom],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      isGuide: true,
      objectType: 'guide-line',
    });
    this.guideLines.push(line);
    this.canvas.add(line);
    this.canvas.bringObjectToFront(line);
  }

  /**
   * Remove active guidelines from canvas.
   */
  clearGuides() {
    if (this.guideLines.length === 0) return;
    this.guideLines.forEach((line) => {
      this.canvas.remove(line);
    });
    this.guideLines = [];
  }
}

window.AlignmentGuideManager = AlignmentGuideManager;

