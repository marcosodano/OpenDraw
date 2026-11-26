const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const mastersXml = await zip.file('visio/masters/masters.xml').async('text');
  const relsXml = await zip.file('visio/masters/_rels/masters.xml.rels').async('text');

  console.log('--- Masters list ---');
  const masterRegex = /<Master\s+([^>]+)>/g;
  let m;
  while ((m = masterRegex.exec(mastersXml)) !== null) {
    const id = (m[1].match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (m[1].match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
    const relId = (m[1].match(/r:id=['"]([^'"]+)['"]/) || [])[1];
    console.log(`Master ID=${id} Name="${name}" RelId=${relId}`);
  }
}
test();

