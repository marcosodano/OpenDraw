const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);

  const mastersMap = new Map();
  const mastersRelsFile = zip.file('visio/masters/_rels/masters.xml.rels');
  const mastersFile = zip.file('visio/masters/masters.xml');
  const mastersXml = await mastersFile.async('text');
  const mastersRelsXml = mastersRelsFile ? await mastersRelsFile.async('text') : '';
  const mRegex = /<Master\s+([^>]+)>/g;
  let mMatch;
  while ((mMatch = mRegex.exec(mastersXml)) !== null) {
    const id = (mMatch[1].match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (mMatch[1].match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1] || '';
    const relMatch = mastersXml.substring(mMatch.index).match(/<Rel\s+r:id=['"]([^'"]+)['"]/);
    console.log(`Master ID=${id} Name=${name} relMatch=${relMatch ? relMatch[1] : null}`);
    if (id && relMatch) {
      const rId = relMatch[1];
      const targetMatch = mastersRelsXml.match(new RegExp(`Id=["']${rId}["'][^>]*Target=["']([^"']+)["']`));
      console.log(`  targetMatch=${targetMatch ? targetMatch[1] : null}`);
    }
  }
}
test();

