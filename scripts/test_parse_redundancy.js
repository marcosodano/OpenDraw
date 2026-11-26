const fs = require('fs');
const JSZip = require('jszip');

// Import VISIO_PALETTE and helper functions from VisioConverter
const VISIO_PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#c0c0c0', '#808080',
  '#9999ff', '#993366', '#ffffcc', '#ccffff', '#660066', '#ff8080', '#0066cc', '#ccccff',
  '#000080', '#ff00ff', '#ffff00', '#00ffff', '#800080', '#800000', '#008080', '#0000ff'
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

function _getDirectCellFromXml(xml, cellName) {
  const shapesIdx = xml.indexOf('<Shapes>');
  const head = shapesIdx >= 0 ? xml.substring(0, shapesIdx) : xml;
  const m = head.match(new RegExp(`<Cell\\s+[^>]*N=['"]${cellName}['"][^>]*\\/>`));
  if (!m) return { val: null, formula: null };
  const vMatch = m[0].match(/V=['"]([^'"]+)['"]/);
  const fMatch = m[0].match(/F=['"]([^'"]+)['"]/);
  return { val: vMatch ? vMatch[1] : null, formula: fMatch ? fMatch[1] : null };
}

async function run() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  // Extract top-level shapes like VisioConverter does
  const shapesIdx = p1Xml.indexOf('<Shapes>');
  const endShapesIdx = p1Xml.lastIndexOf('</Shapes>');
  const shapesContent = p1Xml.substring(shapesIdx + 8, endShapesIdx);

  let depth = 0;
  let start = -1;
  const topShapes = [];
  const tagRegex = /<\/?Shape\b[^>]*>/g;
  let t;
  while ((t = tagRegex.exec(shapesContent)) !== null) {
    if (t[0].startsWith('</')) {
      depth--;
      if (depth === 0 && start >= 0) {
        topShapes.push(shapesContent.substring(start, tagRegex.lastIndex));
        start = -1;
      }
    } else if (!t[0].endsWith('/>')) {
      if (depth === 0) start = t.index;
      depth++;
    } else {
      if (depth === 0) {
        topShapes.push(t[0]);
      }
    }
  }

  console.log('Total topShapes:', topShapes.length);

  for (let i = 0; i < topShapes.length; i++) {
    const sXml = topShapes[i];
    const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const masterId = (sXml.match(/Master=['"]([^'"]+)['"]/) || [])[1];
    const name = (sXml.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1] || '';
    const fillCell = _getDirectCellFromXml(sXml, 'FillForegnd');
    const lineCell = _getDirectCellFromXml(sXml, 'LineColor');
    const fill = _parseColor(fillCell.val, fillCell.formula, 'transparent');
    const stroke = _parseColor(lineCell.val, lineCell.formula, '#333333');

    // Check if fill is red or weird
    if (fill.includes('255,0,0') || fill === '#ff0000' || fill === '#fa000f' || stroke === '#fa000f') {
      const textM = sXml.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
      const txt = textM ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
      const wCell = _getDirectCellFromXml(sXml, 'Width');
      const hCell = _getDirectCellFromXml(sXml, 'Height');
      console.log(`Shape ID=${id} Master=${masterId} Name="${name}" Text="${txt}" Fill="${fill}" (rawVal: ${fillCell.val}) Stroke="${stroke}" (rawVal: ${lineCell.val}) W=${wCell.val} H=${hCell.val}`);
    }
  }
}
run();

