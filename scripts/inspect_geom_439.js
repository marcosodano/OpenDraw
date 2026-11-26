const fs = require('fs');
const JSZip = require('jszip');

async function inspect477() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  for (const id of ['477', '478', '481', '482']) {
    const m = p1Xml.match(new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`));
    console.log(`=== FULL XML OF SHAPE ${id} ===`);
    console.log(m[0]);
  }
}
inspect477();

