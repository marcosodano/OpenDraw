const fs = require('fs');
const JSZip = require('jszip');

async function inspect404Context() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  console.log('--- Inspecting Shape 402, 403, 404, 405 ---');
  for (const id of ['402', '403', '404', '405']) {
    const m = p1Xml.match(new RegExp(`<Shape\\s+[^>]*ID=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/Shape>`));
    if (m) {
      const s = m[0];
      const name = (s.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1];
      const master = (s.match(/Master=['"]([^'"]+)['"]/) || [])[1];
      const type = (s.match(/Type=['"]([^'"]+)['"]/) || [])[1];
      const textM = s.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
      const text = textM ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
      console.log(`ID=${id} Master=${master} Type=${type} Name="${name}" Text="${text}"`);
      const childCount = (s.match(/<Shape\b/g) || []).length;
      console.log(`   Has child shapes: ${childCount}`);
      const fills = s.match(/<Cell\s+[^>]*N=['"]FillForegnd['"][^>]*V=['"]([^'"]+)['"]/);
      const lines = s.match(/<Cell\s+[^>]*N=['"]LineColor['"][^>]*V=['"]([^'"]+)['"]/);
      console.log(`   Fill: ${fills ? fills[1] : null}, Line: ${lines ? lines[1] : null}`);
    }
  }
}
inspect404Context();

