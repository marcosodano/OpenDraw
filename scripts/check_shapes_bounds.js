const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const pagePixelHeight = Math.round(45.27165354330709 * 96);
  const pagePixelWidth = Math.round(23.80314960629921 * 96);

  console.log(`Page dimensions: ${pagePixelWidth} x ${pagePixelHeight}`);

  let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;

  const sRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let match;
  while ((match = sRegex.exec(p1Xml)) !== null) {
    const body = match[3];
    const pxM = body.match(/<Cell\s+[^>]*N=['"]PinX['"][^>]*V=['"]([^'"]+)['"]/);
    const pyM = body.match(/<Cell\s+[^>]*N=['"]PinY['"][^>]*V=['"]([^'"]+)['"]/);
    const wM = body.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
    const hM = body.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
    if (pxM && pyM && wM && hM) {
      const pinX = parseFloat(pxM[1]) * 96;
      const pinY = parseFloat(pyM[1]) * 96;
      const w = parseFloat(wM[1]) * 96;
      const h = parseFloat(hM[1]) * 96;
      const left = pinX - w / 2;
      const top = pagePixelHeight - (pinY + h / 2);
      if (left < minLeft) minLeft = left;
      if (left + w > maxRight) maxRight = left + w;
      if (top < minTop) minTop = top;
      if (top + h > maxBottom) maxBottom = top + h;
    }
  }

  console.log(`Shapes bounding box: left=${minLeft.toFixed(1)}, right=${maxRight.toFixed(1)}, top=${minTop.toFixed(1)}, bottom=${maxBottom.toFixed(1)}`);
}
test();

