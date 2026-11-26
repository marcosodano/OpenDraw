const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  for (const id of ['31', '32', '33', '34']) {
    const regex = new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`);
    const m = p1Xml.match(regex);
    console.log(`\n=================== SHAPE ID ${id} ===================`);
    console.log(m ? m[0] : 'not found');
  }
}

run().catch(console.error);

