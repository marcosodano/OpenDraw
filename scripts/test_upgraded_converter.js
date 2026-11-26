const fs = require('fs');
const JSZip = require('jszip');

const VISIO_PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#c0c0c0', '#808080',
  '#9999ff', '#993366', '#ffffcc', '#ccffff', '#660066', '#ff8080', '#0066cc', '#ccccff',
  '#000080', '#ff00ff', '#ffff00', '#00ffff', '#800080', '#800000', '#008080', '#0000ff'
];

function _parseColor(val, formula = null, defaultColor = 'transparent', shapeRefMap = null) {
  if (formula) {
    const rgbMatch = formula.match(/RGB\((\d+),\s*(\d+),\s*(\d+)\)/i);
    if (rgbMatch) return `rgb(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]})`;
    
    // Check Sheet reference e.g. Sheet.2!FillForegnd
    if (shapeRefMap) {
      const sheetRef = formula.match(/Sheet\.(\d+)!FillForegnd/i);
      if (sheetRef && shapeRefMap.has(sheetRef[1])) {
        return shapeRefMap.get(sheetRef[1]).fill || defaultColor;
      }
    }
  }
  if (!val || val === 'Inh' || val === 'THEMEVAL()' || val === '#' || val === 'none' || val === 'transparent' || val === 'Themed') {
    return defaultColor;
  }
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

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');
  const pagePixelHeight = Math.round(45.27165354330709 * 96);
  const pagePixelWidth = Math.round(23.80314960629921 * 96);

  // Extract top-level shapes
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

  // Pre-index shapes for sheet references
  const shapeRawMap = new Map();
  for (const sXml of topShapes) {
    const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    const fillCell = _getDirectCellFromXml(sXml, 'FillForegnd');
    const lineCell = _getDirectCellFromXml(sXml, 'LineColor');
    const fill = _parseColor(fillCell.val, fillCell.formula, null);
    const stroke = _parseColor(lineCell.val, lineCell.formula, null);
    shapeRawMap.set(id, { fill, stroke, fillCell, lineCell, xml: sXml });
  }

  console.log(`Pre-indexed ${shapeRawMap.size} shapes for cross-references.`);

  // Test resolving Shape 2 and Shape 3
  const s2 = shapeRawMap.get('2');
  const s3 = shapeRawMap.get('3');
  const s2Fill = _parseColor(s2.fillCell.val, s2.fillCell.formula, 'transparent', shapeRawMap);
  const s3Fill = _parseColor(s3.fillCell.val, s3.fillCell.formula, 'transparent', shapeRawMap);
  console.log('Shape 2 resolved fill:', s2Fill);
  console.log('Shape 3 resolved fill (referenced Sheet.2):', s3Fill);

  // Test resolving Shape 7 and Shape 8
  const s7 = shapeRawMap.get('7');
  const s8 = shapeRawMap.get('8');
  const s7Fill = _parseColor(s7.fillCell.val, s7.fillCell.formula, 'transparent', shapeRawMap);
  const s8Fill = _parseColor(s8.fillCell.val, s8.fillCell.formula, 'transparent', shapeRawMap);
  console.log('Shape 7 resolved fill:', s7Fill);
  console.log('Shape 8 resolved fill (referenced Sheet.7):', s8Fill);

  // Parse connects
  const connects = [];
  const connectMatches = Array.from(p1Xml.matchAll(/<Connect\s+([^>]+)\/>/g));
  for (const cm of connectMatches) {
    const attrs = cm[1];
    const fromSheet = (attrs.match(/FromSheet=['"]([^'"]+)['"]/) || [])[1];
    const fromCell = (attrs.match(/FromCell=['"]([^'"]+)['"]/) || [])[1];
    const toSheet = (attrs.match(/ToSheet=['"]([^'"]+)['"]/) || [])[1];
    const toCell = (attrs.match(/ToCell=['"]([^'"]+)['"]/) || [])[1];
    connects.push({ fromSheet, fromCell, toSheet, toCell });
  }
  console.log(`Parsed ${connects.length} connects.`);
}
test();

