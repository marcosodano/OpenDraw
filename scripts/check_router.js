const fs = require('fs');
const JSZip = require('jszip');

async function check() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1 = await zip.file('visio/pages/page1.xml').async('text');

  // Find shapes with Master='17'
  const shapeRegex = /<Shape\s+([^>]*Master=['"]17['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let s;
  while ((s = shapeRegex.exec(p1)) !== null) {
    console.log('Router shape in page1:', s[1]);
    const fillM = s[2].match(/<Cell\s+[^>]*N=['"]FillForegnd['"][^>]*V=['"]([^'"]+)['"]/);
    const lineM = s[2].match(/<Cell\s+[^>]*N=['"]LineColor['"][^>]*V=['"]([^'"]+)['"]/);
    console.log('  FillForegnd:', fillM ? fillM[1] : 'none');
    console.log('  LineColor:', lineM ? lineM[1] : 'none');
  }
}
check();

