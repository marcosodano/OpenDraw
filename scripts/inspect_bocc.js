const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  // Let's find shapes with BOCC or text or near top right
  const sRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let match;
  while ((match = sRegex.exec(p1Xml)) !== null) {
    const attrs = match[1];
    const id = match[2];
    const body = match[3];
    if (body.includes('BOCC') || body.includes('NOCC') || id === '604' || id === '596' || id === '602' || id === '603' || id === '605') {
      console.log(`\n=================== SHAPE ID=${id} ===================`);
      console.log('Attrs:', attrs);
      const cells = Array.from(body.matchAll(/<Cell\s+([^>]+)>/g)).map(m => m[1]);
      ['PinX', 'PinY', 'Width', 'Height', 'FillForegnd', 'FillBkgnd', 'FillPattern', 'LineColor', 'LinePattern', 'LineWeight'].forEach(cName => {
        const c = cells.find(x => x.includes(`N='${cName}'`) || x.includes(`N="${cName}"`));
        if (c) console.log(`  ${cName}: ${c}`);
      });
      const textM = body.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
      if (textM) console.log('  Text:', textM[1].replace(/<[^>]+>/g, '').trim());
    }
  }
}
test();

