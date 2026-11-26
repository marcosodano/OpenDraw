const { app } = require('electron');
const JSZip = require('jszip');
const fs = require('fs');

app.whenReady().then(async () => {
  const filePath = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const parser = new DOMParser();

  // Load masters
  const mastersRelsFile = zip.file('visio/masters/_rels/masters.xml.rels');
  const mastersFile = zip.file('visio/masters/masters.xml');
  const mastersMap = new Map();

  if (mastersFile) {
    const mastersXml = await mastersFile.async('text');
    const mastersDoc = parser.parseFromString(mastersXml, 'application/xml');
    const masterRelMap = new Map();
    if (mastersRelsFile) {
      const relsXml = await mastersRelsFile.async('text');
      const relsDoc = parser.parseFromString(relsXml, 'application/xml');
      relsDoc.querySelectorAll('Relationship').forEach((r) => {
        masterRelMap.set(r.getAttribute('Id'), r.getAttribute('Target'));
      });
    }
    const masterElements = Array.from(mastersDoc.querySelectorAll('Master'));
    for (const mEl of masterElements) {
      const mId = mEl.getAttribute('ID');
      const mName = mEl.getAttribute('Name') || mEl.getAttribute('NameU') || '';
      const relEl = mEl.querySelector('Rel');
      const rId = relEl ? (relEl.getAttribute('r:id') || relEl.getAttribute('id')) : null;
      const target = rId ? masterRelMap.get(rId) : null;
      if (mId && target) {
        const mXmlFile = zip.file(`visio/masters/${target}`);
        if (mXmlFile) {
          const mXmlContent = await mXmlFile.async('text');
          const mDoc = parser.parseFromString(mXmlContent, 'application/xml');
          mastersMap.set(mId, { id: mId, name: mName, doc: mDoc });
        }
      }
    }
  }

  // Load page1
  const p1File = zip.file('visio/pages/page1.xml');
  const p1Xml = await p1File.async('text');
  const p1Doc = parser.parseFromString(p1Xml, 'application/xml');

  // Import VisioConverter helper methods
  function _getCell(node, cellName) {
    if (!node) return null;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.tagName === 'Cell' && child.getAttribute('N') === cellName) {
        return child.getAttribute('V');
      }
    }
    const c = node.querySelector(`:scope > Cell[N="${cellName}"]`);
    return c ? c.getAttribute('V') : null;
  }

  function _parseColor(val, defaultColor = null) {
    if (!val || val === 'Inh' || val === 'THEMEVAL()' || val === '#') return defaultColor;
    if (val.startsWith('#') && (val.length === 7 || val.length === 9 || val.length === 4)) return val;
    if (val.includes('RGB(')) {
      const m = val.match(/RGB\((\d+),(\d+),(\d+)\)/);
      if (m) return `rgb(${m[1]},${m[2]},${m[3]})`;
    }
    if (val === '0') return '#000000';
    if (val === '1') return '#ffffff';
    return defaultColor;
  }

  function _parseGeometryToSvg(geomSection, widthPx, heightPx) {
    if (!geomSection) return '';
    const rows = Array.from(geomSection.querySelectorAll('Row'));
    let pathD = '';
    let curX = 0, curY = 0;

    for (const row of rows) {
      const rType = row.getAttribute('T') || '';
      if (rType.includes('Ellipse')) {
        return `M 0 ${(heightPx/2).toFixed(2)} a ${(widthPx/2).toFixed(2)} ${(heightPx/2).toFixed(2)} 0 1 0 ${widthPx.toFixed(2)} 0 a ${(widthPx/2).toFixed(2)} ${(heightPx/2).toFixed(2)} 0 1 0 -${widthPx.toFixed(2)} 0`;
      }
      const xCell = row.querySelector('Cell[N="X"]');
      const yCell = row.querySelector('Cell[N="Y"]');

      if (xCell) curX = parseFloat(xCell.getAttribute('V') || '0');
      if (yCell) curY = parseFloat(yCell.getAttribute('V') || '0');

      let rx = curX;
      let ry = curY;

      if (rType.startsWith('Rel')) {
        rx = rx * widthPx;
        ry = ry * heightPx;
      } else {
        rx = rx * 96;
        ry = ry * 96;
      }
      ry = heightPx - ry;

      if (rType.includes('MoveTo')) {
        pathD += `M ${rx.toFixed(2)} ${ry.toFixed(2)} `;
      } else if (rType.includes('LineTo') || rType.includes('NURBSTo') || rType.includes('ArcTo')) {
        pathD += `L ${rx.toFixed(2)} ${ry.toFixed(2)} `;
      }
    }
    if (pathD && !pathD.trim().endsWith('Z')) pathD += 'Z';
    return pathD;
  }

  function _buildShapeNodeSvg(shapeNode, masterShapeNode, parentW, parentH, overridesByMsId) {
    const activeNode = shapeNode || masterShapeNode;
    if (!activeNode) return '';
    const msId = activeNode.getAttribute('ID');

    const wVal = _getCell(shapeNode, 'Width') || _getCell(masterShapeNode, 'Width');
    const hVal = _getCell(shapeNode, 'Height') || _getCell(masterShapeNode, 'Height');
    const w = wVal ? parseFloat(wVal) * 96 : parentW;
    const h = hVal ? parseFloat(hVal) * 96 : parentH;

    const pinX = parseFloat(_getCell(shapeNode, 'PinX') || _getCell(masterShapeNode, 'PinX') || '0');
    const pinY = parseFloat(_getCell(shapeNode, 'PinY') || _getCell(masterShapeNode, 'PinY') || '0');
    const locPinX = parseFloat(_getCell(shapeNode, 'LocPinX') || _getCell(masterShapeNode, 'LocPinX') || `${w / 192}`);
    const locPinY = parseFloat(_getCell(shapeNode, 'LocPinY') || _getCell(masterShapeNode, 'LocPinY') || `${h / 192}`);

    const leftPx = (pinX - locPinX) * 96;
    const topPx = parentH - (pinY - locPinY + (hVal ? parseFloat(hVal) : h / 96)) * 96;

    let content = '';

    const geom = activeNode.querySelector(':scope > Section[N="Geometry"]') || masterShapeNode?.querySelector(':scope > Section[N="Geometry"]');
    if (geom && geom.querySelectorAll('Row').length > 0) {
      let fillVal = _getCell(shapeNode, 'FillForegnd');
      const fillF = shapeNode?.querySelector(':scope > Cell[N="FillForegnd"]')?.getAttribute('F');
      if (!fillVal || fillF === 'Inh') {
        fillVal = _getCell(masterShapeNode, 'FillForegnd') || fillVal;
      }
      let fill = _parseColor(fillVal, '#0b3c68');
      if (fillVal === '1') fill = '#ffffff';

      let lineVal = _getCell(shapeNode, 'LineColor');
      const lineF = shapeNode?.querySelector(':scope > Cell[N="LineColor"]')?.getAttribute('F');
      if (!lineVal || lineF === 'Inh') {
        lineVal = _getCell(masterShapeNode, 'LineColor') || lineVal;
      }
      let stroke = _parseColor(lineVal, 'none');
      if (lineVal === '0') stroke = '#000000';

      const d = _parseGeometryToSvg(geom, w, h);
      if (d) {
        content += `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="0.5" />\n`;
      }
    }

    // Traverse children
    const masterChildren = masterShapeNode ? Array.from(masterShapeNode.querySelectorAll(':scope > Shapes > Shape, :scope > Shape')) : [];
    for (const mChild of masterChildren) {
      const cId = mChild.getAttribute('ID');
      const cOverride = overridesByMsId.get(cId);
      content += _buildShapeNodeSvg(cOverride, mChild, w, h, overridesByMsId);
    }

    if (!content) return '';
    return `<g id="ms_${msId}" transform="translate(${leftPx.toFixed(2)}, ${topPx.toFixed(2)})">\n${content}</g>\n`;
  }

  const s370 = p1Doc.querySelector("Shape[ID='370']");
  const m26 = mastersMap.get('26');
  const groupW = 0.4918 * 96;
  const groupH = 0.5127 * 96;

  const overridesByMsId = new Map();
  const pageChildren = Array.from(s370.querySelectorAll('Shape'));
  pageChildren.forEach((child) => {
    const msId = child.getAttribute('MasterShape');
    if (msId) overridesByMsId.set(msId, child);
  });

  const rootMasterShape = m26.doc.querySelector('Shapes > Shape');
  const masterChildren = Array.from(rootMasterShape.querySelectorAll(':scope > Shapes > Shape, :scope > Shape'));
  let innerSvg = '';
  for (const mChild of masterChildren) {
    const cId = mChild.getAttribute('ID');
    const cOverride = overridesByMsId.get(cId);
    innerSvg += _buildShapeNodeSvg(cOverride, mChild, groupW, groupH, overridesByMsId);
  }
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${groupW.toFixed(1)}" height="${groupH.toFixed(1)}" viewBox="0 0 ${groupW.toFixed(1)} ${groupH.toFixed(1)}">\n${innerSvg}</svg>`;
  fs.writeFileSync('C:/Users/T9813424/.gemini/antigravity/brain/1a32f7f1-acf8-4629-bd92-2f705f95b7c2/scratch/firewall.svg', fullSvg);
  console.log('Saved firewall.svg successfully, length:', fullSvg.length);

  app.quit();
});

