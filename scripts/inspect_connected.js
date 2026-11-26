const fs = require('fs');
const JSZip = require('jszip');
async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  ['761', '755', '740', '763'].forEach(id => {
    const regex = new RegExp('<Shape\\s+[^>]*ID=[\'"]' + id + '[\'"][^>]*>([\\s\\S]*?)<\\/Shape>');
    const m = p1Xml.match(regex);
    if (m) {
      const name = (m[0].match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
      const master = (m[0].match(/Master=['"]([^'"]+)['"]/) || [])[1];
      console.log(`Shape ID=${id} Name=${name} Master=${master}`);
    } else {
      console.log(`Shape ID=${id} not found as top-level shape, searching inside groups...`);
      const anyRegex = new RegExp('<Shape\\s+[^>]*ID=[\'"]' + id + '[\'"][^>]*>');
      const anyM = p1Xml.match(anyRegex);
      if (anyM) console.log(`  Found: ${anyM[0]}`);
    }
  });
}
test();

