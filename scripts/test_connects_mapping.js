const fs = require('fs');
const JSZip = require('jszip');

async function inspectLegend() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  // Find shape 606
  const s606Match = p1Xml.match(/<Shape\s+[^>]*ID=['"]606['"][^>]*>([\s\S]*?)<\/Shape>/);
  if (s606Match) {
    console.log('Shape 606 XML snippet:', s606Match[0].substring(0, 400));
    const childShapes = Array.from(s606Match[0].matchAll(/<Shape\s+[^>]*ID=['"]([^'"]+)['"][^>]*>/g));
    console.log('Shape 606 child shape IDs:', childShapes.map(c => c[1]));
  }
}
inspectLegend();

