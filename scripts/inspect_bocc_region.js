const fs = require('fs');
const JSZip = require('jszip');

global.window = { JSZip: JSZip, openDraw: null };
global.DOMParser = class {
  parseFromString(str) {
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
  Rect: class { constructor(opts) { Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } toObject() { return { type: 'rect' }; } },
  Text: class { constructor(text, opts) { this.text = text; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } toObject() { return { type: 'text' }; } },
  Group: class { constructor(objects, opts) { this.objects = objects; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } toObject() { return { type: 'group' }; } },
  Polyline: class { constructor(points, opts) { this.points = points; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } toObject() { return { type: 'polyline' }; } },
  Polygon: class { constructor(points, opts) { this.points = points; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } toObject() { return { type: 'polygon' }; } },
  Image: class { constructor(el, opts) { Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } toObject() { return { type: 'image' }; } }
};
global.Image = class { constructor() { this.naturalWidth = 100; this.naturalHeight = 100; } set src(v) { setTimeout(() => { if (this.onload) this.onload(); }, 1); } };

const VisioConverter = require('../src/renderer/core/VisioConverter.js');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const mockCanvasManager = {
    canvas: { getObjects: () => [], add: () => {}, remove: () => {}, sendObjectToBack: () => {}, requestRenderAll: () => {} },
    gridManager: { setPageSize: () => {} },
    pageManager: { pages: [], renderTabs: () => {} },
    connectorManager: { connectors: [], _findTargetShape: () => null },
    zoomToFit: () => {},
  };

  const pages = await VisioConverter.importVsdx(buf, mockCanvasManager);
  const p1 = pages[0];

  console.log('--- ALL SHAPES NEAR BOCC (x: 1650-1850, y: 2400-2800) ---');
  for (const s of p1.shapes) {
    const left = s.left || 0;
    const top = s.top || 0;
    const w = s.width || 0;
    const h = s.height || 0;
    if (left + w >= 1650 && left <= 1850 && top + h >= 2400 && top <= 2800) {
      console.log(`Shape ID: ${s.shapeData?.visioId} | Name: "${s.shapeData?.name}" | Type: ${s.objectType} | bounds: [${left.toFixed(1)}, ${top.toFixed(1)}, ${w.toFixed(1)}, ${h.toFixed(1)}] | fill: ${s.fill || s.objects?.[0]?.fill}`);
    }
  }

  console.log('\n--- ALL CONNECTORS NEAR BOCC ---');
  for (const l of p1.standaloneLines) {
    const pts = l.points || [];
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    if (maxX >= 1650 && minX <= 1850 && maxY >= 2400 && minY <= 2800) {
      console.log(`Connector ID: ${l.shapeData?.visioId} | Name: "${l.shapeData?.name}" | Type: ${l.objectType} | pts: ${pts.length} | bounds: [${minX.toFixed(1)}, ${minY.toFixed(1)} to ${maxX.toFixed(1)}, ${maxY.toFixed(1)}]`);
    }
  }
}
test();

