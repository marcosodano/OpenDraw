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
    const shapesStart = xml.indexOf('<Shapes>');
    const shapesEnd = xml.lastIndexOf('</Shapes>');
    console.log(`\n================ Testing ${m.name} (${m.file}) ================`);
    console.log(`shapesStart: ${shapesStart}, shapesEnd: ${shapesEnd}`);

    if (shapesStart >= 0 && shapesEnd > shapesStart) {
      const innerShapesXml = xml.substring(shapesStart + 8, shapesEnd);
      let depth = 0;
      let start = -1;
      let rootShapeXml = null;
      const tagRegex = /<\/?Shape\b[^>]*>/g;
      let t;
      while ((t = tagRegex.exec(innerShapesXml)) !== null) {
        if (t[0].startsWith('</')) {
          depth--;
          if (depth === 0 && start >= 0) {
            rootShapeXml = innerShapesXml.substring(start, tagRegex.lastIndex);
            break;
          }
        } else if (!t[0].endsWith('/>')) {
          if (depth === 0) start = t.index;
          depth++;
        }
      }

      console.log(`rootShapeXml found: ${!!rootShapeXml}, length: ${rootShapeXml ? rootShapeXml.length : 0}`);
      if (rootShapeXml) {
        const wM = rootShapeXml.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
        const hM = rootShapeXml.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
        const mwPx = wM ? parseFloat(wM[1]) * 96 : 50;
        const mhPx = hM ? parseFloat(hM[1]) * 96 : 50;
        console.log(`mwPx: ${mwPx}, mhPx: ${mhPx}`);

        const renderedG = VisioConverter._parseMasterShapeXml(rootShapeXml, mwPx, mhPx, true);
        console.log(`renderedG length: ${renderedG.length}`);
        const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mwPx.toFixed(1)}" height="${mhPx.toFixed(1)}" viewBox="-4 -4 ${(mwPx + 8).toFixed(1)} ${(mhPx + 8).toFixed(1)}" overflow="visible">\n${renderedG}\n</svg>`;
        fs.writeFileSync(`scripts/actual_${m.name}.svg`, masterSvg);
        console.log(`Saved scripts/actual_${m.name}.svg`);
      }
    }
  }
}

run().catch(console.error);

