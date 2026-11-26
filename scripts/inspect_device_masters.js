const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);

  const mXml = await zip.file('visio/masters/masters.xml').async('text');
  const mRels = await zip.file('visio/masters/_rels/masters.xml.rels').async('text');

  // Parse relationships
  const relMap = {};
  const relRegex = /<Relationship\s+Id=['"]([^'"]+)['"][^>]*Target=['"]([^'"]+)['"]/g;
  let rm;
  while ((rm = relRegex.exec(mRels)) !== null) {
    relMap[rm[1]] = rm[2];
  }

  // Parse Master IDs
  const masterRegex = /<Master\s+([^>]+)>([\s\S]*?)<\/Master>/g;
  let mm;
  const masterTargets = {};
  while ((mm = masterRegex.exec(mXml)) !== null) {
    const id = (mm[1].match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const name = (mm[1].match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
    const relId = (mm[2].match(/<Rel\s+r:id=['"]([^'"]+)['"]/) || [])[1];
    const target = relMap[relId];
    console.log(`Master ID ${id} ("${name}") -> Rel ${relId} -> ${target}`);
    masterTargets[id] = { id, name, target };
  }

  // Check the files for Master 17, 23, 26
  for (const id of ['17', '23', '26']) {
    const info = masterTargets[id];
    if (info && info.target) {
      const fileXml = await zip.file('visio/masters/' + info.target).async('text');
      console.log(`\n================ Master ${id} (${info.name}) in ${info.target} (${fileXml.length} bytes) ================`);
      // Check if it has media relationships or shapes
      const mRelPath = `visio/masters/_rels/${info.target}.rels`;
      const mRelFile = zip.file(mRelPath);
      if (mRelFile) {
        console.log(`  Rels:`, await mRelFile.async('text'));
      } else {
        console.log(`  No rels file`);
      }
      // Check shape types and child shapes
      const shapeMatches = Array.from(fileXml.matchAll(/<Shape\s+([^>]+)>/g)).map(m => m[1]);
      console.log(`  Total Shapes in master: ${shapeMatches.length}`);
      // Find FillForegnd colors in master
      const fills = Array.from(fileXml.matchAll(/<Cell\s+[^>]*N=['"]FillForegnd['"][^>]*V=['"]([^'"]+)['"]/g)).map(m => m[1]);
      console.log(`  Unique fills:`, [...new Set(fills)]);
    }
  }
}

run().catch(console.error);

