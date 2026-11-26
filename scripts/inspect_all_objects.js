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

  console.log('Shapes count:', p1.shapes.length);
  console.log('StandaloneLines count:', p1.standaloneLines.length);
  console.log('Connectors count:', p1.connectors.length);

  // Check Shape 439, 440, 435, 436, 477
  for (const id of ['439', '440', '435', '436', '477', '478']) {
    const s = p1.shapes.find(o => o.shapeData?.visioId === id);
    const l = p1.standaloneLines.find(o => o.shapeData?.visioId === id);
    const c = p1.connectors.find(o => o.visioId === id);
    console.log(`ID ${id}: in shapes? ${!!s} (objectType: ${s?.objectType}) | in standaloneLines? ${!!l} (objectType: ${l?.objectType}, connectorData? ${!!l?.connectorData}) | in connectors? ${!!c}`);
  }
}
test();

