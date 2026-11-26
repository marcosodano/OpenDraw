const fs = require('fs');
const JSZip = require('jszip');

async function checkNoShow() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const mXml = await zip.file('visio/masters/master11.xml').async('text');

  const rootShape = mXml.match(/<Shape\s+[^>]*ID=['"]5['"][^>]*>([\s\S]*?)<\/Shapes>/);
  if (rootShape) {
    const cells = rootShape[1].match(/<Cell\s+[^>]+>/g) || [];
    cells.filter(c => c.includes('NoShow') || c.includes('NoLine') || c.includes('NoFill') || c.includes('HideText') || c.includes('Geometry')).forEach(c => console.log(c));
  }
}
checkNoShow();

