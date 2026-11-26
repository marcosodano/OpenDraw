const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);

  const relsXml = await zip.file('visio/pages/_rels/pages.xml.rels').async('text');
  console.log('--- pages.xml.rels ---');
  console.log(relsXml);

  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  console.log('page1.xml length:', p1Xml.length);

  // Check masters in masters.xml
  const mastersXml = await zip.file('visio/masters/masters.xml').async('text');
  const masterMatches = Array.from(mastersXml.matchAll(/<Master\s+([^>]+)>/g));
  console.log('Masters count:', masterMatches.length);
  for (const m of masterMatches) {
    const id = (m[1].match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (m[1].match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
    console.log(`  Master ID=${id} Name=${name}`);
  }

  // Count connects in page1.xml
  const connects = Array.from(p1Xml.matchAll(/<Connect\s+([^>]+)\/>/g));
  console.log('\nConnects count in page1.xml:', connects.length);
  for (let i = 0; i < Math.min(10, connects.length); i++) {
    console.log(' ', connects[i][1]);
  }

  // Top level shapes in page1.xml
  const shapesIdx = p1Xml.indexOf('<Shapes>');
  const endShapesIdx = p1Xml.lastIndexOf('</Shapes>');
  const shapesContent = p1Xml.substring(shapesIdx + 8, endShapesIdx);
  
  let depth = 0;
  let start = -1;
  const topShapes = [];
  const tagRegex = /<\/?Shape\b[^>]*>/g;
  let t;
  while ((t = tagRegex.exec(shapesContent)) !== null) {
    if (t[0].startsWith('</')) {
      depth--;
      if (depth === 0 && start >= 0) {
        topShapes.push(shapesContent.substring(start, tagRegex.lastIndex));
        start = -1;
      }
    } else if (!t[0].endsWith('/>')) {
      if (depth === 0) start = t.index;
      depth++;
    } else {
      if (depth === 0) {
        topShapes.push(t[0]);
      }
    }
  }

  console.log(`\nTop-level shapes count in page1.xml: ${topShapes.length}`);
  for (let i = 0; i < Math.min(30, topShapes.length); i++) {
    const sXml = topShapes[i];
    const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const master = (sXml.match(/Master=['"]([^'"]+)['"]/) || [])[1];
    const name = (sXml.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
    const type = (sXml.match(/Type=['"]([^'"]+)['"]/) || [])[1];
    const textM = sXml.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
    const text = textM ? textM[1].replace(/<[^>]+>/g, '').trim().substring(0, 30) : '';
    console.log(`Shape #${i+1}: ID=${id} Master=${master} Type=${type} Name=${name} Text="${text}"`);
  }
}
test();
