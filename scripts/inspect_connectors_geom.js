const fs = require('fs');
const JSZip = require('jszip');
async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  ['236', '708', '728', '849'].forEach(id => {
    const m = p1Xml.match(new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`));
    if (m) {
      console.log(`\n--- Shape ID=${id} ---`);
      const geomM = m[0].match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
      if (geomM) console.log(geomM[0]);
    }
  });
}
test();

