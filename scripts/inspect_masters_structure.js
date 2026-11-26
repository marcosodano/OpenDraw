const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);

  for (let i = 1; i <= 16; i++) {
    const f = zip.file(`visio/masters/master${i}.xml`);
    if (f) {
      const content = await f.async('text');
      const hasGeom = content.includes('<Section N=\'Geometry\'') || content.includes('<Section N="Geometry"');
      const hasShapes = content.includes('<Shapes>');
      const hasForeign = content.includes('Type=\'Foreign\'') || content.includes('Type="Foreign"');
      const shapesCount = (content.match(/<Shape\b/g) || []).length;
      console.log(`master${i}.xml: shapes=${shapesCount}, hasShapes=${hasShapes}, hasGeom=${hasGeom}, hasForeign=${hasForeign}`);
    }
  }
}
test();

