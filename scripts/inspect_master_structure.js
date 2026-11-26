const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);

  for (const f of ['master9.xml', 'master13.xml', 'master14.xml']) {
    const xml = await zip.file('visio/masters/' + f).async('text');
    console.log(`\n================= ${f} (${xml.length} bytes) =================`);
    // Find all <Shapes> and <Shape> tags
    const shapesTagIdx = xml.indexOf('<Shapes>');
    console.log('Index of <Shapes>:', shapesTagIdx);
    const shapeTags = Array.from(xml.matchAll(/<Shape\s+([^>]+)>/g)).map(m => m[1]);
    console.log('Shapes attributes:', shapeTags.slice(0, 5));
  }
}

run().catch(console.error);

