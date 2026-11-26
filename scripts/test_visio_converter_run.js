const fs = require('fs');
const JSZip = require('jszip');

// Mock browser globals for VisioConverter in Node
global.window = {
  JSZip: JSZip,
  openDraw: null,
};
global.DOMParser = class {
  parseFromString(str, type) {
    return {
      querySelectorAll(tag) {
        const matches = [];
        const regex = new RegExp(`<${tag}\\b([^>]*)>`, 'g');
        let m;
        while ((m = regex.exec(str)) !== null) {
          const attrs = m[1];
          matches.push({
            getAttribute(name) {
              const am = attrs.match(new RegExp(`${name}=['"]([^'"]+)['"]`));
              return am ? am[1] : null;
            }
          });
        }
        return matches;
      }
    };
  }
};

global.fabric = {
  Rect: class {
    constructor(opts) { Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    toObject() { return { type: 'rect' }; }
  },
  Text: class {
    constructor(text, opts) { this.text = text; Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    toObject() { return { type: 'text', text: this.text }; }
  },
  Group: class {
    constructor(objects, opts) { this.objects = objects; Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    toObject() { return { type: 'group' }; }
  },
  Polyline: class {
    constructor(points, opts) { this.points = points; Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    toObject() { return { type: 'polyline' }; }
  },
  Polygon: class {
    constructor(points, opts) { this.points = points; Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    toObject() { return { type: 'polygon' }; }
  },
  Image: class {
    constructor(el, opts) { Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    toObject() { return { type: 'image' }; }
  }
};

global.Image = class {
  constructor() {
    this.naturalWidth = 100;
    this.naturalHeight = 100;
  }
  set src(val) {
    setTimeout(() => { if (this.onload) this.onload(); }, 1);
  }
};

const VisioConverter = require('../src/renderer/core/VisioConverter.js');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const mockCanvasManager = {
    canvas: {
      getObjects: () => [],
      add: () => {},
      remove: () => {},
      sendObjectToBack: () => {},
      requestRenderAll: () => {},
    },
    gridManager: {
      setPageSize: () => {},
    },
    pageManager: {
      pages: [],
      renderTabs: () => {},
    },
    connectorManager: {
      connectors: [],
      _findTargetShape: () => null,
    },
    zoomToFit: () => {},
  };

  const pages = await VisioConverter.importVsdx(buf, mockCanvasManager);
  console.log(`\nImported ${pages.length} pages.`);

  const p1 = pages[0];
  console.log(`Page 1 "${p1.name}":`);
  console.log(`  Shapes: ${p1.shapes.length}`);
  console.log(`  Connectors: ${p1.connectors.length}`);

  // Check containers and their colors
  console.log('\nContainers (first 15):');
  for (const c of p1.shapes.slice(0, 15)) {
    const text = c.shapeData?.properties?.text || '';
    const fill = c.fill || (c.objects && c.objects[0]?.fill);
    const stroke = c.stroke || (c.objects && c.objects[0]?.stroke);
    const isGroup = c instanceof global.fabric.Group;
    console.log(`  [ID: ${c.shapeData?.visioId}] Name="${c.shapeData?.name}" Text="${text}" Fill=${fill} Stroke=${stroke} Group=${isGroup}`);
  }

  // Check connectors
  console.log('\nSample Connectors (first 5):');
  for (const conn of p1.connectors.slice(0, 5)) {
    console.log(`  [Conn: ${conn.visioId}] targetArrow=${conn.style.targetArrow} sourceShapeId=${conn.sourceShapeId} targetShapeId=${conn.targetShapeId} pts=${conn.line?.points?.length} srcShape=${!!conn.sourceShape} tgtShape=${!!conn.targetShape}`);
  }

  // Count connectors with arrows
  const arrowCount = p1.connectors.filter(c => c.style.targetArrow).length;
  console.log(`\nTotal connectors with targetArrow: ${arrowCount} / ${p1.connectors.length}`);

  // Count connectors with linked shapes
  const linkedCount = p1.connectors.filter(c => c.sourceShape || c.targetShape).length;
  console.log(`Total connectors with linked shapes: ${linkedCount} / ${p1.connectors.length}`);

  // Check Master 30 Cross
  const crosses = p1.shapes.filter(s => s.shapeData?.name?.toLowerCase().includes('cross'));
  console.log(`\nCross shapes found: ${crosses.length}`);
  for (const cr of crosses) {
    console.log(`  Cross [ID: ${cr.shapeData?.visioId}] angle=${cr.angle}`);
  }
}
run();

