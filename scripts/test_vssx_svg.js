const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Import VisioConverter
global.JSZip = JSZip;
const VisioConverter = require('../src/renderer/core/VisioConverter.js');

async function testGenerateMasterSvgs() {
  const filePath = 'C:/Program Files/Microsoft Office/root/Office16/Visio Content/1033/CISCONETWORKSHAPES_M.VSSX';
  const buf = fs.readFileSync(filePath);
  const result = await VisioConverter.parseVssxArchive(buf, 'Cisco Network Shapes');

  console.log(`Successfully parsed ${result.shapes.length} shapes from Cisco stencil!`);
  for (let i = 0; i < Math.min(5, result.shapes.length); i++) {
    const s = result.shapes[i];
    console.log(`Shape #${i}: Name="${s.name}", W=${s.width}, H=${s.height}, SVG length=${s.svg.length}`);
  }
}

testGenerateMasterSvgs().catch(console.error);

