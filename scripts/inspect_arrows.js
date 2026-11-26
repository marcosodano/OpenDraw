const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const arrows = Array.from(p1Xml.matchAll(/<Cell\s+[^>]*N=['"](?:BeginArrow|EndArrow)['"][^>]*V=['"]([^'"]+)['"]/g));
  console.log(`Found ${arrows.length} arrow cells in page1.xml`);
  const values = new Set(arrows.map(a => a[1]));
  console.log('Arrow values:', Array.from(values));
}
test();

