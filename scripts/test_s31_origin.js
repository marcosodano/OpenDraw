const fs = require('fs');
const JSZip = require('jszip');

async function testShape31() {
  const filePath = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const pagePixelHeight = 11 * 96; // 1056

  const sRegex = /<Shape\s+[^>]*ID=['"]31['"][^>]*>([\s\S]*?)<\/Shape>/;
  const m = p1Xml.match(sRegex);
  const sXml = m[1];

  const pxCell = (sXml.match(/<Cell\s+[^>]*N=['"]PinX['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];
  const pyCell = (sXml.match(/<Cell\s+[^>]*N=['"]PinY['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];
  const lpxCell = (sXml.match(/<Cell\s+[^>]*N=['"]LocPinX['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];
  const lpyCell = (sXml.match(/<Cell\s+[^>]*N=['"]LocPinY['"][^>]*V=['"]([^'"]+)['"]/) || [])[1];

  const originX = parseFloat(pxCell) - parseFloat(lpxCell);
  const originY = parseFloat(pyCell) - parseFloat(lpyCell);

  let curX = 0;
  let curY = 0;
  let curPx = originX * 96;
  let curPy = pagePixelHeight - originY * 96;

  let pathD = `M ${curPx.toFixed(2)} ${curPy.toFixed(2)} `;

  const geomMatch = sXml.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
  const rowRegex = /<Row\s+([^>]+)>([\s\S]*?)<\/Row>/g;
  let r;
  while ((r = rowRegex.exec(geomMatch[1])) !== null) {
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
    } else if (rowType.includes('LineTo')) {
      pathD += `L ${ptX.toFixed(2)} ${ptY.toFixed(2)} `;
    }
  }

  console.log('Connector 31 with implicit origin (0, 0):');
  console.log(pathD);
}

testShape31();

