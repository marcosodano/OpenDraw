const fs = require('fs');
const JSZip = require('jszip');
async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  const m = p1Xml.match(/<Shape\s+[^>]*ID=['"]728['"][^>]*>([\s\S]*?)<\/Shape>/);
  if (m) {
    const cells = Array.from(m[0].matchAll(/<Cell\s+([^>]+)>/g)).map(x => x[1]);
    ['PinX', 'PinY', 'LocPinX', 'LocPinY', 'Width', 'Height', 'Angle', 'BeginX', 'BeginY', 'EndX', 'EndY'].forEach(name => {
      const c = cells.find(x => x.includes(`N='${name}'`));
      if (c) console.log(c);
    });
  }
}
test();

