const fs = require('fs');
const JSZip = require('jszip');

async function findGreenShapes() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const shapesIdx = p1Xml.indexOf('<Shapes>');
  const endShapesIdx = p1Xml.lastIndexOf('</Shapes>');
  const shapesContent = p1Xml.substring(shapesIdx + 8, endShapesIdx);

  let depth = 0, start = -1;
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
      if (depth === 0) topShapes.push(t[0]);
    }
  }

  console.log(`Checking ${topShapes.length} top shapes for green line color (#00964e or 150,78)...`);
  for (const sXml of topShapes) {
    if (sXml.includes('00964e') || sXml.includes('150,78') || sXml.includes('0,150,78')) {
      const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
      const name = (sXml.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
      const master = (sXml.match(/Master=['"]([^'"]+)['"]/) || [])[1];
      const type = (sXml.match(/Type=['"]([^'"]+)['"]/) || [])[1];
      const hasBeginX = sXml.includes('BeginX');
      const textM = sXml.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
      const text = textM ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
      console.log(`Shape ID=${id} Master=${master} Type=${type} Name="${name}" Text="${text}" HasBeginX=${hasBeginX}`);
    }
  }
}
findGreenShapes();

