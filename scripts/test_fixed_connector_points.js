const fs = require('fs');
const JSZip = require('jszip');

function parseConnectorPoints(sXml, pagePixelHeight) {
  const bxCell = sXml.match(/<Cell\s+[^>]*N=['"]BeginX['"][^>]*V=['"]([^'"]+)['"]/);
  const byCell = sXml.match(/<Cell\s+[^>]*N=['"]BeginY['"][^>]*V=['"]([^'"]+)['"]/);
  const exCell = sXml.match(/<Cell\s+[^>]*N=['"]EndX['"][^>]*V=['"]([^'"]+)['"]/);
  const eyCell = sXml.match(/<Cell\s+[^>]*N=['"]EndY['"][^>]*V=['"]([^'"]+)['"]/);

  const bx = bxCell ? parseFloat(bxCell[1]) * 96 : 0;
  const by = byCell ? pagePixelHeight - parseFloat(byCell[1]) * 96 : 0;
  const ex = exCell ? parseFloat(exCell[1]) * 96 : bx;
  const ey = eyCell ? pagePixelHeight - parseFloat(eyCell[1]) * 96 : by;

  const rawBx = bxCell ? parseFloat(bxCell[1]) : 0;
  const rawBy = byCell ? parseFloat(byCell[1]) : 0;

  const connPoints = [{ x: bx, y: by }];
  const geomMatch = sXml.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
  if (geomMatch) {
    let curX = 0;
    let curY = 0;
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

      const ptX = (rawBx + curX) * 96;
      const ptY = pagePixelHeight - (rawBy + curY) * 96;

      const lastPt = connPoints[connPoints.length - 1];
      if (Math.hypot(ptX - lastPt.x, ptY - lastPt.y) > 0.5) {
        connPoints.push({ x: ptX, y: ptY });
      }
    }
  }

  const lastPt = connPoints[connPoints.length - 1];
  if (Math.hypot(ex - lastPt.x, ey - lastPt.y) > 0.5) {
    connPoints.push({ x: ex, y: ey });
  }

  return connPoints;
}

function checkOrthogonal(points) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    if (dx > 0.5 && dy > 0.5) {
      return false; // diagonal segment
    }
  }
  return true;
}

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  const pagePixelHeight = Math.round(45.27165354330709 * 96);

  for (const id of ['477', '478', '481', '482', '439', '440', '23', '26']) {
    const m = p1Xml.match(new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`));
    if (m) {
      const pts = parseConnectorPoints(m[0], pagePixelHeight);
      const isOrtho = checkOrthogonal(pts);
      console.log(`Connector ID=${id}: ptsCount=${pts.length}, isOrthogonal=${isOrtho}`);
      console.log('   Points:', pts.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' -> '));
    }
  }
}
run();

