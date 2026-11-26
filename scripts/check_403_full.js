const fs = require('fs');
const JSZip = require('jszip');

async function check403() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const m403 = p1Xml.match(/<Shape\s+[^>]*ID=['"]403['"][^>]*>([\s\S]*?)<\/Shape>/);
  const m404 = p1Xml.match(/<Shape\s+[^>]*ID=['"]404['"][^>]*>([\s\S]*?)<\/Shape>/);
  console.log('Shape 403:');
  console.log(m403[0]);
  console.log('\nShape 404:');
  console.log(m404[0]);
}
check403();

