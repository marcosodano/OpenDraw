const fs = require('fs');
const JSZip = require('jszip');

function _getDirectCellFromXml(xml, cellName) {
  const shapesIdx = xml.indexOf('<Shapes>');
  const head = shapesIdx >= 0 ? xml.substring(0, shapesIdx) : xml;
  const m = head.match(new RegExp(`<Cell\\s+[^>]*N=['"]${cellName}['"][^>]*\\/>`));
  if (!m) return { val: null, formula: null };
  const vMatch = m[0].match(/V=['"]([^'"]+)['"]/);
  const fMatch = m[0].match(/F=['"]([^'"]+)['"]/);
  return { val: vMatch ? vMatch[1] : null, formula: fMatch ? fMatch[1] : null };
}

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const pagePixelHeight = Math.round(45.27165354330709 * 96);
  const pagePixelWidth = Math.round(23.80314960629921 * 96);

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

  let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;

  for (const sXml of topShapes) {
    const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const wCell = _getDirectCellFromXml(sXml, 'Width');
    const hCell = _getDirectCellFromXml(sXml, 'Height');
    const pXCell = _getDirectCellFromXml(sXml, 'PinX');
    const pYCell = _getDirectCellFromXml(sXml, 'PinY');
    const lpXCell = _getDirectCellFromXml(sXml, 'LocPinX');
    const lpYCell = _getDirectCellFromXml(sXml, 'LocPinY');

    const w = wCell.val ? parseFloat(wCell.val) * 96 : 50;
    const h = hCell.val ? parseFloat(hCell.val) * 96 : 50;
    const pinX = pXCell.val ? parseFloat(pXCell.val) * 96 : 0;
    const pinY = pYCell.val ? parseFloat(pYCell.val) * 96 : 0;
    const locPinX = lpXCell.val ? parseFloat(lpXCell.val) * 96 : w / 2;
    const locPinY = lpYCell.val ? parseFloat(lpYCell.val) * 96 : h / 2;

    const left = pinX - locPinX;
    const top = pagePixelHeight - (pinY - locPinY + h);

    if (left < minLeft) minLeft = left;
    if (left + w > maxRight) maxRight = left + w;
    if (top < minTop) minTop = top;
    if (top + h > maxBottom) maxBottom = top + h;
  }

  console.log(`Page: ${pagePixelWidth} x ${pagePixelHeight}`);
  console.log(`Shapes: left=${minLeft.toFixed(1)}, right=${maxRight.toFixed(1)}, top=${minTop.toFixed(1)}, bottom=${maxBottom.toFixed(1)}`);
}
test();

