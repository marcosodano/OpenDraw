const fs = require('fs');
const JSZip = require('jszip');

async function checkOtherCrosses() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  
  for (const id of ['203', '400', '591']) {
    const m = p1Xml.match(new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`));
    if (m) {
      const s = m[0];
      const name = (s.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
      const master = (s.match(/Master=['"]([^'"]+)['"]/) || [])[1];
      const angle = (s.match(/<Cell\s+[^>]*N=['"]Angle['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];
      const fill = (s.match(/<Cell\s+[^>]*N=['"]FillForegnd['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];
      console.log(`Cross ID=${id} Name=${name} Master=${master} Angle=${angle} Fill=${fill}`);
    }
  }
}
checkOtherCrosses();

