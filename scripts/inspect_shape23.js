const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  
  const mastersXml = await zip.file('visio/masters/masters.xml').async('text');
  const m12Match = mastersXml.match(/<Master\s+[^>]*ID=['"]12['"][^>]*>([\s\S]*?)<\/Master>/);
  console.log('Master 12 in masters.xml:', m12Match ? m12Match[0] : 'not found');
  
  // Find where "Legend" text appears in page1.xml
  const legendIdx = p1Xml.indexOf('Legend');
  console.log('Legend index in page1.xml:', legendIdx);
  if (legendIdx !== -1) {
    console.log(p1Xml.slice(legendIdx - 200, legendIdx + 300));
  }
}

run().catch(console.error);

