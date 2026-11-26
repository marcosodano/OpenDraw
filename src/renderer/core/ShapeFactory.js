/**
 * ShapeFactory — Generates vector shapes for OpenDraw with Visio fidelity.
 * 
 * Supports:
 * - Basic shapes (Rectangle, Ellipse, Triangle, Diamond, Rounded Rect, Pentagon, Hexagon, Star, Cylinder)
 * - Flowchart shapes (Terminator, Process, Decision, Data, Document, Sub-process, Manual Input, Preparation, Connector)
 * - UML shapes (Class, Interface, Actor, Use Case, Package, Note)
 * - Arrows & Callouts (Block arrows, Callouts, Braces)
 * 
 * Each shape is built with connection points, custom metadata, and centered label text.
 */

class ShapeFactory {
  /**
   * Default theme palette (Visio Office Theme)
   */
  static THEME = {
    primary: { fill: '#D9E1F2', stroke: '#41719C', text: '#1F3864' },
    flowchart: {
      process: { fill: '#4472C4', stroke: '#2F528F', text: '#FFFFFF' },
      terminator: { fill: '#70AD47', stroke: '#507E32', text: '#FFFFFF' },
      decision: { fill: '#FFC000', stroke: '#BF8F00', text: '#FFFFFF' },
      data: { fill: '#5B9BD5', stroke: '#2F7DC4', text: '#FFFFFF' },
      document: { fill: '#ED7D31', stroke: '#C65911', text: '#FFFFFF' },
      subprocess: { fill: '#4472C4', stroke: '#2F528F', text: '#FFFFFF' },
      manualInput: { fill: '#9DC3E6', stroke: '#2F7DC4', text: '#FFFFFF' },
      preparation: { fill: '#A9D18E', stroke: '#507E32', text: '#FFFFFF' },
      connector: { fill: '#4472C4', stroke: '#2F528F', text: '#FFFFFF' },
    },
    uml: {
      class: { fill: '#FFFFCC', stroke: '#B2B200', text: '#333333' },
      interface: { fill: '#E2EFDA', stroke: '#507E32', text: '#20371A' },
      usecase: { fill: '#E6EEF8', stroke: '#41719C', text: '#1F3864' },
      package: { fill: '#F2DCDB', stroke: '#963634', text: '#591C1B' },
      note: { fill: '#FFF2CC', stroke: '#D56B00', text: '#333333' },
    }
  };

  /**
   * Create a diagram shape by type.
   * @param {string} shapeType
   * @param {number} x - Center X on canvas
   * @param {number} y - Center Y on canvas
   * @param {Object} [customOptions={}]
   * @returns {fabric.Group}
   */
  static create(shapeType, x, y, customOptions = {}) {
    const builder = ShapeFactory._builders[shapeType] || ShapeFactory._builders['rectangle'];
    const shape = builder(x, y, customOptions);

    // Common shape properties
    shape.set({
      cornerStyle: 'circle',
      cornerColor: '#0078d4',
      cornerStrokeColor: '#ffffff',
      cornerSize: 8,
      transparentCorners: false,
      borderColor: '#0078d4',
      borderScaleFactor: 1.5,
      padding: 2,
      subTargetCheck: false,
    });

    shape.objectType = shape.objectType || shapeType;
    if (!shape.shapeData) {
      shape.shapeData = {
        name: shapeType,
        id: 'shape_' + Math.random().toString(36).substr(2, 9),
        properties: {},
      };
    }

    return shape;
  }

