const fs = require('fs');
const JSZip = require('jszip');

// Let's copy the VisioConverter methods and test master9 SVG generation
async function testSvg() {
  const filePath = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const m9Xml = await zip.file('visio/masters/master9.xml').async('text');

  // Load VisioConverter
  const code = fs.readFileSync('src/renderer/core/VisioConverter.js', 'utf8');
  // eval VisioConverter class in a sandbox
  const vm = require('vm');
  const sandbox = {
    console,
    fabric: {
      Rect: class {},
      Path: class {},
      Group: class {},
      Text: class {},
      Image: class {},
    },
    DOMParser: class {
      parseFromString(str) {
        return {
          querySelectorAll: () => [],
        };
      }
    }
  };
  vm.createContext(sandbox);
  // Extract VisioConverter class definition
  vm.runInContext(code + '\nthis.VisioConverter = VisioConverter;', sandbox);

  const VisioConverter = sandbox.VisioConverter;
  const shapesIdx = m9Xml.indexOf('<Shapes>');
  const endShapesIdx = m9Xml.lastIndexOf('</Shapes>');
  const rootShapeMatch = m9Xml.match(/<Shape\s+[^>]*ID=['"]5['"][^>]*>([\s\S]*?)<\/Shapes>/);
  
  const wCell = VisioConverter._getDirectCellFromXml(m9Xml, 'Width');
  const hCell = VisioConverter._getDirectCellFromXml(m9Xml, 'Height');
  const w = parseFloat(wCell.val) * 96;
  const h = parseFloat(hCell.val) * 96;

  const svgInner = VisioConverter._parseMasterShapeXml(rootShapeMatch ? rootShapeMatch[0] : m9Xml, w, h, true);
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}">\n${svgInner}\n</svg>`;
  
  fs.writeFileSync('scripts/router_master9.svg', fullSvg);
  console.log('Saved scripts/router_master9.svg (length:', fullSvg.length, ')');
}

testSvg().catch(err => console.error(err));

