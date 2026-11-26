const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function testParseVssx(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const mastersFile = zip.file('visio/masters/masters.xml');
  const mastersRelsFile = zip.file('visio/masters/_rels/masters.xml.rels');

  if (!mastersFile) {
    console.log('No masters.xml in', filePath);
    return;
  }

  const mastersXml = await mastersFile.async('text');
  const mastersRelsXml = mastersRelsFile ? await mastersRelsFile.async('text') : '';

  const mRegex = /<Master\s+([^>]+)>/g;
  let match;
  const shapes = [];

  while ((match = mRegex.exec(mastersXml)) !== null) {
    const attrs = match[1];
    const id = (attrs.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (attrs.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1] || 'Shape';
    const relMatch = mastersXml.substring(match.index).match(/<Rel\s+r:id=['"]([^'"]+)['"]/);

    let targetXml = '';
    if (relMatch) {
      const rId = relMatch[1];
      const targetMatch = mastersRelsXml.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
      if (targetMatch) {
        const targetPath = 'visio/masters/' + targetMatch[1];
        if (zip.file(targetPath)) {
          targetXml = await zip.file(targetPath).async('text');
        }
      }
    }

    // Check if targetXml has shapes or geometry
    const hasGeometry = targetXml.includes('<Section N=\'Geometry\'') || targetXml.includes('<Section N="Geometry"');
    shapes.push({ id, name, hasXml: !!targetXml, hasGeometry });
  }

  console.log(`Parsed ${shapes.length} master shapes from ${path.basename(filePath)}`);
  console.log('Sample shapes:', shapes.slice(0, 10));
}

async function main() {
  const dir = 'C:/Program Files/Microsoft Office/root/Office16/Visio Content/1033';
  await testParseVssx(path.join(dir, 'BASIC_M.VSSX'));
  await testParseVssx(path.join(dir, 'CISCONETWORKSHAPES_M.VSSX'));
}

main().catch(console.error);

