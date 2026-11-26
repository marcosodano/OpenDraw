const fs = require('fs');
const JSZip = require('jszip');

async function checkMaster21() {
  const buf = fs.readFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const mXml = await zip.file('visio/masters/master11.xml').async('text');

  ['NoShow', 'FillPattern', 'LinePattern', 'Geometry'].forEach(cell => {
    const cM = mXml.match(new RegExp('<Cell\\s+[^>]*N=[\'"]' + cell + '[\'"][^>]*V=[\'"]([^\'"]*)[\'"]'));
    if (cM) console.log(`${cell}: ${cM[0]}`);
  });
  const noShowM = mXml.match(/N=['"]NoShow['"][^>]*V=['"]([^'"]+)['"]/);
  console.log('NoShow match:', noShowM);
  const fillPatM = mXml.match(/N=['"]FillPattern['"][^>]*V=['"]([^'"]+)['"]/);
  console.log('FillPattern match:', fillPatM);
  const linePatM = mXml.match(/N=['"]LinePattern['"][^>]*V=['"]([^'"]+)['"]/);
  console.log('LinePattern match:', linePatM);
}
checkMaster21();

