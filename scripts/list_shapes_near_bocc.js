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

  console.log('=== All Shapes in p1.shapes with pos near X: 1400-1900, Y: 2200-2900 ===');
  for (const s of p1.shapes) {
    const id = s.shapeData?.visioId;
    const name = s.shapeData?.name;
    const text = s.shapeData?.properties?.text || '';
    const l = s.left;
    const t = s.top;
    const w = s.width;
    const h = s.height;
    if (l >= 1300 && l <= 2000 && t >= 2000 && t <= 3000) {
      console.log(`Shape ID=${id} Name="${name}" Text="${text}" left=${l?.toFixed(1)} top=${t?.toFixed(1)} width=${w?.toFixed(1)} height=${h?.toFixed(1)} type=${s.objectType}`);
    }
  }

  console.log('\n=== All StandaloneLines with pos near X: 1400-1900, Y: 2200-2900 ===');
  for (const l of p1.standaloneLines) {
    const id = l.shapeData?.visioId;
    const pts = l.points;
    if (!pts || pts.length === 0) continue;
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    if (minX >= 1300 && minX <= 2000 && minY >= 2000 && minY <= 3000) {
      console.log(`Line ID=${id} Name="${l.shapeData?.name}" minX=${minX.toFixed(1)} maxX=${maxX.toFixed(1)} minY=${minY.toFixed(1)} maxY=${maxY.toFixed(1)} ptsCount=${pts.length} stroke=${l.stroke}`);
      console.log('   Points:', pts);
    }
  }
}
test();

