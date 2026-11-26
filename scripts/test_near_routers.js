const fs = require('fs');
const JSZip = require('jszip');

async function checkNearRouters() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1 = await zip.file('visio/pages/page1.xml').async('text');

  const shapeRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let s;
  while ((s = shapeRegex.exec(p1)) !== null) {
    const sAttrs = s[1];
    const sId = s[2];
    const content = s[3];
    const pxM = content.match(/<Cell\s+[^>]*N=['"]PinX['"][^>]*V=['"]([^'"]+)['"]/);
    const pyM = content.match(/<Cell\s+[^>]*N=['"]PinY['"][^>]*V=['"]([^'"]+)['"]/);
    if (pxM && pyM) {
      const px = parseFloat(pxM[1]);
      const py = parseFloat(pyM[1]);
      if (Math.abs(px - 4.33) < 0.5 && Math.abs(py - 9.14) < 0.5) {
        console.log(`Near Router 1 (4.33, 9.14): Shape ID=${sId} attrs=${sAttrs.trim().substring(0, 80)}`);
      }
      if (Math.abs(px - 5.78) < 0.5 && Math.abs(py - 9.14) < 0.5) {
        console.log(`Near Router 2 (5.78, 9.14): Shape ID=${sId} attrs=${sAttrs.trim().substring(0, 80)}`);
      }
    }
  }
}
checkNearRouters();

