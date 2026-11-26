const fs = require('fs');
const JSZip = require('jszip');
async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  const m = p1Xml.match(/<Shape\s+[^>]*ID=['"]1064['"][^>]*>([\s\S]*?)<\/Shape>/);
  if (m) {
    const geomM = m[0].match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
    if (geomM) console.log(geomM[0]);
  }
}
test();

