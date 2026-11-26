const fs = require('fs');
const JSZip = require('jszip');

async function testBBox() {
  const filePath = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  for (const mFile of ['master9.xml', 'master13.xml', 'master14.xml']) {
    const xml = await zip.file(`visio/masters/${mFile}`).async('text');
    console.log(`\n=== Testing ${mFile} ===`);
    // Find all Shapes with Geometry
    const shapeRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
    let s;
    while ((s = shapeRegex.exec(xml)) !== null) {
      const sId = s[2];
      const content = s[3];
      const wM = content.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
      const hM = content.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
      const pxM = content.match(/<Cell\s+[^>]*N=['"]PinX['"][^>]*V=['"]([^'"]+)['"]/);
      const pyM = content.match(/<Cell\s+[^>]*N=['"]PinY['"][^>]*V=['"]([^'"]+)['"]/);
      const lxM = content.match(/<Cell\s+[^>]*N=['"]LocPinX['"][^>]*V=['"]([^'"]+)['"]/);
      const lyM = content.match(/<Cell\s+[^>]*N=['"]LocPinY['"][^>]*V=['"]([^'"]+)['"]/);
      
      const w = wM ? parseFloat(wM[1]) * 96 : 0;
      const h = hM ? parseFloat(hM[1]) * 96 : 0;
      const px = pxM ? parseFloat(pxM[1]) * 96 : 0;
      const py = pyM ? parseFloat(pyM[1]) * 96 : 0;
      const lx = lxM ? parseFloat(lxM[1]) * 96 : 0;
      const ly = lyM ? parseFloat(lyM[1]) * 96 : 0;

      console.log(`Shape ${sId}: w=${w.toFixed(1)} h=${h.toFixed(1)} PinX=${px.toFixed(1)} PinY=${py.toFixed(1)} LocPinX=${lx.toFixed(1)} LocPinY=${ly.toFixed(1)} (left=${(px-lx).toFixed(1)}, bottom=${(py-ly).toFixed(1)})`);
    }
  }
}
testBBox();

