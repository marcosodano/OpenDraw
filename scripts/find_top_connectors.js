const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const shapeRegex = /<Shape\s+([^>]+)>([\s\S]*?)<\/Shape>/g;
  let match;
  console.log('--- Connectors with Y > 8.5 ---');
  while ((match = shapeRegex.exec(p1Xml)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const id = (attrs.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (attrs.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];

    const getVal = (name) => {
      const m = body.match(new RegExp(`<Cell\\s+[^>]*N=['"]${name}['"][^>]*V=['"]([^'"]+)['"]`));
      return m ? m[1] : null;
    };
    const bx = parseFloat(getVal('BeginX') || '0');
    const by = parseFloat(getVal('BeginY') || '0');
    const ex = parseFloat(getVal('EndX') || '0');
    const ey = parseFloat(getVal('EndY') || '0');
    const lc = getVal('LineColor');

    if (by > 8.5 || ey > 8.5) {
      console.log(`\nID ${id} (${name}) LineColor=${lc}:`);
      console.log(`  Begin=(${bx.toFixed(3)}, ${by.toFixed(3)}), End=(${ex.toFixed(3)}, ${ey.toFixed(3)})`);
      const geomM = body.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
      if (geomM) {
        console.log('  Geom:', geomM[1].trim().replace(/\s+/g, ' '));
      }
    }
  }
}

run().catch(console.error);

