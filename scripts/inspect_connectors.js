const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  // Find all shapes with BeginX or LineColor or Master="Connector" or Line
  const shapeRegex = /<Shape\s+([^>]+)>([\s\S]*?)<\/Shape>/g;
  let match;
  console.log('--- Inspecting Connectors ---');
  while ((match = shapeRegex.exec(p1Xml)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const idM = attrs.match(/ID=['"]([^'"]+)['"]/);
    const id = idM ? idM[1] : '?';
    const nameM = attrs.match(/Name(?:U)?=['"]([^'"]+)['"]/);
    const name = nameM ? nameM[1] : '';

    const hasBeginX = body.includes('N=\'BeginX\'') || body.includes('N="BeginX"');
    const hasEndX = body.includes('N=\'EndX\'') || body.includes('N="EndX"');
    const isConn = hasBeginX || hasEndX || name.toLowerCase().includes('dynamic connector');

    if (isConn) {
      // Extract LineColor, BeginX, BeginY, EndX, EndY, PinX, PinY, Geometry rows
      const getVal = (name) => {
        const m = body.match(new RegExp(`<Cell\\s+[^>]*N=['"]${name}['"][^>]*V=['"]([^'"]+)['"]`));
        return m ? m[1] : null;
      };
      const lc = getVal('LineColor');
      const bx = getVal('BeginX');
      const by = getVal('BeginY');
      const ex = getVal('EndX');
      const ey = getVal('EndY');
      const px = getVal('PinX');
      const py = getVal('PinY');

      // Geometry rows
      const geomM = body.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
      let rowTypes = [];
      if (geomM) {
        const rowRegex = /<Row\s+[^>]*T=['"]([^'"]+)['"][^>]*>/g;
        let rm;
        while ((rm = rowRegex.exec(geomM[1])) !== null) {
          rowTypes.push(rm[1]);
        }
      }

      console.log(`ID ${id} (${name}): LineColor=${lc}, Begin=(${bx}, ${by}), End=(${ex}, ${ey}), Pin=(${px}, ${py}), Rows=[${rowTypes.join(', ')}]`);
      if (geomM && (id === '31' || id === '32' || id === '33' || id === '34' || id === '35' || id === '36' || id === '260' || id === '261')) {
        console.log(`  Geom XML for ID ${id}:`, geomM[1].trim());
      }
    }
  }
}

run().catch(console.error);

