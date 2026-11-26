const fs = require('fs');
const JSZip = require('jszip');

async function checkLegendText() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1 = await zip.file('visio/pages/page1.xml').async('text');

  const shapeRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let s;
  while ((s = shapeRegex.exec(p1)) !== null) {
    const sId = s[2];
    const content = s[3];
    const textM = content.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
    if (textM && (textM[1].includes('Router') || textM[1].includes('Switch') || textM[1].includes('Firewall') || textM[1].includes('Ring'))) {
      const text = textM[1].replace(/<[^>]+>/g, '').trim();
      const szM = content.match(/<Section\s+[^>]*N=['"]Character['"][\s\S]*?<Cell\s+[^>]*N=['"]Size['"][^>]*V=['"]([^'"]+)['"]/);
      const szVal = szM ? szM[1] : 'null';
      const szInches = parseFloat(szVal);
      console.log(`Shape ${sId} text="${text}" Size Cell V="${szVal}" (inches) -> in pt: ${szInches * 72}pt, in 96dpi px: ${szInches * 96}px`);
    }
  }
}
checkLegendText();

