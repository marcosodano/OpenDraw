/**
 * AutoLayoutManager — Automatic Diagram Layout Engine for OpenDraw.
 * 
 * Features:
 * - Hierarchical layout: Top-to-Bottom (TB) and Left-to-Right (LR)
 * - Uses connectivity graph from ConnectorManager
 * - Gracefully handles cycles, multi-parent graphs, and unconnected nodes
 * - Fully undoable via UndoManager
 * - Auto-routes all connectors after rearrangement
 */

class AutoLayoutManager {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.canvas;
  }

  /**
   * Layout the diagram top-to-bottom.
   */
  layoutTopToBottom() {
    this._performLayout('TB');
  }

  /**
   * Layout the diagram left-to-right.
   */
  layoutLeftToRight() {
    this._performLayout('LR');
  }

  /**
   * Perform bottom-to-top hierarchical layout.
   */
  layoutBottomToTop() {
    this._performLayout('BT');
  }

  /**
   * Perform radial hub-and-spoke layout.
   */
  layoutRadial() {
    this._performLayout('RADIAL');
  }

  /**
   * Perform compact grid layout.
   */
  layoutCompact() {
    this._performLayout('COMPACT');
  }

  /**
   * Internal layout execution.
   * @param {'TB'|'LR'|'BT'|'RADIAL'|'COMPACT'} direction
   */
  _performLayout(direction) {
    this.canvas.discardActiveObject();
    const excluded = new Set([
      'grid-line', 'page-background', 'connector', 'connector-arrow',
      'connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line',
      'preview-rect', 'border-frame', 'title-block', 'container'
    ]);
    const objects = this.canvas.getObjects().filter(
      (obj) => !obj.isGridLine && !obj.isPageBg && !obj.isGuide && !excluded.has(obj.objectType)
    );

    if (objects.length < 2) return;

    const oldCenters = new Map();
    const sizeMap = new Map();
    objects.forEach((obj) => {
      const b = obj.getBoundingRect();
      oldCenters.set(obj, { cx: b.left + b.width / 2, cy: b.top + b.height / 2 });
      sizeMap.set(obj, { w: Math.max(20, b.width), h: Math.max(20, b.height) });
    });

    const connectors = this.canvasManager.connectorManager ? this.canvasManager.connectorManager.connectors : [];
    const adj = new Map();
    const inDegree = new Map();
    objects.forEach((obj) => { adj.set(obj, []); inDegree.set(obj, 0); });

    connectors.forEach((conn) => {
      if (conn.sourceShape && conn.targetShape && adj.has(conn.sourceShape) && adj.has(conn.targetShape) && conn.sourceShape !== conn.targetShape) {
        adj.get(conn.sourceShape).push(conn.targetShape);
        inDegree.set(conn.targetShape, (inDegree.get(conn.targetShape) || 0) + 1);
      }
    });

    // Longest-path stratification with cycle protection (re-queues when rank improves up to N times)
    const ranks = new Map();
    const visitCounts = new Map();
    const queue = [];

    objects.forEach((obj) => {
      if (inDegree.get(obj) === 0) {
        ranks.set(obj, 0);
        queue.push(obj);
      }
    });

    const runRelax = () => {
      while (queue.length > 0) {
        const u = queue.shift();
        const cr = ranks.get(u);
        for (const v of (adj.get(u) || [])) {
          const nr = cr + 1;
          const cnt = visitCounts.get(v) || 0;
          if ((!ranks.has(v) || ranks.get(v) < nr) && cnt < objects.length) {
            ranks.set(v, nr);
            visitCounts.set(v, cnt + 1);
            queue.push(v);
          }
        }
      }
    };

    runRelax();
    // Seed any disconnected cyclic components that lacked inDegree===0 roots
    objects.forEach((obj) => {
      if (!ranks.has(obj)) {
        ranks.set(obj, 0);
        queue.push(obj);
        runRelax();
      }
    });

    const rankGroups = new Map();
    ranks.forEach((r, obj) => {
      if (!rankGroups.has(r)) rankGroups.set(r, []);
      rankGroups.get(r).push(obj);
    });

    const pageSize = this.canvasManager.gridManager.pageSize;
    const hGap = direction === 'COMPACT' ? 30 : 60;
    const vGap = direction === 'COMPACT' ? 40 : 80;
    const newCenters = new Map();
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);

    if (direction === 'RADIAL') {
      const cxPage = pageSize.width / 2;
      const cyPage = pageSize.height / 2;
      sortedRanks.forEach((r) => {
        const ring = rankGroups.get(r);
        if (r === 0 && ring.length === 1) {
          newCenters.set(ring[0], { cx: cxPage, cy: cyPage });
        } else {
          const radius = Math.min(pageSize.width, pageSize.height) * 0.16 * (r + 1);
          ring.forEach((obj, i) => {
            const ang = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
            newCenters.set(obj, { cx: cxPage + radius * Math.cos(ang), cy: cyPage + radius * Math.sin(ang) });
          });
        }
      });
    } else if (direction === 'COMPACT') {
      const cols = Math.max(2, Math.ceil(Math.sqrt(objects.length)));
      let x = 70, y = 70, rowH = 0;
      objects.forEach((obj, idx) => {
        const sz = sizeMap.get(obj);
        if (idx > 0 && idx % cols === 0) { x = 70; y += rowH + vGap; rowH = 0; }
        newCenters.set(obj, { cx: x + sz.w / 2, cy: y + sz.h / 2 });
        x += sz.w + hGap;
        rowH = Math.max(rowH, sz.h);
      });
    } else if (direction === 'LR') {
      let currentX = 80;
      sortedRanks.forEach((r) => {
        const col = rankGroups.get(r);
        const totalH = col.reduce((s, o) => s + sizeMap.get(o).h, 0) + (col.length - 1) * vGap;
        let startY = Math.max(60, (pageSize.height - totalH) / 2);
        let maxW = 0;
        col.forEach((obj) => {
          const sz = sizeMap.get(obj);
          newCenters.set(obj, { cx: currentX + sz.w / 2, cy: startY + sz.h / 2 });
          startY += sz.h + vGap;
          maxW = Math.max(maxW, sz.w);
        });
        currentX += maxW + hGap;
      });
    } else {
      // TB or BT
      const ordered = direction === 'BT' ? sortedRanks.slice().reverse() : sortedRanks;
      let currentY = 80;
      ordered.forEach((r) => {
        const row = rankGroups.get(r);
        const totalW = row.reduce((s, o) => s + sizeMap.get(o).w, 0) + (row.length - 1) * hGap;
        let startX = Math.max(60, (pageSize.width - totalW) / 2);
        let maxH = 0;
        row.forEach((obj) => {
          const sz = sizeMap.get(obj);
          newCenters.set(obj, { cx: startX + sz.w / 2, cy: currentY + sz.h / 2 });
          startX += sz.w + hGap;
          maxH = Math.max(maxH, sz.h);
        });
        currentY += maxH + vGap;
      });
    }

    const applyMap = (map) => {
      this.canvas.discardActiveObject();
      map.forEach((pt, obj) => {
        obj.setPositionByOrigin(new fabric.Point(pt.cx, pt.cy), 'center', 'center');
        obj.setCoords();
      });
      if (this.canvasManager.connectorManager) {
        this.canvasManager.connectorManager.updateAllConnectors();
        this.canvasManager.connectorManager.hideAutoConnect();
      }
      this.canvas.requestRenderAll();
    };

    applyMap(newCenters);

    if (window.undoManager) {
      window.undoManager.record({
        name: `Auto-Layout (${direction})`,
        execute: () => applyMap(newCenters),
        undo: () => applyMap(oldCenters),
      });
    }
  }
}

window.AutoLayoutManager = AutoLayoutManager;

