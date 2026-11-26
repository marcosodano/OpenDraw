const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const m6 = await zip.file('visio/masters/master6.xml').async('text');
  console.log('--- master6.xml (Plain) ---');
  console.log(m6.substring(0, 1500));
}
test();

