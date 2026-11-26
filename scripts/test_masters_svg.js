const fs = require('fs');
const JSZip = require('jszip');

async function testAllMasters() {
  const filePath = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const vm = require('vm');
  const code = fs.readFileSync('src/renderer/core/VisioConverter.js', 'utf8');
  const sandbox = {
    console,
    fabric: { Rect: class {}, Path: class {}, Group: class {}, Text: class {}, Image: class {} },
    DOMParser: class { querySelectorAll() { return []; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.VisioConverter = VisioConverter;', sandbox);
  const VisioConverter = sandbox.VisioConverter;

  for (const [name, file] of [['router', 'master9.xml'], ['switch', 'master13.xml'], ['firewall', 'master14.xml']]) {
    const xml = await zip.file(`visio/masters/${file}`).async('text');
    const shapeM = xml.match(/<Shape\s+[^>]*ID=['"]5['"][^>]*>([\s\S]*?)<\/Shapes>\s*<\/MasterContents>/);
    const shapeXml = shapeM ? shapeM[0].replace(/<\/Shapes>\s*<\/MasterContents>$/, '') : xml;
    const wM = shapeXml.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
    const hM = shapeXml.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
    const w = wM ? parseFloat(wM[1]) * 96 : 50;
    const h = hM ? parseFloat(hM[1]) * 96 : 50;

    const svgInner = VisioConverter._parseMasterShapeXml(shapeXml, w, h, true);
    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}">\n${svgInner}\n</svg>`;
    fs.writeFileSync(`scripts/${name}.svg`, fullSvg);
    console.log(`Generated scripts/${name}.svg (w=${w.toFixed(1)}, h=${h.toFixed(1)})`);
  }
}
testAllMasters();

