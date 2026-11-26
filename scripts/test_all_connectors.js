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

  let connPoints = [{ x: bx, y: by }];
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

  if (connPoints.length < 2) {
    if (Math.abs(bx - ex) > 2 && Math.abs(by - ey) > 2) {
      const midX = (bx + ex) / 2;
      connPoints = [{ x: bx, y: by }, { x: midX, y: by }, { x: midX, y: ey }, { x: ex, y: ey }];
    } else {
      connPoints = [{ x: bx, y: by }, { x: ex, y: ey }];
    }
  }

  return connPoints;
}

function checkOrthogonal(points) {
  let diagCount = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    if (dx > 1 && dy > 1) {
      diagCount++;
    }
  }
  return diagCount;
}

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  for (let p = 1; p <= 3; p++) {
    const pXml = await zip.file('visio/pages/page' + p + '.xml').async('text');
    const pagePixelHeight = Math.round(45.27165354330709 * 96);
    const shapes = Array.from(pXml.matchAll(/<Shape\s+[^>]*ID=['"](\d+)['"][^>]*>([\s\S]*?)<\/Shape>/g));
    let totalConn = 0;
    let totalDiagSegments = 0;
    for (const s of shapes) {
      const sXml = s[0];
      const hasBeginX = sXml.includes("N='BeginX'") || sXml.includes('N="BeginX"');
      const hasEndX = sXml.includes("N='EndX'") || sXml.includes('N="EndX"');
      if (hasBeginX && hasEndX) {
        totalConn++;
        const pts = parseConnectorPoints(sXml, pagePixelHeight);
        const diags = checkOrthogonal(pts);
        if (diags > 0) {
          totalDiagSegments += diags;
          console.log(`  Page ${p} Diag Conn ID=${s[1]}: pts=${pts.length}`);
        }
      }
    }
    console.log(`Page ${p}: Connectors=${totalConn}, DiagSegments=${totalDiagSegments}`);
  }
}
run();
