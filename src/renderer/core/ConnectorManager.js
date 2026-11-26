/**
 * ConnectorManager — Advanced Visio-style AutoConnect & Connector Engine for OpenDraw.
 * 
 * Features:
 * - AutoConnect: 4 directional arrow triggers appear on hover and selection
 * - Click & Drag from any trigger to pull out a live orthogonal connector
 * - Dynamic Snapping: Hovering over any shape highlights its ports and snaps the line
 * - Dynamic & Static Glue: Connectors stay perfectly attached as shapes move/rotate
 * - Endpoint Re-gluing: Green control handles on selected connectors to reconnect endpoints
 * - Orthogonal 90-degree routing with automatic collinear segment reduction
 */

class ConnectorManager {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.canvas;

    /** @type {Array<Object>} List of registered connectors */
    this.connectors = [];

    // Interactive creation state
    this.isCreating = false;
    this.startShape = null;
    this.startPort = null;
    this.startPoint = null;
    this.previewLine = null;

    // AutoConnect trigger markers
    this.autoConnectTriggers = [];
    this.activeTriggerShape = null;

    // Visual port indicators
    this.portMarkers = [];
    this.activeHoverShape = null;

    // Endpoint edit handles
    this.selectedConnector = null;
    this.endpointHandles = [];
    this.draggingEndpoint = null; // 'source' | 'target'

    // Default connector settings
    this.defaultStyle = {
      stroke: '#41719C',
      strokeWidth: 2,
      strokeDashArray: null,
      routingType: 'orthogonal', // 'orthogonal' | 'straight' | 'curved'
      targetArrow: 'arrow',
      sourceArrow: 'none',
    };

