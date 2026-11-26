const fs = require('fs');
const JSZip = require('jszip');

async function checkMaster21() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1 = await zip.file('visio/pages/page1.xml').async('text');

  const shapeRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let s;
  while ((s = shapeRegex.exec(p1)) !== null) {
    const sAttrs = s[1];
    const sId = s[2];
    const content = s[3];
    if (sAttrs.includes('Master="21"') || sAttrs.includes("Master='21'")) {
      const pX = (content.match(/<Cell\s+[^>]*N=['"]PinX['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];
      const pY = (content.match(/<Cell\s+[^>]*N=['"]PinY['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];
      const name = (sAttrs.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
      console.log(`Shape ID=${sId} "${name}": PinX=${parseFloat(pX).toFixed(2)}, PinY=${parseFloat(pY).toFixed(2)}`);
    }
  }
}
checkMaster21();

