const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  // Let's find all shapes with LineColor = #00b050 (green) or #0070c0 (blue)
  const shapeRegex = /<Shape\s+([^>]+)>([\s\S]*?)<\/Shape>/g;
  let match;
  console.log('--- Green (#00b050) and Blue (#0070c0) Shapes in Page 1 ---');
  while ((match = shapeRegex.exec(p1Xml)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const id = (attrs.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (attrs.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];

    if (body.includes('00b050') || body.includes('0070c0')) {
      console.log(`\n=== Shape ID ${id} (${name}) ===`);
      // Print cells
      const cells = Array.from(body.matchAll(/<Cell\s+[^>]*N=['"]([^'"]+)['"][^>]*V=['"]([^'"]*)['"]/g)).map(m => `${m[1]}=${m[2]}`);
      console.log('Cells:', cells.slice(0, 15).join(', '));
      // Print geometry
      const geomM = body.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
      if (geomM) {
        console.log('Geom rows:\n', geomM[1].trim());
      }
    }
  }
}

run().catch(console.error);

