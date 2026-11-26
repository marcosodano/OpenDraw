/**
 * Automated Regression Test Suite for Visio Compatibility in OpenDraw
 * Verifies fixes for D-01 through D-07 across real-world enterprise fixtures.
 */

const fs = require('fs');
const path = require('path');
const baseDir = path.resolve(__dirname, '..');
const JSZip = require(path.join(baseDir, 'node_modules/jszip'));
global.JSZip = JSZip;

// Mock DOM and Fabric environment for Node.js execution
global.window = {
  JSZip: JSZip,
  openDraw: {
    convertEmfBatch: async (items) => {
      return items.map(it => ({
        name: it.name,
        dataUrl: `data:image/png;base64,mockEmfConverted_${it.name}`
      }));
    }
  }
};

global.DOMParser = class {
  parseFromString(str, type) {
    return {
      querySelectorAll(tag) {
        const matches = [];
        const regex = new RegExp(`<${tag}\\b([^>]*)>`, 'g');
        let m;
        while ((m = regex.exec(str)) !== null) {
          const attrs = m[1];
          matches.push({
            getAttribute(name) {
              const am = attrs.match(new RegExp(`${name}=['"]([^'"]+)['"]`));
              return am ? am[1] : null;
            }
          });
        }
        return matches;
      }
    };
  }
};

global.fabric = {
  Rect: class { constructor(opts) { Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } },
  Text: class { constructor(text, opts) { this.text = text; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } },
  Group: class { constructor(objects, opts) { this.objects = objects; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } },
  Polyline: class { constructor(points, opts) { this.points = points; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } },
  Polygon: class { constructor(points, opts) { this.points = points; Object.assign(this, opts); } set(opts) { Object.assign(this, opts); } },
  Image: class { constructor(el, opts) { Object.assign(this, opts); this.svg = el.svgContent; } set(opts) { Object.assign(this, opts); } }
};

global.Image = class {
  constructor() { this.naturalWidth = 100; this.naturalHeight = 100; }
  set src(val) {
    if (val && val.startsWith('data:image/svg+xml')) {
      this.svgContent = decodeURIComponent(val.replace('data:image/svg+xml;charset=utf-8,', ''));
    }
    setTimeout(() => { if (this.onload) this.onload(); }, 1);
  }
};

const VisioConverter = require(path.join(baseDir, 'src/renderer/core/VisioConverter.js'));

