const fs = require('fs');
const JSZip = require('jszip');

async function check402LocPin() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1 = await zip.file('visio/pages/page1.xml').async('text');

  const shapeRegex = /<Shape\s+([^>]*ID=['"]402['"][^>]*)>([\s\S]*?)<\/Shape>/;
  const m = p1.match(shapeRegex);
  if (m) {
    ['PinX', 'PinY', 'LocPinX', 'LocPinY', 'Width', 'Height'].forEach(cell => {
      const cM = m[2].match(new RegExp('<Cell\\s+[^>]*N=[\'"]' + cell + '[\'"][^>]*V=[\'"]([^\'"]*)[\'"](?:\\s+F=[\'"]([^\'"]*)[\'"])?'));
      if (cM) console.log(`${cell}: val="${cM[1]}" F="${cM[2] || ''}"`);
      else console.log(`${cell}: NOT FOUND`);
    });
  }
}
check402LocPin();

