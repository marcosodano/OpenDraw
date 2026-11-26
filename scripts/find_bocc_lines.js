const fs = require('fs');
const JSZip = require('jszip');

async function findGreenLines() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  const pagePixelHeight = Math.round(45.27165354330709 * 96);

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

  console.log('Searching top shapes for lines near BOCC or with green/blue stroke...');
  for (const sXml of topShapes) {
    const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (sXml.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1] || '';
    const masterId = (sXml.match(/Master=['"]([^'"]+)['"]/) || [])[1];
    const lineCell = sXml.match(/<Cell\s+[^>]*N=['"]LineColor['"][^>]*V=['"]([^'"]+)['"]/);
    const lineForm = sXml.match(/<Cell\s+[^>]*N=['"]LineColor['"][^>]*F=['"]([^'"]+)['"]/);
    const pxM = sXml.match(/<Cell\s+[^>]*N=['"]PinX['"][^>]*V=['"]([^'"]+)['"]/);
    const pyM = sXml.match(/<Cell\s+[^>]*N=['"]PinY['"][^>]*V=['"]([^'"]+)['"]/);
    const wM = sXml.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
    const hM = sXml.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);

    const px = pxM ? parseFloat(pxM[1]) * 96 : 0;
    const py = pyM ? pagePixelHeight - parseFloat(pyM[1]) * 96 : 0;
    const w = wM ? parseFloat(wM[1]) * 96 : 0;
    const h = hM ? parseFloat(hM[1]) * 96 : 0;

    // Check shapes near X: 1600-1900, Y: 2400-2900 (above BOCC)
    if (px >= 1400 && px <= 2100 && py >= 2300 && py <= 3000) {
      console.log(`ID=${id} Master=${masterId} Name="${name}" pos=(${px.toFixed(0)}, ${py.toFixed(0)}) size=(${w.toFixed(0)}, ${h.toFixed(0)}) Line=${lineCell ? lineCell[1] : null} ${lineForm ? lineForm[1] : ''}`);
      const textM = sXml.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
      if (textM) console.log('   Text:', textM[1].replace(/<[^>]+>/g, '').trim());
      const geomM = sXml.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>/);
      console.log('   Has geom:', !!geomM, 'Has BeginX:', sXml.includes('BeginX'));
    }
  }
}
findGreenLines();

