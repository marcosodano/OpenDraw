const fs = require('fs');
const JSZip = require('jszip');

async function inspect403() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  for (const id of ['403', '404', '439', '440', '435', '436']) {
    const m = p1Xml.match(new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`));
    if (m) {
      console.log(`\n=================== SHAPE ID ${id} ===================`);
      console.log(m[0].substring(0, 1000));
    }
  }
}
inspect403();