    this._autoConnectHideTimer = null;
    this._setupEvents();
  }

  _setupEvents() {
    const syncSelectionConns = (target, finalize = false) => {
      if (!target) return;
      if ((target.type === 'activeselection' || target.type === 'activeSelection') && typeof target.getObjects === 'function') {
        target.getObjects().forEach((m) => {
          if (m && (m.objectType === 'connector' || m.connectorData)) {
            this._syncConnectorFromTransformedLine(m.connectorData || m, finalize);
          }
        });
      } else if (target.objectType === 'connector' || target.connectorData) {
        this._syncConnectorFromTransformedLine(target.connectorData || target, finalize);
      }
    };

    // Re-route connectors when shapes or connectors move/transform
    this.canvas.on('object:moving', (e) => {
      const target = e.target;
      if (target && (target.objectType === 'connector' || target.connectorData)) {
        this._onConnectorMoving(target);
        this._updateEndpointHandlePositions();
        return;
      }
      this._onShapeTransform(target);
      syncSelectionConns(target, false);
      this._updateAutoConnectPositions();
      this._updateEndpointHandlePositions();
    });
    this.canvas.on('object:scaling', (e) => {
      this._onShapeTransform(e.target);
      syncSelectionConns(e.target, false);
      this._updateAutoConnectPositions();
      this._updateEndpointHandlePositions();
    });
    this.canvas.on('object:rotating', (e) => {
      this._onShapeTransform(e.target);
      syncSelectionConns(e.target, false);
      this._updateAutoConnectPositions();
      this._updateEndpointHandlePositions();
    });
    this.canvas.on('object:modified', (e) => {
      const target = e.target;
      if (!target) return;
      if ((target.type === 'activeselection' || target.type === 'activeSelection') && typeof target.getObjects === 'function') {
        this._onShapeTransform(target);
        target.getObjects().forEach((m) => {
          if (m && (m.objectType === 'connector' || m.connectorData)) {
            this._syncConnectorFromTransformedLine(m.connectorData || m, false);
          }
        });
      } else if (target.objectType === 'connector' || target.connectorData) {
        if (!this._draggingConnectorBody) {
          this._syncConnectorFromTransformedLine(target.connectorData || target, true);
        }
      } else {
        this._onShapeTransform(target);
      }
      this._updateAutoConnectPositions();
      this._updateEndpointHandlePositions();
    });

    // Mouse events for AutoConnect and interactive drawing
    this.canvas.on('mouse:down', (e) => this._handleMouseDown(e));
    this.canvas.on('mouse:move', (e) => this._handleMouseMove(e));
    this.canvas.on('mouse:up', (e) => this._handleMouseUp(e));

    // Show AutoConnect triggers on shape hover only when Select tool is active
    this.canvas.on('mouse:over', (e) => {
      if (this.isCreating || this.draggingElbow || this.draggingEndpoint) return;
      const target = e.target;
      if (target && target.objectType === 'autoconnect-trigger') {
        if (this._autoConnectHideTimer) {
          clearTimeout(this._autoConnectHideTimer);
          this._autoConnectHideTimer = null;
        }
        return;
      }
      if (this.canvasManager.activeTool !== 'select') return;
      if (target && this._isConnectable(target)) {
        if (this._autoConnectHideTimer) {
          clearTimeout(this._autoConnectHideTimer);
          this._autoConnectHideTimer = null;
        }
        if (target !== this.activeTriggerShape) {
          this.showAutoConnect(target);
        }
      }
    });

    this.canvas.on('mouse:out', (e) => {
      const target = e.target;
      if (!target) return;
      if (target === this.activeTriggerShape || target.objectType === 'autoconnect-trigger') {
        if (this._autoConnectHideTimer) clearTimeout(this._autoConnectHideTimer);
        this._autoConnectHideTimer = setTimeout(() => {
          this._autoConnectHideTimer = null;
          if (this.isCreating) return;
          const active = this.canvas.getActiveObject();
          if (active && active === this.activeTriggerShape) return;
          this.hideAutoConnect();
        }, 180);
      }
    });

    this.canvas.on('selection:created', (e) => {
      this.connectors.forEach(c => { if (c && c.line && !c.line.group) this._syncConnectorFromTransformedLine(c, true); });
      this._handleSelectionChange(e);
    });
    this.canvas.on('selection:updated', (e) => {
      this.connectors.forEach(c => { if (c && c.line && !c.line.group) this._syncConnectorFromTransformedLine(c, true); });
      this._handleSelectionChange(e);
    });
    this.canvas.on('selection:cleared', () => {
      this.connectors.forEach(c => { if (c && c.line && !c.line.group) this._syncConnectorFromTransformedLine(c, true); });
      this.hideAutoConnect();
      if (this.isCreating || this.draggingEndpoint || this.draggingElbow) return;
      this._hideEndpointHandles();
    });
  }

  _handleSelectionChange(e) {
    if (this.isCreating || this.draggingEndpoint || this.draggingElbow) return;
    const selected = e.selected || [];
    if (selected.length === 1) {
      const obj = selected[0];
      const isConnector = obj.objectType === 'connector' || obj.shapeType === 'connector' || !!obj.connectorData;
      if (isConnector) {
        this.hideAutoConnect();
        this._showEndpointHandles(obj.connectorData || obj);
        return;
      }
      if (this._isConnectable(obj)) {
        this.showAutoConnect(obj);
        this._hideEndpointHandles();
      } else {
        this.hideAutoConnect();
        this._hideEndpointHandles();
      }
    } else {
      this.hideAutoConnect();
      this._hideEndpointHandles();
    }
  }

  /**
   * Test if object can be connected.
   */
  _isConnectable(obj) {
    if (!obj || obj.excludeFromExport) return false;
    const blocked = new Set([
      'grid-line', 'page-background', 'guide-line', 'preview-rect',
      'container-border', 'connector', 'container', 'connector-arrow',
      'connector-preview', 'port-marker', 'autoconnect-trigger',
      'connector-handle', 'connector-label', 'comment-card', 'title-block', 'border-frame'
    ]);
    return !blocked.has(obj.objectType) &&
           obj.shapeType !== 'connector' &&
           !obj.connectorData;
  }

  // ==========================================
  // CONNECTION PORTS & SHAPE BOUNDS
  // ==========================================

  _getSceneMatrix(shape) {
    if (!shape || typeof shape.calcTransformMatrix !== 'function') return null;
    try {
      const own = shape.calcTransformMatrix(false);
      if (shape.group && typeof shape.group.calcTransformMatrix === 'function' && typeof fabric !== 'undefined' && fabric.util && fabric.util.multiplyTransformMatrices) {
        return fabric.util.multiplyTransformMatrices(shape.group.calcTransformMatrix(), own);
      }
      return own;
    } catch (e) {
      return null;
    }
  }

  _getShapeWorldRect(shape) {
    const mat = this._getSceneMatrix(shape);
    const w = shape.width || (shape.getScaledWidth ? shape.getScaledWidth() : 0);
    const h = shape.height || (shape.getScaledHeight ? shape.getScaledHeight() : 0);
    if (mat && w > 0 && h > 0 && typeof fabric !== 'undefined' && fabric.util && fabric.util.transformPoint) {
      const corners = [
        fabric.util.transformPoint({ x: -w / 2, y: -h / 2 }, mat),
        fabric.util.transformPoint({ x: w / 2, y: -h / 2 }, mat),
        fabric.util.transformPoint({ x: w / 2, y: h / 2 }, mat),
        fabric.util.transformPoint({ x: -w / 2, y: h / 2 }, mat),
      ];
      const xs = corners.map(c => c.x);
      const ys = corners.map(c => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    }
    return shape.getBoundingRect();
  }

  /**
   * Compute a fractional local pin offset relative to shape so off-center Visio
   * attachments along wide busbars/containers stay pinned cleanly when dragged.
   */
  _computePinSpec(shape, worldPt) {
    if (!shape || !worldPt) return null;
    const mat = this._getSceneMatrix(shape);
    const w = Math.max(1, shape.width || 1);
    const h = Math.max(1, shape.height || 1);
    if (mat && typeof fabric !== 'undefined' && fabric.util && fabric.util.invertTransform) {
      const inv = fabric.util.invertTransform(mat);
      const local = fabric.util.transformPoint({ x: worldPt.x, y: worldPt.y }, inv);
      const fx = local.x / w;
      const fy = local.y / h;
      const dxEdge = Math.abs(Math.abs(fx) - 0.5);
      const dyEdge = Math.abs(Math.abs(fy) - 0.5);
      let nx = 0, ny = 0;
      if (dxEdge < dyEdge) nx = fx >= 0 ? 1 : -1;
      else ny = fy >= 0 ? 1 : -1;
      const rLen = Math.hypot(mat[0], mat[1]) || 1;
      const rCos = mat[0] / rLen;
      const rSin = mat[1] / rLen;
      return {
        fx, fy,
        normal: { x: nx * rCos - ny * rSin, y: nx * rSin + ny * rCos }
      };
    }
    const b = this._getShapeWorldRect(shape);
    const fx = (worldPt.x - (b.left + b.width / 2)) / Math.max(1, b.width);
    const fy = (worldPt.y - (b.top + b.height / 2)) / Math.max(1, b.height);
    return { fx, fy, normal: { x: 0, y: fy >= 0 ? 1 : -1 } };
  }

  _resolvePinSpec(shape, pinSpec) {
    if (!shape || !pinSpec) return null;
    const mat = this._getSceneMatrix(shape);
    const w = Math.max(1, shape.width || 1);
    const h = Math.max(1, shape.height || 1);
    if (mat && typeof fabric !== 'undefined' && fabric.util && fabric.util.transformPoint) {
      const pt = fabric.util.transformPoint({ x: pinSpec.fx * w, y: pinSpec.fy * h }, mat);
      return { id: 'custom', x: pt.x, y: pt.y, normal: pinSpec.normal || { x: 0, y: 1 } };
    }
    const b = this._getShapeWorldRect(shape);
    return {
      id: 'custom',
      x: b.left + b.width / 2 + pinSpec.fx * b.width,
      y: b.top + b.height / 2 + pinSpec.fy * b.height,
      normal: pinSpec.normal || { x: 0, y: 1 }
    };
  }

  /**
   * Get world coordinates of all connection ports for a shape.
   * @param {fabric.Object} shape
   * @returns {Array<{id: string, x: number, y: number, normal: {x: number, y: number}}>}
   */
  getShapePorts(shape) {
    const bound = this._getShapeWorldRect(shape);
    const cx = bound.left + bound.width / 2;
    const cy = bound.top + bound.height / 2;
    const matrix = this._getSceneMatrix(shape);
    const w = shape.width || (shape.getScaledWidth ? shape.getScaledWidth() : bound.width);
    const h = shape.height || (shape.getScaledHeight ? shape.getScaledHeight() : bound.height);

    const rotVec = (nx, ny) => {
      if (!matrix) return { x: nx, y: ny };
      const sx = Math.hypot(matrix[0], matrix[1]) || 1;
      const cos = matrix[0] / sx;
      const sin = matrix[1] / sx;
      const rx = nx * cos - ny * sin;
      const ry = nx * sin + ny * cos;
      const len = Math.hypot(rx, ry) || 1;
      return { x: rx / len, y: ry / len };
    };

    if (shape.connectionPoints && shape.connectionPoints.length > 0) {
      const ports = shape.connectionPoints.map((cp) => {
        let px, py;
        if (matrix && w > 0 && h > 0 && typeof fabric !== 'undefined' && fabric.util && fabric.util.transformPoint) {
          const localPt = { x: (cp.x - 0.5) * w, y: (cp.y - 0.5) * h };
          const worldPt = fabric.util.transformPoint(localPt, matrix);
          px = worldPt.x;
          py = worldPt.y;
        } else {
          px = bound.left + cp.x * bound.width;
          py = bound.top + cp.y * bound.height;
        }
        const rawN = cp.normal || { x: (cp.x - 0.5) * 2, y: (cp.y - 0.5) * 2 };
        return {
          id: cp.id,
          x: px,
          y: py,
          normal: rotVec(rawN.x, rawN.y),
        };
      });

      ports.push({ id: 'center', x: cx, y: cy, normal: { x: 0, y: 0 } });
      return ports;
    }

    const mkDefault = (id, lx, ly, nx, ny) => {
      if (matrix && w > 0 && h > 0 && typeof fabric !== 'undefined' && fabric.util && fabric.util.transformPoint) {
        const pt = fabric.util.transformPoint({ x: lx * w, y: ly * h }, matrix);
        return { id, x: pt.x, y: pt.y, normal: rotVec(nx, ny) };
      }
      return { id, x: cx + lx * bound.width, y: cy + ly * bound.height, normal: { x: nx, y: ny } };
    };

    return [
      mkDefault('top', 0, -0.5, 0, -1),
      mkDefault('right', 0.5, 0, 1, 0),
      mkDefault('bottom', 0, 0.5, 0, 1),
      mkDefault('left', -0.5, 0, -1, 0),
      { id: 'center', x: cx, y: cy, normal: { x: 0, y: 0 } },
    ];
  }

  getClosestPort(shape, point) {
    const ports = this.getShapePorts(shape).filter(p => p.id !== 'center');
    let closest = ports[0];
    let minDist = Infinity;

    for (const port of ports) {
      const dx = port.x - point.x;
      const dy = port.y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = port;
      }
    }
    return closest;
  }

  _showPorts(shape) {
    this._hidePorts();
    this.activeHoverShape = shape;

    const ports = this.getShapePorts(shape).filter(p => p.id !== 'center');
    ports.forEach((p) => {
      const marker = new fabric.Circle({
        left: p.x,
        top: p.y,
        radius: 5,
        fill: '#0078d4',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectType: 'port-marker',
      });
      this.portMarkers.push(marker);
      this.canvas.add(marker);
      this.canvas.bringObjectToFront(marker);
    });
    this.canvas.requestRenderAll();
  }

  _hidePorts() {
    if (this.portMarkers.length > 0) {
      this.portMarkers.forEach((m) => this.canvas.remove(m));
      this.portMarkers = [];
    }
    this.activeHoverShape = null;
  }

  // ==========================================
  // AUTOCONNECT TRIGGERS (VISIO BLUE ARROWS)
  // ==========================================

  /**
   * Display 4 Visio AutoConnect directional arrow triggers around a shape.
   */
  showAutoConnect(shape) {
    this.hideAutoConnect();
    this.activeTriggerShape = shape;

    const bound = this._getShapeWorldRect(shape);
    const cx = bound.left + bound.width / 2;
    const cy = bound.top + bound.height / 2;
    const offset = 18;

    const directions = [
      { id: 'top', x: cx, y: bound.top - offset, angle: 0 },
      { id: 'right', x: bound.left + bound.width + offset, y: cy, angle: 90 },
      { id: 'bottom', x: cx, y: bound.top + bound.height + offset, angle: 180 },
      { id: 'left', x: bound.left - offset, y: cy, angle: 270 },
    ];

    directions.forEach((dir) => {
      // Circle background
      const circle = new fabric.Circle({
        radius: 9,
        fill: '#0078d4',
        stroke: '#ffffff',
        strokeWidth: 1.5,
        originX: 'center',
        originY: 'center',
      });

      // Directional arrow head
      const arrow = new fabric.Polygon([
        { x: 0, y: -4 },
        { x: -3.5, y: 3 },
        { x: 3.5, y: 3 },
      ], {
        fill: '#ffffff',
        originX: 'center',
        originY: 'center',
      });

      const trigger = new fabric.Group([circle, arrow], {
        left: dir.x,
        top: dir.y,
        angle: dir.angle,
        originX: 'center',
        originY: 'center',
        selectable: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: (window.OPENDRAW_CURSORS && window.OPENDRAW_CURSORS.CROSSHAIR) ? window.OPENDRAW_CURSORS.CROSSHAIR : 'crosshair',
        excludeFromExport: true,
        objectType: 'autoconnect-trigger',
      });

      trigger.parentShape = shape;
      trigger.portId = dir.id;

      this.autoConnectTriggers.push(trigger);
      this.canvas.add(trigger);
      this.canvas.bringObjectToFront(trigger);
    });

    this.canvas.requestRenderAll();
  }

  hideAutoConnect() {
    if (this._autoConnectHideTimer) {
      clearTimeout(this._autoConnectHideTimer);
      this._autoConnectHideTimer = null;
    }
    if (this.autoConnectTriggers.length > 0) {
      this.autoConnectTriggers.forEach((t) => this.canvas.remove(t));
      this.autoConnectTriggers = [];
    }
    this.activeTriggerShape = null;
  }

  _updateAutoConnectPositions() {
    if (!this.activeTriggerShape || this.autoConnectTriggers.length === 0) return;
    const shape = this.activeTriggerShape;
    const bound = this._getShapeWorldRect(shape);
    const cx = bound.left + bound.width / 2;
    const cy = bound.top + bound.height / 2;
    const offset = 18;

    const coords = {
      top: { x: cx, y: bound.top - offset },
      right: { x: bound.left + bound.width + offset, y: cy },
      bottom: { x: cx, y: bound.top + bound.height + offset },
      left: { x: bound.left - offset, y: cy },
    };

    this.autoConnectTriggers.forEach((t) => {
      const pos = coords[t.portId];
      if (pos) {
        t.set({ left: pos.x, top: pos.y });
        t.setCoords();
      }
    });
  }

  // ==========================================
  // ENDPOINT EDIT HANDLES (VISIO GREEN SQUARES)
  // ==========================================

  _showEndpointHandles(conn, opts = {}) {
    this._hideEndpointHandles(!!opts.preserveDragState);
    this.selectedConnector = conn;

    const lineObj = conn.line || (conn.points ? conn : null);
    if (!lineObj) return;
    const pts = lineObj.points;
    if (!pts || pts.length < 2) return;

    const zoom = this.canvas ? Math.max(0.2, this.canvas.getZoom()) : 1;
    const srcPt = pts[0];
    const tgtPt = pts[pts.length - 1];
    const endToEndDist = Math.hypot(tgtPt.x - srcPt.x, tgtPt.y - srcPt.y);
    const baseEndRadius = Math.min(11, Math.max(5.5, 6.5 / zoom));
    const endRadius = (endToEndDist > 0.5 && endToEndDist < baseEndRadius * 3.2)
      ? Math.max(3.2 / zoom, Math.min(baseEndRadius, endToEndDist * 0.2))
      : baseEndRadius;
    const midSize = Math.min(13, Math.max(6.5, 7.5 / zoom));

    const srcHandle = new fabric.Circle({
      left: srcPt.x,
      top: srcPt.y,
      radius: endRadius,
      padding: 2,
      fill: conn.sourceShape ? '#107c41' : '#ffffff', // Green if glued, white if free
      stroke: '#107c41',
      strokeWidth: Math.max(1.5, 2 / zoom),
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: true,
      hasBorders: false,
      hasControls: false,
      hoverCursor: (window.OPENDRAW_CURSORS && window.OPENDRAW_CURSORS.CROSSHAIR) ? window.OPENDRAW_CURSORS.CROSSHAIR : 'crosshair',
      excludeFromExport: true,
      objectType: 'connector-handle',
    });
    srcHandle.handleType = 'source';
    srcHandle.connectorData = conn;

    const tgtHandle = new fabric.Circle({
      left: tgtPt.x,
      top: tgtPt.y,
      radius: endRadius,
      padding: 2,
      fill: conn.targetShape ? '#107c41' : '#ffffff', // Green if glued, white if free
      stroke: '#107c41',
      strokeWidth: Math.max(1.5, 2 / zoom),
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: true,
      hasBorders: false,
      hasControls: false,
      hoverCursor: (window.OPENDRAW_CURSORS && window.OPENDRAW_CURSORS.CROSSHAIR) ? window.OPENDRAW_CURSORS.CROSSHAIR : 'crosshair',
      excludeFromExport: true,
      objectType: 'connector-handle',
    });
    tgtHandle.handleType = 'target';
    tgtHandle.connectorData = conn;

    const handles = [srcHandle, tgtHandle];
    const midClearance = endRadius + 2 / zoom;

    // Visio-style intermediate elbow / vertex waypoint handles
    const makeMidHandle = (x, y, cursor, meta) => {
      if (Math.hypot(x - srcPt.x, y - srcPt.y) < midClearance ||
          Math.hypot(x - tgtPt.x, y - tgtPt.y) < midClearance) {
        return null;
      }
      const isVertex = meta.elbowKind === 'vertex' || meta.elbowKind === 'curved-control';
      const h = new fabric.Rect({
        left: x,
        top: y,
        width: midSize,
        height: midSize,
        padding: 4,
        rx: isVertex ? midSize / 2 : 0,
        ry: isVertex ? midSize / 2 : 0,
        fill: isVertex ? '#ffffff' : '#ffb900',
        stroke: isVertex ? '#185abd' : '#ffffff',
        strokeWidth: Math.max(1.2, 1.5 / zoom),
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: true,
        hasBorders: false,
        hasControls: false,
        hoverCursor: cursor,
        excludeFromExport: true,
        objectType: 'connector-handle',
      });
      Object.assign(h, meta, { handleType: 'elbow', connectorData: conn });
      return h;
    };
    const pushMid = (h) => { if (h) handles.push(h); };

    if (pts.length >= 4) {
      if (conn.style && conn.style.routingType === 'curved') {
        const wps = (conn.curveWaypoints && conn.curveWaypoints.length > 0)
          ? conn.curveWaypoints
          : [pts[Math.floor(pts.length / 2)]];
        wps.forEach((wp, wi) => {
          if (!wp) return;
          pushMid(makeMidHandle(wp.x, wp.y, 'move', {
            elbowKind: 'curved-control',
            waypointIndex: wi,
          }));
        });
      } else {
        // Offer draggable segment handles across ALL orthogonal segments (0 .. pts.length - 2)
        // plus bend vertex handles on non-orthogonal corners so both height and length stay editable.
        const addedVertices = new Set();
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const dx = Math.abs(p1.x - p2.x);
          const dy = Math.abs(p1.y - p2.y);
          if (dx < 0.5 && dy < 0.5) continue;
          const isHorizontal = dy <= 3 && dx >= dy;
          const isVertical = dx <= 3 && dy > dx;
          if (isHorizontal || isVertical) {
            pushMid(makeMidHandle(
              (p1.x + p2.x) / 2,
              (p1.y + p2.y) / 2,
              isHorizontal ? 'ns-resize' : 'ew-resize',
              { elbowKind: 'segment', segmentIndex: i, isHorizontal }
            ));
          } else {
            if (i > 0 && !addedVertices.has(i)) {
              addedVertices.add(i);
              pushMid(makeMidHandle(p1.x, p1.y, 'move', { elbowKind: 'vertex', vertexIndex: i }));
            }
            if (i + 1 < pts.length - 1 && !addedVertices.has(i + 1)) {
              addedVertices.add(i + 1);
              pushMid(makeMidHandle(p2.x, p2.y, 'move', { elbowKind: 'vertex', vertexIndex: i + 1 }));
            }
          }
        }
        if (handles.length === 2) {
          for (let k = 1; k < pts.length - 1; k++) {
            pushMid(makeMidHandle(pts[k].x, pts[k].y, 'move', {
              elbowKind: 'vertex',
              vertexIndex: k,
            }));
          }
        }
      }
    } else if (pts.length === 3) {
      const p0 = pts[0], p1 = pts[1], p2 = pts[2];
      const seg0H = Math.abs(p0.y - p1.y) < 2;
      const seg0V = Math.abs(p0.x - p1.x) < 2;
      const seg1H = Math.abs(p1.y - p2.y) < 2;
      const seg1V = Math.abs(p1.x - p2.x) < 2;
      if ((seg0H || seg0V) && (seg1H || seg1V) && (!conn.style || conn.style.routingType !== 'straight')) {
        pushMid(makeMidHandle((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, seg0H ? 'ns-resize' : 'ew-resize', {
          elbowKind: 'split3',
          segmentIndex: 0,
          isHorizontal: seg0H,
        }));
        pushMid(makeMidHandle((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, seg1H ? 'ns-resize' : 'ew-resize', {
          elbowKind: 'split3',
          segmentIndex: 1,
          isHorizontal: seg1H,
        }));
      } else {
        pushMid(makeMidHandle(p1.x, p1.y, 'move', {
          elbowKind: 'vertex',
          vertexIndex: 1,
        }));
      }
    } else if (pts.length === 2) {
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      if (conn.style && conn.style.routingType === 'straight') {
        pushMid(makeMidHandle(mx, my, 'move', {
          elbowKind: 'vertex',
          vertexIndex: 1,
        }));
      } else {
        const isHorizontal = Math.abs(pts[0].y - pts[1].y) < Math.abs(pts[0].x - pts[1].x);
        pushMid(makeMidHandle(mx, my, isHorizontal ? 'ns-resize' : 'ew-resize', {
          elbowKind: 'segment',
          segmentIndex: 0,
          isHorizontal,
        }));
      }
    }

    this.endpointHandles = handles;
    // Add midpoint handles first so extremity handles always sit highest in z-order
    const zOrdered = [...handles.slice(2), srcHandle, tgtHandle];
    zOrdered.forEach((h) => {
      this.canvas.add(h);
      this.canvas.bringObjectToFront(h);
    });
    this._ensureCompleteConnectorHandles(conn, pts, endRadius, midSize, zoom);
    this.canvas.requestRenderAll();
  }

  /**
   * Ensure short connectors and short orthogonal legs never lose their height/length
   * or midpoint edit handles when zoomed out or when one leg is shorter than endRadius.
   */
  _ensureCompleteConnectorHandles(conn, pts, endRadius, midSize, zoom) {
    if (!conn || !pts || pts.length < 2 || !this.canvas) return;
    const mids = this.endpointHandles.slice(2);
    const coveredSegs = new Set(mids.filter(h => h.elbowKind === 'segment' || h.elbowKind === 'split3').map(h => h.segmentIndex));
    const routing = (conn.style && conn.style.routingType) || 'orthogonal';
    const srcPt = pts[0];
    const tgtPt = pts[pts.length - 1];
    const addHandle = (x, y, cursor, meta, sizeScale = 0.8) => {
      const sz = Math.max(4.5 / zoom, Math.min(midSize * sizeScale, midSize));
      const h = new fabric.Rect({
        left: x,
        top: y,
        width: sz,
        height: sz,
        angle: 45,
        padding: 2,
        fill: '#ffffff',
        stroke: '#0078d4',
        strokeWidth: Math.max(1.2, 1.4 / zoom),
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: true,
        hasBorders: false,
        hasControls: false,
        hoverCursor: cursor,
        excludeFromExport: true,
        objectType: 'connector-handle',
      });
      h.handleType = 'elbow';
      h.connectorData = conn;
      Object.assign(h, meta);
      this.endpointHandles.push(h);
      this.canvas.add(h);
      this.canvas.bringObjectToFront(h);
    };

    if (pts.length === 2 && mids.length === 0) {
      const segLen = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (segLen >= Math.max(6, 5 / zoom)) {
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = (pts[0].y + pts[1].y) / 2;
        const dx = Math.abs(pts[1].x - pts[0].x);
        const dy = Math.abs(pts[1].y - pts[0].y);
        if (routing === 'straight' || routing === 'curved' || (dx > 3 && dy > 3)) {
          addHandle(mx, my, 'move', { elbowKind: 'vertex', vertexIndex: 1 }, Math.min(0.85, (segLen * 0.32) / midSize));
        } else {
          const isH = dy <= 3;
          addHandle(mx, my, isH ? 'ns-resize' : 'ew-resize', { elbowKind: 'segment', segmentIndex: 0, isHorizontal: isH }, Math.min(0.85, (segLen * 0.32) / midSize));
        }
      }
      return;
    }

    if (pts.length >= 3 && routing === 'orthogonal') {
      for (let i = 0; i < pts.length - 1; i++) {
        if (coveredSegs.has(i)) continue;
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (segLen < 5) continue;
        const isH = Math.abs(p2.y - p1.y) <= 3;
        const isV = Math.abs(p2.x - p1.x) <= 3;
        if (!isH && !isV) continue;
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const dSrc = Math.hypot(mx - srcPt.x, my - srcPt.y);
        const dTgt = Math.hypot(mx - tgtPt.x, my - tgtPt.y);
        if (dSrc < 3 || dTgt < 3) continue;
        addHandle(mx, my, isH ? 'ns-resize' : 'ew-resize', { elbowKind: 'segment', segmentIndex: i, isHorizontal: isH }, 0.72);
      }
    }
  }

  _hideEndpointHandles(preserveDragState = false) {
    if (this.endpointHandles.length > 0) {
      this.endpointHandles.forEach((h) => this.canvas.remove(h));
      this.endpointHandles = [];
    }
    if (this.selectedConnector) {
      this._lastClearedConnector = this.selectedConnector;
      this._lastClearedAt = Date.now();
    }
    this.selectedConnector = null;
    if (!preserveDragState) {
      this.draggingEndpoint = null;
      this.draggingElbow = null;
    }
  }

  _updateEndpointHandlePositions() {
    if (!this.selectedConnector || this.endpointHandles.length < 2) return;
    const pts = this.selectedConnector.line ? this.selectedConnector.line.points : null;
    if (!pts || pts.length < 2) return;

    this.endpointHandles[0].set({
      left: pts[0].x,
      top: pts[0].y,
      fill: this.selectedConnector.sourceShape ? '#107c41' : '#ffffff',
    });
    this.endpointHandles[0].setCoords();

    this.endpointHandles[1].set({
      left: pts[pts.length - 1].x,
      top: pts[pts.length - 1].y,
      fill: this.selectedConnector.targetShape ? '#107c41' : '#ffffff',
    });
    this.endpointHandles[1].setCoords();

    // Update elbow / vertex / curved control handles
    for (let h = 2; h < this.endpointHandles.length; h++) {
      const handle = this.endpointHandles[h];
      if (handle.elbowKind === 'curved-control') {
        const wps = this.selectedConnector.curveWaypoints;
        const wi = handle.waypointIndex || 0;
        const pt = (wps && wps[wi]) ? wps[wi] : pts[Math.floor(pts.length / 2)];
        if (pt) {
          handle.set({ left: pt.x, top: pt.y });
          handle.setCoords();
        }
        continue;
      }
      if (handle.elbowKind === 'vertex') {
        const vi = handle.vertexIndex;
        if (vi >= 0 && vi < pts.length) {
          handle.set({ left: pts[vi].x, top: pts[vi].y });
          handle.setCoords();
        } else if (pts.length === 2) {
          handle.set({ left: (pts[0].x + pts[1].x) / 2, top: (pts[0].y + pts[1].y) / 2 });
          handle.setCoords();
        }
        continue;
      }
      const i = handle.segmentIndex;
      if (pts.length > 2 && i >= 0 && i < pts.length - 1) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        handle.set({
          left: (p1.x + p2.x) / 2,
          top: (p1.y + p2.y) / 2,
        });
        handle.setCoords();
      } else if (pts.length === 2) {
        handle.set({
          left: (pts[0].x + pts[1].x) / 2,
          top: (pts[0].y + pts[1].y) / 2,
        });
        handle.setCoords();
      }
    }
  }

  // ==========================================
  // INTERACTIVE CREATION & DRAG EVENTS
  // ==========================================

  _handleMouseDown(opt) {
    const target = opt.target;
    const evt = opt && opt.e;
    if (this.canvasManager.activeTool === 'select' && evt && (evt.ctrlKey || evt.metaKey || evt.shiftKey)) {
      if (!target || (target.objectType !== 'connector-handle' && target.objectType !== 'autoconnect-trigger')) {
        return;
      }
    }
    const pointer = this.canvas.getScenePoint(opt.e);
    const zoom = this.canvas ? Math.max(0.2, this.canvas.getZoom()) : 1;

    // Locate clicked connector handle directly or via endpoint proximity fallback
    // (helps when an extremity sits over an overlapping shape border or container)
    let handleTarget = (target && target.objectType === 'connector-handle') ? target : null;
    if (handleTarget && handleTarget.connectorData && handleTarget.connectorData.line) {
      const pts = handleTarget.connectorData.line.points;
      if (pts && pts.length >= 2) {
        const dSrc = Math.hypot(pointer.x - pts[0].x, pointer.y - pts[0].y);
        const dTgt = Math.hypot(pointer.x - pts[pts.length - 1].x, pointer.y - pts[pts.length - 1].y);
        const endHit = 10 / zoom;
        if (handleTarget.handleType === 'elbow') {
          const dElbow = Math.hypot(pointer.x - handleTarget.left, pointer.y - handleTarget.top);
          if (dTgt <= endHit && dTgt < dElbow * 0.85 && dTgt <= dSrc) {
            handleTarget = { objectType: 'connector-handle', handleType: 'target', connectorData: handleTarget.connectorData };
          } else if (dSrc <= endHit && dSrc < dElbow * 0.85) {
            handleTarget = { objectType: 'connector-handle', handleType: 'source', connectorData: handleTarget.connectorData };
          }
        } else if (handleTarget.handleType === 'target' && dSrc < dTgt && dSrc <= endHit) {
          handleTarget = { objectType: 'connector-handle', handleType: 'source', connectorData: handleTarget.connectorData };
        } else if (handleTarget.handleType === 'source' && dTgt < dSrc && dTgt <= endHit) {
          handleTarget = { objectType: 'connector-handle', handleType: 'target', connectorData: handleTarget.connectorData };
        }
      }
    }
    if (!handleTarget && this.canvasManager.activeTool !== 'insert:connector') {
      const activeObj = this.canvas.getActiveObject();
      const recentConn = (this._lastClearedAt && (Date.now() - this._lastClearedAt < 350))
        ? this._lastClearedConnector : null;
      const targetConn = target ? (target.connectorData || (target.objectType === 'connector' ? target : null)) : null;
      const activeConn = this.selectedConnector || (activeObj && activeObj.connectorData) || targetConn || recentConn;
      const pts = activeConn && activeConn.line ? activeConn.line.points : null;
      if (activeConn && pts && pts.length >= 2) {
        const hitR = 14 / zoom;
        if (Math.hypot(pointer.x - pts[0].x, pointer.y - pts[0].y) <= hitR) {
          handleTarget = { objectType: 'connector-handle', handleType: 'source', connectorData: activeConn };
        } else if (Math.hypot(pointer.x - pts[pts.length - 1].x, pointer.y - pts[pts.length - 1].y) <= hitR) {
          handleTarget = { objectType: 'connector-handle', handleType: 'target', connectorData: activeConn };
        }
      }
    }

    // 1. Check if user clicked an AutoConnect arrow trigger
    if (target && target.objectType === 'autoconnect-trigger') {
      this._savedCanvasSelection = this.canvas.selection;
      this.canvas.selection = false;
      this.canvas._groupSelector = null;
      this.canvas._currentTransform = null;
      this.isCreating = true;
      this.startShape = target.parentShape;
      this.startPort = target.portId;

      const port = this.getShapePorts(this.startShape).find(p => p.id === this.startPort) ||
                   this.getClosestPort(this.startShape, pointer);
      this.startPoint = { x: port.x, y: port.y, normal: port.normal };

      this.hideAutoConnect();
      this._createPreviewLine(this.startPoint, pointer);
      return;
    }

    // 2. Check if user clicked a connector handle (endpoint or elbow)
    if (handleTarget) {
      const conn = handleTarget.connectorData;
      // Disable canvas marquee selection while dragging a non-selectable handle
      if (this._savedCanvasSelection === undefined) {
        this._savedCanvasSelection = this.canvas.selection;
      }
      this.canvas.selection = false;
      this.canvas._groupSelector = null;
      this.canvas._currentTransform = null;

      if (handleTarget.handleType === 'elbow') {
        const prevPts = conn && conn.line && conn.line.points ? conn.line.points.map(p => ({ x: p.x, y: p.y })) : [];
        const prevWps = conn && conn.curveWaypoints ? conn.curveWaypoints.map(p => ({ x: p.x, y: p.y })) : null;
        this.draggingElbow = {
          handle: handleTarget,
          elbowKind: handleTarget.elbowKind || 'segment',
          segmentIndex: handleTarget.segmentIndex,
          vertexIndex: handleTarget.vertexIndex,
          waypointIndex: handleTarget.waypointIndex || 0,
          isHorizontal: handleTarget.isHorizontal,
          conn,
          startPointer: pointer,
          beforePoints: prevPts,
          beforeCurveWaypoints: prevWps,
          beforePreserve: conn ? !!conn.preserveGeometry : false,
        };
        this.isCreating = false;
        if (conn && this.endpointHandles.length === 0) {
          this._showEndpointHandles(conn, { preserveDragState: true });
        }
        return;
      }

      this.draggingEndpoint = handleTarget.handleType;
      this.hasEndpointDragged = false;
      this.isCreating = true;
      this.selectedConnector = conn;
      if (conn && this.endpointHandles.length === 0) {
        this._showEndpointHandles(conn, { preserveDragState: true });
      }
      this._endpointDragBefore = conn ? {
        sourceShape: conn.sourceShape,
        sourcePortId: conn.sourcePortId,
        sourcePoint: conn.sourcePoint ? { ...conn.sourcePoint } : null,
        sourcePinSpec: conn.sourcePinSpec ? { ...conn.sourcePinSpec } : null,
        targetShape: conn.targetShape,
        targetPortId: conn.targetPortId,
        targetPoint: conn.targetPoint ? { ...conn.targetPoint } : null,
        targetPinSpec: conn.targetPinSpec ? { ...conn.targetPinSpec } : null,
        preserveGeometry: !!conn.preserveGeometry,
        points: conn.line && conn.line.points ? conn.line.points.map(p => ({ x: p.x, y: p.y })) : null,
      } : null;

      if (this.draggingEndpoint === 'target') {
        this.startShape = conn.sourceShape;
        this.startPort = conn.sourcePortId;
        const port = this.startShape ? (this._resolveConnectorPort(conn, 'source') || this.getClosestPort(this.startShape, pointer)) : null;
        this.startPoint = port ? { x: port.x, y: port.y, normal: port.normal } : (conn.sourcePoint || (conn.line && conn.line.points ? conn.line.points[0] : pointer));
      } else {
        this.startShape = conn.targetShape;
        this.startPort = conn.targetPortId;
        const port = this.startShape ? (this._resolveConnectorPort(conn, 'target') || this.getClosestPort(this.startShape, pointer)) : null;
        const lastPt = conn.line && conn.line.points ? conn.line.points[conn.line.points.length - 1] : pointer;
        this.startPoint = port ? { x: port.x, y: port.y, normal: port.normal } : (conn.targetPoint || lastPt);
      }

      this._createPreviewLine(this.startPoint, pointer);
      return;
    }

    // 3. Click existing connector with Pointer tool: select it and show handles
    const isConnTarget = target && (target.objectType === 'connector' || target.shapeType === 'connector' || target.connectorData || target.objectType === 'connector-arrow');
    if (isConnTarget && this.canvasManager.activeTool !== 'insert:connector') {
      const lineObj = target.objectType === 'connector-arrow' ? (target.connectorData ? target.connectorData.line : null) : (target.line || target);
      if (lineObj) {
        this.canvas.setActiveObject(lineObj);
        lineObj._lastLeft = lineObj.left;
        lineObj._lastTop = lineObj.top;
      }
      this._showEndpointHandles(target.connectorData || target);
      return;
    }

    // 4. Check if connector tool is active
    if (this.canvasManager.activeTool === 'insert:connector') {
      this.canvas._currentTransform = null;
      this.canvas.discardActiveObject();

      const shape = this._findTargetShape(pointer);
      if (shape) {
        this.isCreating = true;
        this.startShape = shape;
        const port = this.getClosestPort(shape, pointer);
        this.startPort = port.id;
        this.startPoint = { x: port.x, y: port.y, normal: port.normal };
        this._createPreviewLine(this.startPoint, pointer);
      } else {
        this.isCreating = true;
        this.startShape = null;
        this.startPort = null;
        this.startPoint = { x: pointer.x, y: pointer.y, normal: { x: 0, y: 0 } };
        this._createPreviewLine(this.startPoint, pointer);
      }
    }
  }

  _createPreviewLine(startPt, curPt) {
    if (this.previewLine) this.canvas.remove(this.previewLine);

    this.previewLine = new fabric.Polyline([
      { x: startPt.x, y: startPt.y },
      { x: curPt.x, y: curPt.y },
    ], {
      stroke: '#0078d4',
      strokeWidth: 2,
      strokeDashArray: [5, 4],
      fill: 'transparent',
      selectable: false,
      evented: false,
      objectType: 'connector-preview',
    });
    this.canvas.add(this.previewLine);
    this.canvas.bringObjectToFront(this.previewLine);
    this.canvas.requestRenderAll();
  }

  _refreshPolyline(lineObj, points) {
    if (!lineObj) return;
    lineObj.points = points;
    lineObj.set({ dirty: true });
    if (typeof lineObj.setBoundingBox === 'function') {
      lineObj.setBoundingBox(true);
    } else if (typeof lineObj._calcDimensions === 'function') {
      lineObj.set(lineObj._calcDimensions());
    }
    lineObj.setCoords();
  }

  _handleMouseMove(opt) {
    if (this.draggingElbow) {
      const pointer = this.canvas.getScenePoint(opt.e);
      const conn = this.draggingElbow.conn;
      if (conn && conn.line && conn.line.points) {
        let pts = conn.line.points;

        if (this.draggingElbow.elbowKind === 'curved-control') {
          const wi = this.draggingElbow.waypointIndex || 0;
          if (!Array.isArray(conn.curveWaypoints) || conn.curveWaypoints.length === 0) {
            conn.curveWaypoints = [{ x: pointer.x, y: pointer.y }];
          } else {
            conn.curveWaypoints[wi] = { x: pointer.x, y: pointer.y };
          }
          const p0 = { x: pts[0].x, y: pts[0].y };
          const pEnd = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
          const curvedPts = this._evaluateSmoothCurve(p0, pEnd, conn.curveWaypoints);
          conn.preserveGeometry = true;
          this._refreshPolyline(conn.line, curvedPts);
          conn.line._lastLeft = conn.line.left;
          conn.line._lastTop = conn.line.top;
          this._updateConnectorArrowsAndLabel(conn, curvedPts);
          this._updateEndpointHandlePositions();
          this.canvas.requestRenderAll();
          return;
        }

        if (this.draggingElbow.elbowKind === 'vertex') {
          if (pts.length === 2) {
            pts = [{ x: pts[0].x, y: pts[0].y }, { x: pointer.x, y: pointer.y }, { x: pts[1].x, y: pts[1].y }];
            this.draggingElbow.vertexIndex = 1;
            conn.line.points = pts;
            this._showEndpointHandles(conn, { preserveDragState: true });
          }
          const vi = this.draggingElbow.vertexIndex;
          if (vi > 0 && vi < pts.length - 1) {
            conn.preserveGeometry = true;
            pts[vi].x = pointer.x;
            pts[vi].y = pointer.y;
            this._refreshPolyline(conn.line, pts);
            this._updateConnectorArrowsAndLabel(conn, pts);
            this._updateEndpointHandlePositions();
            this.canvas.requestRenderAll();
          }
          return;
        }

        if (pts.length === 3 && this.draggingElbow.elbowKind === 'split3') {
          const isH = this.draggingElbow.isHorizontal;
          const p0 = pts[0], p1 = pts[1], p2 = pts[2];
          if (this.draggingElbow.segmentIndex === 0) {
            pts = isH
              ? [{ x: p0.x, y: p0.y }, { x: p0.x, y: pointer.y }, { x: p1.x, y: pointer.y }, { x: p2.x, y: p2.y }]
              : [{ x: p0.x, y: p0.y }, { x: pointer.x, y: p0.y }, { x: pointer.x, y: p1.y }, { x: p2.x, y: p2.y }];
          } else {
            pts = isH
              ? [{ x: p0.x, y: p0.y }, { x: p1.x, y: pointer.y }, { x: p2.x, y: pointer.y }, { x: p2.x, y: p2.y }]
              : [{ x: p0.x, y: p0.y }, { x: pointer.x, y: p1.y }, { x: pointer.x, y: p2.y }, { x: p2.x, y: p2.y }];
          }
          this.draggingElbow.segmentIndex = 1;
          this.draggingElbow.elbowKind = 'segment';
          conn.line.points = pts;
          this._showEndpointHandles(conn, { preserveDragState: true });
        } else if (pts.length === 2) {
          const isH = this.draggingElbow.isHorizontal;
          const p0 = pts[0];
          const p1 = pts[1];
          pts = isH
            ? [{ x: p0.x, y: p0.y }, { x: p0.x, y: pointer.y }, { x: p1.x, y: pointer.y }, { x: p1.x, y: p1.y }]
            : [{ x: p0.x, y: p0.y }, { x: pointer.x, y: p0.y }, { x: pointer.x, y: p1.y }, { x: p1.x, y: p1.y }];
          this.draggingElbow.segmentIndex = 1;
          conn.line.points = pts;
          this._showEndpointHandles(conn, { preserveDragState: true });
        }

        const i = this.draggingElbow.segmentIndex;
        if (i >= 0 && i + 1 < pts.length) {
          conn.preserveGeometry = true;
          if (i === 0 && pts.length >= 3 && conn.sourceShape) {
            const p0 = { x: pts[0].x, y: pts[0].y };
            pts.splice(1, 0, { x: p0.x, y: p0.y });
            this.draggingElbow.segmentIndex = 1;
            this._showEndpointHandles(conn, { preserveDragState: true });
          } else if (i === pts.length - 2 && pts.length >= 3 && conn.targetShape) {
            const pN = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
            pts.splice(pts.length - 1, 0, { x: pN.x, y: pN.y });
            this._showEndpointHandles(conn, { preserveDragState: true });
          }
          const curIdx = this.draggingElbow.segmentIndex;
          if (this.draggingElbow.isHorizontal) {
            pts[curIdx].y = pointer.y;
            pts[curIdx + 1].y = pointer.y;
          } else {
            pts[curIdx].x = pointer.x;
            pts[curIdx + 1].x = pointer.x;
          }
          if (curIdx === 0 && !conn.sourceShape) {
            conn.sourcePoint = { x: pts[0].x, y: pts[0].y };
          }
          if (curIdx === pts.length - 2 && !conn.targetShape) {
            conn.targetPoint = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
          }
          this._refreshPolyline(conn.line, pts);
          this._updateConnectorArrowsAndLabel(conn, pts);
          this._updateEndpointHandlePositions();
          this.canvas.requestRenderAll();
        }
      }
      return;
    }

    if (!this.isCreating || !this.previewLine || !this.startPoint) return;
    this.hasEndpointDragged = true;
    this.canvas._groupSelector = null;
    this.canvas._currentTransform = null; // Prevent dragging underlying shape

    const pointer = this.canvas.getScenePoint(opt.e);
    const target = this._findTargetShape(pointer);

    let endPt = { x: pointer.x, y: pointer.y };

    if (target && target !== this.startShape) {
      const targetPort = this.getClosestPort(target, pointer);
      endPt = { x: targetPort.x, y: targetPort.y, normal: targetPort.normal };
      this._showPorts(target);
    } else {
      this._hidePorts();
    }

    // Live route preview (honor dragged connector's routing style)
    const rt = (this.draggingEndpoint && this.selectedConnector && this.selectedConnector.style && this.selectedConnector.style.routingType)
      ? this.selectedConnector.style.routingType
      : this.defaultStyle.routingType;
    const points = rt === 'straight'
      ? [{ x: this.startPoint.x, y: this.startPoint.y }, { x: endPt.x, y: endPt.y }]
      : rt === 'curved'
        ? this._calculateCurvedPoints(this.startPoint, endPt)
        : this._calculateOrthogonalPoints(this.startPoint, endPt);
    this._refreshPolyline(this.previewLine, points);
    this.canvas.requestRenderAll();
  }

  _recordEndpointChangeUndo(conn, beforeSnap) {
    if (!conn || !beforeSnap || !window.undoManager) return;
    const afterSnap = {
      sourceShape: conn.sourceShape,
      sourcePortId: conn.sourcePortId,
      sourcePoint: conn.sourcePoint ? { ...conn.sourcePoint } : null,
      sourcePinSpec: conn.sourcePinSpec ? { ...conn.sourcePinSpec } : null,
      targetShape: conn.targetShape,
      targetPortId: conn.targetPortId,
      targetPoint: conn.targetPoint ? { ...conn.targetPoint } : null,
      targetPinSpec: conn.targetPinSpec ? { ...conn.targetPinSpec } : null,
      preserveGeometry: !!conn.preserveGeometry,
      points: conn.line && conn.line.points ? conn.line.points.map(p => ({ x: p.x, y: p.y })) : null,
    };
    const applySnap = (snap) => {
      conn.sourceShape = snap.sourceShape;
      conn.sourcePortId = snap.sourcePortId;
      conn.sourcePoint = snap.sourcePoint ? { ...snap.sourcePoint } : null;
      conn.sourcePinSpec = snap.sourcePinSpec ? { ...snap.sourcePinSpec } : null;
      conn.targetShape = snap.targetShape;
      conn.targetPortId = snap.targetPortId;
      conn.targetPoint = snap.targetPoint ? { ...snap.targetPoint } : null;
      conn.targetPinSpec = snap.targetPinSpec ? { ...snap.targetPinSpec } : null;
      conn.preserveGeometry = snap.preserveGeometry;
      if (snap.points && conn.line) conn.line.points = snap.points.map(p => ({ x: p.x, y: p.y }));
      this.updateConnector(conn);
      if (this.selectedConnector === conn) this._showEndpointHandles(conn);
    };
    window.undoManager.record({
      name: 'Edit Connector Endpoint',
      execute: () => applySnap(afterSnap),
      undo: () => applySnap(beforeSnap),
    });
  }

  _restoreSelectionState() {
    if (this._savedCanvasSelection !== undefined) {
      this.canvas.selection = this._savedCanvasSelection;
      delete this._savedCanvasSelection;
    }
    this.canvas._groupSelector = null;
  }

  _handleMouseUp(opt) {
    this._restoreSelectionState();

    if (this._draggingConnectorBody) {
      const bodyDrag = this._draggingConnectorBody;
      this._draggingConnectorBody = null;
      const {
        conn, totalDx, totalDy, beforePoints,
        beforeSourceShape, beforeSourcePortId, beforeSourcePinSpec, beforeSourcePoint,
        beforeTargetShape, beforeTargetPortId, beforeTargetPinSpec, beforeTargetPoint,
        beforePreserveGeometry,
      } = bodyDrag;
      if (conn && conn.line && (totalDx !== 0 || totalDy !== 0)) {
        const nextPts = beforePoints.map(p => ({ x: p.x + totalDx, y: p.y + totalDy }));
        const baseSrc = beforeSourcePoint || (beforePoints[0] ? { x: beforePoints[0].x, y: beforePoints[0].y } : null);
        const baseTgt = beforeTargetPoint || (beforePoints.length > 0 ? { x: beforePoints[beforePoints.length - 1].x, y: beforePoints[beforePoints.length - 1].y } : null);
        const nextSrc = baseSrc ? { ...baseSrc, x: baseSrc.x + totalDx, y: baseSrc.y + totalDy } : null;
        const nextTgt = baseTgt ? { ...baseTgt, x: baseTgt.x + totalDx, y: baseTgt.y + totalDy } : null;
        const afterMeta = {
          sourceShape: null, sourcePortId: null, sourcePinSpec: null,
          targetShape: null, targetPortId: null, targetPinSpec: null,
          preserveGeometry: true,
        };
        const beforeMeta = {
          sourceShape: beforeSourceShape || null,
          sourcePortId: beforeSourcePortId || null,
          sourcePinSpec: beforeSourcePinSpec ? { ...beforeSourcePinSpec } : null,
          targetShape: beforeTargetShape || null,
          targetPortId: beforeTargetPortId || null,
          targetPinSpec: beforeTargetPinSpec ? { ...beforeTargetPinSpec } : null,
          preserveGeometry: !!beforePreserveGeometry,
        };
        const applyMovedPts = (ptsSnap, srcSnap, tgtSnap, metaSnap) => {
          if (metaSnap) {
            conn.sourceShape = metaSnap.sourceShape;
            conn.sourcePortId = metaSnap.sourcePortId;
            conn.sourcePinSpec = metaSnap.sourcePinSpec ? { ...metaSnap.sourcePinSpec } : null;
            conn.targetShape = metaSnap.targetShape;
            conn.targetPortId = metaSnap.targetPortId;
            conn.targetPinSpec = metaSnap.targetPinSpec ? { ...metaSnap.targetPinSpec } : null;
            conn.preserveGeometry = metaSnap.preserveGeometry;
          }
          conn.sourcePoint = srcSnap ? { ...srcSnap } : null;
          conn.targetPoint = tgtSnap ? { ...tgtSnap } : null;
          this._refreshPolyline(conn.line, ptsSnap.map(p => ({ x: p.x, y: p.y })));
          conn.line._lastLeft = conn.line.left;
          conn.line._lastTop = conn.line.top;
          this._updateConnectorArrowsAndLabel(conn, conn.line.points);
          if (this.selectedConnector === conn) this._showEndpointHandles(conn, { preserveDragState: true });
          this.canvas.requestRenderAll();
        };
        applyMovedPts(nextPts, nextSrc, nextTgt, afterMeta);
        if (window.undoManager) {
          window.undoManager.record({
            name: 'Move Connector',
            execute: () => applyMovedPts(nextPts, nextSrc, nextTgt, afterMeta),
            undo: () => applyMovedPts(beforePoints, beforeSourcePoint, beforeTargetPoint, beforeMeta),
          });
        }
      }
    }

    if (this.draggingElbow) {
      const { conn, beforePoints, beforeCurveWaypoints, beforePreserve } = this.draggingElbow;
      this.draggingElbow = null;
      if (conn) {
        this.updateConnector(conn);
        if (conn.line) this.canvas.setActiveObject(conn.line);
        this._showEndpointHandles(conn);
        if (window.undoManager && conn.line && conn.line.points && beforePoints && beforePoints.length >= 2) {
          const afterPts = conn.line.points.map(p => ({ x: p.x, y: p.y }));
          const afterWps = conn.curveWaypoints ? conn.curveWaypoints.map(p => ({ x: p.x, y: p.y })) : null;
          const beforeWpsCopy = beforeCurveWaypoints ? beforeCurveWaypoints.map(p => ({ x: p.x, y: p.y })) : null;
          const afterPreserve = !!conn.preserveGeometry;
          const beforeSrc = (!conn.sourceShape && beforePoints[0]) ? { x: beforePoints[0].x, y: beforePoints[0].y } : (conn.sourcePoint ? { ...conn.sourcePoint } : null);
          const beforeTgt = (!conn.targetShape && beforePoints[beforePoints.length - 1]) ? { x: beforePoints[beforePoints.length - 1].x, y: beforePoints[beforePoints.length - 1].y } : (conn.targetPoint ? { ...conn.targetPoint } : null);
          const afterSrc = (!conn.sourceShape && afterPts[0]) ? { x: afterPts[0].x, y: afterPts[0].y } : (conn.sourcePoint ? { ...conn.sourcePoint } : null);
          const afterTgt = (!conn.targetShape && afterPts[afterPts.length - 1]) ? { x: afterPts[afterPts.length - 1].x, y: afterPts[afterPts.length - 1].y } : (conn.targetPoint ? { ...conn.targetPoint } : null);
          window.undoManager.record({
            name: 'Move Connector Waypoint',
            execute: () => {
              conn.preserveGeometry = afterPreserve;
              conn.curveWaypoints = afterWps ? afterWps.map(p => ({ x: p.x, y: p.y })) : null;
              if (!conn.sourceShape && afterSrc) conn.sourcePoint = { ...afterSrc };
              if (!conn.targetShape && afterTgt) conn.targetPoint = { ...afterTgt };
              if (conn.line) conn.line.points = afterPts.map(p => ({ x: p.x, y: p.y }));
              this.updateConnector(conn);
              if (this.selectedConnector === conn) this._showEndpointHandles(conn);
            },
            undo: () => {
              conn.preserveGeometry = beforePreserve;
              conn.curveWaypoints = beforeWpsCopy ? beforeWpsCopy.map(p => ({ x: p.x, y: p.y })) : null;
              if (!conn.sourceShape && beforeSrc) conn.sourcePoint = { ...beforeSrc };
              if (!conn.targetShape && beforeTgt) conn.targetPoint = { ...beforeTgt };
              if (conn.line) conn.line.points = beforePoints.map(p => ({ x: p.x, y: p.y }));
              this.updateConnector(conn);
              if (this.selectedConnector === conn) this._showEndpointHandles(conn);
            },
          });
        }
      }
      return;
    }

    if (!this.isCreating) return;

    if (this.draggingEndpoint && !this.hasEndpointDragged) {
      const conn = this.selectedConnector;
      this.isCreating = false;
      this.draggingEndpoint = null;
      this._endpointDragBefore = null;
      if (this.previewLine) {
        this.canvas.remove(this.previewLine);
        this.previewLine = null;
      }
      if (conn && conn.line) {
        this.canvas.setActiveObject(conn.line);
        this._showEndpointHandles(conn);
      }
      return;
    }

    const pointer = this.canvas.getScenePoint(opt.e);
    const target = this._findTargetShape(pointer);

    if (this.previewLine) {
      this.canvas.remove(this.previewLine);
      this.previewLine = null;
    }
    this._hidePorts();

    const isContinuousMode = this.canvasManager.activeTool === 'insert:connector';
    const wasDraggingEndpoint = this.draggingEndpoint;
    const beforeSnap = this._endpointDragBefore;
    let activeConnResult = null;

    if (target && target !== this.startShape) {
      const targetPort = this.getClosestPort(target, pointer);

      if (wasDraggingEndpoint && this.selectedConnector) {
        const conn = this.selectedConnector;
        conn.preserveGeometry = false;
        if (wasDraggingEndpoint === 'target') {
          if (!conn.sourceShape && !conn.sourcePoint && this.startPoint) {
            conn.sourcePoint = { x: this.startPoint.x, y: this.startPoint.y };
          }
          conn.targetShape = target;
          conn.targetPortId = targetPort.id;
          conn.targetPoint = null;
          conn.targetPinSpec = null;
        } else {
          if (!conn.targetShape && !conn.targetPoint && this.startPoint) {
            conn.targetPoint = { x: this.startPoint.x, y: this.startPoint.y };
          }
          conn.sourceShape = target;
          conn.sourcePortId = targetPort.id;
          conn.sourcePoint = null;
          conn.sourcePinSpec = null;
        }
        this.updateConnector(conn);
        this._recordEndpointChangeUndo(conn, beforeSnap);
        activeConnResult = conn;
      } else {
        const conn = this.createConnector(
          this.startShape,
          this.startPort,
          target,
          targetPort.id,
          this.defaultStyle
        );
        if (!isContinuousMode) activeConnResult = conn;
      }
    } else {
      if (wasDraggingEndpoint && this.selectedConnector) {
        const conn = this.selectedConnector;
        conn.preserveGeometry = false;
        if (wasDraggingEndpoint === 'target') {
          if (!conn.sourceShape && !conn.sourcePoint && this.startPoint) {
            conn.sourcePoint = { x: this.startPoint.x, y: this.startPoint.y };
          }
          conn.targetShape = null;
          conn.targetPortId = null;
          conn.targetPoint = { x: pointer.x, y: pointer.y };
          conn.targetPinSpec = null;
        } else {
          if (!conn.targetShape && !conn.targetPoint && this.startPoint) {
            conn.targetPoint = { x: this.startPoint.x, y: this.startPoint.y };
          }
          conn.sourceShape = null;
          conn.sourcePortId = null;
          conn.sourcePoint = { x: pointer.x, y: pointer.y };
          conn.sourcePinSpec = null;
        }
        this.updateConnector(conn);
        this._recordEndpointChangeUndo(conn, beforeSnap);
        activeConnResult = conn;
      } else if ((this.startShape || this.startPoint) && (isContinuousMode || this.startPoint)) {
        const dist = Math.hypot(pointer.x - this.startPoint.x, pointer.y - this.startPoint.y);
        if (dist > 10) {
          const conn = this.createConnector(
            this.startShape,
            this.startPort,
            null,
            null,
            this.defaultStyle,
            [this.startPoint, { x: pointer.x, y: pointer.y }]
          );
          if (!isContinuousMode) activeConnResult = conn;
        }
      }
    }

    this.isCreating = false;
    this.startShape = null;
    this.startPort = null;
    this.startPoint = null;
    this.draggingEndpoint = null;
    this._endpointDragBefore = null;
    this.canvas._currentTransform = null;

    if (activeConnResult && activeConnResult.line) {
      this.canvas.setActiveObject(activeConnResult.line);
      this._showEndpointHandles(activeConnResult);
    }

    if (!isContinuousMode && this.canvasManager.activeTool !== 'select') {
      this.canvasManager.setTool('select');
    }
  }

  /**
   * Find shape at pointer with comfortable padding for port clicking.
   */
  _findTargetShape(pointer) {
    const objects = this.canvas.getObjects().slice().reverse();
    for (const obj of objects) {
      if (this._isConnectable(obj)) {
        const bound = this._getShapeWorldRect(obj);
        const isCont = Boolean(obj.isContainer || (obj.shapeData && obj.shapeData.isContainer) || obj.objectType === 'container');
        if (isCont) {
          const onOuter = pointer.x >= bound.left - 14 && pointer.x <= bound.left + bound.width + 14 &&
                          pointer.y >= bound.top - 14 && pointer.y <= bound.top + bound.height + 14;
          const inInner = pointer.x > bound.left + 14 && pointer.x < bound.left + bound.width - 14 &&
                          pointer.y > bound.top + 14 && pointer.y < bound.top + bound.height - 14;
          if (onOuter && !inInner) return obj;
          continue;
        }
        // 16px hit-test buffer around shape
        if (
          pointer.x >= bound.left - 16 &&
          pointer.x <= bound.left + bound.width + 16 &&
          pointer.y >= bound.top - 16 &&
          pointer.y <= bound.top + bound.height + 16
        ) {
          return obj;
        }
      }
    }
    return null;
  }

  // ==========================================
  // CONNECTOR CREATION & MANAGEMENT
  // ==========================================

  _isArrowVisible(val) {
    return Boolean(val && val !== 'none' && val !== false);
  }

  _makeArrowHead(kind, strokeColor, strokeWidth) {
    const visible = this._isArrowVisible(kind);
    const col = strokeColor || '#41719C';
    const scale = Math.max(0.85, Math.min(2, (strokeWidth || 2) / 2));
    if (kind === 'open') {
      return new fabric.Polyline([
        { x: -10 * scale, y: -5 * scale },
        { x: 0, y: 0 },
        { x: -10 * scale, y: 5 * scale },
      ], {
        fill: 'transparent',
        stroke: col,
        strokeWidth: Math.max(1.5, strokeWidth || 2),
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        visible,
        objectType: 'connector-arrow',
      });
    }
    if (kind === 'diamond') {
      return new fabric.Polygon([
        { x: 0, y: 0 },
        { x: -6 * scale, y: -4 * scale },
        { x: -12 * scale, y: 0 },
        { x: -6 * scale, y: 4 * scale },
      ], {
        fill: col,
        stroke: col,
        strokeWidth: 1,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        visible,
        objectType: 'connector-arrow',
      });
    }
    return new fabric.Polygon([
      { x: 0, y: 0 },
      { x: -10 * scale, y: -4.5 * scale },
      { x: -10 * scale, y: 4.5 * scale },
    ], {
      fill: col,
      stroke: col,
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      visible,
      objectType: 'connector-arrow',
    });
  }

  _resolveConnectorPort(conn, end) {
    const shape = end === 'source' ? conn.sourceShape : conn.targetShape;
    const portId = end === 'source' ? conn.sourcePortId : conn.targetPortId;
    const pinSpec = end === 'source' ? conn.sourcePinSpec : conn.targetPinSpec;
    const freePt = end === 'source' ? conn.sourcePoint : conn.targetPoint;
    if (shape) {
      if (pinSpec) return this._resolvePinSpec(shape, pinSpec);
      const ports = this.getShapePorts(shape);
      if (portId === 'dynamic') {
        const otherCenter = (end === 'source'
          ? (conn.targetShape ? this.getShapePorts(conn.targetShape).find(p => p.id === 'center') : conn.targetPoint)
          : (conn.sourceShape ? this.getShapePorts(conn.sourceShape).find(p => p.id === 'center') : conn.sourcePoint));
        if (otherCenter) return this.getClosestPort(shape, otherCenter);
      }
      return ports.find(p => p.id === portId) || ports[0];
    }
    if (freePt) {
      return {
        x: freePt.x,
        y: freePt.y,
        normal: freePt.normal || { x: end === 'source' ? 1 : -1, y: 0 },
      };
    }
    return null;
  }

  /**
   * Create a glued or free-floating connector.
   */
  createConnector(sourceShape, sourcePortId, targetShape, targetPortId, styleOpts = {}, initialPoints = null) {
    const {
      skipUndo,
      preserveGeometry,
      label,
      textStyle,
      ...pureStyle
    } = (styleOpts || {});
    const style = { ...this.defaultStyle, ...pureStyle };
    const connId = 'conn_' + Math.random().toString(36).substr(2, 9);

    let sourcePinSpec = null;
    if (sourceShape && initialPoints && initialPoints.length >= 2) {
      const sp = sourcePortId ? this.getShapePorts(sourceShape).find(p => p.id === sourcePortId) : null;
      const p0 = initialPoints[0];
      if (!sp || Math.hypot(sp.x - p0.x, sp.y - p0.y) > 4) {
        sourcePinSpec = this._computePinSpec(sourceShape, p0);
      }
    }

    let targetPinSpec = null;
    if (targetShape && initialPoints && initialPoints.length >= 2) {
      const tp = targetPortId ? this.getShapePorts(targetShape).find(p => p.id === targetPortId) : null;
      const pN = initialPoints[initialPoints.length - 1];
      if (!tp || Math.hypot(tp.x - pN.x, tp.y - pN.y) > 4) {
        targetPinSpec = this._computePinSpec(targetShape, pN);
      }
    }

    const connectorData = {
      id: connId,
      sourceShape: sourceShape || null,
      sourcePortId: sourcePinSpec ? 'custom' : (sourcePortId || (sourceShape ? 'center' : null)),
      sourcePinSpec,
      sourcePoint: !sourceShape && initialPoints && initialPoints.length ? initialPoints[0] : null,
      targetShape: targetShape || null,
      targetPortId: targetPinSpec ? 'custom' : (targetPortId || (targetShape ? 'center' : null)),
      targetPinSpec,
      targetPoint: !targetShape && initialPoints && initialPoints.length ? initialPoints[initialPoints.length - 1] : null,
      preserveGeometry: Boolean(preserveGeometry),
      label: label || '',
      textStyle: textStyle || null,
      style,
      line: null,
      arrow: null,
      sourceArrowHead: null,
      labelObj: null,
    };

    // Build the visual Fabric elements directly on the canvas
    this._buildConnectorVisuals(connectorData, initialPoints);
    this.connectors.push(connectorData);

    // Initial positioning
    this.updateConnector(connectorData);

    if (!skipUndo && window.undoManager) {
      window.undoManager.record({
        name: 'Add Connector',
        execute: () => {
          if (!this.connectors.includes(connectorData)) {
            this.connectors.push(connectorData);
          }
          this._buildConnectorVisuals(connectorData, initialPoints);
          this.updateConnector(connectorData);
        },
        undo: () => {
          this.removeConnector(connectorData);
        },
      });
    }

    return connectorData;
  }

  _buildConnectorVisuals(conn, seedPoints = null) {
    if (conn.line) this.canvas.remove(conn.line);
    if (conn.arrow) this.canvas.remove(conn.arrow);
    if (conn.sourceArrowHead) this.canvas.remove(conn.sourceArrowHead);
    if (conn.labelObj) this.canvas.remove(conn.labelObj);

    const initialPoints = (conn.line && conn.line.points && conn.line.points.length >= 2)
      ? conn.line.points
      : (seedPoints && seedPoints.length >= 2 ? seedPoints.map(p => ({ x: p.x, y: p.y })) : [{ x: 0, y: 0 }, { x: 10, y: 10 }]);

    const strokeCol = conn.style.stroke || '#41719C';
    const strokeW = conn.style.strokeWidth || 2;
    const line = new fabric.Polyline(initialPoints, {
      stroke: strokeCol,
      strokeWidth: strokeW,
      strokeDashArray: conn.style.strokeDashArray || null,
      strokeLineJoin: (conn.style.roundingPx && conn.style.roundingPx > 1) ? 'round' : 'miter',
      fill: 'transparent',
      selectable: true,
      hasControls: false,
      hasBorders: true,
      borderColor: '#0078d4',
      padding: 8,
      perPixelTargetFind: true,
      targetFindTolerance: 12,
      lockMovementX: false,
      lockMovementY: false,
      objectType: 'connector',
    });
    line.connectorData = conn;
    line._lastLeft = line.left;
    line._lastTop = line.top;

    const arrow = this._makeArrowHead(conn.style.targetArrow, strokeCol, strokeW);
    arrow.connectorData = conn;
    const sourceArrowHead = this._makeArrowHead(conn.style.sourceArrow, strokeCol, strokeW);
    sourceArrowHead.connectorData = conn;

    conn.line = line;
    conn.arrow = arrow;
    conn.arrowHead = arrow;
    conn.sourceArrowHead = sourceArrowHead;

    this.canvas.add(line);
    this.canvas.add(arrow);
    this.canvas.add(sourceArrowHead);

    if (conn.label) {
      this.setConnectorLabel(conn, conn.label, conn.textStyle);
    }

    // Place connector above grid/page-bg/containers and behind foreground shapes
    this._placeConnectorInZOrder(conn);
  }

  _updateConnectorArrowsAndLabel(conn, points) {
    if (!points || points.length < 2) return;
    const pLast = points[points.length - 1];
    let pPrev = points[points.length - 2];
    for (let k = points.length - 2; k >= 0; k--) {
      if (Math.hypot(pLast.x - points[k].x, pLast.y - points[k].y) > 0.5) {
        pPrev = points[k];
        break;
      }
    }

    const strokeW = conn.style.strokeWidth || 2;
    const halfArrow = 5 * Math.max(0.85, Math.min(2, strokeW / 2));

    if (conn.arrow) {
      const showTgt = this._isArrowVisible(conn.style.targetArrow);
      const dx = pLast.x - pPrev.x;
      const dy = pLast.y - pPrev.y;
      const rad = Math.hypot(dx, dy) > 0.1 ? Math.atan2(dy, dx) : 0;
      const deg = (rad * 180) / Math.PI;
      conn.arrow.set({
        left: pLast.x - Math.cos(rad) * halfArrow,
        top: pLast.y - Math.sin(rad) * halfArrow,
        angle: deg,
        visible: showTgt,
      });
      conn.arrow.setCoords();
    }

    if (conn.sourceArrowHead) {
      const showSrc = this._isArrowVisible(conn.style.sourceArrow);
      const p0 = points[0];
      let p1 = points[1];
      for (let k = 1; k < points.length; k++) {
        if (Math.hypot(points[k].x - p0.x, points[k].y - p0.y) > 0.5) {
          p1 = points[k];
          break;
        }
      }
      const dx = p0.x - p1.x;
      const dy = p0.y - p1.y;
      const rad = Math.hypot(dx, dy) > 0.1 ? Math.atan2(dy, dx) : Math.PI;
      const deg = (rad * 180) / Math.PI;
      conn.sourceArrowHead.set({
        left: p0.x - Math.cos(rad) * halfArrow,
        top: p0.y - Math.sin(rad) * halfArrow,
        angle: deg,
        visible: showSrc,
      });
      conn.sourceArrowHead.setCoords();
    }

    if (conn.labelObj) {
      let totalLen = 0;
      const segs = [];
      for (let i = 0; i < points.length - 1; i++) {
        const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
        segs.push({ a: points[i], b: points[i + 1], len });
        totalLen += len;
      }
      let mx = (points[0].x + pLast.x) / 2;
      let my = (points[0].y + pLast.y) / 2;
      let acc = 0;
      const half = totalLen / 2;
      for (const s of segs) {
        if (acc + s.len >= half && s.len > 0) {
          const t = (half - acc) / s.len;
          mx = s.a.x + (s.b.x - s.a.x) * t;
          my = s.a.y + (s.b.y - s.a.y) * t;
          break;
        }
        acc += s.len;
      }
      conn.labelObj.set({ left: mx, top: my });
      conn.labelObj.setCoords();
    }
  }

  setConnectorLabel(conn, labelText, textStyle = null) {
    if (!conn) return;
    const text = (labelText || '').trim();
    conn.label = text;
    if (textStyle) conn.textStyle = textStyle;

    if (!text) {
      if (conn.labelObj) {
        this.canvas.remove(conn.labelObj);
        conn.labelObj = null;
      }
      this.canvas.requestRenderAll();
      return;
    }

    const st = conn.textStyle || {};
    if (!conn.labelObj) {
      conn.labelObj = new fabric.IText(text, {
        fontFamily: st.fontFamily || 'Calibri',
        fontSize: st.fontSize || 11,
        fontWeight: st.fontWeight || 'normal',
        fontStyle: st.fontStyle || 'normal',
        fill: st.fill || '#1a1a1a',
        backgroundColor: 'rgba(255,255,255,0.88)',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        objectType: 'connector-label',
      });
      conn.labelObj.connectorData = conn;
      this.canvas.add(conn.labelObj);
    } else {
      conn.labelObj.set({ text });
    }
    this._updateConnectorArrowsAndLabel(conn, conn.line ? conn.line.points : []);
    this.canvas.bringObjectToFront(conn.labelObj);
    this.canvas.requestRenderAll();
  }

  /**
   * Recalculate connector route and update geometry with absolute coordinates.
   */
  updateConnector(conn) {
    if (!conn || !conn.line) return;
    if (!conn.sourceShape && !conn.sourcePoint) return;
    if (!conn.targetShape && !conn.targetPoint) return;

    const srcPort = this._resolveConnectorPort(conn, 'source');
    const tgtPort = this._resolveConnectorPort(conn, 'target');
    if (!srcPort || !tgtPort) return;

    let points;
    if (conn.style && conn.style.routingType === 'curved' && conn.preserveGeometry && conn.curveWaypoints && conn.curveWaypoints.length > 0) {
      points = this._evaluateSmoothCurve(srcPort, tgtPort, conn.curveWaypoints);
    } else if (conn.preserveGeometry && conn.line && conn.line.points && conn.line.points.length >= 2) {
      const orig = conn.line.points;
      const pts = orig.map(p => ({ x: p.x, y: p.y }));
      const isOrthoMode = !conn.style || conn.style.routingType === 'orthogonal';
      const firstLen = orig.length >= 2 ? Math.hypot(orig[1].x - orig[0].x, orig[1].y - orig[0].y) : 0;
      const firstH = firstLen > 0.5 && Math.abs(orig[1].y - orig[0].y) < 2 && Math.abs(orig[1].y - orig[0].y) <= Math.abs(orig[1].x - orig[0].x);
      const firstV = firstLen > 0.5 && Math.abs(orig[1].x - orig[0].x) < 2 && Math.abs(orig[1].x - orig[0].x) < Math.abs(orig[1].y - orig[0].y);
      const lastLen = orig.length >= 2 ? Math.hypot(orig[orig.length - 1].x - orig[orig.length - 2].x, orig[orig.length - 1].y - orig[orig.length - 2].y) : 0;
      const lastH = lastLen > 0.5 && Math.abs(orig[orig.length - 1].y - orig[orig.length - 2].y) < 2 && Math.abs(orig[orig.length - 1].y - orig[orig.length - 2].y) <= Math.abs(orig[orig.length - 1].x - orig[orig.length - 2].x);
      const lastV = lastLen > 0.5 && Math.abs(orig[orig.length - 1].x - orig[orig.length - 2].x) < 2 && Math.abs(orig[orig.length - 1].x - orig[orig.length - 2].x) < Math.abs(orig[orig.length - 1].y - orig[orig.length - 2].y);

      pts[0] = { x: srcPort.x, y: srcPort.y };
      pts[pts.length - 1] = { x: tgtPort.x, y: tgtPort.y };
      if (isOrthoMode && pts.length === 3 && ((firstH && lastV) || (firstV && lastH))) {
        if (firstH) {
          pts[1].y = pts[0].y;
          pts[1].x = pts[2].x;
        } else {
          pts[1].x = pts[0].x;
          pts[1].y = pts[2].y;
        }
      } else if (isOrthoMode && pts.length >= 4) {
        if (firstH) pts[1].y = pts[0].y;
        else if (firstV) pts[1].x = pts[0].x;
        const n = pts.length;
        if (lastH) pts[n - 2].y = pts[n - 1].y;
        else if (lastV) pts[n - 2].x = pts[n - 1].x;
      }
      points = pts;
    } else if (conn.style.routingType === 'straight') {
      points = [{ x: srcPort.x, y: srcPort.y }, { x: tgtPort.x, y: tgtPort.y }];
    } else if (conn.style.routingType === 'curved') {
      points = this._calculateCurvedPoints(srcPort, tgtPort);
    } else {
      points = this._calculateOrthogonalPoints(srcPort, tgtPort);
    }

    this._refreshPolyline(conn.line, points);
    conn.line._lastLeft = conn.line.left;
    conn.line._lastTop = conn.line.top;
    this._updateConnectorArrowsAndLabel(conn, points);
    this.canvas.requestRenderAll();
  }

  _calculateCurvedPoints(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const handleLen = Math.max(30, Math.min(140, dist * 0.42));
    const n1 = p1.normal && (p1.normal.x || p1.normal.y) ? p1.normal : (Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 });
    const n2 = p2.normal && (p2.normal.x || p2.normal.y) ? p2.normal : { x: -n1.x, y: -n1.y };
    const cp1 = { x: p1.x + n1.x * handleLen, y: p1.y + n1.y * handleLen };
    const cp2 = { x: p2.x + n2.x * handleLen, y: p2.y + n2.y * handleLen };
    const steps = 24;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push({
        x: u * u * u * p1.x + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t * t * t * p2.x,
        y: u * u * u * p1.y + 3 * u * u * t * cp1.y + 3 * u * t * t * cp2.y + t * t * t * p2.y,
      });
    }
    return pts;
  }

  /**
   * Evaluate a C1/C-inf smooth spline passing exactly through user curve waypoints [p0, ...waypoints, p1].
   */
  _evaluateSmoothCurve(p0, p1, waypoints) {
    const wps = (waypoints || []).filter(Boolean);
    if (wps.length === 0) return this._calculateCurvedPoints(p0, p1);

    if (wps.length === 1) {
      const w = wps[0];
      const cp = {
        x: 2 * w.x - 0.5 * (p0.x + p1.x),
        y: 2 * w.y - 0.5 * (p0.y + p1.y),
      };
      const steps = 28;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        pts.push({
          x: u * u * p0.x + 2 * u * t * cp.x + t * t * p1.x,
          y: u * u * p0.y + 2 * u * t * cp.y + t * t * p1.y,
        });
      }
      return pts;
    }

    // Centripetal Catmull-Rom spline for 2+ waypoints
    const knots = [
      { x: 2 * p0.x - wps[0].x, y: 2 * p0.y - wps[0].y },
      { x: p0.x, y: p0.y },
      ...wps.map(w => ({ x: w.x, y: w.y })),
      { x: p1.x, y: p1.y },
      { x: 2 * p1.x - wps[wps.length - 1].x, y: 2 * p1.y - wps[wps.length - 1].y },
    ];
    const pts = [];
    const perSeg = 12;
    for (let s = 1; s < knots.length - 2; s++) {
      const k0 = knots[s - 1], k1 = knots[s], k2 = knots[s + 1], k3 = knots[s + 2];
      const t0 = 0;
      const t1 = t0 + Math.pow(Math.max(1e-3, Math.hypot(k1.x - k0.x, k1.y - k0.y)), 0.5);
      const t2 = t1 + Math.pow(Math.max(1e-3, Math.hypot(k2.x - k1.x, k2.y - k1.y)), 0.5);
      const t3 = t2 + Math.pow(Math.max(1e-3, Math.hypot(k3.x - k2.x, k3.y - k2.y)), 0.5);
      for (let i = 0; i < perSeg; i++) {
        const t = t1 + ((t2 - t1) * i) / perSeg;
        const interp = (a, b, ta, tb) => {
          const d = Math.max(1e-5, tb - ta);
          return { x: ((tb - t) / d) * a.x + ((t - ta) / d) * b.x, y: ((tb - t) / d) * a.y + ((t - ta) / d) * b.y };
        };
        const A1 = interp(k0, k1, t0, t1);
        const A2 = interp(k1, k2, t1, t2);
        const A3 = interp(k2, k3, t2, t3);
        const B1 = interp(A1, A2, t0, t2);
        const B2 = interp(A2, A3, t1, t3);
        pts.push(interp(B1, B2, t1, t2));
      }
    }
    pts.push({ x: p1.x, y: p1.y });
    return pts;
  }

  _getLivePolylineWorldPoints(conn) {
    const line = conn && conn.line;
    if (!line || !line.points || line.points.length < 2) return null;
    const mat = this._getSceneMatrix(line);
    if (!mat || typeof fabric === 'undefined' || !fabric.util || !fabric.util.transformPoint) {
      return line.points.map(p => ({ x: p.x, y: p.y }));
    }
    const ox = line.pathOffset ? line.pathOffset.x : 0;
    const oy = line.pathOffset ? line.pathOffset.y : 0;
    return line.points.map(p => {
      const wp = fabric.util.transformPoint({ x: p.x - ox, y: p.y - oy }, mat);
      return { x: wp.x, y: wp.y };
    });
  }

  _syncConnectorFromTransformedLine(conn, finalize = false) {
    if (!conn || !conn.line) return;
    const livePts = this._getLivePolylineWorldPoints(conn);
    if (!livePts || livePts.length < 2) return;

    this._updateConnectorArrowsAndLabel(conn, livePts);
    if (this.selectedConnector === conn && this.endpointHandles.length >= 2) {
      this._updateEndpointHandlePositions();
    }

    if (finalize && !conn.line.group) {
      const raw = conn.line.points || [];
      const shifted = raw.length === livePts.length && raw.some((p, idx) =>
        Math.hypot(p.x - livePts[idx].x, p.y - livePts[idx].y) > 0.05
      );
      if (shifted) {
        const dx = livePts[0].x - (raw[0] ? raw[0].x : livePts[0].x);
        const dy = livePts[0].y - (raw[0] ? raw[0].y : livePts[0].y);
        if (conn.curveWaypoints && conn.curveWaypoints.length > 0) {
          conn.curveWaypoints = conn.curveWaypoints.map(w => ({ x: w.x + dx, y: w.y + dy }));
        }
        if (conn.sourceShape) {
          const sp = this._resolveConnectorPort(conn, 'source');
          if (!sp || Math.hypot(sp.x - livePts[0].x, sp.y - livePts[0].y) > 2) {
            conn.sourceShape = null; conn.sourcePortId = null; conn.sourcePinSpec = null;
          }
        }
        if (conn.targetShape) {
          const tp = this._resolveConnectorPort(conn, 'target');
          if (!tp || Math.hypot(tp.x - livePts[livePts.length - 1].x, tp.y - livePts[livePts.length - 1].y) > 2) {
            conn.targetShape = null; conn.targetPortId = null; conn.targetPinSpec = null;
          }
        }
        if (!conn.sourceShape) conn.sourcePoint = { x: livePts[0].x, y: livePts[0].y };
        if (!conn.targetShape) conn.targetPoint = { x: livePts[livePts.length - 1].x, y: livePts[livePts.length - 1].y };
        conn.preserveGeometry = true;
        conn.line.set({ scaleX: 1, scaleY: 1, angle: 0 });
        this._refreshPolyline(conn.line, livePts);
        conn.line._lastLeft = conn.line.left;
        conn.line._lastTop = conn.line.top;
        this._updateConnectorArrowsAndLabel(conn, livePts);
      }
    }
  }

  /**
   * 90-degree orthogonal path calculation algorithm.
   */
  _calculateOrthogonalPoints(p1, p2) {
    const points = [{ x: p1.x, y: p1.y }];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    const normal1 = p1.normal || (Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
    const normal2 = p2.normal || { x: -normal1.x, y: -normal1.y };

    const offset = 20;

    // Point 1 stub
    const stub1 = {
      x: p1.x + (normal1.x || 0) * offset,
      y: p1.y + (normal1.y || 0) * offset,
    };
    points.push(stub1);

    // Point 2 stub
    const stub2 = {
      x: p2.x + (normal2.x || 0) * offset,
      y: p2.y + (normal2.y || 0) * offset,
    };

    // Intermediate orthogonal route
    if (normal1.x !== 0) {
      const midX = (stub1.x + stub2.x) / 2;
      points.push({ x: midX, y: stub1.y });
      points.push({ x: midX, y: stub2.y });
    } else {
      const midY = (stub1.y + stub2.y) / 2;
      points.push({ x: stub1.x, y: midY });
      points.push({ x: stub2.x, y: midY });
    }

    points.push(stub2);
    points.push({ x: p2.x, y: p2.y });

    return this._simplifyPoints(points);
  }

  _simplifyPoints(points) {
    if (!points || points.length <= 2) return points;
    const deduped = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = deduped[deduped.length - 1];
      if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) >= 0.5) {
        deduped.push(points[i]);
      }
    }
    if (deduped.length <= 2) return deduped;

    const result = [deduped[0]];
    for (let i = 1; i < deduped.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = deduped[i];
      const next = deduped[i + 1];

      const isHorizontal = (Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1);
      const isVertical = (Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1);

      if (!isHorizontal && !isVertical) {
        result.push(curr);
      }
    }
    result.push(deduped[deduped.length - 1]);
    return result;
  }

  _onConnectorMoving(target) {
    const conn = target.connectorData || target;
    if (!conn) return;

    const livePts = this._getLivePolylineWorldPoints(conn);
    const curLeft = target.left;
    const curTop = target.top;
    const refPts = conn.line && conn.line.points ? conn.line.points : [];
    const baseDx = (livePts && refPts[0]) ? (livePts[0].x - refPts[0].x) : 0;
    const baseDy = (livePts && refPts[0]) ? (livePts[0].y - refPts[0].y) : 0;
    const dx = target._lastLeft !== undefined ? (curLeft - target._lastLeft) : baseDx;
    const dy = target._lastTop !== undefined ? (curTop - target._lastTop) : baseDy;

    if (dx !== 0 || dy !== 0) {
      if (!this._draggingConnectorBody || this._draggingConnectorBody.conn !== conn) {
        const curPts = refPts.map(p => ({ x: p.x, y: p.y }));
        this._draggingConnectorBody = {
          conn,
          totalDx: 0,
          totalDy: 0,
          beforePoints: curPts,
          beforeSourceShape: conn.sourceShape,
          beforeSourcePortId: conn.sourcePortId,
          beforeSourcePinSpec: conn.sourcePinSpec ? { ...conn.sourcePinSpec } : null,
          beforeSourcePoint: conn.sourcePoint ? { ...conn.sourcePoint } : null,
          beforeTargetShape: conn.targetShape,
          beforeTargetPortId: conn.targetPortId,
          beforeTargetPinSpec: conn.targetPinSpec ? { ...conn.targetPinSpec } : null,
          beforeTargetPoint: conn.targetPoint ? { ...conn.targetPoint } : null,
          beforePreserveGeometry: !!conn.preserveGeometry,
        };
        // Detach glue cleanly when dragging a glued connector body (Visio behavior)
        if (conn.sourceShape || conn.targetShape) {
          const p0 = curPts[0];
          const pLast = curPts[curPts.length - 1];
          conn.sourceShape = null;
          conn.sourcePortId = null;
          conn.sourcePinSpec = null;
          if (!conn.sourcePoint && p0) conn.sourcePoint = { x: p0.x, y: p0.y };
          conn.targetShape = null;
          conn.targetPortId = null;
          conn.targetPinSpec = null;
          if (!conn.targetPoint && pLast) conn.targetPoint = { x: pLast.x, y: pLast.y };
          conn.preserveGeometry = true;
          if (this.selectedConnector === conn && this.endpointHandles.length >= 2) {
            this.endpointHandles[0].set({ fill: '#ffffff' });
            this.endpointHandles[1].set({ fill: '#ffffff' });
          }
        }
      }
      this._draggingConnectorBody.totalDx += dx;
      this._draggingConnectorBody.totalDy += dy;

      if (this.selectedConnector === conn && this.endpointHandles.length > 0) {
        this.endpointHandles.forEach((h) => {
          h.set({ left: h.left + dx, top: h.top + dy });
          h.setCoords();
        });
      }
    }

    if (livePts) {
      this._updateConnectorArrowsAndLabel(conn, livePts);
    }
    target._lastLeft = curLeft;
    target._lastTop = curTop;
  }

  /**
   * Update visual/routing style of an existing connector cleanly with Undo support.
   */
  updateConnectorStyle(conn, stylePatch, skipUndo = false) {
    if (!conn || !stylePatch) return;
    const wasSelected = this.canvas.getActiveObject() === conn.line || this.selectedConnector === conn;
    const beforeSnap = {
      style: { ...conn.style },
      preserveGeometry: !!conn.preserveGeometry,
      points: conn.line && conn.line.points ? conn.line.points.map(p => ({ x: p.x, y: p.y })) : null,
    };

    const nextStyle = { ...conn.style, ...stylePatch };
    const nextPreserve = stylePatch.routingType ? false : !!conn.preserveGeometry;

    const applyStyleState = (st, preserve, pts) => {
      conn.style = { ...st };
      conn.preserveGeometry = preserve;
      if (st.routingType && st.routingType !== 'curved') {
        conn.curveWaypoints = null;
      }
      const seed = pts ? pts.map(p => ({ x: p.x, y: p.y })) : null;
      this._buildConnectorVisuals(conn, preserve && seed ? seed : null);
      if (!preserve || !seed) {
        this.updateConnector(conn);
      }
      if (wasSelected && conn.line) {
        this.canvas.setActiveObject(conn.line);
        this._showEndpointHandles(conn, { preserveDragState: true });
      }
      this.canvas.requestRenderAll();
    };

    applyStyleState(nextStyle, nextPreserve, beforeSnap.points);

    if (!skipUndo && window.undoManager) {
      const afterPts = conn.line && conn.line.points ? conn.line.points.map(p => ({ x: p.x, y: p.y })) : null;
      window.undoManager.record({
        name: 'Change Connector Style',
        execute: () => applyStyleState(nextStyle, nextPreserve, afterPts),
        undo: () => applyStyleState(beforeSnap.style, beforeSnap.preserveGeometry, beforeSnap.points),
      });
    }
  }

  _placeConnectorInZOrder(conn) {
    if (!conn || !this.canvas) return;
    const objs = this.canvas.getObjects();
    const parts = [conn.line, conn.arrow, conn.sourceArrowHead, conn.labelObj].filter(Boolean);
    if (parts.length === 0) return;
    const partSet = new Set(parts);
    let baseIdx = 0;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (partSet.has(o)) continue;
      if (
        o.objectType === 'grid-line' ||
        o.objectType === 'page-background' ||
        o.objectType === 'container' ||
        o.isContainer ||
        (o.shapeData && o.shapeData.isContainer)
      ) {
        baseIdx = i + 1;
      }
    }
    let targetIdx = 0;
    for (let i = 0; i < baseIdx; i++) {
      if (!partSet.has(objs[i])) targetIdx++;
    }
    parts.forEach((p, idx) => {
      this.canvas.moveObjectTo(p, targetIdx + idx);
    });
    this._keepGridAtBack();
  }

  /**
   * Called whenever any shape is transformed.
   */
  _onShapeTransform(target) {
    if (!target) return;
    if ((target.type === 'activeselection' || target.type === 'activeSelection') && typeof target.getObjects === 'function') {
      const objs = new Set(target.getObjects());
      objs.forEach((m) => {
        if (m && (m.objectType === 'connector' || m.connectorData)) {
          this._syncConnectorFromTransformedLine(m.connectorData || m, false);
        }
      });
      const attached = this.connectors.filter(
        c => objs.has(c.sourceShape) || objs.has(c.targetShape)
      );
      attached.forEach(conn => this.updateConnector(conn));
      return;
    }
    if (target.objectType === 'connector' || target.connectorData) {
      this._syncConnectorFromTransformedLine(target.connectorData || target, true);
      return;
    }
    const attached = this.connectors.filter(
      c => c.sourceShape === target || c.targetShape === target
    );
    attached.forEach(conn => this.updateConnector(conn));
  }

  updateAllConnectors() {
    this.connectors.forEach(conn => this.updateConnector(conn));
  }

  removeConnector(conn) {
    if (conn.line) this.canvas.remove(conn.line);
    if (conn.arrow) this.canvas.remove(conn.arrow);
    if (conn.sourceArrowHead) this.canvas.remove(conn.sourceArrowHead);
    if (conn.labelObj) this.canvas.remove(conn.labelObj);
    const idx = this.connectors.indexOf(conn);
    if (idx !== -1) {
      this.connectors.splice(idx, 1);
    }
    this._hideEndpointHandles();
    this.canvas.requestRenderAll();
  }

  _keepGridAtBack() {
    this.canvas.getObjects().forEach((obj) => {
      if (obj.objectType === 'grid-line' || obj.objectType === 'page-background') {
        this.canvas.sendObjectToBack(obj);
      }
    });
  }
}

window.ConnectorManager = ConnectorManager;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConnectorManager;
}
