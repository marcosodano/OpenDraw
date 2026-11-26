const fs = require('fs');
const JSZip = require('jszip');

async function checkLegendPositions() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1 = await zip.file('visio/pages/page1.xml').async('text');

  ['349', '350', '368', '369', '430'].forEach(id => {
    const sRegex = new RegExp('<Shape\\s+[^>]*ID=[\'"]' + id + '[\'"][^>]*>([\\s\\S]*?)<\\/Shape>');
    const m = p1.match(sRegex);
    if (m) {
      const px = m[1].match(/<Cell\s+[^>]*N=['"]PinX['"][^>]*V=['"]([^'"]+)['"]/);
      const py = m[1].match(/<Cell\s+[^>]*N=['"]PinY['"][^>]*V=['"]([^'"]+)['"]/);
      const w = m[1].match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
      const h = m[1].match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
      const txt = m[1].match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
      console.log(`Shape ${id}: "${txt[1].replace(/<[^>]+>/g, '').trim()}" PinX=${px ? px[1] : ''} PinY=${py ? py[1] : ''} w=${w ? w[1] : ''} h=${h ? h[1] : ''}`);
    }
  });
}
checkLegendPositions();

