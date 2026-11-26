const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const buf = fs.readFileSync('C:/Users/T9813424/Downloads/MSN - Redundancy_20261012.vsdx');
  const zip = await JSZip.loadAsync(buf);
  const p1Xml = await zip.file('visio/pages/page1.xml').async('text');

  const pagePixelHeight = Math.round(45.27165354330709 * 96);
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

  console.log('Classifying all shapes:');
  const containerShapes = [];
  const connectorShapes = [];
  const deviceShapes = [];
  const labelShapes = [];

  for (const sXml of topShapes) {
    const id = (sXml.match(/ID=['"]([^'"]+)['"]/) || [])[1];
    let masterId = (sXml.match(/Master=['"]([^'"]+)['"]/) || [])[1];
    const name = (sXml.match(/Name(?:U)?=['"]([^'"]+)['"]/) || [])[1] || '';

    if (name.includes('16-Point Star') || name.includes('24-Point Star') || masterId === '21' || masterId === '46') {
      continue;
    }

    const hasBeginX = sXml.includes("N='BeginX'") || sXml.includes('N="BeginX"');
    const hasEndX = sXml.includes("N='EndX'") || sXml.includes('N="EndX"');
    const isConnector = (hasBeginX && hasEndX) || masterId === '2' || name.toLowerCase().includes('dynamic connector');

    if (isConnector) {
      connectorShapes.push({ id, name });
      continue;
    }

    const isContainerMaster = masterId === '12' || name.toLowerCase().includes('plain') || name.toLowerCase().includes('container');
    const isContainerName = name.toLowerCase().includes('plain') || name.toLowerCase().includes('container') || name.toLowerCase().includes('room') || name.toLowerCase().includes('legend');

    if (isContainerMaster || isContainerName) {
      containerShapes.push({ id, name, reason: 'master/name' });
      continue;
    }

    let isDevice = masterId === '15' || masterId === '16' || masterId === '17' || masterId === '18' || masterId === '22' || masterId === '23' || masterId === '26';
    if (!isDevice && name) {
      const lower = name.toLowerCase();
      isDevice = lower.includes('router') || lower.includes('switch') || lower.includes('firewall') || lower.includes('eudemon') || lower.includes('server') || lower.includes('cloud');
    }

    if (isDevice) {
      deviceShapes.push({ id, name, masterId });
      continue;
    }

    const wM = sXml.match(/<Cell\s+[^>]*N=['"]Width['"][^>]*V=['"]([^'"]+)['"]/);
    const hM = sXml.match(/<Cell\s+[^>]*N=['"]Height['"][^>]*V=['"]([^'"]+)['"]/);
    const wVal = wM ? parseFloat(wM[1]) : 0;
    const hVal = hM ? parseFloat(hM[1]) : 0;

    const isGroupContainer = sXml.includes("Type='Group'") && wVal >= 0.8 && hVal >= 1.5;
    if ((wVal >= 1.5 && hVal >= 1.5) || isGroupContainer) {
      containerShapes.push({ id, name, wVal, hVal, reason: 'size' });
    } else {
      labelShapes.push({ id, name, wVal, hVal });
    }
  }

  console.log(`Results: ${containerShapes.length} containers, ${connectorShapes.length} connectors, ${deviceShapes.length} devices, ${labelShapes.length} labels.`);
  console.log('\nContainers with reason=size:');
  containerShapes.filter(c => c.reason === 'size').forEach(c => console.log(' ', c));
}
test();

