const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const sRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let match;
  console.log('Containers and large shapes in page1:');
  while ((match = sRegex.exec(p1Xml)) !== null) {
    const attrs = match[1];
    const id = match[2];
    const body = match[3];
    const name = (attrs.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1] || '';
    const master = (attrs.match(/Master=['"]([^'"]+)['"]/) || [])[1] || '';
    const textM = body.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
    const txt = textM ? textM[1].replace(/<[^>]+>/g, '').trim() : '';

    const wM = body.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
    const hM = body.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
    const w = wM ? parseFloat(wM[1]) : 0;
    const h = hM ? parseFloat(hM[1]) : 0;

    if (w > 1.5 && h > 1.5) {
      const fillM = body.match(/<Cell\s+[^>]*N=['"]FillForegnd['"][^>]*V=['"]([^'"]+)['"]/);
      const fillF = body.match(/<Cell\s+[^>]*N=['"]FillForegnd['"][^>]*F=['"]([^'"]+)['"]/);
      const lineM = body.match(/<Cell\s+[^>]*N=['"]LineColor['"][^>]*V=['"]([^'"]+)['"]/);
      const lineF = body.match(/<Cell\s+[^>]*N=['"]LineColor['"][^>]*F=['"]([^'"]+)['"]/);
      console.log(`ID=${id} Master=${master} Name="${name}" Text="${txt}" W=${w.toFixed(2)} H=${h.toFixed(2)} FillV="${fillM ? fillM[1] : ''}" FillF="${fillF ? fillF[1] : ''}" LineV="${lineM ? lineM[1] : ''}" LineF="${lineF ? lineF[1] : ''}"`);
    }
  }
}
test();