  static _getContrastingTextColor(color) {
    if (!color || color === 'transparent') return '#ffffff';
    if (typeof color === 'string' && color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substr(0, 2), 16) || 0;
      const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substr(2, 2), 16) || 0;
      const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substr(4, 2), 16) || 0;
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 155) ? '#1f3864' : '#ffffff';
    }
    return '#ffffff';
  }

  /**
   * Helper to build a standard group with geometry + centered label
   */
  static _createComposite(geometry, textStr, x, y, width, height, shapeType, connPoints, customProps = {}) {
    const isDevice = customProps.labelPosition
      ? customProps.labelPosition === 'bottom'
      : shapeType.startsWith('net-');

    const fill = geometry.fill || customProps.fill || ShapeFactory.THEME.primary.fill;
    const defaultTextColor = customProps.textColor || (isDevice ? '#262626' : ShapeFactory._getContrastingTextColor(fill));
    const textTop = isDevice ? (height / 2 + 10) : 0;
    const totalHeight = isDevice ? (height + 24) : height;

    const text = new fabric.IText(textStr || '', {
      fontSize: isDevice ? 11 : 12,
      fontWeight: isDevice ? 'bold' : 'normal',
      fontFamily: 'Segoe UI, Calibri, sans-serif',
      fill: defaultTextColor,
      textAlign: 'center',
      originX: 'center',
      originY: isDevice ? 'top' : 'center',
      left: 0,
      top: textTop,
      selectable: false,
      evented: false,
    });

    geometry.set({
      originX: 'center',
      originY: 'center',
      left: 0,
      top: isDevice ? -10 : 0,
    });

    const group = new fabric.Group([geometry, text], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      width: width,
      height: totalHeight,
    });

    group.labelObject = text;
    group.geometryObject = geometry;
    group.shapeType = shapeType;
    group.connectionPoints = connPoints || [
      { id: 'top', x: 0.5, y: 0 },
      { id: 'right', x: 1, y: 0.5 },
      { id: 'bottom', x: 0.5, y: 1 },
      { id: 'left', x: 0, y: 0.5 },
    ];

    group.shapeData = {
      name: textStr || shapeType,
      id: 'shape_' + Math.random().toString(36).substr(2, 9),
      type: shapeType,
      properties: customProps.properties || {},
    };

    return group;
  }

  // ==========================================
  // SHAPE BUILDERS REGISTRY
  // ==========================================

  static _builders = {
    // ----------------------------------------
    // BASIC SHAPES
    // ----------------------------------------
    'rectangle': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 80;
      const rect = new fabric.Rect({
        width: w,
        height: h,
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
        rx: 0,
        ry: 0,
      });
      return ShapeFactory._createComposite(rect, opts.text || '', x, y, w, h, 'rectangle', null, opts);
    },

    'square': (x, y, opts) => {
      const s = opts.width || 80;
      const rect = new fabric.Rect({
        width: s,
        height: s,
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(rect, opts.text || '', x, y, s, s, 'square', null, opts);
    },

    'circle': (x, y, opts) => {
      const r = (opts.width || 80) / 2;
      const circle = new fabric.Circle({
        radius: r,
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(circle, opts.text || '', x, y, r * 2, r * 2, 'circle', null, opts);
    },

    'right-triangle': (x, y, opts) => {
      const w = opts.width || 100;
      const h = opts.height || 80;
      const points = [
        { x: -w / 2, y: h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: -h / 2 },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'right-triangle', null, opts);
    },

    'cross': (x, y, opts) => {
      const s = opts.width || 80;
      const u = s / 3;
      const hw = s / 2;
      const hh = s / 2;
      const points = [
        { x: -u / 2, y: -hh }, { x: u / 2, y: -hh },
        { x: u / 2, y: -u / 2 }, { x: hw, y: -u / 2 },
        { x: hw, y: u / 2 }, { x: u / 2, y: u / 2 },
        { x: u / 2, y: hh }, { x: -u / 2, y: hh },
        { x: -u / 2, y: u / 2 }, { x: -hw, y: u / 2 },
        { x: -hw, y: -u / 2 }, { x: -u / 2, y: -u / 2 }
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, s, s, 'cross', null, opts);
    },

    'rounded-rect': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 80;
      const rect = new fabric.Rect({
        width: w,
        height: h,
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
        rx: 10,
        ry: 10,
      });
      return ShapeFactory._createComposite(rect, opts.text || '', x, y, w, h, 'rounded-rect', null, opts);
    },

    'ellipse': (x, y, opts) => {
      const rx = (opts.width || 120) / 2;
      const ry = (opts.height || 80) / 2;
      const ellipse = new fabric.Ellipse({
        rx: rx,
        ry: ry,
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(ellipse, opts.text || '', x, y, rx * 2, ry * 2, 'ellipse', null, opts);
    },

    'triangle': (x, y, opts) => {
      const w = opts.width || 110;
      const h = opts.height || 90;
      const tri = new fabric.Triangle({
        width: w,
        height: h,
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      const comp = ShapeFactory._createComposite(tri, opts.text || '', x, y, w, h, 'triangle', [
        { id: 'top', x: 0.5, y: 0 },
        { id: 'bottom-left', x: 0.1, y: 1 },
        { id: 'bottom-right', x: 0.9, y: 1 },
      ], opts);
      // Slight vertical text offset for triangle visual center
      if (comp.labelObject) {
        comp.labelObject.set('top', 12);
        if (comp.triggerLayout) comp.triggerLayout();
        comp.dirty = true;
        comp.setCoords();
      }
      return comp;
    },

    'diamond': (x, y, opts) => {
      const w = opts.width || 110;
      const h = opts.height || 100;
      const hw = w / 2;
      const hh = h / 2;
      const points = [
        { x: 0, y: -hh },
        { x: hw, y: 0 },
        { x: 0, y: hh },
        { x: -hw, y: 0 },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'diamond', null, {
        textColor: ShapeFactory.THEME.primary.text,
        ...opts
      });
    },

    'pentagon': (x, y, opts) => {
      const r = 50;
      const points = [];
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
        points.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, 100, 100, 'pentagon', null, opts);
    },

    'hexagon': (x, y, opts) => {
      const r = 50;
      const points = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * 2 * Math.PI / 6);
        points.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, 100, 100, 'hexagon', null, opts);
    },

    'star': (x, y, opts) => {
      const spikes = 5;
      const outerR = 50;
      const innerR = 25;
      const points = [];
      let rot = Math.PI / 2 * 3;
      const step = Math.PI / spikes;
      const connPoints = [];

      for (let i = 0; i < spikes; i++) {
        const cosOut = Math.cos(rot);
        const sinOut = Math.sin(rot);
        points.push({ x: cosOut * outerR, y: sinOut * outerR });
        connPoints.push({
          id: `point_${i + 1}`,
          x: 0.5 + 0.5 * cosOut,
          y: 0.5 + 0.5 * sinOut,
          normal: { x: cosOut, y: sinOut },
        });

        rot += step;
        const cosIn = Math.cos(rot);
        const sinIn = Math.sin(rot);
        points.push({ x: cosIn * innerR, y: sinIn * innerR });
        connPoints.push({
          id: `valley_${i + 1}`,
          x: 0.5 + 0.25 * cosIn,
          y: 0.5 + 0.25 * sinIn,
          normal: { x: cosIn, y: sinIn },
        });
        rot += step;
      }

      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, 100, 100, 'star', connPoints, {
        textColor: ShapeFactory.THEME.primary.text,
        ...opts
      });
    },

    'cylinder': (x, y, opts) => {
      const w = opts.width || 90;
      const h = opts.height || 100;
      const hw = w / 2;
      const hh = h / 2;
      const ry = 14;

      const fill = opts.fill || ShapeFactory.THEME.primary.fill;
      const stroke = opts.stroke || ShapeFactory.THEME.primary.stroke;

      // Closed cylinder body: sides and bottom curved rim, capped at top
      const bodyData = `M ${-hw} ${-hh + ry} L ${-hw} ${hh - ry} A ${hw} ${ry} 0 0 0 ${hw} ${hh - ry} L ${hw} ${-hh + ry} Z`;
      const body = new fabric.Path(bodyData, {
        fill: fill,
        stroke: stroke,
        strokeWidth: 2,
        strokeLineJoin: 'round',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: ry / 2,
      });

      // Top circular cap: complete 360-degree ellipse with full fill and stroke
      const topCap = new fabric.Ellipse({
        rx: hw,
        ry: ry,
        fill: fill,
        stroke: stroke,
        strokeWidth: 2,
        strokeLineJoin: 'round',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: -hh + ry,
      });

      const geomGroup = new fabric.Group([body, topCap], {
        fill: fill,
        stroke: stroke,
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        width: w,
        height: h,
      });

      const connPoints = [
        { id: 'top', x: 0.5, y: 0, normal: { x: 0, y: -1 } },
        { id: 'bottom', x: 0.5, y: 1, normal: { x: 0, y: 1 } },
        { id: 'left', x: 0, y: 0.5, normal: { x: -1, y: 0 } },
        { id: 'right', x: 1, y: 0.5, normal: { x: 1, y: 0 } },
      ];
      return ShapeFactory._createComposite(geomGroup, opts.text || '', x, y, w, h, 'cylinder', connPoints, opts);
    },

    'rotated-triangle': (x, y, opts) => {
      const w = opts.width || 110;
      const h = opts.height || 90;
      const hw = w / 2;
      const hh = h / 2;
      const points = [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: 0, y: hh },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'rotated-triangle', null, opts);
    },

    'heptagon': (x, y, opts) => {
      const r = (opts.width || 100) / 2;
      const points = [];
      for (let i = 0; i < 7; i++) {
        const a = (i * 2 * Math.PI / 7) - Math.PI / 2;
        points.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, r * 2, r * 2, 'heptagon', null, opts);
    },

    'octagon': (x, y, opts) => {
      const r = (opts.width || 100) / 2;
      const points = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * 2 * Math.PI / 8) - Math.PI / 8;
        points.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, r * 2, r * 2, 'octagon', null, opts);
    },

    'decagon': (x, y, opts) => {
      const r = (opts.width || 100) / 2;
      const points = [];
      for (let i = 0; i < 10; i++) {
        const a = (i * 2 * Math.PI / 10) - Math.PI / 2;
        points.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, r * 2, r * 2, 'decagon', null, opts);
    },

    'parallelogram': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 75;
      const hw = w / 2;
      const hh = h / 2;
      const slant = 18;
      const points = [
        { x: -hw + slant, y: -hh },
        { x: hw, y: -hh },
        { x: hw - slant, y: hh },
        { x: -hw, y: hh },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'parallelogram', null, opts);
    },

    'trapezoid': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 75;
      const hw = w / 2;
      const hh = h / 2;
      const inset = 22;
      const points = [
        { x: -hw + inset, y: -hh },
        { x: hw - inset, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'trapezoid', null, opts);
    },

    'chevron': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 70;
      const hw = w / 2;
      const hh = h / 2;
      const indent = 20;
      const points = [
        { x: -hw, y: -hh },
        { x: hw - indent, y: -hh },
        { x: hw, y: 0 },
        { x: hw - indent, y: hh },
        { x: -hw, y: hh },
        { x: -hw + indent, y: 0 },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'chevron', null, opts);
    },

    'cube': (x, y, opts) => {
      const w = opts.width || 90;
      const h = opts.height || 90;
      const dx = Math.round(w * 0.22);
      const dy = Math.round(h * 0.22);
      const x0 = -w / 2;
      const x1 = w / 2 - dx;
      const x2 = -w / 2 + dx;
      const x3 = w / 2;
      const y0 = -h / 2;
      const y1 = -h / 2 + dy;
      const y2 = h / 2 - dy;
      const y3 = h / 2;

      // Outer boundary + 3 interior visible edges forming authentic 3D oblique cube
      const pathData = `
        M ${x0} ${y1}
        L ${x2} ${y0}
        L ${x3} ${y0}
        L ${x3} ${y2}
        L ${x1} ${y3}
        L ${x0} ${y3}
        Z
        M ${x0} ${y1} L ${x1} ${y1} L ${x1} ${y3}
        M ${x1} ${y1} L ${x3} ${y0}
      `;
      const connPoints = [
        { id: 'top', x: 0.5, y: 0, normal: { x: 0, y: -1 } },
        { id: 'bottom', x: (x0 + x1) / 2 / w + 0.5, y: 1, normal: { x: 0, y: 1 } },
        { id: 'left', x: 0, y: (y1 + y3) / 2 / h + 0.5, normal: { x: -1, y: 0 } },
        { id: 'right', x: 1, y: (y0 + y2) / 2 / h + 0.5, normal: { x: 1, y: 0 } },
        { id: 'front_center', x: (x0 + x1) / 2 / w + 0.5, y: (y1 + y3) / 2 / h + 0.5, normal: { x: 0, y: 0 } }
      ];
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
        strokeLineJoin: 'round',
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, w, h, 'cube', connPoints, opts);
    },

    'drop': (x, y, opts) => {
      const w = opts.width || 80;
      const h = opts.height || 100;
      const hw = w / 2;
      const hh = h / 2;
      const pathData = `
        M 0 ${-hh}
        C ${hw} ${-hh * 0.2} ${hw} ${hh} 0 ${hh}
        C ${-hw} ${hh} ${-hw} ${-hh * 0.2} 0 ${-hh}
        Z
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, w, h, 'drop', null, opts);
    },

    'semi-circle': (x, y, opts) => {
      const r = (opts.width || 100) / 2;
      const pathData = `M ${-r} ${r / 2} A ${r} ${r} 0 0 1 ${r} ${r / 2} Z`;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, r * 2, r, 'semi-circle', null, opts);
    },

    'semi-ellipse': (x, y, opts) => {
      const rx = (opts.width || 120) / 2;
      const ry = (opts.height || 70);
      const pathData = `M ${-rx} ${ry / 2} A ${rx} ${ry} 0 0 1 ${rx} ${ry / 2} Z`;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, rx * 2, ry, 'semi-ellipse', null, opts);
    },

    'cone': (x, y, opts) => {
      const w = opts.width || 90;
      const h = opts.height || 100;
      const hw = w / 2;
      const hh = h / 2;
      const ry = 14;
      const pathData = `
        M 0 ${-hh}
        L ${hw} ${hh - ry}
        A ${hw} ${ry} 0 0 1 ${-hw} ${hh - ry}
        Z
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, w, h, 'cone', null, opts);
    },

    'pyramid': (x, y, opts) => {
      const w = opts.width || 110;
      const h = opts.height || 95;
      const hw = w / 2;
      const hh = h / 2;
      const pathData = `
        M 0 ${-hh}
        L ${hw} ${hh}
        L ${-hw} ${hh}
        Z
        M 0 ${-hh}
        L 0 ${hh}
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, w, h, 'pyramid', null, opts);
    },

    'gear': (x, y, opts) => {
      const r = (opts.width || 100) / 2;
      const teeth = 8;
      const outerR = r;
      const innerR = r * 0.72;
      const holeR = r * 0.32;
      const connPoints = [];

      const cycle = (Math.PI * 2) / teeth;
      const pathCommands = [];

      for (let i = 0; i < teeth; i++) {
        const base = i * cycle - Math.PI / 2;
        // Involute/trapezoidal tooth profile:
        // a0 -> a1: flat tooth tip
        // a1 -> a2: falling flank to root radius
        // a2 -> a3: flat root valley
        // a3 -> a4: rising flank to next tooth tip
        const a0 = base;
        const a1 = base + cycle * 0.32;
        const a2 = base + cycle * 0.50;
        const a3 = base + cycle * 0.82;

        const p0x = Math.cos(a0) * outerR;
        const p0y = Math.sin(a0) * outerR;
        const p1x = Math.cos(a1) * outerR;
        const p1y = Math.sin(a1) * outerR;
        const p2x = Math.cos(a2) * innerR;
        const p2y = Math.sin(a2) * innerR;
        const p3x = Math.cos(a3) * innerR;
        const p3y = Math.sin(a3) * innerR;

        if (i === 0) {
          pathCommands.push(`M ${p0x.toFixed(2)} ${p0y.toFixed(2)}`);
        } else {
          pathCommands.push(`L ${p0x.toFixed(2)} ${p0y.toFixed(2)}`);
        }
        pathCommands.push(`L ${p1x.toFixed(2)} ${p1y.toFixed(2)}`);
        pathCommands.push(`L ${p2x.toFixed(2)} ${p2y.toFixed(2)}`);
        pathCommands.push(`L ${p3x.toFixed(2)} ${p3y.toFixed(2)}`);

        // Port on each tooth tip
        const midA = (a0 + a1) / 2;
        connPoints.push({
          id: `tooth_${i + 1}`,
          x: 0.5 + 0.5 * Math.cos(midA),
          y: 0.5 + 0.5 * Math.sin(midA),
          normal: { x: Math.cos(midA), y: Math.sin(midA) }
        });
      }
      pathCommands.push('Z');

      // Central circular axle hole
      pathCommands.push(`M ${-holeR.toFixed(2)} 0`);
      pathCommands.push(`A ${holeR.toFixed(2)} ${holeR.toFixed(2)} 0 1 0 ${holeR.toFixed(2)} 0`);
      pathCommands.push(`A ${holeR.toFixed(2)} ${holeR.toFixed(2)} 0 1 0 ${-holeR.toFixed(2)} 0`);
      pathCommands.push('Z');

      const pathData = pathCommands.join(' ');
      const gearPath = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
        fillRule: 'evenodd',
        strokeLineJoin: 'round',
      });

      return ShapeFactory._createComposite(gearPath, opts.text || '', x, y, r * 2, r * 2, 'gear', connPoints, opts);
    },

    'star-4': (x, y, opts) => {
      const outerR = (opts.width || 100) / 2;
      const innerR = outerR * 0.4;
      const points = [];
      const connPoints = [];
      const spikes = 4;
      const step = Math.PI / spikes;
      let rot = -Math.PI / 2;
      for (let i = 0; i < spikes; i++) {
        const cosOut = Math.cos(rot);
        const sinOut = Math.sin(rot);
        points.push({ x: cosOut * outerR, y: sinOut * outerR });
        connPoints.push({
          id: `point_${i + 1}`,
          x: 0.5 + 0.5 * cosOut,
          y: 0.5 + 0.5 * sinOut,
          normal: { x: cosOut, y: sinOut },
        });

        rot += step;
        points.push({ x: Math.cos(rot) * innerR, y: Math.sin(rot) * innerR });
        rot += step;
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, outerR * 2, outerR * 2, 'star-4', connPoints, opts);
    },

    'star-6': (x, y, opts) => {
      const outerR = (opts.width || 100) / 2;
      const innerR = outerR * 0.55;
      const points = [];
      const connPoints = [];
      const spikes = 6;
      const step = Math.PI / spikes;
      let rot = -Math.PI / 2;
      for (let i = 0; i < spikes; i++) {
        const cosOut = Math.cos(rot);
        const sinOut = Math.sin(rot);
        points.push({ x: cosOut * outerR, y: sinOut * outerR });
        connPoints.push({
          id: `point_${i + 1}`,
          x: 0.5 + 0.5 * cosOut,
          y: 0.5 + 0.5 * sinOut,
          normal: { x: cosOut, y: sinOut },
        });

        rot += step;
        points.push({ x: Math.cos(rot) * innerR, y: Math.sin(rot) * innerR });
        rot += step;
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, outerR * 2, outerR * 2, 'star-6', connPoints, opts);
    },

    'star-8': (x, y, opts) => {
      const outerR = (opts.width || 100) / 2;
      const innerR = outerR * 0.50;
      const points = [];
      const connPoints = [];
      const spikes = 8;
      const step = Math.PI / spikes;
      let rot = -Math.PI / 2;
      for (let i = 0; i < spikes; i++) {
        const cosOut = Math.cos(rot);
        const sinOut = Math.sin(rot);
        points.push({ x: cosOut * outerR, y: sinOut * outerR });
        connPoints.push({
          id: `point_${i + 1}`,
          x: 0.5 + 0.5 * cosOut,
          y: 0.5 + 0.5 * sinOut,
          normal: { x: cosOut, y: sinOut },
        });

        rot += step;
        const cosIn = Math.cos(rot);
        const sinIn = Math.sin(rot);
        points.push({ x: cosIn * innerR, y: sinIn * innerR });
        connPoints.push({
          id: `valley_${i + 1}`,
          x: 0.5 + 0.5 * (innerR / outerR) * cosIn,
          y: 0.5 + 0.5 * (innerR / outerR) * sinIn,
          normal: { x: cosIn, y: sinIn },
        });
        rot += step;
      }
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
        strokeLineJoin: 'round',
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, outerR * 2, outerR * 2, 'star-8', connPoints, opts);
    },

    'donut': (x, y, opts) => {
      const r = (opts.width || 100) / 2;
      const hole = r * 0.5;
      const pathData = `
        M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z
        M ${-hole} 0 A ${hole} ${hole} 0 1 1 ${hole} 0 A ${hole} ${hole} 0 1 1 ${-hole} 0 Z
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
        fillRule: 'evenodd',
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, r * 2, r * 2, 'donut', null, opts);
    },

    'l-shape': (x, y, opts) => {
      const w = opts.width || 100;
      const h = opts.height || 100;
      const hw = w / 2;
      const hh = h / 2;
      const thickX = w * 0.4;
      const thickY = h * 0.4;
      const points = [
        { x: -hw, y: -hh },
        { x: -hw + thickX, y: -hh },
        { x: -hw + thickX, y: hh - thickY },
        { x: hw, y: hh - thickY },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'l-shape', null, opts);
    },

    // ----------------------------------------
    // FLOWCHART SHAPES
    // ----------------------------------------
    'fc-terminator': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 60;
      const rect = new fabric.Rect({
        width: w,
        height: h,
        rx: h / 2,
        ry: h / 2,
        fill: opts.fill || ShapeFactory.THEME.flowchart.terminator.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.terminator.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(rect, opts.text || '', x, y, w, h, 'fc-terminator', null, {
        textColor: ShapeFactory.THEME.flowchart.terminator.text,
        ...opts
      });
    },

    'fc-process': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 75;
      const rect = new fabric.Rect({
        width: w,
        height: h,
        fill: opts.fill || ShapeFactory.THEME.flowchart.process.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.process.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(rect, opts.text || '', x, y, w, h, 'fc-process', null, {
        textColor: ShapeFactory.THEME.flowchart.process.text,
        ...opts
      });
    },

    'fc-decision': (x, y, opts) => {
      const w = opts.width || 110;
      const h = opts.height || 100;
      const hw = w / 2;
      const hh = h / 2;
      const points = [
        { x: 0, y: -hh },
        { x: hw, y: 0 },
        { x: 0, y: hh },
        { x: -hw, y: 0 },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.flowchart.decision.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.decision.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'fc-decision', null, {
        textColor: ShapeFactory.THEME.flowchart.decision.text,
        ...opts
      });
    },

    'fc-data': (x, y, opts) => {
      const w = opts.width || 130;
      const h = opts.height || 70;
      const hw = w / 2;
      const hh = h / 2;
      const slant = 18;
      const points = [
        { x: -hw + slant, y: -hh },
        { x: hw, y: -hh },
        { x: hw - slant, y: hh },
        { x: -hw, y: hh },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.flowchart.data.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.data.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'fc-data', null, {
        textColor: ShapeFactory.THEME.flowchart.data.text,
        ...opts
      });
    },

    'fc-document': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 80;
      const hw = w / 2;
      const hh = h / 2;
      const pathData = `
        M ${-hw} ${-hh}
        L ${hw} ${-hh}
        L ${hw} ${hh - 12}
        Q ${hw * 0.5} ${hh - 24} 0 ${hh - 12}
        Q ${-hw * 0.5} ${hh} ${-hw} ${hh - 12}
        Z
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.flowchart.document.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.document.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, w, h, 'fc-document', null, {
        textColor: ShapeFactory.THEME.flowchart.document.text,
        ...opts
      });
    },

    'fc-subprocess': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 75;
      const hw = w / 2;
      const hh = h / 2;
      const pathData = `
        M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z
        M ${-hw + 14} ${-hh} L ${-hw + 14} ${hh}
        M ${hw - 14} ${-hh} L ${hw - 14} ${hh}
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.flowchart.subprocess.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.subprocess.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, w, h, 'fc-subprocess', null, {
        textColor: ShapeFactory.THEME.flowchart.subprocess.text,
        ...opts
      });
    },

    'fc-manual-input': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 75;
      const hw = w / 2;
      const hh = h / 2;
      const points = [
        { x: -hw, y: -hh + 15 },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.flowchart.manualInput.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.manualInput.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'fc-manual-input', null, {
        textColor: ShapeFactory.THEME.flowchart.manualInput.text,
        ...opts
      });
    },

    'fc-preparation': (x, y, opts) => {
      const w = opts.width || 120;
      const h = opts.height || 65;
      const hw = w / 2;
      const hh = h / 2;
      const tip = 20;
      const points = [
        { x: -hw + tip, y: -hh },
        { x: hw - tip, y: -hh },
        { x: hw, y: 0 },
        { x: hw - tip, y: hh },
        { x: -hw + tip, y: hh },
        { x: -hw, y: 0 },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.flowchart.preparation.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.preparation.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'fc-preparation', null, {
        textColor: ShapeFactory.THEME.flowchart.preparation.text,
        ...opts
      });
    },

    'fc-connector': (x, y, opts) => {
      const r = 20;
      const circle = new fabric.Circle({
        radius: r,
        fill: opts.fill || ShapeFactory.THEME.flowchart.connector.fill,
        stroke: opts.stroke || ShapeFactory.THEME.flowchart.connector.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(circle, opts.text || '', x, y, r * 2, r * 2, 'fc-connector', null, {
        textColor: ShapeFactory.THEME.flowchart.connector.text,
        ...opts
      });
    },

    // ----------------------------------------
    // UML SHAPES
    // ----------------------------------------
    'uml-class': (x, y, opts) => {
      const w = 140, h = 110;
      const hw = w / 2, hh = h / 2;
      const pathData = `
        M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z
        M ${-hw} ${-hh + 28} L ${hw} ${-hh + 28}
        M ${-hw} ${-hh + 65} L ${hw} ${-hh + 65}
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.uml.class.fill,
        stroke: opts.stroke || ShapeFactory.THEME.uml.class.stroke,
        strokeWidth: 2,
      });
      const comp = ShapeFactory._createComposite(path, opts.text || 'ClassName\n+ id: string\n+ execute(): void', x, y, w, h, 'uml-class', null, {
        textColor: ShapeFactory.THEME.uml.class.text,
        ...opts
      });
      if (comp.labelObject) {
        comp.labelObject.set({
          fontSize: 11,
          textAlign: 'left',
          left: -hw + 8,
          originX: 'left',
          top: 0,
        });
        if (comp.triggerLayout) comp.triggerLayout();
        comp.dirty = true;
        comp.setCoords();
      }
      return comp;
    },

    'uml-interface': (x, y, opts) => {
      const w = 140, h = 90;
      const hw = w / 2, hh = h / 2;
      const pathData = `
        M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z
        M ${-hw} ${-hh + 32} L ${hw} ${-hh + 32}
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.uml.interface.fill,
        stroke: opts.stroke || ShapeFactory.THEME.uml.interface.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || '<<interface>>\nService', x, y, w, h, 'uml-interface', null, opts);
    },

    'uml-actor': (x, y, opts) => {
      const w = 60, h = 100;
      const hw = w / 2, hh = h / 2;
      const pathData = `
        M 0 ${-hh + 14}
        A 14 14 0 1 1 0.1 ${-hh + 14}
        M 0 ${-hh + 28} L 0 ${hh - 30}
        M ${-hw} ${-hh + 45} L ${hw} ${-hh + 45}
        M 0 ${hh - 30} L ${-hw + 6} ${hh}
        M 0 ${hh - 30} L ${hw - 6} ${hh}
      `;
      const path = new fabric.Path(pathData, {
        fill: 'transparent',
        stroke: opts.stroke || '#1F3864',
        strokeWidth: 2.5,
      });
      const comp = ShapeFactory._createComposite(path, opts.text || 'User', x, y, w, h, 'uml-actor', [
        { id: 'top', x: 0.5, y: 0 },
        { id: 'bottom', x: 0.5, y: 1 },
      ], opts);
      if (comp.labelObject) {
        comp.labelObject.set({ top: hh + 12 });
        if (comp.triggerLayout) comp.triggerLayout();
        comp.dirty = true;
        comp.setCoords();
      }
      return comp;
    },

    'uml-usecase': (x, y, opts) => {
      const rx = 65, ry = 40;
      const ellipse = new fabric.Ellipse({
        rx: rx,
        ry: ry,
        fill: opts.fill || ShapeFactory.THEME.uml.usecase.fill,
        stroke: opts.stroke || ShapeFactory.THEME.uml.usecase.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(ellipse, opts.text || 'Use Case', x, y, rx * 2, ry * 2, 'uml-usecase', null, opts);
    },

    'uml-package': (x, y, opts) => {
      const w = 130, h = 90;
      const hw = w / 2, hh = h / 2;
      const pathData = `
        M ${-hw} ${-hh + 18} L ${-hw + 45} ${-hh + 18} L ${-hw + 55} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z
        M ${-hw} ${-hh + 18} L ${hw} ${-hh + 18}
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.uml.package.fill,
        stroke: opts.stroke || ShapeFactory.THEME.uml.package.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(path, opts.text || 'Package', x, y, w, h, 'uml-package', null, opts);
    },

    'uml-note': (x, y, opts) => {
      const w = 110, h = 90;
      const hw = w / 2, hh = h / 2;
      const fold = 18;
      const pathData = `
        M ${-hw} ${-hh} L ${hw - fold} ${-hh} L ${hw} ${-hh + fold} L ${hw} ${hh} L ${-hw} ${hh} Z
        M ${hw - fold} ${-hh} L ${hw - fold} ${-hh + fold} L ${hw} ${-hh + fold}
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || ShapeFactory.THEME.uml.note.fill,
        stroke: opts.stroke || ShapeFactory.THEME.uml.note.stroke,
        strokeWidth: 1.5,
      });
      return ShapeFactory._createComposite(path, opts.text || 'Note comment...', x, y, w, h, 'uml-note', null, opts);
    },

    // ----------------------------------------
    // ARROWS & CALLOUTS
    // ----------------------------------------
    'arrow-right': (x, y, opts) => {
      const w = 120, h = 60;
      const hw = w / 2, hh = h / 2;
      const shaft = 15;
      const points = [
        { x: -hw, y: -shaft },
        { x: hw - 30, y: -shaft },
        { x: hw - 30, y: -hh },
        { x: hw, y: 0 },
        { x: hw - 30, y: hh },
        { x: hw - 30, y: shaft },
        { x: -hw, y: shaft },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'arrow-right', null, opts);
    },

    'arrow-left': (x, y, opts) => {
      const w = 120, h = 60;
      const hw = w / 2, hh = h / 2;
      const shaft = 15;
      const points = [
        { x: hw, y: -shaft },
        { x: -hw + 30, y: -shaft },
        { x: -hw + 30, y: -hh },
        { x: -hw, y: 0 },
        { x: -hw + 30, y: hh },
        { x: -hw + 30, y: shaft },
        { x: hw, y: shaft },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'arrow-left', null, opts);
    },

    'arrow-double': (x, y, opts) => {
      const w = 130, h = 60;
      const hw = w / 2, hh = h / 2;
      const shaft = 12;
      const head = 25;
      const points = [
        { x: -hw + head, y: -hh },
        { x: -hw + head, y: -shaft },
        { x: hw - head, y: -shaft },
        { x: hw - head, y: -hh },
        { x: hw, y: 0 },
        { x: hw - head, y: hh },
        { x: hw - head, y: shaft },
        { x: -hw + head, y: shaft },
        { x: -hw + head, y: hh },
        { x: -hw, y: 0 },
      ];
      const poly = new fabric.Polygon(points, {
        fill: opts.fill || ShapeFactory.THEME.primary.fill,
        stroke: opts.stroke || ShapeFactory.THEME.primary.stroke,
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(poly, opts.text || '', x, y, w, h, 'arrow-double', null, opts);
    },

    'callout-rect': (x, y, opts) => {
      const w = 130, h = 85;
      const hw = w / 2, hh = h / 2;
      const pathData = `
        M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh - 20} L ${-hw + 40} ${hh - 20} L ${-hw + 15} ${hh} L ${-hw + 25} ${hh - 20} L ${-hw} ${hh - 20} Z
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || '#FFF2CC',
        stroke: opts.stroke || '#D56B00',
        strokeWidth: 1.5,
      });
      return ShapeFactory._createComposite(path, opts.text || 'Callout...', x, y, w, h, 'callout-rect', null, opts);
    },

    'callout-round': (x, y, opts) => {
      const w = 130, h = 85;
      const hw = w / 2, hh = h / 2;
      const pathData = `
        M ${-hw + 20} ${-hh}
        L ${hw - 20} ${-hh}
        Q ${hw} ${-hh} ${hw} ${-hh + 20}
        L ${hw} ${hh - 35}
        Q ${hw} ${hh - 20} ${hw - 20} ${hh - 20}
        L ${-hw + 45} ${hh - 20}
        L ${-hw + 15} ${hh}
        L ${-hw + 25} ${hh - 20}
        L ${-hw + 20} ${hh - 20}
        Q ${-hw} ${hh - 20} ${-hw} ${hh - 35}
        L ${-hw} ${-hh + 20}
        Q ${-hw} ${-hh} ${-hw + 20} ${-hh}
        Z
      `;
      const path = new fabric.Path(pathData, {
        fill: opts.fill || '#FFF2CC',
        stroke: opts.stroke || '#D56B00',
        strokeWidth: 1.5,
      });
      return ShapeFactory._createComposite(path, opts.text || 'Message', x, y, w, h, 'callout-round', null, opts);
    },

    'brace-left': (x, y, opts) => {
      const w = 30, h = 120;
      const hh = h / 2;
      const pathData = `
        M 10 ${-hh}
        Q -5 ${-hh} -5 ${-hh + 20}
        L -5 -8
        Q -5 0 -15 0
        Q -5 0 -5 8
        L -5 ${hh - 20}
        Q -5 ${hh} 10 ${hh}
      `;
      const path = new fabric.Path(pathData, {
        fill: 'transparent',
        stroke: opts.stroke || '#1F3864',
        strokeWidth: 2.5,
      });
      return ShapeFactory._createComposite(path, opts.text || '', x, y, w, h, 'brace-left', null, opts);
    },

    'textbox': (x, y, opts) => {
      const text = new fabric.Textbox(opts.text || 'Text Box', {
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        width: opts.width || 120,
        fontSize: 14,
        fontFamily: 'Segoe UI, sans-serif',
        fill: opts.fill || '#1F3864',
        textAlign: 'center',
      });
      text.objectType = 'textbox';
      text.shapeType = 'textbox';
      return text;
    },

    // ----------------------------------------
    // DYNAMIC CONNECTOR
    // ----------------------------------------
    'dynamic-connector': (x, y, opts) => {
      const line = new fabric.Polyline([
        { x: x - 50, y: y },
        { x: x + 50, y: y }
      ], {
        stroke: opts.stroke || '#0078d4',
        strokeWidth: opts.strokeWidth || 2,
        fill: 'transparent',
        selectable: true,
        hasControls: true,
        objectType: 'connector',
      });
      line.shapeData = { id: 'conn_' + Math.random().toString(36).substr(2, 9), name: 'Dynamic Connector' };
      return line;
    },

    // ----------------------------------------
    // CLOUD (AWS / AZURE / HYBRID)
    // ----------------------------------------
    'cloud-ec2': (x, y, opts = {}) => {
      const w = opts.width || 85, h = opts.height || 55;
      const rect = new fabric.Rect({
        width: w,
        height: h,
        rx: 4,
        ry: 4,
        fill: opts.fill || '#ff9800',
        stroke: opts.stroke || '#e65100',
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(rect, opts.text || 'EC2 Instance', x, y, w, h, 'cloud-ec2', null, { textColor: '#ffffff', ...opts });
    },

    'cloud-storage': (x, y, opts = {}) => {
      const w = opts.width || 80, h = opts.height || 60;
      const rect = new fabric.Rect({
        width: w,
        height: h,
        rx: 4,
        ry: 4,
        fill: opts.fill || '#43a047',
        stroke: opts.stroke || '#2e7d32',
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(rect, opts.text || 'S3 Bucket', x, y, w, h, 'cloud-storage', null, { textColor: '#ffffff', ...opts });
    },

    'cloud-database': (x, y, opts = {}) => {
      const w = opts.width || 80, h = opts.height || 65;
      const rect = new fabric.Rect({
        width: w,
        height: h,
        rx: 4,
        ry: 4,
        fill: opts.fill || '#1e88e5',
        stroke: opts.stroke || '#1565c0',
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(rect, opts.text || 'RDS Database', x, y, w, h, 'cloud-database', null, { textColor: '#ffffff', ...opts });
    },

    'cloud-lb': (x, y, opts = {}) => {
      const r = opts.width ? opts.width / 2 : 30;
      const circle = new fabric.Circle({
        radius: r,
        fill: opts.fill || '#8e24aa',
        stroke: opts.stroke || '#6a1b9a',
        strokeWidth: 2,
      });
      return ShapeFactory._createComposite(circle, opts.text || 'Load Balancer', x, y, r * 2, r * 2, 'cloud-lb', null, { textColor: '#ffffff', ...opts });
    },

    // ----------------------------------------
    // VISIO DIAGRAM PARTS (CONTAINERS, CALLOUTS, CHARTS, CAD, ELECTRICAL)
    // ----------------------------------------
    'container-classic': (x, y, opts = {}) => {
      const w = opts.width || 320;
      const h = opts.height || 200;
      const headerH = 26;
      const stroke = opts.stroke || '#41719C';
      const fill = opts.fill || 'rgba(217, 225, 242, 0.15)';

      const body = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        rx: 0,
        ry: 0,
        fill: fill,
        stroke: stroke,
        strokeWidth: opts.strokeWidth || 2,
        strokeDashArray: [6, 3],
      });

      const header = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: headerH,
        fill: stroke,
        stroke: stroke,
        strokeWidth: 1,
      });

      const title = new fabric.IText(opts.text || 'Classic Container', {
        left: 10,
        top: 6,
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#ffffff',
      });

      return ShapeFactory._makeCustomGroup([body, header, title], x, y, w, h, 'container', 'container-classic', {
        geometryObject: body,
        labelObject: title,
        idPrefix: 'container_',
        name: opts.text || 'Classic Container',
        properties: { isContainer: true, ...(opts.properties || {}) },
      });
    },

    'container-banner': (x, y, opts = {}) => {
      const w = opts.width || 340;
      const h = opts.height || 210;
      const headerH = 34;
      const stroke = opts.stroke || '#2F5597';
      const fill = opts.fill || 'rgba(47, 85, 151, 0.08)';

      const body = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        rx: 4,
        ry: 4,
        fill: fill,
        stroke: stroke,
        strokeWidth: 2,
      });

      const banner = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: headerH,
        rx: 4,
        ry: 4,
        fill: stroke,
      });

      const ribbonFold = new fabric.Polyline([
        { x: 0, y: headerH },
        { x: 12, y: headerH + 6 },
        { x: 12, y: headerH }
      ], {
        fill: '#1b3259',
        stroke: '#1b3259',
      });

      const title = new fabric.IText(opts.text || 'Header Banner Container', {
        left: 14,
        top: 8,
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#ffffff',
      });

      return ShapeFactory._makeCustomGroup([body, banner, ribbonFold, title], x, y, w, h, 'container', 'container-banner', {
        geometryObject: body,
        labelObject: title,
        idPrefix: 'container_',
        name: opts.text || 'Header Banner Container',
        properties: { isContainer: true, ...(opts.properties || {}) },
      });
    },

    'container-rounded': (x, y, opts = {}) => {
      const w = opts.width || 320;
      const h = opts.height || 200;
      const stroke = opts.stroke || '#70AD47';
      const fill = opts.fill || 'rgba(112, 173, 71, 0.08)';

      const body = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        rx: 16,
        ry: 16,
        fill: fill,
        stroke: stroke,
        strokeWidth: 2,
      });

      const badgeW = Math.min(180, w - 40);
      const badge = new fabric.Rect({
        left: 20,
        top: 0,
        width: badgeW,
        height: 24,
        rx: 12,
        ry: 12,
        fill: stroke,
      });

      const title = new fabric.IText(opts.text || 'Rounded Container', {
        left: 20 + badgeW / 2,
        top: 12,
        originX: 'center',
        originY: 'center',
        fontSize: 11,
        fontWeight: 'bold',
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#ffffff',
      });

      return ShapeFactory._makeCustomGroup([body, badge, title], x, y, w, h, 'container', 'container-rounded', {
        geometryObject: body,
        labelObject: title,
        idPrefix: 'container_',
        name: opts.text || 'Rounded Container',
        properties: { isContainer: true, ...(opts.properties || {}) },
      });
    },

    'container-frame': (x, y, opts = {}) => {
      const w = opts.width || 320;
      const h = opts.height || 200;
      const stroke = opts.stroke || '#595959';

      const outer = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        fill: 'transparent',
        stroke: stroke,
        strokeWidth: 1.5,
      });

      const inner = new fabric.Rect({
        left: 6,
        top: 6,
        width: w - 12,
        height: h - 12,
        fill: 'transparent',
        stroke: stroke,
        strokeWidth: 0.8,
        strokeDashArray: [3, 3],
      });

      const titleTag = new fabric.Rect({
        left: 12,
        top: 0,
        width: 120,
        height: 18,
        fill: stroke,
      });

      const title = new fabric.IText(opts.text || 'Minimal Frame', {
        left: 72,
        top: 9,
        originX: 'center',
        originY: 'center',
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#ffffff',
      });

      return ShapeFactory._makeCustomGroup([outer, inner, titleTag, title], x, y, w, h, 'container', 'container-frame', {
        geometryObject: outer,
        labelObject: title,
        idPrefix: 'container_',
        name: opts.text || 'Minimal Frame',
        properties: { isContainer: true, ...(opts.properties || {}) },
      });
    },

    'container': (x, y, opts) => ShapeFactory._builders['container-classic'](x, y, opts),

    'callout-bubble': (x, y, opts = {}) => {
      const w = opts.width || 160;
      const h = opts.height || 80;
      const stroke = opts.stroke || '#D56B00';
      const fill = opts.fill || '#FFF2CC';

      const pathData = `M 10 0 L ${w - 10} 0 Q ${w} 0 ${w} 10 L ${w} ${h - 20} Q ${w} ${h - 10} ${w - 10} ${h - 10} L 50 ${h - 10} L 20 ${h} L 32 ${h - 10} L 10 ${h - 10} Q 0 ${h - 10} 0 ${h - 20} L 0 10 Q 0 0 10 0 Z`;
      const bubble = new fabric.Path(pathData, {
        fill: fill,
        stroke: stroke,
        strokeWidth: 1.5,
      });

      const text = new fabric.IText(opts.text || 'Speech Bubble', {
        left: w / 2,
        top: (h - 10) / 2,
        originX: 'center',
        originY: 'center',
        fontSize: 11,
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#333333',
        textAlign: 'center',
      });

      return ShapeFactory._makeCustomGroup([bubble, text], x, y, w, h, 'callout', 'callout-bubble', {
        geometryObject: bubble,
        labelObject: text,
        idPrefix: 'callout_',
        name: opts.text || 'Speech Bubble',
      });
    },

    'callout-line': (x, y, opts = {}) => {
      const w = opts.width || 170;
      const h = opts.height || 60;
      const stroke = opts.stroke || '#0078d4';

      const leader = new fabric.Polyline([
        { x: 0, y: h },
        { x: 30, y: h - 18 },
        { x: w, y: h - 18 }
      ], {
        fill: 'transparent',
        stroke: stroke,
        strokeWidth: 2,
      });

      const dot = new fabric.Circle({
        left: 0,
        top: h,
        originX: 'center',
        originY: 'center',
        radius: 3.5,
        fill: stroke,
      });

      const text = new fabric.IText(opts.text || 'Line Callout', {
        left: 36,
        top: (h - 18) / 2,
        originX: 'left',
        originY: 'center',
        fontSize: 11,
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#262626',
      });

      return ShapeFactory._makeCustomGroup([leader, dot, text], x, y, w, h, 'callout', 'callout-line', {
        geometryObject: leader,
        labelObject: text,
        idPrefix: 'callout_',
        name: opts.text || 'Line Callout',
      });
    },

    'callout-bracket': (x, y, opts = {}) => {
      const w = opts.width || 160;
      const h = opts.height || 64;
      const stroke = opts.stroke || '#C65911';

      const bracket = new fabric.Polyline([
        { x: 18, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: h },
        { x: 18, y: h }
      ], {
        fill: 'transparent',
        stroke: stroke,
        strokeWidth: 3,
      });

      const text = new fabric.IText(opts.text || 'Bracket Callout', {
        left: 24,
        top: h / 2,
        originX: 'left',
        originY: 'center',
        fontSize: 11,
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#333333',
      });

      return ShapeFactory._makeCustomGroup([bracket, text], x, y, w, h, 'callout', 'callout-bracket', {
        geometryObject: bracket,
        labelObject: text,
        idPrefix: 'callout_',
        name: opts.text || 'Bracket Callout',
      });
    },

    'callout-side-line': (x, y, opts = {}) => {
      const w = opts.width || 170;
      const h = opts.height || 60;
      const stroke = opts.stroke || '#70AD47';
      const fill = opts.fill || '#F2F9ED';

      const bg = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        rx: 3,
        ry: 3,
        fill: fill,
        stroke: '#e0e0e0',
        strokeWidth: 1,
      });

      const sideBar = new fabric.Rect({
        left: 0,
        top: 0,
        width: 6,
        height: h,
        rx: 2,
        ry: 2,
        fill: stroke,
      });

      const text = new fabric.IText(opts.text || 'Side Line Callout', {
        left: 18,
        top: h / 2,
        originX: 'left',
        originY: 'center',
        fontSize: 11,
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#333333',
      });

      return ShapeFactory._makeCustomGroup([bg, sideBar, text], x, y, w, h, 'callout', 'callout-side-line', {
        geometryObject: bg,
        labelObject: text,
        idPrefix: 'callout_',
        name: opts.text || 'Side Line Callout',
      });
    },

    'callout': (x, y, opts) => ShapeFactory._builders['callout-bubble'](x, y, opts),

    'cad': (x, y, opts = {}) => {
      const w = opts.width || 280;
      const h = opts.height || 180;
      const stroke = opts.stroke || '#262626';

      const outerBorder = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        fill: '#fafafa',
        stroke: stroke,
        strokeWidth: 2,
      });

      const innerBorder = new fabric.Rect({
        left: 8,
        top: 8,
        width: w - 16,
        height: h - 16,
        fill: 'transparent',
        stroke: stroke,
        strokeWidth: 1,
      });

      const tbW = Math.min(140, w - 30);
      const tbH = 26;
      const titleBlock = new fabric.Rect({
        left: w - 8 - tbW,
        top: h - 8 - tbH,
        width: tbW,
        height: tbH,
        fill: '#eeeeee',
        stroke: stroke,
        strokeWidth: 1,
      });

      const tbText = new fabric.IText(opts.text || 'CAD Drawing | 1:50', {
        left: w - 8 - tbW / 2,
        top: h - 8 - tbH / 2,
        originX: 'center',
        originY: 'center',
        fontSize: 9,
        fontWeight: 'bold',
        fontFamily: 'Consolas, monospace',
        fill: '#333333',
      });

      const ch1 = new fabric.Line([20, 16, 20, 28], { stroke: '#0078d4', strokeWidth: 1 });
      const ch2 = new fabric.Line([14, 22, 26, 22], { stroke: '#0078d4', strokeWidth: 1 });

      return ShapeFactory._makeCustomGroup([outerBorder, innerBorder, titleBlock, tbText, ch1, ch2], x, y, w, h, 'cad', 'cad', {
        geometryObject: outerBorder,
        labelObject: tbText,
        idPrefix: 'cad_',
        name: opts.text || 'CAD Drawing',
      });
    },

    'logic-and': (x, y, opts = {}) => {
      const w = opts.width || 80;
      const h = opts.height || 50;
      const fill = opts.fill || '#D9E1F2';
      const stroke = opts.stroke || '#41719C';
      const pathData = `M 15 5 L 45 5 C 65 5 65 45 45 45 L 15 45 Z`;
      const body = new fabric.Path(pathData, { fill, stroke, strokeWidth: 1.5 });
      const in1 = new fabric.Line([0, 15, 15, 15], { stroke, strokeWidth: 1.5 });
      const in2 = new fabric.Line([0, 35, 15, 35], { stroke, strokeWidth: 1.5 });
      const out = new fabric.Line([65, 25, 80, 25], { stroke, strokeWidth: 1.5 });
      const label = new fabric.IText(opts.text || 'AND', { left: 35, top: 25, originX: 'center', originY: 'center', fontSize: 10, fill: '#1F3864' });
      return ShapeFactory._makeCustomGroup([body, in1, in2, out, label], x, y, w, h, 'logic-and', 'logic-and', {
        geometryObject: body,
        labelObject: label,
        name: opts.text || 'AND',
        connectionPoints: [
          { id: 'in1', x: 0, y: 0.3 },
          { id: 'in2', x: 0, y: 0.7 },
          { id: 'out', x: 1, y: 0.5 },
        ],
      });
    },

    'logic-or': (x, y, opts = {}) => {
      const w = opts.width || 80;
      const h = opts.height || 50;
      const fill = opts.fill || '#D9E1F2';
      const stroke = opts.stroke || '#41719C';
      const pathData = `M 15 5 Q 25 25 15 45 Q 45 45 65 25 Q 45 5 15 5 Z`;
      const body = new fabric.Path(pathData, { fill, stroke, strokeWidth: 1.5 });
      const in1 = new fabric.Line([0, 15, 18, 15], { stroke, strokeWidth: 1.5 });
      const in2 = new fabric.Line([0, 35, 18, 35], { stroke, strokeWidth: 1.5 });
      const out = new fabric.Line([65, 25, 80, 25], { stroke, strokeWidth: 1.5 });
      const label = new fabric.IText(opts.text || 'OR', { left: 36, top: 25, originX: 'center', originY: 'center', fontSize: 10, fill: '#1F3864' });
      return ShapeFactory._makeCustomGroup([body, in1, in2, out, label], x, y, w, h, 'logic-or', 'logic-or', {
        geometryObject: body,
        labelObject: label,
        name: opts.text || 'OR',
        connectionPoints: [
          { id: 'in1', x: 0, y: 0.3 },
          { id: 'in2', x: 0, y: 0.7 },
          { id: 'out', x: 1, y: 0.5 },
        ],
      });
    },

    'logic-not': (x, y, opts = {}) => {
      const w = opts.width || 75;
      const h = opts.height || 40;
      const fill = opts.fill || '#D9E1F2';
      const stroke = opts.stroke || '#41719C';
      const triangle = new fabric.Polygon([{ x: 15, y: 5 }, { x: 50, y: 20 }, { x: 15, y: 35 }], { fill, stroke, strokeWidth: 1.5 });
      const circle = new fabric.Circle({ left: 54, top: 20, originX: 'center', originY: 'center', radius: 4, fill, stroke, strokeWidth: 1.5 });
      const inLine = new fabric.Line([0, 20, 15, 20], { stroke, strokeWidth: 1.5 });
      const outLine = new fabric.Line([58, 20, 75, 20], { stroke, strokeWidth: 1.5 });
      return ShapeFactory._makeCustomGroup([triangle, circle, inLine, outLine], x, y, w, h, 'logic-not', 'logic-not', {
        geometryObject: triangle,
        name: opts.text || 'NOT',
        connectionPoints: [
          { id: 'in', x: 0, y: 0.5 },
          { id: 'out', x: 1, y: 0.5 },
        ],
      });
    },

    'elec-resistor': (x, y, opts = {}) => {
      const w = opts.width || 90;
      const h = opts.height || 30;
      const stroke = opts.stroke || '#41719C';
      const pathData = `M 0 15 L 18 15 L 24 5 L 34 25 L 44 5 L 54 25 L 64 5 L 72 15 L 90 15`;
      const line = new fabric.Path(pathData, { fill: 'transparent', stroke, strokeWidth: 2 });
      const label = new fabric.IText(opts.text || 'R', { left: 45, top: 2, originX: 'center', originY: 'bottom', fontSize: 10, fill: '#1F3864' });
      return ShapeFactory._makeCustomGroup([line, label], x, y, w, h, 'elec-resistor', 'elec-resistor', {
        geometryObject: line,
        labelObject: label,
        name: opts.text || 'R',
        connectionPoints: [
          { id: 'left', x: 0, y: 0.5 },
          { id: 'right', x: 1, y: 0.5 },
        ],
      });
    },

    'elec-ground': (x, y, opts = {}) => {
      const w = opts.width || 50;
      const h = opts.height || 40;
      const stroke = opts.stroke || '#41719C';
      const stem = new fabric.Line([25, 0, 25, 18], { stroke, strokeWidth: 2 });
      const b1 = new fabric.Line([10, 18, 40, 18], { stroke, strokeWidth: 2 });
      const b2 = new fabric.Line([15, 24, 35, 24], { stroke, strokeWidth: 1.8 });
      const b3 = new fabric.Line([20, 30, 30, 30], { stroke, strokeWidth: 1.5 });
      return ShapeFactory._makeCustomGroup([stem, b1, b2, b3], x, y, w, h, 'elec-ground', 'elec-ground', {
        geometryObject: stem,
        name: 'Ground',
        connectionPoints: [{ id: 'top', x: 0.5, y: 0 }],
      });
    },

    'chart': (x, y, opts = {}) => {
      const w = opts.width || 160;
      const h = opts.height || 110;

      const bg = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        rx: 4,
        ry: 4,
        fill: '#ffffff',
        stroke: '#41719C',
        strokeWidth: 1.5,
      });

      const axis = new fabric.Polyline([
        { x: 20, y: 15 },
        { x: 20, y: h - 25 },
        { x: w - 15, y: h - 25 }
      ], {
        stroke: '#888888',
        strokeWidth: 1.5,
        fill: 'transparent',
      });

      const bar1 = new fabric.Rect({ left: 35, top: h - 65, width: 22, height: 40, fill: '#4472c4' });
      const bar2 = new fabric.Rect({ left: 70, top: h - 85, width: 22, height: 60, fill: '#ed7d31' });
      const bar3 = new fabric.Rect({ left: 105, top: h - 50, width: 22, height: 25, fill: '#70ad47' });

      const title = new fabric.IText(opts.text || 'Chart', {
        left: w / 2,
        top: 8,
        originX: 'center',
        fontSize: 10,
        fontWeight: 'bold',
        fontFamily: 'Segoe UI, sans-serif',
        fill: '#333333',
      });

      return ShapeFactory._makeCustomGroup([bg, axis, bar1, bar2, bar3, title], x, y, w, h, 'chart', 'chart', {
        geometryObject: bg,
        labelObject: title,
        idPrefix: 'chart_',
        name: opts.text || 'Chart',
      });
    }
  };

  static _makeCustomGroup(objects, x, y, w, h, objectType, shapeType, meta = {}) {
    objects.forEach((o) => {
      if (o && o.type !== 'i-text' && o.type !== 'text' && o.type !== 'textbox') {
        o.set({ strokeUniform: true });
      }
    });
    const group = new fabric.Group(objects, {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      objectType,
    });
    group.geometryObject = meta.geometryObject || objects[0];
    if (meta.labelObject) group.labelObject = meta.labelObject;
    group.shapeType = shapeType;
    group.connectionPoints = meta.connectionPoints || [
      { id: 'top', x: 0.5, y: 0 },
      { id: 'right', x: 1, y: 0.5 },
      { id: 'bottom', x: 0.5, y: 1 },
      { id: 'left', x: 0, y: 0.5 },
    ];
    group.shapeData = {
      id: (meta.idPrefix || 'shape_') + Math.random().toString(36).substr(2, 9),
      name: meta.name || shapeType,
      type: shapeType,
      properties: meta.properties || {},
    };
    return group;
  }
}

window.ShapeFactory = ShapeFactory;

