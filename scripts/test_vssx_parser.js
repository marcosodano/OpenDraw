const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function inspectVssx(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  console.log(`=== Inspecting ${path.basename(filePath)} ===`);
  const mastersFile = zip.file('visio/masters/masters.xml');
  if (!mastersFile) {
    console.log('No visio/masters/masters.xml found!');
    return;
  }
  const mastersXml = await mastersFile.async('text');
  const mastersRelsFile = zip.file('visio/masters/_rels/masters.xml.rels');
  const mastersRelsXml = mastersRelsFile ? await mastersRelsFile.async('text') : '';

  const mRegex = /<Master\s+([^>]+)>/g;
  let match;
  let count = 0;
  while ((match = mRegex.exec(mastersXml)) !== null && count < 15) {
    const attrs = match[1];
    const id = (attrs.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (attrs.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
    const relMatch = mastersXml.substring(match.index).match(/<Rel\s+r:id=['"]([^'"]+)['"]/);
    let target = null;
    if (relMatch) {
      const rId = relMatch[1];
      const targetMatch = mastersRelsXml.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
      if (targetMatch) target = targetMatch[1];
    }
    console.log(`Master ID: ${id}, Name: ${name}, Target: ${target}`);
    count++;
  }
}

async function run() {
  const dir = 'C:/Program Files/Microsoft Office/root/Office16/Visio Content/1033';
  await inspectVssx(path.join(dir, 'CISCONETWORKSHAPES_M.VSSX'));
  await inspectVssx(path.join(dir, 'BASIC_M.VSSX'));
}

run().catch(console.error);

