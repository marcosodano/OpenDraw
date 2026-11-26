const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  // Let's find every single Shape in page1.xml and print ID, Name, PinX, PinY, BeginX, BeginY, EndX, EndY, LineColor
  const shapeRegex = /<Shape\s+([^>]+)>([\s\S]*?)<\/Shape>/g;
  let match;
  while ((match = shapeRegex.exec(p1Xml)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const id = (attrs.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (attrs.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];

    const getCell = (name) => {
      const m = body.match(new RegExp(`<Cell\\s+[^>]*N=['"]${name}['"][^>]*V=['"]([^'"]*)['"](?:[^>]*F=['"]([^'"]*)['"])?`));
      return m ? { val: m[1], formula: m[2] } : null;
    };
    const py = getCell('PinY');
    const by = getCell('BeginY');
    const pyVal = py ? parseFloat(py.val) : (by ? parseFloat(by.val) : 0);

    if (pyVal > 9.5) {
      const px = getCell('PinX');
      const bx = getCell('BeginX');
      const ex = getCell('EndX');
      const ey = getCell('EndY');
      const lc = getCell('LineColor');
      const fc = getCell('FillForegnd');
      const textM = body.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
      const text = textM ? textM[1].replace(/<[^>]+>/g, '').trim() : '';

      console.log(`ID ${id} (${name}) Pin=(${px?.val}, ${py?.val}), Begin=(${bx?.val}, ${by?.val}), End=(${ex?.val}, ${ey?.val}), LineColor=${lc?.val || lc?.formula}, Fill=${fc?.val || fc?.formula}, Text="${text}"`);
    }
  }
}

run().catch(console.error);

