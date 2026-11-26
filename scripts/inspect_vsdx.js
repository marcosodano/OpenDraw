const fs = require('fs');
const JSZip = require('jszip');

async function run() {
  const filePath = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const m9 = await zip.file('visio/masters/master9.xml').async('text');
  const sRegex = /<Shape\s+([^>]*ID=['"](\d+)['"][^>]*)>([\s\S]*?)<\/Shape>/g;
  let s;
  while ((s = sRegex.exec(m9)) !== null) {
    console.log(`\n--- Master9 Shape ID=${s[2]}`);
    ['FillForegnd', 'FillPattern', 'LineColor', 'LinePattern', 'LineWeight'].forEach(cell => {
      const cM = s[3].match(new RegExp('<Cell\\s+[^>]*N=[\'"]' + cell + '[\'"][^>]*V=[\'"]([^\'"]*)[\'"](?:\\s+F=[\'"]([^\'"]*)[\'"])?'));
      if (cM) console.log(`  ${cell} = val:"${cM[1]}" formula:"${cM[2] || ''}"`);
    });
  }
}
run();

