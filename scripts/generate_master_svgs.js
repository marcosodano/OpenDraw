const fs = require('fs');
const JSZip = require('jszip');
const vm = require('vm');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);

  // Load VisioConverter
  const code = fs.readFileSync('src/renderer/core/VisioConverter.js', 'utf8');
  const sandbox = {
    console,
    fabric: { Rect: class {}, Path: class {}, Group: class {}, Text: class {}, Image: class {} },
    DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.VisioConverter = VisioConverter;', sandbox);
  const VisioConverter = sandbox.VisioConverter;

  const masters = [
    { id: '17', name: 'Router', file: 'visio/masters/master9.xml' },
    { id: '23', name: 'AccessSwitch', file: 'visio/masters/master13.xml' },
    { id: '26', name: 'Firewall', file: 'visio/masters/master14.xml' }
  ];

  for (const m of masters) {
    const xml = await zip.file(m.file).async('text');
    const wCell = VisioConverter._getDirectCellFromXml(xml, 'Width');
    const hCell = VisioConverter._getDirectCellFromXml(xml, 'Height');
    const w = wCell.val ? parseFloat(wCell.val) * 96 : 40;
    const h = hCell.val ? parseFloat(hCell.val) * 96 : 30;

    const shapesIdx = xml.indexOf('<Shapes>');
    const rootShapeMatch = xml.match(/<Shape\s+[^>]*ID=['"]\d+['"][^>]*>([\s\S]*?)<\/Shapes>/);
    const targetXml = rootShapeMatch ? rootShapeMatch[0] : xml;

    const svgInner = VisioConverter._parseMasterShapeXml(targetXml, w, h, true);
    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}">\n${svgInner}\n</svg>`;
    const outPath = `scripts/current_${m.name}.svg`;
    fs.writeFileSync(outPath, fullSvg);
    console.log(`Generated ${outPath}: width=${w.toFixed(1)}, height=${h.toFixed(1)}, svgLength=${fullSvg.length}`);
  }
}

run().catch(console.error);

