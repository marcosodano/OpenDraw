const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  // Let's test the connector logic in VisioConverter:
  const pagePixelHeight = 11.22774532013872 * 96;

  function _getDirectCellFromXml(sXml, cellName) {
    const rx = new RegExp(`<Cell\\s+[^>]*N=['"]${cellName}['"][^>]*V=['"]([^'"]*)['"](?:[^>]*F=['"]([^'"]*)['"])?`);
    const m = sXml.match(rx);
    if (m) return { val: m[1], formula: m[2] || null };
    const rxF = new RegExp(`<Cell\\s+[^>]*N=['"]${cellName}['"][^>]*F=['"]([^'"]*)['"]`);
    const mF = sXml.match(rxF);
    if (mF) return { val: null, formula: mF[1] };
    return { val: null, formula: null };
  }

  function convertConnector(sXml, shapeId) {
    const bxCell = _getDirectCellFromXml(sXml, 'BeginX');
    const byCell = _getDirectCellFromXml(sXml, 'BeginY');
    const exCell = _getDirectCellFromXml(sXml, 'EndX');
    const eyCell = _getDirectCellFromXml(sXml, 'EndY');
    const pxCell = _getDirectCellFromXml(sXml, 'PinX');
    const pyCell = _getDirectCellFromXml(sXml, 'PinY');
    const lpxCell = _getDirectCellFromXml(sXml, 'LocPinX');
    const lpyCell = _getDirectCellFromXml(sXml, 'LocPinY');

    let originX = 0;
    let originY = 0;
    if (pxCell.val && lpxCell.val) {
      originX = parseFloat(pxCell.val) - parseFloat(lpxCell.val);
    } else if (bxCell.val) {
      originX = parseFloat(bxCell.val);
    }
    if (pyCell.val && lpyCell.val) {
      originY = parseFloat(pyCell.val) - parseFloat(lpyCell.val);
    } else if (byCell.val) {
      originY = parseFloat(byCell.val);
    }

    const bx = bxCell.val ? parseFloat(bxCell.val) * 96 : originX * 96;
    const by = byCell.val ? pagePixelHeight - parseFloat(byCell.val) * 96 : pagePixelHeight - originY * 96;
    const ex = exCell.val ? parseFloat(exCell.val) * 96 : bx;
    const ey = eyCell.val ? pagePixelHeight - parseFloat(eyCell.val) * 96 : by;

    let pathD = '';
    const geomMatch = sXml.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
    if (geomMatch) {
      let curX = 0;
      let curY = 0;
      let curPx = (originX + curX) * 96;
      let curPy = pagePixelHeight - (originY + curY) * 96;

      pathD = `M ${curPx.toFixed(2)} ${curPy.toFixed(2)} `;

      const rowRegex = /<Row\s+([^>]+)>([\s\S]*?)<\/Row>/g;
      let r;
      let hasRows = false;
      while ((r = rowRegex.exec(geomMatch[1])) !== null) {
        hasRows = true;
        const rAttrs = r[1];
        const rBody = r[2];
        const tMatch = rAttrs.match(/T=['"]([^'"]+)['"]/);
        const rowType = tMatch ? tMatch[1] : 'LineTo';

        const xM = rBody.match(/<Cell\s+[^>]*N=['"]X['"][^>]*V=['"]([^'"]+)['"]/);
        const yM = rBody.match(/<Cell\s+[^>]*N=['"]Y['"][^>]*V=['"]([^'"]+)['"]/);

        if (xM) curX = parseFloat(xM[1]);
        if (yM) curY = parseFloat(yM[1]);

        const ptX = (originX + curX) * 96;
        const ptY = pagePixelHeight - (originY + curY) * 96;

        if (rowType.includes('MoveTo')) {
          pathD += `M ${ptX.toFixed(2)} ${ptY.toFixed(2)} `;
          curPx = ptX;
          curPy = ptY;
        } else if (rowType.includes('LineTo')) {
          pathD += `L ${ptX.toFixed(2)} ${ptY.toFixed(2)} `;
          curPx = ptX;
          curPy = ptY;
        } else if (rowType.includes('ArcTo')) {
          const dx = ptX - curPx;
          const dy = ptY - curPy;
          const dist = Math.max(0.01, Math.hypot(dx, dy));
          const rad = dist / 2;
          pathD += `A ${rad.toFixed(2)} ${rad.toFixed(2)} 0 0 1 ${ptX.toFixed(2)} ${ptY.toFixed(2)} `;
          curPx = ptX;
          curPy = ptY;
        }
      }
    }
    return { id: shapeId, originX, originY, bx, by, ex, ey, pathD };
  }

  for (const id of ['31', '32', '33', '34']) {
    const regex = new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`);
    const m = p1Xml.match(regex);
    if (m) {
      const res = convertConnector(m[0], id);
      console.log(`\nConnector ${id}:`);
      console.log(`  Origin: (${res.originX.toFixed(3)}, ${res.originY.toFixed(3)})`);
      console.log(`  Begin: (${res.bx.toFixed(1)}, ${res.by.toFixed(1)}), End: (${res.ex.toFixed(1)}, ${res.ey.toFixed(1)})`);
      console.log(`  Path: ${res.pathD}`);
    }
  }
}

run().catch(console.error);

