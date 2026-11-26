const fs = require('fs');
const JSZip = require('jszip');

async function testShape402() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);

  // masters rels
  const relsXml = await zip.file('visio/masters/_rels/masters.xml.rels').async('text');
  const relMap = {};
  const relRegex = /<Relationship\s+[^>]*Id=['"]([^'"]+)['"][^>]*Target=['"]([^'"]+)['"]/g;
  let r;
  while ((r = relRegex.exec(relsXml)) !== null) {
    relMap[r[1]] = r[2];
  }

  const mastersXml = await zip.file('visio/masters/masters.xml').async('text');
  const mRegex = /<Master\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Master>/g;
  let m;
  const masterFileMap = {};
  while ((m = mRegex.exec(mastersXml)) !== null) {
    const mId = m[2];
    const relM = m[3].match(/<Rel\s+[^>]*r:id=['"]([^'"]+)['"]/);
    if (relM && relMap[relM[1]]) {
      masterFileMap[mId] = relMap[relM[1]];
    }
  }

  const m9Xml = await zip.file(`visio/masters/${masterFileMap['17']}`).async('text');
  const deviceMaster = { xml: m9Xml };

  const rootMatch = deviceMaster.xml.match(/<Shapes>([\s\S]*?)<\/Shapes>\s*<\/MasterContents>/);
  console.log('rootMatch found:', !!rootMatch);
  if (rootMatch) {
    const rootShape = rootMatch[1].trim();
    console.log('rootShape length:', rootShape.length);
    console.log('rootShape start:', rootShape.substring(0, 100));
    const wM = rootShape.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
    const hM = rootShape.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
    console.log('wM:', wM ? wM[1] : null);
    console.log('hM:', hM ? hM[1] : null);
  }
}
testShape402();

