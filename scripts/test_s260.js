const fs = require('fs');
const JSZip = require('jszip');

async function checkShape260() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1 = await zip.file('visio/pages/page1.xml').async('text');

  const shapeRegex = /<Shape\s+([^>]*ID=['"]260['"][^>]*)>([\s\S]*?)<\/Shape>/;
  const m = p1.match(shapeRegex);
  if (m) {
    console.log('Attrs:', m[1]);
    console.log('Content:\n', m[2]);
  }
}
checkShape260();

