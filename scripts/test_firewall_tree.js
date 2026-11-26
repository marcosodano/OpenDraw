const fs = require('fs');
const JSZip = require('jszip');

async function testFirewallComplete() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('visio/masters/master14.xml').async('text');

  const shapesStart = xml.indexOf('<Shapes>');
  const shapesEnd = xml.lastIndexOf('</Shapes>');
  const rootShapesXml = xml.substring(shapesStart + 8, shapesEnd);
  
  console.log('Old regex length:', (xml.match(/<Shapes>([\s\S]*?)<\/Shapes>\s*<\/MasterContents>/) || [''])[0].length);
  console.log('Full tree length:', rootShapesXml.length);
}
testFirewallComplete();

