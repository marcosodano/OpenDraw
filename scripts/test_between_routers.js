const fs = require('fs');
const JSZip = require('jszip');

async function checkBetweenRouters() {
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
      if (px >= 4.0 && px <= 6.5 && py >= 8.5 && py <= 11.5) {
        const textM = content.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
        const text = textM ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
        console.log(`Shape ID=${sId}: PinX=${px.toFixed(2)}, PinY=${py.toFixed(2)}, attrs=${sAttrs.trim().substring(0, 60)}, text="${text}"`);
      }
    }
  }
}
checkBetweenRouters();