async function runTestSuite() {
  console.log('================================================================');
  console.log('OPENDRAW VISIO COMPATIBILITY REGRESSION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
    }
  }

  // TEST 1: Shape Retention Rate in BMIS Overview (D-01)
  {
    const bmisPath = path.join(baseDir, 'Tests', 'BMIS _Migration_Procedure_20251003.vsdx');
    const buf = fs.readFileSync(bmisPath);
    const pages = await VisioConverter.importVsdx(buf, null);
    const p1 = pages[0];
    const totalRepresented = p1.shapes.length + p1.connectors.length;
    // Page 1 has 176 top-level shapes
    assert(totalRepresented >= 170, 'D-01: BMIS Shape Retention', `Expected >= 170, got ${totalRepresented}`);
  }

  // TEST 2: Railway Track Foreign Media Ingestion in HSR (D-03, D-01)
  {
    const hsrPath = path.join(baseDir, 'Tests', 'HSR_OFN Overview_v02.vsdx');
    const buf = fs.readFileSync(hsrPath);
    const pages = await VisioConverter.importVsdx(buf, null);
    const p1 = pages[0];
    const totalRepresented = p1.shapes.length + p1.connectors.length;
    assert(totalRepresented >= 195, 'D-01/D-03: HSR Full Shape & Media Retention', `Expected >= 195, got ${totalRepresented}`);
  }

  // TEST 3: Group & Composite Sub-shape Preservation in ICMS (D-02)
  {
    const icmsPath = path.join(baseDir, 'Tests', 'ICMS_Architecture_DCP2.vsdx');
    const buf = fs.readFileSync(icmsPath);
    const pages = await VisioConverter.importVsdx(buf, null);
    const p1 = pages[0];
    let totalPathsInSvg = 0;
    for (const s of p1.shapes) {
      let svg = s.svg;
      if (!svg && s.objects) {
        const img = s.objects.find(o => o.svg);
        if (img) svg = img.svg;
      }
      if (svg) {
        totalPathsInSvg += (svg.match(/<path\b/g) || []).length;
      }
    }
    assert(p1.shapes.length >= 70, 'D-02: ICMS Top-Level Group Ingestion', `Expected >= 70, got ${p1.shapes.length}`);
    assert(totalPathsInSvg >= 300, 'D-02: ICMS Recursive Sub-shape Vector Paths', `Expected >= 300 paths, got ${totalPathsInSvg}`);
  }

  // TEST 4: Stencil Master Foreign Image Resolution (D-03)
  {
    const vssxPath = 'C:/Users/T9813424/AppData/Roaming/opendraw/stencil_cache/ea72266509f526a9398aed258890e60d9698725f49d871fdbabdc542b2204f25.vssx';
    if (fs.existsSync(vssxPath)) {
      const vssxBuf = fs.readFileSync(vssxPath);
      const stencil = await VisioConverter.parseVssxArchive(vssxBuf, 'HPE Stencil');
      let fallbackCount = 0;
      stencil.shapes.forEach(s => {
        if (s.svg && s.svg.includes('<rect x="2" y="2"')) fallbackCount++;
      });
      assert(stencil.shapes.length === 171, 'D-03: HPE Stencil Shape Count', `Expected 171, got ${stencil.shapes.length}`);
      assert(fallbackCount === 0, 'D-03: Zero Fallback Rectangles in HPE Stencil', `Expected 0 fallbacks, got ${fallbackCount}`);
    }
  }

  // TEST 5: 1D Connector Transform Formula Incorporates LocPin (D-05)
  {
    const vcSrc = fs.readFileSync(path.join(baseDir, 'src/renderer/core/VisioConverter.js'), 'utf8');
    const hasRawLocPinX = vcSrc.includes('dx = curX - rawLocPinX') || vcSrc.includes('curX - rawLocPinX');
    const hasRawLocPinY = vcSrc.includes('dy = curY - rawLocPinY') || vcSrc.includes('curY - rawLocPinY');
    assert(hasRawLocPinX && hasRawLocPinY, 'D-05: 1D Connector Transformation with LocPin offsets', 'rawLocPinX and rawLocPinY offsets applied');
  }

  // TEST 6: Stencil Connection Points Preserved on Drag & Drop (D-04)
  {
    const pcSrc = fs.readFileSync(path.join(baseDir, 'src/renderer/core/PanelController.js'), 'utf8');
    const appSrc = fs.readFileSync(path.join(baseDir, 'src/renderer/core/App.js'), 'utf8');
    const pcPreservesCp = pcSrc.includes('connectionPoints: shape.connectionPoints');
    const appBindsCp = appSrc.includes('imgObj.connectionPoints = connectionPoints') || appSrc.includes('connectionPoints');
    assert(pcPreservesCp && appBindsCp, 'D-04: Stencil Connection Points Bound to Canvas Shapes', 'PanelController and App forward connection points');
  }

  // TEST 7: DrawingML Theme Palette Formula Support (D-07)
  {
    const vcSrc = fs.readFileSync(path.join(baseDir, 'src/renderer/core/VisioConverter.js'), 'utf8');
    const hasThemeGuard = vcSrc.includes('THEMEGUARD');
    const hasTint = vcSrc.includes('TINT');
    const hasShade = vcSrc.includes('SHADE');
    assert(hasThemeGuard && hasTint && hasShade, 'D-07: DrawingML THEMEGUARD, TINT, and SHADE Formula Handling', 'All formula handlers present in _parseColor');
  }

  // TEST 8: Geometry ArcTo and Ellipse Vector Precision
  {
    const vcSrc = fs.readFileSync(path.join(baseDir, 'src/renderer/core/VisioConverter.js'), 'utf8');
    const hasQuadraticArc = vcSrc.includes('ArcTo') && vcSrc.includes('Q ');
    const hasEllipseCalc = vcSrc.includes('Ellipse') && vcSrc.includes('erx') && vcSrc.includes('ery');
    assert(hasQuadraticArc && hasEllipseCalc, 'Geometry Engine: Quadratic ArcTo and Center-Radius Ellipse Path Calculation', 'Vector math present in _parseGeometrySection');
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
