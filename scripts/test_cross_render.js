const fs = require('fs');
const JSZip = require('jszip');

// Include VisioConverter parsing methods to test Master 30
const VISIO_PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#c0c0c0', '#808080'
];

function _parseColor(val, formula = null, defaultColor = 'transparent') {
  if (formula) {
    const rgbMatch = formula.match(/RGB\((\d+),\s*(\d+),\s*(\d+)\)/i);
    if (rgbMatch) return `rgb(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]})`;
  }
  if (!val || val === 'Inh' || val === 'THEMEVAL()' || val === '#' || val === 'none' || val === 'transparent') return defaultColor;
  if (val.startsWith('#') && (val.length === 7 || val.length === 9 || val.length === 4)) return val;
  if (val.includes('RGB(')) {
    const m = val.match(/RGB\((\d+),\s*(\d+),\s*(\d+)\)/i);
    if (m) return `rgb(${m[1]},${m[2]},${m[3]})`;
  }
  if (val === '0') return '#000000';
  if (val === '1') return '#ffffff';
  const idx = parseInt(val, 10);
  if (!isNaN(idx) && idx >= 0 && idx < VISIO_PALETTE.length) return VISIO_PALETTE[idx];
  return defaultColor;
}

function _parseGeometrySection(geomXml, wPx, hPx) {
  const noShowMatch = geomXml.match(/<Cell\s+[^>]*N=['"]NoShow['"][^>]*V=['"]1['"]/);
  if (noShowMatch) return '';

  const rowRegex = /<Row\s+([^>]+)>([\s\S]*?)<\/Row>/g;
  let rMatch;
  let d = '';
  let curX = 0, curY = 0;
  let rawX = 0, rawY = 0;

  while ((rMatch = rowRegex.exec(geomXml)) !== null) {
    const rAttrs = rMatch[1];
    const rBody = rMatch[2];
    const tMatch = rAttrs.match(/T=['"]([^'"]+)['"]/);
    const rowType = tMatch ? tMatch[1] : '';

    const xMatch = rBody.match(/<Cell\s+[^>]*N=['"]X['"][^>]*V=['"]([^'"]+)['"]/);
    const yMatch = rBody.match(/<Cell\s+[^>]*N=['"]Y['"][^>]*V=['"]([^'"]+)['"]/);

    if (xMatch) rawX = parseFloat(xMatch[1]);
    if (yMatch) rawY = parseFloat(yMatch[1]);

    let sx = rowType.startsWith('Rel') ? rawX * wPx : rawX * 96;
    let sy = rowType.startsWith('Rel') ? (1 - rawY) * hPx : hPx - rawY * 96;

    if (rowType.includes('MoveTo')) {
      d += `M ${sx.toFixed(2)} ${sy.toFixed(2)} `;
      curX = sx; curY = sy;
    } else if (rowType.includes('LineTo')) {
      d += `L ${sx.toFixed(2)} ${sy.toFixed(2)} `;
      curX = sx; curY = sy;
    }
  }
  return d.trim() + ' ';
}

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const m16 = await zip.file('visio/masters/master16.xml').async('text');

  const geomM = m16.match(/<Section\s+[^>]*N=['"]Geometry['"][^>]*>([\s\S]*?)<\/Section>/);
  if (geomM) {
    const wPx = 1.5748 * 96;
    const hPx = 1.5748 * 96;
    const pathD = _parseGeometrySection(geomM[0], wPx, hPx);
    console.log('Cross SVG path:');
    console.log(pathD);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${hPx}">\n<path d="${pathD}" fill="#ff0000" stroke="#b00000" stroke-width="1"/>\n</svg>`;
    fs.writeFileSync('C:/Users/T9813424/OneDrive - Hitachi Group/Documents/11. Scripts/OpenDraw/scripts/cross_test.svg', svg);
    console.log('Saved cross_test.svg successfully!');
  }
}
test();

