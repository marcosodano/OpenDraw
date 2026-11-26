const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  const pagePixelHeight = Math.round(45.27165354330709 * 96);

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

  let totalConnectors = 0;
  let withGeom = 0;
  let samplePts = null;

  for (const sXml of topShapes) {
    const hasBeginX = sXml.includes("N='BeginX'") || sXml.includes('N="BeginX"');
    const hasEndX = sXml.includes("N='EndX'") || sXml.includes('N="EndX"');
    const masterId = (sXml.match(/Master=['"]([^'"]+)['"]/) || [])[1];
    const name = (sXml.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1] || '';

    if ((hasBeginX && hasEndX) || masterId === '2' || name.toLowerCase().includes('dynamic connector')) {
      totalConnectors++;
      const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
      const bxCell = sXml.match(/<Cell\s+[^>]*N=['"]BeginX['"][^>]*V=['"]([^'"]+)['"]/);
      const byCell = sXml.match(/<Cell\s+[^>]*N=['"]BeginY['"][^>]*V=['"]([^'"]+)['"]/);
      const exCell = sXml.match(/<Cell\s+[^>]*N=['"]EndX['"][^>]*V=['"]([^'"]+)['"]/);
      const eyCell = sXml.match(/<Cell\s+[^>]*N=['"]EndY['"][^>]*V=['"]([^'"]+)['"]/);

      const bx = bxCell ? parseFloat(bxCell[1]) : 0;
      const by = byCell ? parseFloat(byCell[1]) : 0;
      const ex = exCell ? parseFloat(exCell[1]) : bx;
      const ey = eyCell ? parseFloat(eyCell[1]) : by;

      const geomMatch = sXml.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
      if (geomMatch) {
        withGeom++;
        const points = [{ x: bx * 96, y: pagePixelHeight - by * 96 }];
        let curX = 0, curY = 0;
        const rowRegex = /<Row\s+([^>]+)>([\s\S]*?)<\/Row>/g;
        let r;
        while ((r = rowRegex.exec(geomMatch[1])) !== null) {
          const rAttrs = r[1];
          const rBody = r[2];
          if (rAttrs.includes("Del='1'")) continue;
          const xM = rBody.match(/<Cell\s+[^>]*N=['"]X['"][^>]*V=['"]([^'"]+)['"]/);
          const yM = rBody.match(/<Cell\s+[^>]*N=['"]Y['"][^>]*V=['"]([^'"]+)['"]/);
          if (xM) curX = parseFloat(xM[1]);
          if (yM) curY = parseFloat(yM[1]);
          const ptX = (bx + curX) * 96;
          const ptY = pagePixelHeight - (by + curY) * 96;
          points.push({ x: ptX, y: ptY });
        }
        if (!samplePts && points.length > 3) {
          samplePts = { id, points };
        }
      }
    }
  }

  console.log(`Total connectors: ${totalConnectors}, with geometry: ${withGeom}`);
  if (samplePts) {
    console.log(`Sample connector ID=${samplePts.id} points:`, samplePts.points);
  }
}
test();

