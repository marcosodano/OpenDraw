/**
 * VisioConverter.js
 *
 * Comprehensive Microsoft Visio OpenXML (.vsdx / .vsdm / .vstx / .vssx)
 * importer and exporter for OpenDraw.
 *
 * Implements:
 * - Stack-based namespace/entity-safe XML tree parser (works in Chromium & Node)
 * - Visio indexed palette (0..23 + document <Colors> 24+), OOXML theme1.xml colors,
 *   variant schemes, QuickStyle color lookup, TINT / SHADE / MSOTINT / HSL / RGB math
 * - StyleSheet inheritance chains + Master/MasterShape + instance delta merging
 * - Multi-section Geometry compilation: MoveTo, RelMoveTo, LineTo, RelLineTo, ArcTo,
 *   EllipticalArcTo, NURBSTo (Cox-de Boor rational B-spline), SplineStart/SplineKnot,
 *   RelQuadBezTo, RelCubBezTo, PolylineTo, Ellipse, InfiniteLine, Rounding corner fillets
 * - Stroke dashes (LinePattern), FillPattern (0/1/hatch/FillGradient), arrows, flips, rotation
 * - Text blocks (TxtPinX/Y/W/H, VerticalAlign), rich character/paragraph formatting & Shape Data
 * - Full multi-page .vsdx export compatible with Microsoft Visio
 */

const VISIO_DEFAULT_PALETTE = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#E6E6E6',
  '#CDCDCD', '#B3B3B3', '#9A9A9A', '#808080', '#666666', '#4D4D4D', '#333333', '#1A1A1A'
];

const DPI = 96;

class VisioConverter {
  // ─── XML Utilities ──────────────────────────────────────────────────────────

  static _unescapeXml(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, code) => {
      if (code === 'amp') return '&';
      if (code === 'lt') return '<';
      if (code === 'gt') return '>';
      if (code === 'quot') return '"';
      if (code === 'apos') return "'";
      if (code.startsWith('#x')) {
        const cp = parseInt(code.slice(2), 16);
        return isNaN(cp) ? m : String.fromCodePoint(cp);
      }
      if (code.startsWith('#')) {
        const cp = parseInt(code.slice(1), 10);
        return isNaN(cp) ? m : String.fromCodePoint(cp);
      }
      return m;
    });
  }

  static _escapeXml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse XML into lightweight node tree:
   * { tag, localName, attrs, children, text, rawInner? }
   */
  static _parseXml(xmlStr) {
    if (!xmlStr || typeof xmlStr !== 'string') return null;
    const root = { tag: '#doc', localName: '#doc', attrs: {}, children: [], text: '' };
    const stack = [root];
    const tokenRe = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([A-Za-z_][\w:.-]*)\s*>|<([A-Za-z_][\w:.-]*)((?:\s+[^<>'"=]+=(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;

    let lastIdx = 0;
    let m;
    while ((m = tokenRe.exec(xmlStr)) !== null) {
      const parent = stack[stack.length - 1];
      if (m.index > lastIdx) {
        const txt = VisioConverter._unescapeXml(xmlStr.slice(lastIdx, m.index));
        if (txt) {
          parent.text += txt;
          parent.children.push({ tag: '#text', localName: '#text', text: txt, attrs: {}, children: [] });
        }
      }
      lastIdx = tokenRe.lastIndex;

      if (m[0].startsWith('<!--') || m[0].startsWith('<?')) continue;
      if (m[1] !== undefined) {
        parent.text += m[1];
        parent.children.push({ tag: '#text', localName: '#text', text: m[1], attrs: {}, children: [] });
        continue;
      }
      if (m[2]) {
        // Closing tag
        const closeName = m[2];
        for (let k = stack.length - 1; k >= 1; k--) {
          if (stack[k].tag === closeName || stack[k].localName === closeName.split(':').pop()) {
            stack.length = k;
            break;
          }
        }
        continue;
      }
      if (m[3]) {
        const tag = m[3];
        const localName = tag.includes(':') ? tag.split(':').pop() : tag;
        const attrs = {};
        if (m[4]) {
          const attrRe = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
          let am;
          while ((am = attrRe.exec(m[4])) !== null) {
            attrs[am[1]] = VisioConverter._unescapeXml(am[2] !== undefined ? am[2] : am[3]);
          }
        }
        const node = { tag, localName, attrs, children: [], text: '' };
        parent.children.push(node);
        if (m[5] !== '/') {
          stack.push(node);
        }
      }
    }
    return root.children.find(c => c.tag !== '#text') || root;
  }

  static _childElements(node, localName = null) {
    if (!node || !node.children) return [];
    const out = [];
    for (const c of node.children) {
      if (c.tag === '#text') continue;
      if (!localName || c.localName === localName) out.push(c);
    }
    return out;
  }

  static _firstChild(node, localName) {
    if (!node || !node.children) return null;
    for (const c of node.children) {
      if (c.tag !== '#text' && c.localName === localName) return c;
    }
    return null;
  }

  static _allText(node) {
    if (!node) return '';
    if (node.tag === '#text') return node.text || '';
    let s = '';
    for (const c of (node.children || [])) s += VisioConverter._allText(c);
    return s;
  }

  // Keep backwards-compatible helper signatures for scripts/tests
  static _getCell(node, cellName) {
    if (!node) return null;
    if (node.children) {
      for (const c of node.children) {
        if (c.localName === 'Cell' && c.attrs && c.attrs.N === cellName) {
          return { val: c.attrs.V !== undefined ? c.attrs.V : null, formula: c.attrs.F !== undefined ? c.attrs.F : null, unit: c.attrs.U || null };
        }
      }
      return null;
    }
    if (typeof node === 'string') return VisioConverter._getDirectCellFromXml(node, cellName);
    return null;
  }

  static _getDirectCellFromXml(xml, cellName) {
    if (!xml || typeof xml !== 'string') return { val: null, formula: null };
    const shapesIdx = xml.indexOf('<Shapes');
    const head = shapesIdx >= 0 ? xml.substring(0, shapesIdx) : xml;
    const secIdx = head.indexOf('<Section');
    const top = secIdx >= 0 ? head.substring(0, secIdx) : head;
    const escaped = cellName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = top.match(new RegExp(`<Cell\\b[^>]*\\bN=['"]${escaped}['"][^>]*/?>`));
    if (!m) return { val: null, formula: null };
    const vM = m[0].match(/\bV=['"]([^'"]*)['"]/);
    const fM = m[0].match(/\bF=['"]([^'"]*)['"]/);
    return { val: vM ? VisioConverter._unescapeXml(vM[1]) : null, formula: fM ? VisioConverter._unescapeXml(fM[1]) : null };
  }

  // ─── Color, Palette, Theme & QuickStyle Engine ──────────────────────────────

  static _parseThemeXml(themeXml) {
    const theme = {
      dk1: '#000000', lt1: '#FFFFFF', dk2: '#44546A', lt2: '#E7E6E6',
      accent1: '#4472C4', accent2: '#ED7D31', accent3: '#A5A5A5',
      accent4: '#FFC000', accent5: '#5B9BD5', accent6: '#70AD47',
      hlink: '#0563C1', folHlink: '#954F72', bkgnd: '#FFFFFF',
      variations: []
    };
    if (!themeXml) return theme;
    const root = VisioConverter._parseXml(themeXml);
    const readClr = (parent) => {
      if (!parent) return null;
      const srgb = VisioConverter._firstChild(parent, 'srgbClr');
      if (srgb && srgb.attrs.val) return '#' + srgb.attrs.val.replace(/^#/, '').toUpperCase();
      const sys = VisioConverter._firstChild(parent, 'sysClr');
      if (sys && (sys.attrs.lastClr || sys.attrs.val)) {
        const v = (sys.attrs.lastClr || sys.attrs.val).replace(/^#/, '');
        if (/^[0-9a-fA-F]{6}$/.test(v)) return '#' + v.toUpperCase();
      }
      return null;
    };
    const walk = (n) => {
      if (!n || !n.children) return;
      for (const c of n.children) {
        if (c.localName === 'clrScheme') {
          for (const k of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']) {
            const ch = VisioConverter._firstChild(c, k);
            const col = readClr(ch);
            if (col) theme[k] = col;
          }
        } else if (c.localName === 'bkgnd') {
          const col = readClr(c);
          if (col) theme.bkgnd = col;
        } else if (c.localName === 'variationClrScheme') {
          const v = {};
          for (let i = 1; i <= 7; i++) {
            const vc = VisioConverter._firstChild(c, 'varColor' + i);
            const col = readClr(vc);
            if (col) v['varColor' + i] = col;
          }
          if (Object.keys(v).length > 0) theme.variations.push(v);
        }
        walk(c);
      }
    };
    walk(root);
    return theme;
  }

  static _hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    const c = hex.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
    return {
      r: parseInt(c.slice(0, 2), 16),
      g: parseInt(c.slice(2, 4), 16),
      b: parseInt(c.slice(4, 6), 16),
    };
  }

  static _rgbToHex(r, g, b) {
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${cl(r)}${cl(g)}${cl(b)}`.toUpperCase();
  }

  static _applyTintShade(hex, tintPct) {
    const rgb = VisioConverter._hexToRgb(hex);
    if (!rgb) return hex;
    // Visio TINT(c, x) / MSOTINT(c, x): positive moves toward white, negative darkens toward black
    let f = Number(tintPct);
    if (isNaN(f)) return hex;
    if (Math.abs(f) > 1.5) f = f / 100.0; // convert percentage 25 -> 0.25
    if (f >= 0) {
      f = Math.min(1, f);
      return VisioConverter._rgbToHex(
        rgb.r + (255 - rgb.r) * f,
        rgb.g + (255 - rgb.g) * f,
        rgb.b + (255 - rgb.b) * f
      );
    }
    const d = Math.min(1, Math.abs(f));
    return VisioConverter._rgbToHex(rgb.r * (1 - d), rgb.g * (1 - d), rgb.b * (1 - d));
  }

  static _hslToHex(h, s, l) {
    // Visio HSL uses 0..255 or 0..240; normalize 255 if >1
    const H = (h > 1 ? h / 255 : h) * 360;
    const S = Math.max(0, Math.min(1, s > 1 ? s / 255 : s));
    const L = Math.max(0, Math.min(1, l > 1 ? l / 255 : l));
    const C = (1 - Math.abs(2 * L - 1)) * S;
    const X = C * (1 - Math.abs(((H / 60) % 2) - 1));
    const m = L - C / 2;
    let r = 0, g = 0, b = 0;
    if (H < 60) [r, g, b] = [C, X, 0];
    else if (H < 120) [r, g, b] = [X, C, 0];
    else if (H < 180) [r, g, b] = [0, C, X];
    else if (H < 240) [r, g, b] = [0, X, C];
    else if (H < 300) [r, g, b] = [X, 0, C];
    else [r, g, b] = [C, 0, X];
    return VisioConverter._rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  static _resolveThemeColorToken(token, theme) {
    if (!theme || token === null || token === undefined) return null;
    const raw = String(token).replace(/['"]/g, '').trim();
    const map = {
      dark1: theme.dk1, dk1: theme.dk1, textcolor: theme.dk1, maintextcolor: theme.dk1,
      light1: theme.lt1, lt1: theme.lt1, backgroundcolor: theme.bkgnd || theme.lt1,
      dark2: theme.dk2, dk2: theme.dk2,
      light2: theme.lt2, lt2: theme.lt2,
      accent1: theme.accent1, accentcolor1: theme.accent1,
      accent2: theme.accent2, accentcolor2: theme.accent2,
      accent3: theme.accent3, accentcolor3: theme.accent3,
      accent4: theme.accent4, accentcolor4: theme.accent4,
      accent5: theme.accent5, accentcolor5: theme.accent5,
      accent6: theme.accent6, accentcolor6: theme.accent6,
      hlink: theme.hlink, folhlink: theme.folHlink
    };
    const key = raw.toLowerCase();
    if (map[key]) return map[key];

    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      const idxMap = {
        0: theme.dk1, 1: theme.lt1, 2: theme.accent1, 3: theme.accent2,
        4: theme.accent3, 5: theme.accent4, 6: theme.accent5, 7: theme.accent6,
        100: null, 101: theme.accent1, 102: theme.accent2,
        103: theme.accent3, 104: theme.accent4, 105: theme.accent5,
        106: theme.accent6, 107: theme.dk2
      };
      if (idxMap[n] !== undefined) return idxMap[n];
    }
    return null;
  }

  static _evalColorFormula(formula, defaultColor, docColors, theme) {
    if (!formula || typeof formula !== 'string') return null;
    let f = formula.trim();
    // Unwrap THEMEGUARD(...)
    while (/^THEMEGUARD\(([\s\S]*)\)$/i.test(f)) {
      f = f.replace(/^THEMEGUARD\(([\s\S]*)\)$/i, '$1').trim();
    }
    const rgbM = f.match(/^RGB\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
    if (rgbM) return VisioConverter._rgbToHex(+rgbM[1], +rgbM[2], +rgbM[3]);

    const hslM = f.match(/^HSL\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
    if (hslM) return VisioConverter._hslToHex(+hslM[1], +hslM[2], +hslM[3]);

    const tsM = f.match(/^(MSOTINT|TINT|SHADE)\(\s*([\s\S]+?)\s*,\s*([-+]?[\d.]+)\s*\)$/i);
    if (tsM) {
      const fn = tsM[1].toUpperCase();
      const base = VisioConverter._evalColorFormula(tsM[2], defaultColor, docColors, theme)
        || VisioConverter._parseColor(tsM[2], null, defaultColor, docColors, theme);
      let amt = parseFloat(tsM[3]);
      if (fn === 'SHADE' && amt > 0) amt = -amt;
      if (base && base.startsWith('#')) return VisioConverter._applyTintShade(base, amt);
    }

    const tvM = f.match(/^(?:THEMEVAL|THEME)\(\s*['"]?([^)'"]+)['"]?\s*\)$/i);
    if (tvM) {
      return VisioConverter._resolveThemeColorToken(tvM[1], theme);
    }
    return VisioConverter._resolveThemeColorToken(f, theme);
  }

  static _parseColor(val, formula = null, defaultColor = 'transparent', docColorsOrMap = null, theme = null) {
    // Support legacy callers passing raw color map or array
    const docColors = docColorsOrMap || {};

    if (val && typeof val === 'string') {
      const trimV = val.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(trimV)) return trimV.toUpperCase();
      if (/^RGB\(/i.test(trimV)) {
        const c = VisioConverter._evalColorFormula(trimV, defaultColor, docColors, theme);
        if (c) return c;
      }
      if (/^\d+$/.test(trimV)) {
        const idx = parseInt(trimV, 10);
        if (docColors[idx]) return docColors[idx];
        if (idx >= 0 && idx < VISIO_DEFAULT_PALETTE.length) return VISIO_DEFAULT_PALETTE[idx];
      }
    }

    if (formula && typeof formula === 'string') {
      const f = formula.trim();
      if (f !== 'Inh' && f !== 'No Formula' && f !== 'THEMEVAL()') {
        const res = VisioConverter._evalColorFormula(f, defaultColor, docColors, theme);
        if (res) return res;
      }
    }

    if (typeof val === 'number') {
      if (docColors[val]) return docColors[val];
      if (val >= 0 && val < VISIO_DEFAULT_PALETTE.length) return VISIO_DEFAULT_PALETTE[val];
    }

    return defaultColor;
  }

  // ─── Layer, ConnectionPoint & Property Helpers ──────────────────────────────

  static _parsePageLayers(pagesXmlOrNode, pageId) {
    const layers = [];
    const root = typeof pagesXmlOrNode === 'string' ? VisioConverter._parseXml(pagesXmlOrNode) : pagesXmlOrNode;
    if (!root) return layers;
    const pages = VisioConverter._childElements(root, 'Page');
    const targetPage = pages.find(p => !pageId || p.attrs.ID === String(pageId)) || pages[0];
    if (!targetPage) return layers;
    const ps = VisioConverter._firstChild(targetPage, 'PageSheet');
    if (!ps) return layers;
    for (const sec of VisioConverter._childElements(ps, 'Section')) {
      if (sec.attrs.N !== 'Layer') continue;
      for (const row of VisioConverter._childElements(sec, 'Row')) {
        const cells = VisioConverter._cellsToMap(row);
        const name = (cells.Name && cells.Name.val) || `Layer ${(parseInt(row.attrs.IX || '0', 10) + 1)}`;
        const vis = cells.Visible ? cells.Visible.val !== '0' : true;
        const lock = cells.Lock ? cells.Lock.val === '1' : false;
        const col = cells.Color ? VisioConverter._parseColor(cells.Color.val, cells.Color.formula, '#888888') : '#888888';
        layers.push({ id: `layer_${row.attrs.IX || layers.length}`, ix: row.attrs.IX || String(layers.length), name, visible: vis, locked: lock, color: col });
      }
    }
    return layers;
  }

  static _cellsToMap(node) {
    const map = {};
    if (!node) return map;
    for (const c of VisioConverter._childElements(node, 'Cell')) {
      if (c.attrs && c.attrs.N) {
        map[c.attrs.N] = { val: c.attrs.V !== undefined ? c.attrs.V : null, formula: c.attrs.F !== undefined ? c.attrs.F : null, unit: c.attrs.U || null };
      }
    }
    return map;
  }

  static _parseConnectionPoints(shapeOrXml, masterOrXml, wPx, hPx) {
    const pts = [];
    const collectFromNode = (n) => {
      if (!n) return;
      for (const sec of VisioConverter._childElements(n, 'Section')) {
        if (sec.attrs.N !== 'Connection') continue;
        for (const row of VisioConverter._childElements(sec, 'Row')) {
          if (row.attrs.Del === '1') continue;
          const m = VisioConverter._cellsToMap(row);
          const xIn = parseFloat(m.X && m.X.val);
          const yIn = parseFloat(m.Y && m.Y.val);
          if (isNaN(xIn) || isNaN(yIn)) continue;
          const wIn = wPx / DPI;
          const hIn = hPx / DPI;
          const nx = wIn > 1e-6 ? Math.max(0, Math.min(1, xIn / wIn)) : 0.5;
          const ny = hIn > 1e-6 ? Math.max(0, Math.min(1, 1 - yIn / hIn)) : 0.5;
          const dirX = parseFloat(m.DirX && m.DirX.val) || 0;
          const dirY = parseFloat(m.DirY && m.DirY.val) || 0;
          pts.push({
            id: row.attrs.IX || row.attrs.N || String(pts.length),
            x: nx,
            y: ny,
            normal: (dirX !== 0 || dirY !== 0) ? { x: -dirX, y: dirY } : null
          });
        }
      }
    };
    const sNode = typeof shapeOrXml === 'string' ? VisioConverter._parseXml(shapeOrXml) : shapeOrXml;
    const mNode = typeof masterOrXml === 'string' ? VisioConverter._parseXml(masterOrXml) : masterOrXml;
    if (sNode) collectFromNode(sNode);
    if (pts.length === 0 && mNode) collectFromNode(mNode);
    return pts;
  }

  // ─── Curves & Geometry Compiler ─────────────────────────────────────────────

  static _parseNurbsControlPoints(eStr, wPx, hPx) {
    const pts = [];
    if (!eStr || typeof eStr !== 'string') return pts;
    const inner = eStr.replace(/^NURBS\(/i, '').replace(/\)$/, '');
    const nums = inner.split(',').map(s => parseFloat(s.trim()));
    if (nums.length < 8 || nums.some(isNaN)) return pts;
    const knotLast = nums[0];
    const degree = Math.max(1, Math.round(nums[1]));
    const xType = Math.round(nums[2]);
    const yType = Math.round(nums[3]);
    for (let i = 4; i + 3 < nums.length; i += 4) {
      pts.push({
        x: xType === 0 ? nums[i] * wPx : nums[i] * DPI,
        y: yType === 0 ? (1 - nums[i + 1]) * hPx : (hPx - nums[i + 1] * DPI),
        k: nums[i + 2],
        w: nums[i + 3] || 1
      });
    }
    return { knotLast, degree, xType, yType, points: pts };
  }

  static _evalNurbsPath(p0, pLast, rowMap, wPx, hPx) {
    const eStr = (rowMap.E && (rowMap.E.val || rowMap.E.formula)) || '';
    const parsed = VisioConverter._parseNurbsControlPoints(eStr, wPx, hPx);
    if (!parsed || !parsed.points || parsed.points.length === 0) {
      return `L ${pLast.x.toFixed(2)} ${pLast.y.toFixed(2)} `;
    }
    const { knotLast, degree, points } = parsed;
    const A = parseFloat(rowMap.A && rowMap.A.val) || 0;
    const B = parseFloat(rowMap.B && rowMap.B.val) || 1;
    const C = parseFloat(rowMap.C && rowMap.C.val) || 0;
    const D = parseFloat(rowMap.D && rowMap.D.val) || 1;

    const cps = [
      { x: p0.x, y: p0.y, k: C, w: D },
      ...points,
      { x: pLast.x, y: pLast.y, k: A, w: B }
    ];

    const knots = cps.map(c => isNaN(c.k) ? 0 : c.k);
    for (let i = 0; i <= degree; i++) knots.push(knotLast);
    for (let i = 1; i < knots.length; i++) {
      if (knots[i] < knots[i - 1]) knots[i] = knots[i - 1];
    }

    const tMin = knots[degree];
    const tMax = knots[cps.length];
    if (!(tMax > tMin)) {
      let d = '';
      for (const c of cps.slice(1)) d += `L ${c.x.toFixed(2)} ${c.y.toFixed(2)} `;
      return d;
    }

    const steps = Math.min(48, Math.max(18, cps.length * 4));
    let d = '';
    for (let s = 1; s < steps; s++) {
      const t = tMin + (tMax - tMin) * (s / steps);
      const N = new Array(cps.length).fill(0);
      for (let i = 0; i < cps.length; i++) {
        N[i] = (t >= knots[i] && t < knots[i + 1]) ? 1 : 0;
      }
      for (let deg = 1; deg <= degree; deg++) {
        for (let i = 0; i < cps.length; i++) {
          if (i + deg + 1 >= knots.length) continue;
          const d1 = knots[i + deg] - knots[i];
          const d2 = knots[i + deg + 1] - knots[i + 1];
          const a = d1 > 1e-12 ? ((t - knots[i]) / d1) * N[i] : 0;
          const b = d2 > 1e-12 ? ((knots[i + deg + 1] - t) / d2) * (N[i + 1] || 0) : 0;
          N[i] = a + b;
        }
      }
      let sx = 0, sy = 0, wsum = 0;
      for (let i = 0; i < cps.length; i++) {
        const rw = N[i] * cps[i].w;
        sx += rw * cps[i].x;
        sy += rw * cps[i].y;
        wsum += rw;
      }
      if (wsum > 1e-12) {
        d += `L ${(sx / wsum).toFixed(2)} ${(sy / wsum).toFixed(2)} `;
      }
    }
    d += `L ${pLast.x.toFixed(2)} ${pLast.y.toFixed(2)} `;
    return d;
  }

  static _evalCircularArcCmd(x0, y0, x1, y1, sagPx) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const chord = Math.hypot(dx, dy);
    if (chord < 0.01 || Math.abs(sagPx) < 0.01) {
      return `L ${x1.toFixed(2)} ${y1.toFixed(2)} `;
    }
    const s = Math.abs(sagPx);
    const r = (chord * chord) / (8 * s) + s / 2;
    const largeArc = s > chord / 2 ? 1 : 0;
    // In Y-down screen space: Visio positive A bulges to the left of (x0->x1) in Y-up, which is right in Y-down (sweep = 1 when sagPx > 0)
    const sweep = sagPx > 0 ? 1 : 0;
    return `A ${r.toFixed(3)} ${r.toFixed(3)} 0 ${largeArc} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)} `;
  }

  static _evalEllipticalArcCmd(x0yUp, y0yUp, mYUp, p1YUp, angleRad, ratioD, hIn) {
    const D = Math.abs(ratioD) > 1e-6 ? Math.abs(ratioD) : 1;
    const c = Math.cos(-angleRad), s = Math.sin(-angleRad);
    const toU = (x, y) => {
      const rx = x * c - y * s;
      const ry = x * s + y * c;
      return { x: rx / D, y: ry };
    };
    const q0 = toU(x0yUp, y0yUp);
    const qm = toU(mYUp.x, mYUp.y);
    const q1 = toU(p1YUp.x, p1YUp.y);

    const denom = 2 * (q0.x * (qm.y - q1.y) + qm.x * (q1.y - q0.y) + q1.x * (q0.y - qm.y));
    const endX = (p1YUp.x * DPI).toFixed(2);
    const endY = ((hIn - p1YUp.y) * DPI).toFixed(2);
    if (Math.abs(denom) < 1e-9) {
      return `L ${endX} ${endY} `;
    }
    const ux = ((q0.x * q0.x + q0.y * q0.y) * (qm.y - q1.y) + (qm.x * qm.x + qm.y * qm.y) * (q1.y - q0.y) + (q1.x * q1.x + q1.y * q1.y) * (q0.y - qm.y)) / denom;
    const uy = ((q0.x * q0.x + q0.y * q0.y) * (q1.x - qm.x) + (qm.x * qm.x + qm.y * qm.y) * (q0.x - q1.x) + (q1.x * q1.x + q1.y * q1.y) * (qm.x - q0.x)) / denom;
    const ry = Math.hypot(q0.x - ux, q0.y - uy);
    const rx = ry * D;

    const a0 = Math.atan2(q0.y - uy, q0.x - ux);
    const am = Math.atan2(qm.y - uy, qm.x - ux);
    const a1 = Math.atan2(q1.y - uy, q1.x - ux);
    const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const dM = norm(am - a0);
    const d1 = norm(a1 - a0);
    const ccw = dM < d1;
    const sweepAngle = ccw ? d1 : (2 * Math.PI - d1);
    const largeArc = sweepAngle > Math.PI ? 1 : 0;
    const sweepSvg = ccw ? 0 : 1; // Y-up CCW maps to Y-down SVG sweep=0
    const rotDeg = (-angleRad * 180) / Math.PI;
    return `A ${(rx * DPI).toFixed(3)} ${(ry * DPI).toFixed(3)} ${rotDeg.toFixed(3)} ${largeArc} ${sweepSvg} ${endX} ${endY} `;
  }

  static _evalSplineChain(startPx, splineRows, wPx, hPx) {
    if (!splineRows || splineRows.length === 0) return '';
    const first = splineRows[0];
    const degree = Math.max(1, Math.min(3, Math.round(first.D || 2)));
    const pts = [startPx, ...splineRows.map(r => ({ x: r.x, y: r.y }))];
    const knots = [first.A || 0, first.B || 0, first.C || 1];
    for (let i = 1; i < splineRows.length; i++) {
      knots.push(splineRows[i].A !== undefined ? splineRows[i].A : knots[knots.length - 1] + 1);
    }
    const endK = knots[knots.length - 1] + 1;
    while (knots.length < pts.length + degree + 1) knots.push(endK);
    for (let i = 1; i < knots.length; i++) if (knots[i] < knots[i - 1]) knots[i] = knots[i - 1];

    const tMin = knots[degree];
    const tMax = knots[pts.length];
    if (!(tMax > tMin)) {
      return splineRows.map(r => `L ${r.x.toFixed(2)} ${r.y.toFixed(2)} `).join('');
    }
    const steps = Math.max(16, pts.length * 6);
    let d = '';
    for (let s = 1; s < steps; s++) {
      const t = tMin + (tMax - tMin) * (s / steps);
      const N = new Array(pts.length).fill(0);
      for (let i = 0; i < pts.length; i++) N[i] = (t >= knots[i] && t < knots[i + 1]) ? 1 : 0;
      for (let deg = 1; deg <= degree; deg++) {
        for (let i = 0; i < pts.length; i++) {
          if (i + deg + 1 >= knots.length) continue;
          const d1 = knots[i + deg] - knots[i];
          const d2 = knots[i + deg + 1] - knots[i + 1];
          N[i] = (d1 > 1e-12 ? ((t - knots[i]) / d1) * N[i] : 0)
            + (d2 > 1e-12 ? ((knots[i + deg + 1] - t) / d2) * (N[i + 1] || 0) : 0);
        }
      }
      let sx = 0, sy = 0;
      for (let i = 0; i < pts.length; i++) { sx += N[i] * pts[i].x; sy += N[i] * pts[i].y; }
      d += `L ${sx.toFixed(2)} ${sy.toFixed(2)} `;
    }
    const last = splineRows[splineRows.length - 1];
    d += `L ${last.x.toFixed(2)} ${last.y.toFixed(2)} `;
    return d;
  }

  /**
   * Compile one merged Visio Geometry section (either XML string or parsed section object)
   * into an SVG `d` path string + vertex list.
   */
  static _parseGeometrySection(geomInput, wPx, hPx, roundingPx = 0) {
    let secObj = null;
    if (typeof geomInput === 'string') {
      secObj = VisioConverter._parseXml(`<Root>${geomInput}</Root>`);
      const innerSec = VisioConverter._firstChild(secObj, 'Section');
      if (innerSec) secObj = innerSec;
    } else {
      secObj = geomInput;
    }
    if (!secObj) return { d: '', noFill: false, noLine: false, noShow: false, vertices: [] };

    const secCells = secObj.cells || VisioConverter._cellsToMap(secObj);
    const noFill = secCells.NoFill ? secCells.NoFill.val === '1' : false;
    const noLine = secCells.NoLine ? secCells.NoLine.val === '1' : false;
    const noShow = secCells.NoShow ? secCells.NoShow.val === '1' : false;
    if (noShow) return { d: '', noFill: true, noLine: true, noShow: true, vertices: [] };

    const wIn = wPx / DPI;
    const hIn = hPx / DPI;
    const rows = (secObj.rows || VisioConverter._childElements(secObj, 'Row')).filter(r => {
      const del = r.del !== undefined ? r.del : (r.attrs && r.attrs.Del === '1');
      return !del;
    });

    // If pure MoveTo/LineTo polygon with Rounding > 0, apply circular corner fillets
    const onlyStraight = rows.length >= 4 && rows.every(r => {
      const t = r.type || (r.attrs && r.attrs.T) || '';
      return t === 'MoveTo' || t === 'RelMoveTo' || t === 'LineTo' || t === 'RelLineTo';
    });

    if (roundingPx > 0.5 && onlyStraight) {
      const pts = [];
      let curX = 0, curY = 0;
      for (const r of rows) {
        const t = r.type || (r.attrs && r.attrs.T) || '';
        const m = r.cells || VisioConverter._cellsToMap(r);
        const rx = m.X && m.X.val !== null ? parseFloat(m.X.val) : 0;
        const ry = m.Y && m.Y.val !== null ? parseFloat(m.Y.val) : 0;
        const isRel = t.startsWith('Rel');
        const x = isRel ? rx * wPx : rx * DPI;
        const y = isRel ? (1 - ry) * hPx : (hPx - ry * DPI);
        if (pts.length === 0 || Math.hypot(x - curX, y - curY) > 0.2) {
          pts.push({ x, y });
          curX = x; curY = y;
        }
      }
      if (pts.length >= 4) {
        const closed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1;
        const verts = closed ? pts.slice(0, -1) : pts;
        if (verts.length >= 3) {
          let d = '';
          const n = verts.length;
          for (let i = 0; i < n; i++) {
            const pPrev = verts[(i - 1 + n) % n];
            const pCurr = verts[i];
            const pNext = verts[(i + 1) % n];
            const v1x = pCurr.x - pPrev.x, v1y = pCurr.y - pPrev.y;
            const v2x = pNext.x - pCurr.x, v2y = pNext.y - pCurr.y;
            const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
            if (!closed && (i === 0 || i === n - 1) || l1 < 0.5 || l2 < 0.5) {
              d += `${i === 0 ? 'M' : 'L'} ${pCurr.x.toFixed(2)} ${pCurr.y.toFixed(2)} `;
            } else {
              const rad = Math.min(roundingPx, l1 * 0.45, l2 * 0.45);
              const sx = pCurr.x - (v1x / l1) * rad;
              const sy = pCurr.y - (v1y / l1) * rad;
              const ex = pCurr.x + (v2x / l2) * rad;
              const ey = pCurr.y + (v2y / l2) * rad;
              d += `${i === 0 ? 'M' : 'L'} ${sx.toFixed(2)} ${sy.toFixed(2)} `;
              d += `Q ${pCurr.x.toFixed(2)} ${pCurr.y.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)} `;
            }
          }
          if (closed) d += 'Z ';
          return { d: d.trim(), noFill, noLine, noShow, vertices: pts };
        }
      }
    }

    let d = '';
    let curXIn = 0, curYIn = 0;
    let curXPx = 0, curYPx = hPx;
    const vertices = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowType = r.type || (r.attrs && r.attrs.T) || '';
      const m = r.cells || VisioConverter._cellsToMap(r);
      const isRel = rowType.startsWith('Rel');
      const rawX = m.X && m.X.val !== null ? parseFloat(m.X.val) : NaN;
      const rawY = m.Y && m.Y.val !== null ? parseFloat(m.Y.val) : NaN;
      const xIn = !isNaN(rawX) ? (isRel ? rawX * wIn : rawX) : curXIn;
      const yIn = !isNaN(rawY) ? (isRel ? rawY * hIn : rawY) : curYIn;
      const sx = xIn * DPI;
      const sy = (hIn - yIn) * DPI;

      if (rowType === 'MoveTo' || rowType === 'RelMoveTo') {
        d += `M ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'LineTo' || rowType === 'RelLineTo') {
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        d += `L ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'ArcTo') {
        const sagIn = parseFloat(m.A && m.A.val) || 0;
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        d += VisioConverter._evalCircularArcCmd(curXPx, curYPx, sx, sy, sagIn * DPI);
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'EllipticalArcTo') {
        const aIn = parseFloat(m.A && m.A.val) || 0;
        const bIn = parseFloat(m.B && m.B.val) || 0;
        const cRad = parseFloat(m.C && m.C.val) || 0;
        const dRat = parseFloat(m.D && m.D.val) || 1;
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        d += VisioConverter._evalEllipticalArcCmd(curXIn, curYIn, { x: aIn, y: bIn }, { x: xIn, y: yIn }, cRad, dRat, hIn);
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'NURBSTo') {
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        d += VisioConverter._evalNurbsPath({ x: curXPx, y: curYPx }, { x: sx, y: sy }, m, wPx, hPx);
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'SplineStart') {
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        const startPx = { x: curXPx, y: curYPx };
        const chain = [{
          x: sx, y: sy,
          A: parseFloat(m.A && m.A.val) || 0,
          B: parseFloat(m.B && m.B.val) || 0,
          C: parseFloat(m.C && m.C.val) || 1,
          D: parseFloat(m.D && m.D.val) || 2
        }];
        while (i + 1 < rows.length && (rows[i + 1].type || (rows[i + 1].attrs && rows[i + 1].attrs.T)) === 'SplineKnot') {
          i++;
          const km = rows[i].cells || VisioConverter._cellsToMap(rows[i]);
          const kx = (parseFloat(km.X && km.X.val) || 0) * DPI;
          const ky = (hIn - (parseFloat(km.Y && km.Y.val) || 0)) * DPI;
          chain.push({ x: kx, y: ky, A: km.A ? parseFloat(km.A.val) : undefined });
        }
        d += VisioConverter._evalSplineChain(startPx, chain, wPx, hPx);
        const last = chain[chain.length - 1];
        curXPx = last.x; curYPx = last.y;
        curXIn = last.x / DPI; curYIn = hIn - last.y / DPI;
        vertices.push(last);
        continue;
      } else if (rowType === 'RelQuadBezTo' || rowType === 'QuadraticBezTo') {
        const ax = parseFloat(m.A && m.A.val) || 0;
        const ay = parseFloat(m.B && m.B.val) || 0;
        const cpx = isRel ? ax * wPx : ax * DPI;
        const cpy = isRel ? (1 - ay) * hPx : (hPx - ay * DPI);
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        d += `Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'RelCubBezTo' || rowType === 'CubicBezTo') {
        const ax = parseFloat(m.A && m.A.val) || 0;
        const ay = parseFloat(m.B && m.B.val) || 0;
        const cx = parseFloat(m.C && m.C.val) || 0;
        const dy = parseFloat(m.D && m.D.val) || 0;
        const cp1x = isRel ? ax * wPx : ax * DPI;
        const cp1y = isRel ? (1 - ay) * hPx : (hPx - ay * DPI);
        const cp2x = isRel ? cx * wPx : cx * DPI;
        const cp2y = isRel ? (1 - dy) * hPx : (hPx - dy * DPI);
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        d += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'PolylineTo') {
        const eStr = (m.A && (m.A.val || m.A.formula)) || '';
        const nums = eStr.replace(/^POLYLINE\(/i, '').replace(/\)$/, '').split(',').map(s => parseFloat(s.trim()));
        if (!d) d += `M ${curXPx.toFixed(2)} ${curYPx.toFixed(2)} `;
        if (nums.length >= 4) {
          const xt = Math.round(nums[0]), yt = Math.round(nums[1]);
          for (let k = 2; k + 1 < nums.length; k += 2) {
            const px = xt === 0 ? nums[k] * wPx : nums[k] * DPI;
            const py = yt === 0 ? (1 - nums[k + 1]) * hPx : (hPx - nums[k + 1] * DPI);
            d += `L ${px.toFixed(2)} ${py.toFixed(2)} `;
            vertices.push({ x: px, y: py });
          }
        }
        d += `L ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        vertices.push({ x: sx, y: sy });
      } else if (rowType === 'Ellipse') {
        const ecx = sx, ecy = sy;
        const axPx = (parseFloat(m.A && m.A.val) || 0) * DPI;
        const ayPx = (hIn - (parseFloat(m.B && m.B.val) || 0)) * DPI;
        const cxPx = (parseFloat(m.C && m.C.val) || 0) * DPI;
        const cyPx = (hIn - (parseFloat(m.D && m.D.val) || 0)) * DPI;
        const erx = Math.max(0.5, Math.hypot(axPx - ecx, ayPx - ecy));
        const ery = Math.max(0.5, Math.hypot(cxPx - ecx, cyPx - ecy));
        const rot = (Math.atan2(ayPx - ecy, axPx - ecx) * 180) / Math.PI;
        const ux = Math.cos((rot * Math.PI) / 180) * erx;
        const uy = Math.sin((rot * Math.PI) / 180) * erx;
        d += `M ${(ecx - ux).toFixed(2)} ${(ecy - uy).toFixed(2)} A ${erx.toFixed(2)} ${ery.toFixed(2)} ${rot.toFixed(2)} 1 0 ${(ecx + ux).toFixed(2)} ${(ecy + uy).toFixed(2)} A ${erx.toFixed(2)} ${ery.toFixed(2)} ${rot.toFixed(2)} 1 0 ${(ecx - ux).toFixed(2)} ${(ecy - uy).toFixed(2)} Z `;
      }

      curXIn = xIn; curYIn = yIn;
      curXPx = sx; curYPx = sy;
    }

    return { d: d.trim(), noFill, noLine, noShow, vertices };
  }

  // ─── StyleSheet & Master Resolution ──────────────────────────────────────────

  static _parseStyleSheets(docNode) {
    const sheets = {};
    const ssRoot = VisioConverter._firstChild(docNode, 'StyleSheets');
    if (!ssRoot) return sheets;
    for (const ss of VisioConverter._childElements(ssRoot, 'StyleSheet')) {
      const id = ss.attrs.ID;
      if (!id) continue;
      sheets[id] = {
        id,
        name: ss.attrs.NameU || ss.attrs.Name || '',
        lineStyle: ss.attrs.LineStyle || null,
        fillStyle: ss.attrs.FillStyle || null,
        textStyle: ss.attrs.TextStyle || null,
        cells: VisioConverter._cellsToMap(ss),
        sections: VisioConverter._sectionsToMap(ss)
      };
    }
    return sheets;
  }

  static _sectionsToMap(node) {
    const out = {};
    for (const sec of VisioConverter._childElements(node, 'Section')) {
      const name = sec.attrs.N;
      if (!name) continue;
      const ix = sec.attrs.IX || '0';
      const key = name === 'Geometry' ? `Geometry:${ix}` : name;
      const rows = [];
      for (const r of VisioConverter._childElements(sec, 'Row')) {
        rows.push({
          ix: r.attrs.IX,
          name: r.attrs.N,
          type: r.attrs.T,
          del: r.attrs.Del === '1',
          cells: VisioConverter._cellsToMap(r)
        });
      }
      out[key] = {
        name,
        ix,
        del: sec.attrs.Del === '1',
        cells: VisioConverter._cellsToMap(sec),
        rows
      };
    }
    return out;
  }

  static _lookupStyleCell(styleSheets, startStyleId, cellName, styleChannel = 'fillStyle') {
    const visited = new Set();
    let sid = startStyleId;
    while (sid && !visited.has(sid)) {
      visited.add(sid);
      const sheet = styleSheets[sid];
      if (!sheet) break;
      const c = sheet.cells[cellName];
      if (c && ((c.val !== null && c.val !== 'Inh') || (c.formula && c.formula !== 'Inh' && c.formula !== 'No Formula'))) {
        return c;
      }
      sid = sheet[styleChannel] || sheet.fillStyle || sheet.lineStyle || sheet.textStyle;
    }
    return null;
  }

  static _resolveQuickStyleColor(cellVal, matrixIdx, channel, theme, docColors) {
    // QuickStyleFillColor/LineColor/FontColor in Visio 2013+ (verified via Visio COM):
    // When QuickStyleFillMatrix/LineMatrix is 0 or 100 ("No Style" matrix), QuickStyle does not override base fill/line.
    // Matrix 6 in OOXML fmtScheme uses lt1 (#FFFFFF) as fill.
    // Color IDs: 0=dk1, 1=lt1, 2..7=accent1..6, 100..105=accent1..6, 106=dk1, 107=lt1.
    if (cellVal === null || cellVal === undefined) return null;
    const matStr = matrixIdx !== null && matrixIdx !== undefined ? String(matrixIdx) : null;
    if (matStr === '0' || matStr === '100') return null;
    if (matStr === '6' && channel === 'fill') return (theme && theme.lt1) || '#FFFFFF';
    const n = parseInt(String(cellVal), 10);
    if (isNaN(n)) return VisioConverter._resolveThemeColorToken(cellVal, theme);
    if (n === 0) return theme ? (theme.dk1 || '#000000') : '#000000';
    if (n === 1) return channel === 'fill' ? ((theme && theme.lt1) || '#FFFFFF') : ((theme && theme.dk1) || '#000000');
    if (n >= 2 && n <= 7 && theme) return theme['accent' + (n - 1)] || null;
    if (n >= 100 && n <= 105 && theme) return theme['accent' + (n - 99)] || null;
    if (n === 106) return (theme && theme.dk1) || '#000000';
    if (n === 107) return (theme && theme.lt1) || '#FFFFFF';
    return null;
  }

  static _mergeSections(masterSections, instanceSections) {
    const merged = {};
    const keys = new Set([...Object.keys(masterSections || {}), ...Object.keys(instanceSections || {})]);
    for (const k of keys) {
      const ms = masterSections && masterSections[k];
      const is = instanceSections && instanceSections[k];
      if (is && is.del) continue;
      if (!ms) {
        merged[k] = { ...is, cells: { ...is.cells }, rows: is.rows.map(r => ({ ...r, cells: { ...r.cells } })) };
        continue;
      }
      if (!is) {
        merged[k] = { ...ms, cells: { ...ms.cells }, rows: ms.rows.map(r => ({ ...r, cells: { ...r.cells } })) };
        continue;
      }
      const cells = { ...ms.cells, ...is.cells };
      const byId = new Map();
      const order = [];
      for (const r of ms.rows) {
        const rid = r.ix !== undefined ? `ix:${r.ix}` : `n:${r.name || order.length}`;
        byId.set(rid, { ...r, cells: { ...r.cells } });
        order.push(rid);
      }
      for (const r of is.rows) {
        const rid = r.ix !== undefined ? `ix:${r.ix}` : `n:${r.name || order.length}`;
        if (r.del) {
          byId.delete(rid);
          continue;
        }
        if (byId.has(rid)) {
          const prev = byId.get(rid);
          byId.set(rid, {
            ix: r.ix !== undefined ? r.ix : prev.ix,
            name: r.name || prev.name,
            type: r.type || prev.type,
            del: false,
            cells: { ...prev.cells, ...r.cells }
          });
        } else {
          byId.set(rid, { ...r, cells: { ...r.cells } });
          order.push(rid);
        }
      }
      // Keep numeric IX order when rows are geometry rows
      const finalRows = [...byId.values()];
      if (k.startsWith('Geometry')) {
        finalRows.sort((a, b) => (parseInt(a.ix || '0', 10) - parseInt(b.ix || '0', 10)));
      }
      merged[k] = { name: is.name || ms.name, ix: is.ix || ms.ix, del: false, cells, rows: finalRows };
    }
    return merged;
  }

  static _isThemeEnabled(instShape, masterShape, ctx, styleChannel = 'lineStyle') {
    const styleSheets = ctx && ctx.styleSheets ? ctx.styleSheets : {};
    const docDefaults = ctx && ctx.docDefaults ? ctx.docDefaults : {};
    const parseTi = (c) => {
      if (!c || c.val === null || c.val === undefined || c.val === 'Inh' || c.val === 'Themed') return NaN;
      const n = parseInt(String(c.val), 10);
      return isNaN(n) ? NaN : n;
    };
    let ti = parseTi(instShape && instShape.cells && instShape.cells.ThemeIndex);
    if (isNaN(ti)) ti = parseTi(masterShape && masterShape.cells && masterShape.cells.ThemeIndex);
    if (isNaN(ti)) {
      const sId = (instShape && instShape[styleChannel])
        || (masterShape && masterShape[styleChannel])
        || docDefaults[styleChannel];
      if (sId) {
        ti = parseTi(VisioConverter._lookupStyleCell(styleSheets, sId, 'ThemeIndex', styleChannel));
      }
    }
    if (!isNaN(ti) && ti !== 65534) return ti > 0;
    if (ctx && typeof ctx.pageThemeIndex === 'number' && !isNaN(ctx.pageThemeIndex) && ctx.pageThemeIndex !== 65534) {
      return ctx.pageThemeIndex > 0;
    }
    if (ctx && typeof ctx.docThemeIndex === 'number' && !isNaN(ctx.docThemeIndex) && ctx.docThemeIndex !== 65534) {
      return ctx.docThemeIndex > 0;
    }
    const s0Ti = parseTi(styleSheets['0'] && styleSheets['0'].cells && styleSheets['0'].cells.ThemeIndex);
    if (!isNaN(s0Ti) && s0Ti !== 65534) return s0Ti > 0;
    return true;
  }

  static _extractUserValue(instShape, masterShape, rowName) {
    for (const src of [instShape, masterShape]) {
      const uSec = src && src.sections && src.sections.User;
      if (uSec && uSec.rows) {
        const row = uSec.rows.find(r => !r.del && r.name === rowName);
        if (row && row.cells && row.cells.Value && row.cells.Value.val !== undefined) {
          return row.cells.Value.val;
        }
      }
    }
    return null;
  }

  static _getEffectiveCell(instShape, masterShape, ctx, cellName, styleChannel = 'fillStyle') {
    const { styleSheets, docDefaults } = ctx;
    const pick = (c) => {
      if (!c) return null;
      const hasVal = c.val !== null && c.val !== undefined && c.val !== 'Inh';
      const hasFormula = c.formula && c.formula !== 'Inh' && c.formula !== 'No Formula';
      return (hasVal || hasFormula) ? c : null;
    };
    const c1 = instShape && pick(instShape.cells[cellName]);
    if (c1) return c1;
    const c2 = masterShape && pick(masterShape.cells[cellName]);
    if (c2) return c2;
    const sId = (instShape && instShape[styleChannel])
      || (masterShape && masterShape[styleChannel])
      || (docDefaults && docDefaults[styleChannel]);
    if (sId) {
      const c3 = VisioConverter._lookupStyleCell(styleSheets, sId, cellName, styleChannel);
      if (c3) return c3;
    }
    return null;
  }

  static _linePatternToDash(patVal) {
    const p = parseInt(String(patVal || '1'), 10);
    switch (p) {
      case 0: return null; // invisible handled by stroke='none'
      case 1: return null; // solid
      case 2: return [6, 4]; // dash
      case 3: return [2, 3]; // dot
      case 4: return [8, 3, 2, 3]; // dash-dot
      case 5: return [8, 3, 2, 2, 2, 3]; // dash-dot-dot
      case 9: return [2, 2];
      case 10: return [10, 4];
      case 16: return [4, 4];
      case 23: return [3, 6]; // railroad cross-tie / tick pattern
      default: return p > 1 ? [6, 3] : null;
    }
  }

  static _indexMasterShapes(masterXml) {
    const root = VisioConverter._parseXml(masterXml);
    const byId = new Map();
    const parseNodeShape = (n) => {
      const s = {
        id: n.attrs.ID,
        nameU: n.attrs.NameU || n.attrs.Name || '',
        type: n.attrs.Type || 'Shape',
        masterShape: n.attrs.MasterShape || null,
        lineStyle: n.attrs.LineStyle || null,
        fillStyle: n.attrs.FillStyle || null,
        textStyle: n.attrs.TextStyle || null,
        cells: VisioConverter._cellsToMap(n),
        sections: VisioConverter._sectionsToMap(n),
        textNode: VisioConverter._firstChild(n, 'Text'),
        foreignNode: VisioConverter._firstChild(n, 'ForeignData'),
        children: []
      };
      if (s.id) byId.set(String(s.id), s);
      const innerShapes = VisioConverter._firstChild(n, 'Shapes');
      if (innerShapes) {
        for (const ch of VisioConverter._childElements(innerShapes, 'Shape')) {
          s.children.push(parseNodeShape(ch));
        }
      }
      return s;
    };
    const topShapesNode = VisioConverter._firstChild(root, 'Shapes');
    const topShapes = topShapesNode ? VisioConverter._childElements(topShapesNode, 'Shape').map(parseNodeShape) : [];
    return { rootShape: topShapes[0] || null, topShapes, byId };
  }

  static _parsePageShapeNode(n) {
    const s = {
      id: n.attrs.ID,
      nameU: n.attrs.NameU || n.attrs.Name || '',
      type: n.attrs.Type || 'Shape',
      masterId: n.attrs.Master || null,
      masterShape: n.attrs.MasterShape || null,
      del: n.attrs.Del === '1',
      lineStyle: n.attrs.LineStyle || null,
      fillStyle: n.attrs.FillStyle || null,
      textStyle: n.attrs.TextStyle || null,
      cells: VisioConverter._cellsToMap(n),
      sections: VisioConverter._sectionsToMap(n),
      textNode: VisioConverter._firstChild(n, 'Text'),
      foreignNode: VisioConverter._firstChild(n, 'ForeignData'),
      children: []
    };
    const innerShapes = VisioConverter._firstChild(n, 'Shapes');
    if (innerShapes) {
      for (const ch of VisioConverter._childElements(innerShapes, 'Shape')) {
        s.children.push(VisioConverter._parsePageShapeNode(ch));
      }
    }
    return s;
  }

  static _resolveShapeColorsAndStroke(instShape, masterShape, ctx, isForeign) {
    const { docColors, theme } = ctx;
    const g = (name, ch) => VisioConverter._getEffectiveCell(instShape, masterShape, ctx, name, ch);

    const fillPatC = g('FillPattern', 'fillStyle');
    const fillPattern = fillPatC && fillPatC.val !== null ? parseInt(fillPatC.val, 10) : 1;

    const linePatC = g('LinePattern', 'lineStyle');
    const linePattern = linePatC && linePatC.val !== null ? parseInt(linePatC.val, 10) : 1;

    const fillThemeOk = VisioConverter._isThemeEnabled(instShape, masterShape, ctx, 'fillStyle');
    const lineThemeOk = VisioConverter._isThemeEnabled(instShape, masterShape, ctx, 'lineStyle');

    const fillCell = g('FillForegnd', 'fillStyle');
    const qsFillColC = g('QuickStyleFillColor', 'fillStyle');
    const qsFillMatC = g('QuickStyleFillMatrix', 'fillStyle');
    let fill = '#FFFFFF';
    if (isForeign) {
      fill = 'transparent';
    } else if (fillPattern === 0) {
      fill = 'none';
    } else {
      const v = fillCell ? fillCell.val : null;
      const f = fillCell ? fillCell.formula : null;
      if (v && v !== 'Themed' && v !== 'Inh') {
        fill = VisioConverter._parseColor(v, f, '#FFFFFF', docColors, theme);
      } else if (f && f !== 'Inh' && f !== 'No Formula' && !/^THEMEVAL\(\)$/i.test(f)) {
        fill = VisioConverter._parseColor(v, f, '#FFFFFF', docColors, theme);
      } else if (fillThemeOk && qsFillColC && qsFillColC.val !== null && (!qsFillMatC || parseInt(qsFillMatC.val || '0', 10) !== 0)) {
        fill = VisioConverter._resolveQuickStyleColor(qsFillColC.val, qsFillMatC && qsFillMatC.val, 'fill', theme, docColors) || '#FFFFFF';
      } else {
        fill = '#FFFFFF';
      }
    }

    const fillTransC = g('FillForegndTrans', 'fillStyle');
    const fillTransVal = fillTransC && fillTransC.val !== null ? parseFloat(fillTransC.val) : NaN;
    const fillOpacity = !isNaN(fillTransVal) ? Math.max(0, Math.min(1, 1 - fillTransVal)) : 1;

    const lineCell = g('LineColor', 'lineStyle');
    const qsLineColC = g('QuickStyleLineColor', 'lineStyle');
    const qsLineMatC = g('QuickStyleLineMatrix', 'lineStyle');
    let stroke = '#000000';
    if (linePattern === 0 || isForeign) {
      stroke = 'none';
    } else {
      const v = lineCell ? lineCell.val : null;
      const f = lineCell ? lineCell.formula : null;
      if (v && v !== 'Themed' && v !== 'Inh') {
        stroke = VisioConverter._parseColor(v, f, '#000000', docColors, theme);
      } else if (f && f !== 'Inh' && f !== 'No Formula' && !/^THEMEVAL\(\)$/i.test(f)) {
        stroke = VisioConverter._parseColor(v, f, '#000000', docColors, theme);
      } else if (lineThemeOk && qsLineColC && qsLineColC.val !== null && (!qsLineMatC || (parseInt(qsLineMatC.val || '0', 10) !== 0 && parseInt(qsLineMatC.val || '0', 10) !== 100))) {
        stroke = VisioConverter._resolveQuickStyleColor(qsLineColC.val, qsLineMatC && qsLineMatC.val, 'line', theme, docColors) || '#000000';
      } else {
        stroke = '#000000';
      }
    }

    const lineTransC = g('LineColorTrans', 'lineStyle');
    const lineTransVal = lineTransC && lineTransC.val !== null ? parseFloat(lineTransC.val) : NaN;
    const strokeOpacity = !isNaN(lineTransVal) ? Math.max(0, Math.min(1, 1 - lineTransVal)) : 1;

    const lwC = g('LineWeight', 'lineStyle');
    const lwIn = lwC && lwC.val !== null && !isNaN(parseFloat(lwC.val)) ? parseFloat(lwC.val) : (1 / 72);
    const strokeWidth = Math.max(0.75, lwIn * DPI);

    const rndC = g('Rounding', 'lineStyle');
    const roundingPx = rndC && rndC.val !== null && !isNaN(parseFloat(rndC.val)) ? Math.max(0, parseFloat(rndC.val) * DPI) : 0;

    const beginArrowC = g('BeginArrow', 'lineStyle');
    const endArrowC = g('EndArrow', 'lineStyle');
    const beginArrow = beginArrowC && beginArrowC.val !== null ? parseInt(beginArrowC.val, 10) || 0 : 0;
    const endArrow = endArrowC && endArrowC.val !== null ? parseInt(endArrowC.val, 10) || 0 : 0;

    // Gradient support if FillPattern >= 25
    let gradient = null;
    if (fillPattern >= 25) {
      const mergedSecs = VisioConverter._mergeSections(masterShape && masterShape.sections, instShape && instShape.sections);
      const fgSec = mergedSecs.FillGradient;
      if (fgSec && fgSec.rows && fgSec.rows.length >= 2) {
        const stops = fgSec.rows.map(r => ({
          offset: Math.max(0, Math.min(1, parseFloat((r.cells.Position && r.cells.Position.val) || '0'))),
          color: VisioConverter._parseColor(r.cells.Color && r.cells.Color.val, r.cells.Color && r.cells.Color.formula, fill, docColors, theme)
        })).sort((a, b) => a.offset - b.offset);
        gradient = stops;
      }
    }

    return {
      fill,
      fillPattern,
      fillOpacity,
      stroke,
      linePattern,
      strokeDashArray: VisioConverter._linePatternToDash(linePattern),
      strokeOpacity,
      strokeWidth,
      roundingPx,
      beginArrow,
      endArrow,
      gradient
    };
  }

  /**
   * Backward-compatible static helper used by scripts/generate_master_svgs & tests.
   */
  static _parseMasterShapeXml(shapeInput, parentW, parentH, isRoot = false, overrideFill = null, overrideStroke = null, theme = null, ctx = null) {
    const sNode = typeof shapeInput === 'string'
      ? VisioConverter._parsePageShapeNode(VisioConverter._firstChild(VisioConverter._parseXml(shapeInput), 'Shape') || VisioConverter._parseXml(shapeInput))
      : shapeInput;
    if (!sNode || sNode.del) return '';

    let activeCtx = ctx || { styleSheets: {}, docDefaults: {}, docColors: {}, theme: theme || VisioConverter._parseThemeXml('') };
    let masterRef = sNode._masterShapeNode || null;
    if (sNode.masterId && activeCtx.masters && activeCtx.masters[sNode.masterId]) {
      const ownMaster = activeCtx.masters[sNode.masterId];
      if (!masterRef) masterRef = ownMaster.rootShape || null;
      activeCtx = {
        ...activeCtx,
        shapeRels: { ...(activeCtx.shapeRels || {}), ...(ownMaster.rels || {}) },
        masterById: ownMaster.byId || activeCtx.masterById
      };
    }
    const g = (n, ch) => VisioConverter._getEffectiveCell(sNode, masterRef, activeCtx, n, ch);

    const wIn = parseFloat((g('Width', 'fillStyle') || {}).val);
    const hIn = parseFloat((g('Height', 'fillStyle') || {}).val);
    const wPx = (!isNaN(wIn) && wIn > 0) ? wIn * DPI : (parentW || 50);
    const hPx = (!isNaN(hIn) && hIn > 0) ? hIn * DPI : (parentH || 50);

    const locPinXIn = parseFloat((g('LocPinX', 'fillStyle') || {}).val);
    const locPinYIn = parseFloat((g('LocPinY', 'fillStyle') || {}).val);
    const lpx = !isNaN(locPinXIn) ? locPinXIn * DPI : wPx / 2;
    const lpy = !isNaN(locPinYIn) ? (hPx - locPinYIn * DPI) : hPx / 2;

    const pinXIn = parseFloat((g('PinX', 'fillStyle') || {}).val);
    const pinYIn = parseFloat((g('PinY', 'fillStyle') || {}).val);
    const px = !isNaN(pinXIn) ? pinXIn * DPI : (parentW || wPx) / 2;
    const py = !isNaN(pinYIn) ? ((parentH || hPx) - pinYIn * DPI) : (parentH || hPx) / 2;

    const angleRad = parseFloat((g('Angle', 'fillStyle') || {}).val) || 0;
    const flipX = ((g('FlipX', 'fillStyle') || {}).val === '1');
    const flipY = ((g('FlipY', 'fillStyle') || {}).val === '1');

    const foreignNode = sNode.foreignNode || (masterRef && masterRef.foreignNode) || null;
    const isForeign = sNode.type === 'Foreign' || (masterRef && masterRef.type === 'Foreign') || !!foreignNode;
    const style = VisioConverter._resolveShapeColorsAndStroke(sNode, masterRef, activeCtx, isForeign);
    if (overrideFill && overrideFill !== 'none' && overrideFill !== 'transparent') style.fill = overrideFill;
    if (overrideStroke && overrideStroke !== 'none') style.stroke = overrideStroke;

    let svgParts = [];

    // 1. ForeignData image (raster or converted EMF PNG in ctx.mediaMap)
    if (foreignNode) {
      const rel = VisioConverter._firstChild(foreignNode, 'Rel');
      const rId = rel && rel.attrs['r:id'];
      const relTarget = rId && activeCtx.shapeRels ? activeCtx.shapeRels[rId] : null;
      const mediaUrl = activeCtx.mediaMap && ((relTarget && activeCtx.mediaMap[relTarget]) || (rId && activeCtx.mediaMap[rId]));
      const imgXIn = parseFloat((g('ImgOffsetX', 'fillStyle') || {}).val) || 0;
      const imgYIn = parseFloat((g('ImgOffsetY', 'fillStyle') || {}).val) || 0;
      const imgWIn = parseFloat((g('ImgWidth', 'fillStyle') || {}).val);
      const imgHIn = parseFloat((g('ImgHeight', 'fillStyle') || {}).val);
      const iw = !isNaN(imgWIn) ? imgWIn * DPI : wPx;
      const ih = !isNaN(imgHIn) ? imgHIn * DPI : hPx;
      const ix = imgXIn * DPI;
      const iy = hPx - (imgYIn * DPI) - ih;
      if (mediaUrl) {
        svgParts.push(`<image href="${mediaUrl}" x="${ix.toFixed(2)}" y="${iy.toFixed(2)}" width="${iw.toFixed(2)}" height="${ih.toFixed(2)}" preserveAspectRatio="none"/>`);
      } else {
        // Headless/placeholder foreign shape box
        svgParts.push(`<rect x="${ix.toFixed(2)}" y="${iy.toFixed(2)}" width="${iw.toFixed(2)}" height="${ih.toFixed(2)}" fill="none" stroke="#999999" stroke-width="0.5"/>`);
      }
    }

    // 2. Geometry sections
    const mergedSections = VisioConverter._mergeSections(masterRef && masterRef.sections, sNode.sections);
    const geomKeys = Object.keys(mergedSections).filter(k => k.startsWith('Geometry')).sort((a, b) => {
      return parseInt(a.split(':')[1] || '0', 10) - parseInt(b.split(':')[1] || '0', 10);
    });

    for (let gkIdx = 0; gkIdx < geomKeys.length; gkIdx++) {
      const sec = mergedSections[geomKeys[gkIdx]];
      const compiled = VisioConverter._parseGeometrySection(sec, wPx, hPx, style.roundingPx);
      if (!compiled.d || compiled.noShow) continue;
      let fCol = compiled.noFill ? 'none' : style.fill;
      const fOp = (fCol === 'none' || fCol === 'transparent') ? 0 : style.fillOpacity;
      if (style.gradient && !compiled.noFill && !isForeign) {
        const gradId = `g_${sNode.id || 's'}_${gkIdx}_${Math.random().toString(36).slice(2, 6)}`;
        const stopsXml = style.gradient.map(st => `<stop offset="${(st.offset * 100).toFixed(1)}%" stop-color="${st.color}" stop-opacity="${fOp}"/>`).join('');
        svgParts.push(`<defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">${stopsXml}</linearGradient></defs>`);
        fCol = `url(#${gradId})`;
      }
      const sCol = compiled.noLine ? 'none' : style.stroke;
      const dashAttr = style.strokeDashArray ? ` stroke-dasharray="${style.strokeDashArray.join(',')}"` : '';
      svgParts.push(
        `<path d="${compiled.d}" fill="${fCol}" fill-opacity="${fCol.startsWith('url(') ? 1 : fOp}" stroke="${sCol}" stroke-opacity="${style.strokeOpacity}" stroke-width="${style.strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>`
      );
    }

    // 3. Children (if master had un-overridden child shapes, merge them too)
    const childList = VisioConverter._resolveEffectiveChildren(sNode, masterRef, wPx, hPx, activeCtx);

    for (const ch of childList) {
      svgParts.push(VisioConverter._parseMasterShapeXml(ch, wPx, hPx, false, overrideFill, overrideStroke, theme, activeCtx));
    }

    const inner = svgParts.join('');
    if (!inner) return '';

    if (isRoot) {
      const fT = [];
      if (flipX || flipY) {
        fT.push(`translate(${(wPx / 2).toFixed(2)},${(hPx / 2).toFixed(2)}) scale(${flipX ? -1 : 1},${flipY ? -1 : 1}) translate(${(-wPx / 2).toFixed(2)},${(-hPx / 2).toFixed(2)})`);
      }
      return fT.length > 0 ? `<g transform="${fT.join(' ')}">${inner}</g>` : inner;
    }

    const rotDeg = (-angleRad * 180) / Math.PI;
    const tOps = [`translate(${px.toFixed(2)}, ${py.toFixed(2)})`];
    if (Math.abs(rotDeg) > 0.05) tOps.push(`rotate(${rotDeg.toFixed(2)})`);
    if (flipX || flipY) tOps.push(`scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`);
    tOps.push(`translate(${(-lpx).toFixed(2)}, ${(-lpy).toFixed(2)})`);
    return `<g transform="${tOps.join(' ')}">${inner}</g>`;
  }

  static _resolveEffectiveChildren(sNode, masterRef, wPx, hPx, activeCtx) {
    let childList = (sNode && sNode.children) ? sNode.children : [];
    if (masterRef && masterRef.children && masterRef.children.length > 0) {
      const masterScaleX = masterRef.cells.Width && parseFloat(masterRef.cells.Width.val) > 0
        ? (wPx / (parseFloat(masterRef.cells.Width.val) * DPI)) : 1;
      const masterScaleY = masterRef.cells.Height && parseFloat(masterRef.cells.Height.val) > 0
        ? (hPx / (parseFloat(masterRef.cells.Height.val) * DPI)) : 1;

      if (childList.length === 0) {
        childList = masterRef.children.map(mc => {
          const cloned = { ...mc, cells: { ...mc.cells } };
          if (masterScaleX !== 1) {
            if (cloned.cells.PinX && cloned.cells.PinX.val !== null) cloned.cells.PinX = { ...cloned.cells.PinX, val: String(parseFloat(cloned.cells.PinX.val) * masterScaleX) };
            if (cloned.cells.Width && cloned.cells.Width.val !== null) cloned.cells.Width = { ...cloned.cells.Width, val: String(parseFloat(cloned.cells.Width.val) * masterScaleX) };
            if (cloned.cells.LocPinX && cloned.cells.LocPinX.val !== null) cloned.cells.LocPinX = { ...cloned.cells.LocPinX, val: String(parseFloat(cloned.cells.LocPinX.val) * masterScaleX) };
          }
          if (masterScaleY !== 1) {
            if (cloned.cells.PinY && cloned.cells.PinY.val !== null) cloned.cells.PinY = { ...cloned.cells.PinY, val: String(parseFloat(cloned.cells.PinY.val) * masterScaleY) };
            if (cloned.cells.Height && cloned.cells.Height.val !== null) cloned.cells.Height = { ...cloned.cells.Height, val: String(parseFloat(cloned.cells.Height.val) * masterScaleY) };
            if (cloned.cells.LocPinY && cloned.cells.LocPinY.val !== null) cloned.cells.LocPinY = { ...cloned.cells.LocPinY, val: String(parseFloat(cloned.cells.LocPinY.val) * masterScaleY) };
          }
          return cloned;
        });
      } else {
        for (const ch of childList) {
          if (ch.masterShape && activeCtx && activeCtx.masterById) {
            ch._masterShapeNode = activeCtx.masterById.get(String(ch.masterShape)) || null;
          }
        }
      }
    }
    return childList;
  }

  static _computeTextLocalOffset(ti, textH) {
    let dyLocal = (ti.margins.top - ti.margins.bottom) / 2;
    if (ti.verticalAlign === 0) {
      dyLocal = -ti.txtHPx / 2 + ti.margins.top + textH / 2;
    } else if (ti.verticalAlign === 2) {
      dyLocal = ti.txtHPx / 2 - ti.margins.bottom - textH / 2;
    }
    const dxLocal = (ti.margins.left - ti.margins.right) / 2;
    const txtRad = ((ti.txtAngleDeg || 0) * Math.PI) / 180;
    return {
      offX: dxLocal * Math.cos(txtRad) - dyLocal * Math.sin(txtRad),
      offY: dxLocal * Math.sin(txtRad) + dyLocal * Math.cos(txtRad),
    };
  }

  static _collectChildTexts(sNode, masterRoot, rootW, rootH, ctx) {
    const out = [];
    const mulMat = (m1, m2) => [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];

    const walk = (node, mRef, pW, pH, curCtx, curMat, isRoot) => {
      if (!node || node.del) return;
      let nextCtx = curCtx;
      let effMaster = mRef;
      if (node.masterId && curCtx.masters && curCtx.masters[node.masterId]) {
        const ownM = curCtx.masters[node.masterId];
        if (!effMaster) effMaster = ownM.rootShape || null;
        nextCtx = {
          ...curCtx,
          shapeRels: { ...(curCtx.shapeRels || {}), ...(ownM.rels || {}) },
          masterById: ownM.byId || curCtx.masterById,
        };
      }
      const g = (n, ch) => VisioConverter._getEffectiveCell(node, effMaster, nextCtx, n, ch);
      const wIn = parseFloat((g('Width', 'fillStyle') || {}).val);
      const hIn = parseFloat((g('Height', 'fillStyle') || {}).val);
      const wPx = isRoot ? pW : ((!isNaN(wIn) && wIn > 0) ? wIn * DPI : (pW || 50));
      const hPx = isRoot ? pH : ((!isNaN(hIn) && hIn > 0) ? hIn * DPI : (pH || 50));

      let nextMat = curMat;
      if (!isRoot) {
        const locPinXIn = parseFloat((g('LocPinX', 'fillStyle') || {}).val);
        const locPinYIn = parseFloat((g('LocPinY', 'fillStyle') || {}).val);
        const lpx = !isNaN(locPinXIn) ? locPinXIn * DPI : wPx / 2;
        const lpy = !isNaN(locPinYIn) ? (hPx - locPinYIn * DPI) : hPx / 2;
        const pinXIn = parseFloat((g('PinX', 'fillStyle') || {}).val);
        const pinYIn = parseFloat((g('PinY', 'fillStyle') || {}).val);
        const px = !isNaN(pinXIn) ? pinXIn * DPI : (pW || wPx) / 2;
        const py = !isNaN(pinYIn) ? ((pH || hPx) - pinYIn * DPI) : (pH || hPx) / 2;
        const angleRad = parseFloat((g('Angle', 'fillStyle') || {}).val) || 0;
        const flipX = ((g('FlipX', 'fillStyle') || {}).val === '1') ? -1 : 1;
        const flipY = ((g('FlipY', 'fillStyle') || {}).val === '1') ? -1 : 1;
        const cosA = Math.cos(-angleRad), sinA = Math.sin(-angleRad);
        const tPin = [1, 0, 0, 1, px, py];
        const tRotScale = [cosA * flipX, sinA * flipX, -sinA * flipY, cosA * flipY, 0, 0];
        const tLoc = [1, 0, 0, 1, -lpx, -lpy];
        nextMat = mulMat(curMat, mulMat(tPin, mulMat(tRotScale, tLoc)));

        const hideCell = g('HideText', 'textStyle');
        const hiddenText = hideCell && hideCell.val === '1';
        // Only collect explicit instance child text (avoid master template placeholders like "Heading")
        if (!hiddenText && node.textNode) {
          const ti = VisioConverter._extractRichText(node, effMaster, nextCtx, wPx, hPx);
          if (ti && ti.text) {
            out.push({
              textInfo: ti,
              matrix: nextMat,
              rootW,
              rootH,
            });
          }
        }
      }

      const children = VisioConverter._resolveEffectiveChildren(node, effMaster, wPx, hPx, nextCtx);
      for (const ch of children) {
        walk(ch, ch._masterShapeNode || null, wPx, hPx, nextCtx, nextMat, false);
      }
    };

    const gRoot = (n, ch) => VisioConverter._getEffectiveCell(sNode, masterRoot, ctx, n, ch);
    const rootFlipX = ((gRoot('FlipX', 'fillStyle') || {}).val === '1') ? -1 : 1;
    const rootFlipY = ((gRoot('FlipY', 'fillStyle') || {}).val === '1') ? -1 : 1;
    const rootMat = (rootFlipX !== 1 || rootFlipY !== 1)
      ? mulMat([1, 0, 0, 1, rootW / 2, rootH / 2], mulMat([rootFlipX, 0, 0, rootFlipY, 0, 0], [1, 0, 0, 1, -rootW / 2, -rootH / 2]))
      : [1, 0, 0, 1, 0, 0];
    walk(sNode, masterRoot, rootW, rootH, ctx, rootMat, true);
    return out;
  }

  static async _createSvgImage(svgXml, left, top, width, height, isCenter = true) {
    if (typeof fabric === 'undefined' || !fabric.Image || typeof btoa === 'undefined') return null;

    // Fast high-res path for pure single-<image> Visio Foreign bitmaps/EMFs (avoids 1x SVG downsampling)
    const pureImgMatch = svgXml && svgXml.match(/^\s*<svg[^>]*>\s*<image\b([^>]*)\/>\s*<\/svg>\s*$/i);
    if (pureImgMatch) {
      const attrs = pureImgMatch[1];
      const hrefM = attrs.match(/\bhref="([^"]+)"/i);
      const xM = attrs.match(/\bx="([^"]+)"/i);
      const yM = attrs.match(/\by="([^"]+)"/i);
      const wM = attrs.match(/\bwidth="([^"]+)"/i);
      const hM = attrs.match(/\bheight="([^"]+)"/i);
      const ix = xM ? parseFloat(xM[1]) : 0;
      const iy = yM ? parseFloat(yM[1]) : 0;
      const iw = wM ? parseFloat(wM[1]) : width;
      const ih = hM ? parseFloat(hM[1]) : height;
      if (hrefM && Math.abs(ix) < 2 && Math.abs(iy) < 2 && Math.abs(iw - width) < 2 && Math.abs(ih - height) < 2) {
        try {
          const rawImg = await fabric.Image.fromURL(hrefM[1]);
          if (rawImg) {
            rawImg.set({
              left,
              top,
              originX: isCenter ? 'center' : 'left',
              originY: isCenter ? 'center' : 'top',
              scaleX: width / Math.max(1, rawImg.width || width),
              scaleY: height / Math.max(1, rawImg.height || height),
              imageSmoothing: true,
              objectCaching: false
            });
            return rawImg;
          }
        } catch (_) {}
      }
    }

    // Upsample SVG rasterization 3x so vector + embedded raster Visio shapes stay sharp under zoom
    const rasterScale = (width <= 600 && height <= 600) ? 3 : 2;
    let hiResSvg = svgXml;
    if (/<svg\b/i.test(svgXml)) {
      const targetW = Math.max(1, width * rasterScale).toFixed(2);
      const targetH = Math.max(1, height * rasterScale).toFixed(2);
      hiResSvg = svgXml.replace(/<svg\b([^>]*)>/i, (all, attrStr) => {
        let next = attrStr;
        if (!/\bviewBox=/i.test(next)) next += ` viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}"`;
        next = /\bwidth="/i.test(next) ? next.replace(/\bwidth="[^"]*"/i, `width="${targetW}"`) : `${next} width="${targetW}"`;
        next = /\bheight="/i.test(next) ? next.replace(/\bheight="[^"]*"/i, `height="${targetH}"`) : `${next} height="${targetH}"`;
        return `<svg${next}>`;
      });
    }

    const b64 = btoa(unescape(encodeURIComponent(hiResSvg)));
    const dataUrl = `data:image/svg+xml;base64,${b64}`;
    try {
      const img = await fabric.Image.fromURL(dataUrl);
      if (!img) return null;
      const sx = width / Math.max(1, img.width || width);
      const sy = height / Math.max(1, img.height || height);
      img.set({
        left,
        top,
        originX: isCenter ? 'center' : 'left',
        originY: isCenter ? 'center' : 'top',
        scaleX: sx,
        scaleY: sy,
        imageSmoothing: true,
        objectCaching: false
      });
      return img;
    } catch (_) {
      return null;
    }
  }

  // ─── Rich Text & Shape Data Parsing ──────────────────────────────────────────

  static _extractShapeDataProperties(instShape, masterShape) {
    const props = {};
    const merged = VisioConverter._mergeSections(masterShape && masterShape.sections, instShape && instShape.sections);
    const propSec = merged.Property;
    if (propSec && propSec.rows) {
      for (const r of propSec.rows) {
        if (r.del) continue;
        const label = (r.cells.Label && r.cells.Label.val) || r.name || `Prop_${r.ix}`;
        const val = r.cells.Value && r.cells.Value.val;
        if (label && val !== null && val !== undefined) props[label] = val;
      }
    }
    return props;
  }

  static _extractRichText(instShape, masterShape, ctx, wPx, hPx) {
    let textNode = instShape && instShape.textNode;
    if (!textNode && masterShape && masterShape.textNode) textNode = masterShape.textNode;
    // Also check child shapes' text only if top shape has no text? Visio puts text on group OR child.
    if (!textNode) return null;

    const mergedSecs = VisioConverter._mergeSections(masterShape && masterShape.sections, instShape && instShape.sections);
    const charRows = {};
    if (mergedSecs.Character && mergedSecs.Character.rows) {
      for (const r of mergedSecs.Character.rows) {
        charRows[r.ix || '0'] = r.cells;
      }
    }
    const paraRows = {};
    if (mergedSecs.Paragraph && mergedSecs.Paragraph.rows) {
      for (const r of mergedSecs.Paragraph.rows) {
        paraRows[r.ix || '0'] = r.cells;
      }
    }
    const fieldRows = {};
    if (mergedSecs.Field && mergedSecs.Field.rows) {
      for (const r of mergedSecs.Field.rows) {
        fieldRows[r.ix || '0'] = r.cells;
      }
    }

    const g = (n, ch) => VisioConverter._getEffectiveCell(instShape, masterShape, ctx, n, ch);

    const resolveCharStyle = (ix) => {
      const c = charRows[ix] || charRows['0'] || {};
      const font = (c.Font && c.Font.val && c.Font.val !== 'Themed') ? c.Font.val : 'Calibri';
      const sizeIn = c.Size && c.Size.val !== null && !isNaN(parseFloat(c.Size.val)) ? parseFloat(c.Size.val) : (12 / 96);
      const fontSize = Math.max(6, Math.round(sizeIn * DPI * 10) / 10);
      const styleBits = parseInt((c.Style && c.Style.val) || '0', 10) || 0;
      const fontThemeOk = VisioConverter._isThemeEnabled(instShape, masterShape, ctx, 'textStyle');
      const colCell = c.Color;
      let fill = '#000000';
      if (colCell && colCell.val && colCell.val !== 'Themed' && colCell.val !== 'Inh') {
        fill = VisioConverter._parseColor(colCell.val, colCell.formula, '#000000', ctx.docColors, ctx.theme);
      } else if (fontThemeOk) {
        const qfc = g('QuickStyleFontColor', 'textStyle');
        const qfm = g('QuickStyleFontMatrix', 'textStyle');
        if (qfc && qfc.val !== null && qfm && parseInt(qfm.val || '0', 10) !== 0) {
          fill = VisioConverter._resolveQuickStyleColor(qfc.val, qfm.val, 'font', ctx.theme, ctx.docColors) || '#000000';
        }
      }
      return {
        fontFamily: font,
        fontSize,
        fontWeight: (styleBits & 1) ? 'bold' : 'normal',
        fontStyle: (styleBits & 2) ? 'italic' : 'normal',
        underline: Boolean(styleBits & 4),
        linethrough: (c.Strikethru && c.Strikethru.val === '1') || false,
        fill
      };
    };

    let fullText = '';
    const runs = [];
    let curCharIx = '0';
    let curParaIx = '0';

    for (const child of (textNode.children || [])) {
      if (child.tag === '#text') {
        const s = (child.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (s) {
          runs.push({ start: fullText.length, end: fullText.length + s.length, charIx: curCharIx, paraIx: curParaIx });
          fullText += s;
        }
      } else if (child.localName === 'cp') {
        curCharIx = child.attrs.IX || '0';
      } else if (child.localName === 'pp') {
        curParaIx = child.attrs.IX || '0';
      } else if (child.localName === 'fld') {
        const fIx = child.attrs.IX || '0';
        const fText = VisioConverter._allText(child) || (fieldRows[fIx] && fieldRows[fIx].Value && fieldRows[fIx].Value.val) || '';
        const clean = String(fText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (clean) {
          runs.push({ start: fullText.length, end: fullText.length + clean.length, charIx: curCharIx, paraIx: curParaIx });
          fullText += clean;
        }
      }
    }

    const trimmed = fullText.replace(/\s+$/, '');
    if (!trimmed) return null;

    const baseChar = resolveCharStyle(runs[0] ? runs[0].charIx : '0');
    const firstPara = paraRows[runs[0] ? runs[0].paraIx : '0'] || paraRows['0'] || {};
    const hAlignNum = parseInt((firstPara.HorzAlign && firstPara.HorzAlign.val) || '1', 10);
    const textAlign = hAlignNum === 0 ? 'left' : hAlignNum === 2 ? 'right' : hAlignNum === 3 ? 'justify' : 'center';

    const vAlignCell = g('VerticalAlign', 'textStyle');
    const verticalAlign = parseInt((vAlignCell && vAlignCell.val) || '1', 10);

    // Build Fabric character styles map only when runs differ
    const fabricStyles = {};
    if (runs.length > 1) {
      let lineIdx = 0;
      let charInLine = 0;
      let runIdx = 0;
      for (let i = 0; i < trimmed.length; i++) {
        while (runIdx < runs.length && i >= runs[runIdx].end) runIdx++;
        if (trimmed[i] === '\n') {
          lineIdx++;
          charInLine = 0;
          continue;
        }
        const rs = resolveCharStyle(runs[runIdx] ? runs[runIdx].charIx : '0');
        if (rs.fontWeight !== baseChar.fontWeight || rs.fontSize !== baseChar.fontSize || rs.fill !== baseChar.fill || rs.fontStyle !== baseChar.fontStyle) {
          if (!fabricStyles[lineIdx]) fabricStyles[lineIdx] = {};
          fabricStyles[lineIdx][charInLine] = rs;
        }
        charInLine++;
      }
    }

    // Text box placement inside shape
    const txtPinX = parseFloat((g('TxtPinX', 'textStyle') || {}).val);
    const txtPinY = parseFloat((g('TxtPinY', 'textStyle') || {}).val);
    const txtW = parseFloat((g('TxtWidth', 'textStyle') || {}).val);
    const txtH = parseFloat((g('TxtHeight', 'textStyle') || {}).val);
    const txtAng = parseFloat((g('TxtAngle', 'textStyle') || {}).val) || 0;
    const parseMargin = (name) => {
      const v = parseFloat((g(name, 'textStyle') || {}).val);
      return !isNaN(v) ? v * DPI : 0.055 * DPI;
    };
    const leftM = parseMargin('LeftMargin');
    const rightM = parseMargin('RightMargin');
    const topM = parseMargin('TopMargin');
    const botM = parseMargin('BottomMargin');

    return {
      text: trimmed,
      baseChar,
      textAlign,
      verticalAlign,
      styles: fabricStyles,
      txtPinXPx: !isNaN(txtPinX) ? txtPinX * DPI : wPx / 2,
      txtPinYPx: !isNaN(txtPinY) ? (hPx - txtPinY * DPI) : hPx / 2,
      txtWPx: !isNaN(txtW) && txtW > 0 ? txtW * DPI : wPx,
      txtHPx: !isNaN(txtH) && txtH > 0 ? txtH * DPI : hPx,
      txtAngleDeg: (-txtAng * 180) / Math.PI,
      margins: { left: leftM, right: rightM, top: topM, bottom: botM }
    };
  }

  // ─── .VSDX Importer ──────────────────────────────────────────────────────────

  static async _convertMediaToDataUrls(zip) {
    const mediaMap = {};
    const mediaFiles = Object.keys(zip.files).filter(n => n.startsWith('visio/media/') && !zip.files[n].dir);
    if (mediaFiles.length === 0) return mediaMap;

    const emfBatch = [];
    const rasterExtMime = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml'
    };

    for (const fullPath of mediaFiles) {
      const ext = fullPath.split('.').pop().toLowerCase();
      const shortName = fullPath.split('/').pop();
      const b64 = await zip.file(fullPath).async('base64');
      if (ext === 'emf' || ext === 'wmf' || ext === 'bmp') {
        emfBatch.push({ name: fullPath, shortName, base64: b64 });
      } else {
        const mime = rasterExtMime[ext] || 'image/png';
        const dataUrl = `data:${mime};base64,${b64}`;
        mediaMap[fullPath] = dataUrl;
        mediaMap[shortName] = dataUrl;
      }
    }

    if (emfBatch.length > 0) {
      if (typeof window !== 'undefined' && window.openDraw && window.openDraw.convertEmfBatch) {
        const converted = await window.openDraw.convertEmfBatch(emfBatch);
        for (const item of converted) {
          mediaMap[item.name] = item.dataUrl;
          mediaMap[item.name.split('/').pop()] = item.dataUrl;
        }
      } else {
        for (const item of emfBatch) {
          if (item.name.toLowerCase().endsWith('.bmp')) {
            const dataUrl = `data:image/bmp;base64,${item.base64}`;
            mediaMap[item.name] = dataUrl;
            mediaMap[item.shortName] = dataUrl;
          }
        }
      }
    }
    return mediaMap;
  }

  static _parseRelsXml(relsStr) {
    const map = {};
    if (!relsStr) return map;
    const root = VisioConverter._parseXml(relsStr);
    for (const r of VisioConverter._childElements(root, 'Relationship')) {
      if (r.attrs.Id && r.attrs.Target) {
        map[r.attrs.Id] = r.attrs.Target.replace(/^(\.\.\/)+/, '').replace(/^visio\//, '');
        if (!map[r.attrs.Id].startsWith('visio/')) {
          const clean = r.attrs.Target.split('/').pop();
          map[r.attrs.Id + ':short'] = clean;
          if (r.attrs.Target.includes('media/')) map[r.attrs.Id] = 'visio/media/' + clean;
        }
      }
    }
    return map;
  }

  static async importVsdx(fileBuffer, canvasManager) {
    if (typeof JSZip === 'undefined' && typeof require !== 'undefined') {
      global.JSZip = require('jszip');
    }
    const zip = await JSZip.loadAsync(fileBuffer);

    // 1. Parse document.xml: Settings, Colors, StyleSheets
    const docStr = zip.file('visio/document.xml') ? await zip.file('visio/document.xml').async('string') : '';
    const docNode = VisioConverter._parseXml(docStr);

    const docDefaults = { fillStyle: '3', lineStyle: '3', textStyle: '3' };
    const ds = VisioConverter._firstChild(docNode, 'DocumentSettings');
    if (ds) {
      if (ds.attrs.DefaultFillStyle) docDefaults.fillStyle = ds.attrs.DefaultFillStyle;
      if (ds.attrs.DefaultLineStyle) docDefaults.lineStyle = ds.attrs.DefaultLineStyle;
      if (ds.attrs.DefaultTextStyle) docDefaults.textStyle = ds.attrs.DefaultTextStyle;
    }
    const docSheet = VisioConverter._firstChild(docNode, 'DocumentSheet');
    const docSheetCells = docSheet ? VisioConverter._cellsToMap(docSheet) : {};
    const docThemeIndex = (docSheetCells.ThemeIndex && docSheetCells.ThemeIndex.val !== null && docSheetCells.ThemeIndex.val !== 'Inh')
      ? parseInt(docSheetCells.ThemeIndex.val, 10) : NaN;

    const docColors = {};
    const colorsEl = VisioConverter._firstChild(docNode, 'Colors');
    if (colorsEl) {
      for (const ce of VisioConverter._childElements(colorsEl, 'ColorEntry')) {
        const ix = parseInt(ce.attrs.IX, 10);
        if (!isNaN(ix) && ce.attrs.RGB) docColors[ix] = ce.attrs.RGB.toUpperCase();
      }
    }

    const styleSheets = VisioConverter._parseStyleSheets(docNode);

    // 2. Parse Theme
    let theme = VisioConverter._parseThemeXml('');
    if (zip.file('visio/theme/theme1.xml')) {
      theme = VisioConverter._parseThemeXml(await zip.file('visio/theme/theme1.xml').async('string'));
    }

    // 3. Convert media (images + EMFs)
    const mediaMap = await VisioConverter._convertMediaToDataUrls(zip);

    // 4. Parse Masters
    const masters = {}; // id -> { id, nameU, rootShape, byId, rels }
    if (zip.file('visio/masters/masters.xml')) {
      const mStr = await zip.file('visio/masters/masters.xml').async('string');
      const mRelsStr = zip.file('visio/masters/_rels/masters.xml.rels') ? await zip.file('visio/masters/_rels/masters.xml.rels').async('string') : '';
      const mRels = VisioConverter._parseRelsXml(mRelsStr);
      const mRoot = VisioConverter._parseXml(mStr);
      for (const mEl of VisioConverter._childElements(mRoot, 'Master')) {
        const relEl = VisioConverter._firstChild(mEl, 'Rel');
        const rId = relEl && relEl.attrs['r:id'];
        const target = rId && mRels[rId] ? (mRels[rId].startsWith('visio/') ? mRels[rId] : `visio/masters/${mRels[rId]}`) : null;
        if (!target || !zip.file(target)) continue;
        const masterXml = await zip.file(target).async('string');
        const masterFileName = target.split('/').pop();
        const mrPath = `visio/masters/_rels/${masterFileName}.rels`;
        const masterRels = zip.file(mrPath) ? VisioConverter._parseRelsXml(await zip.file(mrPath).async('string')) : {};
        const indexed = VisioConverter._indexMasterShapes(masterXml);
        masters[mEl.attrs.ID] = {
          id: mEl.attrs.ID,
          nameU: mEl.attrs.NameU || mEl.attrs.Name || 'Master',
          xml: masterXml,
          rels: masterRels,
          ...indexed
        };
      }
    }

    // 5. Parse Pages list
    const pagesStr = zip.file('visio/pages/pages.xml') ? await zip.file('visio/pages/pages.xml').async('string') : '';
    const pagesRelsStr = zip.file('visio/pages/_rels/pages.xml.rels') ? await zip.file('visio/pages/_rels/pages.xml.rels').async('string') : '';
    const pagesRels = VisioConverter._parseRelsXml(pagesRelsStr);
    const pagesNode = VisioConverter._parseXml(pagesStr);
    const pageEls = VisioConverter._childElements(pagesNode, 'Page');

    const importedPages = [];

    for (let pIdx = 0; pIdx < pageEls.length; pIdx++) {
      const pEl = pageEls[pIdx];
      const pageId = pEl.attrs.ID || String(pIdx + 1);
      const pageName = pEl.attrs.Name || pEl.attrs.NameU || `Page-${pIdx + 1}`;
      const isBackground = pEl.attrs.Background === '1';
      if (isBackground) continue; // skip pure background-only pages from foreground tab list

      const relEl = VisioConverter._firstChild(pEl, 'Rel');
      const rId = relEl && relEl.attrs['r:id'];
      let pagePath = rId && pagesRels[rId] ? pagesRels[rId] : `page${pIdx + 1}.xml`;
      if (!pagePath.startsWith('visio/')) pagePath = `visio/pages/${pagePath}`;
      if (!zip.file(pagePath)) continue;

      const pageSheet = VisioConverter._firstChild(pEl, 'PageSheet');
      const psCells = VisioConverter._cellsToMap(pageSheet);
      const pageWIn = parseFloat(psCells.PageWidth && psCells.PageWidth.val) || 11.69;
      const pageHIn = parseFloat(psCells.PageHeight && psCells.PageHeight.val) || 8.27;
      const pixelWidth = Math.round(pageWIn * DPI);
      const pixelHeight = Math.round(pageHIn * DPI);
      const pageStyleId = pageSheet && (pageSheet.attrs.LineStyle || pageSheet.attrs.FillStyle);
      const pageStyleTi = pageStyleId ? VisioConverter._lookupStyleCell(styleSheets, pageStyleId, 'ThemeIndex', 'lineStyle') : null;
      const rawPageTi = (psCells.ThemeIndex && psCells.ThemeIndex.val !== null && psCells.ThemeIndex.val !== 'Inh')
        ? psCells.ThemeIndex.val
        : (pageStyleTi ? pageStyleTi.val : null);
      const parsedPageTi = rawPageTi !== null && rawPageTi !== undefined ? parseInt(rawPageTi, 10) : NaN;
      const pageThemeIndex = !isNaN(parsedPageTi) ? parsedPageTi : docThemeIndex;

      const prFileName = pagePath.split('/').pop();
      const prPath = `visio/pages/_rels/${prFileName}.rels`;
      const pageRels = zip.file(prPath) ? VisioConverter._parseRelsXml(await zip.file(prPath).async('string')) : {};

      const pageXml = await zip.file(pagePath).async('string');
      const pageRoot = VisioConverter._parseXml(pageXml);
      const shapesNode = VisioConverter._firstChild(pageRoot, 'Shapes');
      const topShapes = shapesNode ? VisioConverter._childElements(shapesNode, 'Shape').map(VisioConverter._parsePageShapeNode) : [];

      const connectsNode = VisioConverter._firstChild(pageRoot, 'Connects');
      const connectMap = {}; // fromSheet -> { begin: { toSheet, toPart }, end: { toSheet, toPart } }
      if (connectsNode) {
        for (const cEl of VisioConverter._childElements(connectsNode, 'Connect')) {
          const fsId = cEl.attrs.FromSheet;
          const fc = cEl.attrs.FromCell;
          const tsId = cEl.attrs.ToSheet;
          if (!fsId || !tsId) continue;
          if (!connectMap[fsId]) connectMap[fsId] = {};
          if (fc === 'BeginX' || fc === 'BeginY') connectMap[fsId].begin = { toSheet: tsId, toPart: cEl.attrs.ToPart };
          if (fc === 'EndX' || fc === 'EndY') connectMap[fsId].end = { toSheet: tsId, toPart: cEl.attrs.ToPart };
        }
      }

      const layers = VisioConverter._parsePageLayers(pagesNode, pageId);
      const parsedShapes = [];
      const parsedConnectors = [];

      const ctx = { styleSheets, docDefaults, docColors, theme, mediaMap, shapeRels: pageRels, masters, docThemeIndex, pageThemeIndex };

      for (let sIdx = 0; sIdx < topShapes.length; sIdx++) {
        const sNode = topShapes[sIdx];
        if (sNode.del) continue;
        const master = sNode.masterId ? masters[sNode.masterId] : null;
        const masterRoot = master ? master.rootShape : null;
        const sCtx = {
          ...ctx,
          shapeRels: { ...pageRels, ...(master ? master.rels : {}) },
          masterById: master ? master.byId : null
        };

        const g = (n, ch) => VisioConverter._getEffectiveCell(sNode, masterRoot, sCtx, n, ch);
        const beginX = g('BeginX', 'lineStyle');
        const endX = g('EndX', 'lineStyle');
        const beginY = g('BeginY', 'lineStyle');
        const endY = g('EndY', 'lineStyle');
        const mergedSecs = VisioConverter._mergeSections(masterRoot && masterRoot.sections, sNode.sections);
        const geom0 = mergedSecs['Geometry:0'];
        const geomRows = geom0 && geom0.rows ? geom0.rows.filter(r => !r.del) : [];
        const hasCurves = geomRows.some(r => {
          const t = r.type || '';
          return t === 'ArcTo' || t === 'EllipticalArcTo' || t === 'NURBSTo' || t === 'SplineStart';
        });
        const hasChildren = (sNode.children && sNode.children.length > 0) || (masterRoot && masterRoot.children && masterRoot.children.length > 0);
        const fillPatC = g('FillPattern', 'fillStyle');
        const fillPatVal = fillPatC && fillPatC.val !== null ? parseInt(fillPatC.val, 10) : 1;
        const isUnfilled1DLine = !hasCurves && !hasChildren && (fillPatVal === 0 || (geom0 && geom0.cells && geom0.cells.NoFill && geom0.cells.NoFill.val === '1') || geomRows.length <= 2);
        const isExplicitConn = Boolean((master && /connector/i.test(master.nameU)) || /connector/i.test(sNode.nameU) || connectMap[sNode.id]);
        const isConnector = Boolean(beginX && endX && beginY && endY && (isExplicitConn || isUnfilled1DLine));
        const displayLevel = parseFloat((g('DisplayLevel', 'fillStyle') || {}).val) || 0;

        if (isConnector) {
          const bx = parseFloat(beginX.val) * DPI;
          const by = (pageHIn - parseFloat(beginY.val)) * DPI;
          const ex = parseFloat(endX.val) * DPI;
          const ey = (pageHIn - parseFloat(endY.val)) * DPI;
          const style = VisioConverter._resolveShapeColorsAndStroke(sNode, masterRoot, sCtx, false);

          const pinXIn = parseFloat((g('PinX', 'lineStyle') || {}).val) || 0;
          const pinYIn = parseFloat((g('PinY', 'lineStyle') || {}).val) || 0;
          const wIn = parseFloat((g('Width', 'lineStyle') || {}).val) || 0;
          const hIn = parseFloat((g('Height', 'lineStyle') || {}).val) || 0;
          const locPinXIn = parseFloat((g('LocPinX', 'lineStyle') || {}).val);
          const locPinYIn = parseFloat((g('LocPinY', 'lineStyle') || {}).val);
          const rawLocPinX = !isNaN(locPinXIn) ? locPinXIn : wIn / 2;
          const rawLocPinY = !isNaN(locPinYIn) ? locPinYIn : hIn / 2;
          const angRad = parseFloat((g('Angle', 'lineStyle') || {}).val) || 0;

          let worldPts = [];
          let connPathD = null;

          const localToPagePx = (curX, curY) => {
            const dx = curX - rawLocPinX;
            const dy = curY - rawLocPinY;
            const wxIn = pinXIn + dx * Math.cos(angRad) - dy * Math.sin(angRad);
            const wyIn = pinYIn + dx * Math.sin(angRad) + dy * Math.cos(angRad);
            return { x: wxIn * DPI, y: (pageHIn - wyIn) * DPI };
          };

          if (geom0 && geom0.rows && geom0.rows.length >= 2) {
            if (hasCurves) {
              const compiled = VisioConverter._parseGeometrySection(geom0, Math.max(1, wIn * DPI), Math.max(1, hIn * DPI), style.roundingPx);
              if (compiled.d) connPathD = compiled.d;
            }
            let curX = 0, curY = 0;
            for (const r of geom0.rows) {
              if (r.del) continue;
              const rx = r.cells.X && r.cells.X.val !== null ? parseFloat(r.cells.X.val) : curX;
              const ry = r.cells.Y && r.cells.Y.val !== null ? parseFloat(r.cells.Y.val) : curY;
              const isRel = (r.type || '').startsWith('Rel');
              curX = isRel ? rx * wIn : rx;
              curY = isRel ? ry * hIn : ry;
              worldPts.push(localToPagePx(curX, curY));
            }
          }

          if (worldPts.length < 2) {
            worldPts = [{ x: bx, y: by }, { x: ex, y: ey }];
          }

          const textInfo = VisioConverter._extractRichText(sNode, masterRoot, sCtx, Math.max(20, wIn * DPI), Math.max(20, hIn * DPI));

          const routeStyleC = g('ShapeRouteStyle', 'lineStyle');
          const lineRouteExtC = g('ConLineRouteExt', 'lineStyle');
          const routeStyleVal = routeStyleC && routeStyleC.val !== null ? parseInt(routeStyleC.val, 10) : NaN;
          const lineRouteExtVal = lineRouteExtC && lineRouteExtC.val !== null ? parseInt(lineRouteExtC.val, 10) : NaN;
          let importedRoutingType = 'orthogonal';
          if (lineRouteExtVal === 2) {
            importedRoutingType = 'curved';
          } else if (routeStyleVal === 16) {
            importedRoutingType = 'straight';
          }

          if (connPathD && !connectMap[sNode.id]) {
            const wPx = Math.max(2, wIn * DPI);
            const hPx = Math.max(2, hIn * DPI);
            const dashAttr = style.strokeDashArray ? ` stroke-dasharray="${style.strokeDashArray.join(',')}"` : '';
            const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" viewBox="0 0 ${wPx.toFixed(2)} ${hPx.toFixed(2)}"><path d="${connPathD}" fill="none" stroke="${style.stroke === 'none' ? '#000000' : style.stroke}" stroke-opacity="${style.strokeOpacity}" stroke-width="${style.strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/></svg>`;
            parsedShapes.push({
              visioId: sNode.id,
              visioOrder: sIdx,
              displayLevel,
              isContainer: false,
              shapeType: sNode.nameU || 'visio-curve',
              svg: fullSvg,
              left: pinXIn * DPI,
              top: (pageHIn - pinYIn) * DPI,
              width: wPx,
              height: hPx,
              angle: (-angRad * 180) / Math.PI,
              textInfo: null,
              childTexts: [],
              styleInfo: style,
              connectionPoints: [],
              layerId: 'layer_default',
              shapeProps: {}
            });
          } else {
            parsedConnectors.push({
              visioId: sNode.id,
              visioOrder: sIdx,
              displayLevel,
              points: worldPts,
              beginSheet: connectMap[sNode.id] && connectMap[sNode.id].begin ? connectMap[sNode.id].begin.toSheet : null,
              endSheet: connectMap[sNode.id] && connectMap[sNode.id].end ? connectMap[sNode.id].end.toSheet : null,
              beginPoint: { x: bx, y: by },
              endPoint: { x: ex, y: ey },
              stroke: style.stroke === 'none' ? '#000000' : style.stroke,
              strokeWidth: style.strokeWidth,
              strokeDashArray: style.strokeDashArray,
              sourceArrow: style.beginArrow > 0 ? 'arrow' : 'none',
              targetArrow: style.endArrow > 0 ? 'arrow' : 'none',
              roundingPx: style.roundingPx,
              routingType: importedRoutingType,
              label: textInfo ? textInfo.text : '',
              textStyle: textInfo ? textInfo.baseChar : null
            });
          }
          continue;
        }

        // Regular 2D Shape or Group
        const pinXIn = parseFloat((g('PinX', 'fillStyle') || {}).val) || 0;
        const pinYIn = parseFloat((g('PinY', 'fillStyle') || {}).val) || 0;
        const wIn = parseFloat((g('Width', 'fillStyle') || {}).val);
        const hIn = parseFloat((g('Height', 'fillStyle') || {}).val);
        const wPx = Math.max(1, (!isNaN(wIn) ? wIn : 1) * DPI);
        const hPx = Math.max(1, (!isNaN(hIn) ? hIn : 1) * DPI);
        const angRad = parseFloat((g('Angle', 'fillStyle') || {}).val) || 0;
        const pxPage = pinXIn * DPI;
        const pyPage = (pageHIn - pinYIn) * DPI;

        sNode._masterShapeNode = masterRoot;
        const svgInner = VisioConverter._parseMasterShapeXml(sNode, wPx, hPx, true, null, null, theme, sCtx);
        const fullSvg = svgInner
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" viewBox="0 0 ${wPx.toFixed(2)} ${hPx.toFixed(2)}">${svgInner}</svg>`
          : null;
        const layerMem = (g('LayerMember', 'fillStyle') || {}).val;
        const layerId = layerMem ? `layer_${layerMem.split(';')[0]}` : 'layer_default';
        const shapeProps = VisioConverter._extractShapeDataProperties(sNode, masterRoot);
        const connPts = VisioConverter._parseConnectionPoints(sNode, masterRoot, wPx, hPx);
        const textInfo = VisioConverter._extractRichText(sNode, masterRoot, sCtx, wPx, hPx);
        const childTexts = hasChildren ? VisioConverter._collectChildTexts(sNode, masterRoot, wPx, hPx, sCtx) : [];
        const isForeignShape = sNode.type === 'Foreign' || (masterRoot && masterRoot.type === 'Foreign') || !!sNode.foreignNode || !!(masterRoot && masterRoot.foreignNode);
        const styleInfo = VisioConverter._resolveShapeColorsAndStroke(sNode, masterRoot, sCtx, isForeignShape);
        const shapeTypeName = (master && master.nameU) || sNode.nameU || 'visio-shape';
        const msvStruct = VisioConverter._extractUserValue(sNode, masterRoot, 'msvStructureType');
        const isContainer = (msvStruct === 'Container') || displayLevel < 0 || /\b(container|swimlane|phase|boundary|frame)\b/i.test(shapeTypeName) || /^plain(\.|$)/i.test(shapeTypeName);

        parsedShapes.push({
          visioId: sNode.id,
          visioOrder: sIdx,
          displayLevel,
          isContainer,
          shapeType: shapeTypeName,
          svg: fullSvg,
          left: pxPage,
          top: pyPage,
          width: wPx,
          height: hPx,
          angle: (-angRad * 180) / Math.PI,
          textInfo,
          childTexts,
          styleInfo,
          connectionPoints: connPts,
          layerId,
          shapeProps
        });
      }

      importedPages.push({
        id: 'page_' + pageId,
        visioId: pageId,
        name: pageName,
        pixelWidth,
        pixelHeight,
        layers,
        rawShapesCount: topShapes.length,
        shapes: parsedShapes,
        connectors: parsedConnectors
      });
    }

    // Load into CanvasManager + PageManager if interactive
    if (canvasManager && importedPages.length > 0) {
      const pm = canvasManager.pageManager;
      if (pm) {
        pm.pages = importedPages.map((p) => ({
          id: p.id,
          name: p.name,
          objects: [],
          connectors: [],
          pendingPageModel: p,
          pixelWidth: p.pixelWidth,
          pixelHeight: p.pixelHeight,
          layers: p.layers && p.layers.length ? p.layers : [{ id: 'layer_default', name: 'Default', visible: true, locked: false, color: '#0078d4' }],
          zoom: null,
          vpt: null
        }));
        pm.currentPageIndex = 0;
        pm.activePageIndex = 0;

        // Hydrate Page 1 immediately (remaining pages hydrate lazily on tab switch!)
        await VisioConverter._hydratePageIntoCanvas(pm.pages[0], canvasManager);
        if (pm.renderTabs) pm.renderTabs();
      } else {
        await VisioConverter._hydratePageIntoCanvas({ pendingPageModel: importedPages[0] }, canvasManager);
      }
      if (canvasManager.zoomToFit) canvasManager.zoomToFit();
      if (window.undoManager) window.undoManager.clear();
    }

    return importedPages;
  }

  static _clearActiveCanvas(canvasManager) {
    if (!canvasManager || !canvasManager.canvas) return;
    const canvas = canvasManager.canvas;
    if (canvasManager.inlineTextEditor) canvasManager.inlineTextEditor.cancel();
    if (canvasManager.alignmentGuideManager) canvasManager.alignmentGuideManager.clearGuides();
    const cm = canvasManager.connectorManager;
    if (cm) {
      cm.hideAutoConnect();
      cm._hidePorts();
      cm._hideEndpointHandles();
      cm._draggingConnectorBody = null;
      cm.connectors = [];
    }
    const toRemove = canvas.getObjects().filter(
      (o) => o && !o.isGridLine && !o.isPageBg && o.objectType !== 'grid-line' && o.objectType !== 'page-background'
    );
    toRemove.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
  }

  static async _hydratePageIntoCanvas(pageData, canvasManager) {
    const model = pageData.pendingPageModel || pageData;
    const canvas = canvasManager.canvas;
    const cm = canvasManager.connectorManager;
    VisioConverter._clearActiveCanvas(canvasManager);
    if (canvasManager.gridManager && canvasManager.gridManager.setPageSize) {
      canvasManager.gridManager.setPageSize(model.pixelWidth || 1100, model.pixelHeight || 800);
    }
    if (canvasManager.layerManager && model.layers) {
      canvasManager.layerManager.setLayers(model.layers);
    }

    const makeTextbox = (ti) => {
      if (!ti || !ti.text || typeof fabric === 'undefined') return null;
      const boxW = Math.max(24, ti.txtWPx - ti.margins.left - ti.margins.right);
      return new fabric.Textbox(ti.text, {
        width: boxW,
        fontFamily: ti.baseChar.fontFamily,
        fontSize: ti.baseChar.fontSize,
        fontWeight: ti.baseChar.fontWeight,
        fontStyle: ti.baseChar.fontStyle,
        underline: ti.baseChar.underline,
        linethrough: ti.baseChar.linethrough,
        fill: ti.baseChar.fill,
        textAlign: ti.textAlign,
        styles: ti.styles,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        editable: false
      });
    };

    const idToFabric = new Map();
    const zEntries = [];
    const shapes = model.shapes || [];
    for (const sd of shapes) {
      let renderedObj = null;
      if (sd.svg) {
        renderedObj = await VisioConverter._createSvgImage(sd.svg, sd.left, sd.top, sd.width, sd.height, true);
      }

      const textObjs = [];
      let primaryTextObj = null;
      if (sd.textInfo && sd.textInfo.text) {
        const tObj = makeTextbox(sd.textInfo);
        if (tObj) {
          const ti = sd.textInfo;
          const textH = tObj.calcTextHeight ? tObj.calcTextHeight() : (tObj.height || ti.baseChar.fontSize);
          const { offX, offY } = VisioConverter._computeTextLocalOffset(ti, textH);
          tObj.set({
            left: (ti.txtPinXPx - sd.width / 2) + offX,
            top: (ti.txtPinYPx - sd.height / 2) + offY,
            angle: ti.txtAngleDeg || 0
          });
          textObjs.push(tObj);
          primaryTextObj = tObj;
        }
      }

      if (sd.childTexts && sd.childTexts.length > 0) {
        for (const ct of sd.childTexts) {
          const tObj = makeTextbox(ct.textInfo);
          if (!tObj) continue;
          const ti = ct.textInfo;
          const textH = tObj.calcTextHeight ? tObj.calcTextHeight() : (tObj.height || ti.baseChar.fontSize);
          const { offX, offY } = VisioConverter._computeTextLocalOffset(ti, textH);
          const lx = ti.txtPinXPx + offX;
          const ly = ti.txtPinYPx + offY;
          const m = ct.matrix;
          const rx = m[0] * lx + m[2] * ly + m[4];
          const ry = m[1] * lx + m[3] * ly + m[5];
          const matAng = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
          tObj.set({
            left: rx - (ct.rootW / 2),
            top: ry - (ct.rootH / 2),
            angle: matAng + (ti.txtAngleDeg || 0)
          });
          textObjs.push(tObj);
          if (!primaryTextObj) primaryTextObj = tObj;
        }
      }

      let finalObj = null;
      if (renderedObj && textObjs.length > 0) {
        renderedObj.set({ left: 0, top: 0, angle: 0, originX: 'center', originY: 'center' });
        finalObj = new fabric.Group([renderedObj, ...textObjs], {
          left: sd.left,
          top: sd.top,
          originX: 'center',
          originY: 'center',
          angle: sd.angle || 0
        });
        finalObj.geometryObject = renderedObj;
        finalObj.labelObject = primaryTextObj;
      } else if (renderedObj) {
        renderedObj.set({ angle: sd.angle || 0 });
        finalObj = renderedObj;
        finalObj.geometryObject = renderedObj;
      } else if (textObjs.length > 0) {
        if (textObjs.length === 1) {
          const tOnly = textObjs[0];
          tOnly.set({ left: sd.left, top: sd.top, angle: (sd.angle || 0) + (sd.textInfo ? sd.textInfo.txtAngleDeg : (tOnly.angle || 0)) });
          finalObj = tOnly;
          finalObj.labelObject = tOnly;
        } else {
          finalObj = new fabric.Group(textObjs, {
            left: sd.left,
            top: sd.top,
            originX: 'center',
            originY: 'center',
            angle: sd.angle || 0
          });
          finalObj.labelObject = primaryTextObj;
        }
      }

      if (finalObj) {
        const displayName = (sd.textInfo && sd.textInfo.text)
          || (sd.childTexts && sd.childTexts[0] && sd.childTexts[0].textInfo && sd.childTexts[0].textInfo.text)
          || sd.shapeType || '';
        const isHollow = Boolean(sd.isContainer && sd.styleInfo && (sd.styleInfo.fill === 'none' || sd.styleInfo.fill === 'transparent' || sd.styleInfo.fillPattern === 0));
        finalObj.set({
          objectType: sd.isContainer ? 'container' : 'shape',
          isContainer: !!sd.isContainer,
          shapeType: sd.shapeType || 'visio-shape',
          connectionPoints: sd.connectionPoints || [],
          layerId: sd.layerId || 'layer_default',
          visioFill: sd.styleInfo ? sd.styleInfo.fill : '#FFFFFF',
          visioStroke: sd.styleInfo ? sd.styleInfo.stroke : '#000000',
          perPixelTargetFind: isHollow,
          shapeData: {
            id: 'visio_' + sd.visioId,
            visioId: sd.visioId,
            isContainer: !!sd.isContainer,
            name: displayName,
            properties: { text: displayName, ...(sd.shapeProps || {}) }
          }
        });
        idToFabric.set(String(sd.visioId), finalObj);
        canvas.add(finalObj);
        zEntries.push({
          tier: (sd.isContainer || (sd.displayLevel || 0) < 0) ? 0 : 1,
          order: sd.visioOrder ?? zEntries.length,
          objs: [finalObj]
        });
      }
    }

    if (cm && model.connectors) {
      for (const cd of model.connectors) {
        const src = cd.beginSheet ? idToFabric.get(String(cd.beginSheet)) : null;
        const tgt = cd.endSheet ? idToFabric.get(String(cd.endSheet)) : null;
        const srcPortId = src && cd.beginPoint && cm.getClosestPort ? cm.getClosestPort(src, cd.beginPoint).id : null;
        const tgtPortId = tgt && cd.endPoint && cm.getClosestPort ? cm.getClosestPort(tgt, cd.endPoint).id : null;
        const connObj = cm.createConnector(
          src || null,
          srcPortId,
          tgt || null,
          tgtPortId,
          {
            stroke: cd.stroke || '#000000',
            strokeWidth: cd.strokeWidth || 1.5,
            strokeDashArray: cd.strokeDashArray || null,
            sourceArrow: cd.sourceArrow || 'none',
            targetArrow: cd.targetArrow || 'none',
            roundingPx: cd.roundingPx || 0,
            routingType: cd.routingType || 'orthogonal',
            preserveGeometry: Boolean(cd.points && cd.points.length >= 2),
            label: cd.label || '',
            textStyle: cd.textStyle || null,
            skipUndo: true
          },
          cd.points && cd.points.length >= 2 ? cd.points : null
        );
        if (connObj) {
          zEntries.push({
            tier: (cd.displayLevel || 0) < 0 ? 0 : 1,
            order: cd.visioOrder ?? zEntries.length,
            objs: [connObj.line, connObj.arrow, connObj.sourceArrowHead, connObj.labelObj].filter(Boolean)
          });
        }
      }
    }

    // Apply deterministic Visio stacking order (grid/page-bg -> containers -> shapes & connectors by visioOrder)
    const bgObjs = canvas.getObjects().filter(
      (o) => o && (o.isGridLine || o.isPageBg || o.objectType === 'grid-line' || o.objectType === 'page-background')
    );
    bgObjs.forEach((bg, idx) => canvas.moveObjectTo(bg, idx));
    zEntries.sort((a, b) => (a.tier - b.tier) || (a.order - b.order));
    let cursor = bgObjs.length;
    for (const entry of zEntries) {
      for (const obj of entry.objs) {
        if (canvas.contains(obj)) {
          canvas.moveObjectTo(obj, cursor++);
        }
      }
    }

    pageData.pendingPageModel = null;
    canvas.requestRenderAll();
  }

  static _cssColorToVisioHex(color, fallback = '#000000') {
    if (!color || typeof color !== 'string') return { hex: fallback, trans: 0 };
    const s = color.trim();
    if (s === 'transparent' || s === 'none') return { hex: fallback, trans: 1 };
    const rgbaMatch = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (rgbaMatch) {
      const toHex = (n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0').toUpperCase();
      const hex = `#${toHex(rgbaMatch[1])}${toHex(rgbaMatch[2])}${toHex(rgbaMatch[3])}`;
      const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1;
      return { hex, trans: Number((1 - a).toFixed(4)) };
    }
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return { hex: (`#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`).toUpperCase(), trans: 0 };
    }
    if (/^#[0-9a-fA-F]{6}$/.test(s)) {
      return { hex: s.toUpperCase(), trans: 0 };
    }
    if (/^#[0-9a-fA-F]{8}$/.test(s)) {
      const a = parseInt(s.slice(7, 9), 16) / 255;
      return { hex: s.slice(0, 7).toUpperCase(), trans: Number((1 - a).toFixed(4)) };
    }
    return { hex: fallback, trans: 0 };
  }

  // ─── Full Multi-Page .VSDX Exporter ──────────────────────────────────────────

  static async exportVsdx(canvasManager) {
    if (typeof JSZip === 'undefined' && typeof require !== 'undefined') {
      global.JSZip = require('jszip');
    }
    const zip = new JSZip();

    const pm = canvasManager && canvasManager.pageManager;
    if (pm && pm._saveCurrentPageState) pm._saveCurrentPageState();
    const pages = (pm && pm.pages && pm.pages.length > 0)
      ? pm.pages
      : [{
        name: 'Page-1',
        pixelWidth: (canvasManager.gridManager && canvasManager.gridManager.pageSize.width) || 1100,
        pixelHeight: (canvasManager.gridManager && canvasManager.gridManager.pageSize.height) || 850,
        objects: canvasManager.canvas.getObjects().filter(o => !o.isGridLine && !o.isPageBg && !o.isGuide && o.objectType !== 'grid-line' && o.objectType !== 'page-background' && o.objectType !== 'connector' && o.objectType !== 'connector-arrow' && o.objectType !== 'connector-handle' && o.objectType !== 'autoconnect-trigger' && o.objectType !== 'port-marker').map(o => o.toObject(['objectType', 'shapeType', 'shapeData', 'layerId', 'connectionPoints'])),
        connectors: (canvasManager.connectorManager && canvasManager.connectorManager.connectors) || [],
        layers: (canvasManager.layerManager && canvasManager.layerManager.layers) || [{ id: 'layer_default', name: 'Default', visible: true, locked: false }]
      }];

    const contentTypesOverrides = [
      `<Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>`,
      `<Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>`,
      `<Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>`
    ];
    const pagesXmlEntries = [];
    const pagesRelsEntries = [];
    const mediaExts = new Set();
    const usedFonts = new Set(['Calibri', 'Arial', 'Segoe UI']);
    const mediaAdded = {};
    let nextMediaIdx = 1;

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const pg = pages[pIdx];
      const pageId = pIdx;
      const pageNum = pIdx + 1;
      const wIn = ((pg.pixelWidth || 1100) / DPI).toFixed(6);
      const hIn = ((pg.pixelHeight || 850) / DPI).toFixed(6);
      const pgH = pg.pixelHeight || 850;
      const layers = pg.layers && pg.layers.length ? pg.layers : [{ id: 'layer_default', name: 'Default', visible: true, locked: false }];

      contentTypesOverrides.push(`<Override PartName="/visio/pages/page${pageNum}.xml" ContentType="application/vnd.ms-visio.page+xml"/>`);
      pagesRelsEntries.push(`<Relationship Id="rId${pageNum}" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page${pageNum}.xml"/>`);

      const layerRowsXml = layers.map((l, li) =>
        `<Row IX="${li}"><Cell N="Name" V="${VisioConverter._escapeXml(l.name || 'Default')}"/><Cell N="Visible" V="${l.visible === false ? 0 : 1}"/><Cell N="Lock" V="${l.locked ? 1 : 0}"/><Cell N="Snap" V="1"/><Cell N="Glue" V="1"/></Row>`
      ).join('');

      pagesXmlEntries.push(
        `<Page ID="${pageId}" NameU="${VisioConverter._escapeXml(pg.name || `Page-${pageNum}`)}" Name="${VisioConverter._escapeXml(pg.name || `Page-${pageNum}`)}">`
        + `<PageSheet LineStyle="0" FillStyle="0" TextStyle="0"><Cell N="PageWidth" V="${wIn}"/><Cell N="PageHeight" V="${hIn}"/>`
        + (layerRowsXml ? `<Section N="Layer">${layerRowsXml}</Section>` : '')
        + `</PageSheet><Rel r:id="rId${pageNum}"/></Page>`
      );

      // Build shapes XML on page{pageNum}.xml
      const shapeXmls = [];
      const connectsXml = [];
      const pageRelsList = [];
      let nextShapeId = 1;
      const objIdToVisioId = new Map();
      const objRefToVisioId = new Map();

      // If page is currently active canvas, prefer live Fabric objects for highest fidelity
      const isCurrent = !pm || pIdx === pm.currentPageIndex;
      const rawObjs = isCurrent
        ? canvasManager.canvas.getObjects().filter(o =>
            !o.isGridLine && !o.isPageBg && !o.isGuide &&
            !['grid-line', 'page-background', 'connector', 'connector-arrow', 'connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line', 'preview-rect'].includes(o.objectType)
          )
        : (pg.liveShapes || pg.objects || []);

      const extractVisualProps = (obj) => {
        const findLeafGeom = (node) => {
          if (!node) return null;
          if (node.geometryObject && !node.geometryObject.getObjects) return node.geometryObject;
          const rootSub = node.geometryObject || node;
          if (rootSub.getObjects) {
            for (const c of rootSub.getObjects()) {
              if (['text', 'i-text', 'textbox'].includes(c.type)) continue;
              const leaf = c.getObjects ? findLeafGeom(c) : c;
              if (leaf) return leaf;
            }
          }
          return !['text', 'i-text', 'textbox'].includes(rootSub.type) ? rootSub : null;
        };
        const sub = findLeafGeom(obj) || obj;
        const lbl = obj.labelObject || (obj.getObjects ? obj.getObjects().find(c => ['text', 'i-text', 'textbox'].includes(c.type)) : null) || (['text', 'i-text', 'textbox'].includes(obj.type) ? obj : null);
        const rawW = (obj.width || 100) * (obj.scaleX || 1);
        const rawH = (obj.height || 60) * (obj.scaleY || 1);
        const cx = obj.originX === 'center' ? obj.left : obj.left + rawW / 2;
        const cy = obj.originY === 'center' ? obj.top : obj.top + rawH / 2;
        const rawFill = (sub && typeof sub.fill === 'string' && sub.fill !== 'transparent' && sub.fill !== 'none') ? sub.fill : (obj.visioFill || '#FFFFFF');
        const noFill = (sub && (sub.fill === 'transparent' || sub.fill === 'none' || !sub.fill) && !obj.visioFill) || ['text', 'i-text', 'textbox'].includes(obj.type);
        const fillParsed = VisioConverter._cssColorToVisioHex(rawFill, '#FFFFFF');
        const fillCol = fillParsed.hex;
        const fillTrans = fillParsed.trans;
        const rawStroke = (sub && typeof sub.stroke === 'string' && sub.stroke !== 'none' && sub.stroke !== 'transparent') ? sub.stroke : (obj.visioStroke || '#000000');
        const noLine = (sub && (!sub.stroke || sub.stroke === 'none' || sub.stroke === 'transparent') && !obj.visioStroke) || ['text', 'i-text', 'textbox'].includes(obj.type);
        const strokeCol = VisioConverter._cssColorToVisioHex(rawStroke, '#000000').hex;
        const sw = (sub && sub.strokeWidth) ? sub.strokeWidth : 1;
        const dash = sub && sub.strokeDashArray;
        const linePat = noLine ? 0 : (dash && dash.length >= 4 ? 4 : dash && dash.length >= 2 ? (dash[0] <= 2.5 ? 3 : 2) : 1);
        const rx = (sub && sub.rx) ? sub.rx : 0;
        const text = (lbl && lbl.text) || (obj.shapeData && obj.shapeData.properties && obj.shapeData.properties.text) || '';
        const textColor = VisioConverter._cssColorToVisioHex((lbl && typeof lbl.fill === 'string') ? lbl.fill : '#000000', '#000000').hex;
        const rawFont = (lbl && lbl.fontFamily) ? String(lbl.fontFamily).split(',')[0].replace(/['"]/g, '').trim() : 'Calibri';
        const font = rawFont || 'Calibri';
        usedFonts.add(font);
        const fontSize = (lbl && lbl.fontSize) || 12;
        const isBold = lbl && (lbl.fontWeight === 'bold' || Number(lbl.fontWeight) >= 700);
        const isItalic = lbl && lbl.fontStyle === 'italic';
        const layerIdx = Math.max(0, layers.findIndex(l => l.id === obj.layerId));
        const srcUrl = (sub && sub.src) || obj.src || null;
        return { rawW, rawH, cx, cy, angle: obj.angle || 0, fillCol, fillTrans, noFill, strokeCol, noLine, sw, linePat, rx, text, textColor, font, fontSize, isBold, isItalic, layerIdx, srcUrl, shapeData: obj.shapeData, st: obj.shapeType, type: obj.type };
      };

      for (const o of rawObjs) {
        const sid = nextShapeId++;
        const vp = extractVisualProps(o);
        objRefToVisioId.set(o, sid);
        if (o.shapeData && o.shapeData.id) objIdToVisioId.set(o.shapeData.id, sid);
        if (o.id) objIdToVisioId.set(o.id, sid);

        const pinX = (vp.cx / DPI).toFixed(6);
        const pinY = ((pgH - vp.cy) / DPI).toFixed(6);
        const wIn = (Math.max(2, vp.rawW) / DPI).toFixed(6);
        const hIn = (Math.max(2, vp.rawH) / DPI).toFixed(6);
        const angRad = ((-vp.angle * Math.PI) / 180).toFixed(6);

        let geomXml = '';
        let foreignXml = '';
        let typeAttr = `Type='Shape'`;

        const imgMatch = (vp.srcUrl && typeof vp.srcUrl === 'string')
          ? vp.srcUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
          : null;
        if (imgMatch) {
          const ext = imgMatch[1].toLowerCase() === 'png' ? 'png' : 'jpg';
          const b64 = imgMatch[2];
          mediaExts.add(ext);
          const mediaName = `visio/media/img_${nextMediaIdx++}.${ext}`;
          if (!mediaAdded[mediaName]) {
            zip.file(mediaName, b64, { base64: true });
            mediaAdded[mediaName] = true;
          }
          const relId = `rIdImg${pageRelsList.length + 1}`;
          pageRelsList.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName.split('/').pop()}"/>`);
          typeAttr = `Type='Foreign'`;
          foreignXml = `<ForeignData ForeignType='Bitmap' CompressionType='${ext === 'png' ? 'PNG' : 'JPEG'}'><Rel r:id='${relId}'/></ForeignData>`;
        } else if (vp.st === 'circle' || vp.st === 'ellipse' || vp.type === 'circle' || vp.type === 'ellipse') {
          const wN = Math.max(2, vp.rawW) / DPI, hN = Math.max(2, vp.rawH) / DPI;
          geomXml = `<Section N='Geometry' IX='0'><Cell N='NoFill' V='${vp.noFill ? 1 : 0}'/><Cell N='NoLine' V='${vp.noLine ? 1 : 0}'/><Cell N='NoShow' V='0'/>`
            + `<Row T='Ellipse' IX='1'><Cell N='X' V='${(wN / 2).toFixed(6)}'/><Cell N='Y' V='${(hN / 2).toFixed(6)}'/>`
            + `<Cell N='A' V='${wN.toFixed(6)}'/><Cell N='B' V='${(hN / 2).toFixed(6)}'/>`
            + `<Cell N='C' V='${(wN / 2).toFixed(6)}'/><Cell N='D' V='${hN.toFixed(6)}'/></Row></Section>`;
        } else {
          geomXml = `<Section N='Geometry' IX='0'><Cell N='NoFill' V='${vp.noFill ? 1 : 0}'/><Cell N='NoLine' V='${vp.noLine ? 1 : 0}'/><Cell N='NoShow' V='0'/>`
            + `<Row T='RelMoveTo' IX='1'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row>`
            + `<Row T='RelLineTo' IX='2'><Cell N='X' V='1'/><Cell N='Y' V='0'/></Row>`
            + `<Row T='RelLineTo' IX='3'><Cell N='X' V='1'/><Cell N='Y' V='1'/></Row>`
            + `<Row T='RelLineTo' IX='4'><Cell N='X' V='0'/><Cell N='Y' V='1'/></Row>`
            + `<Row T='RelLineTo' IX='5'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row></Section>`;
        }

        const charStyle = (vp.isBold ? 1 : 0) | (vp.isItalic ? 2 : 0);
        const propsRows = vp.shapeData && vp.shapeData.properties
          ? Object.entries(vp.shapeData.properties).filter(([k]) => k !== 'text').map(([k, v], idx) =>
              `<Row N='Prop_${idx}'><Cell N='Label' V='${VisioConverter._escapeXml(k)}'/><Cell N='Value' V='${VisioConverter._escapeXml(v)}'/></Row>`
            ).join('')
          : '';
        const baseName = `${vp.st || 'Shape'}.${sid}`;

        shapeXmls.push(
          `<Shape ID='${sid}' NameU='${VisioConverter._escapeXml(baseName)}' ${typeAttr} LineStyle='0' FillStyle='0' TextStyle='0'>`
          + `<Cell N='PinX' V='${pinX}'/><Cell N='PinY' V='${pinY}'/><Cell N='Width' V='${wIn}'/><Cell N='Height' V='${hIn}'/>`
          + `<Cell N='LocPinX' V='${(parseFloat(wIn) / 2).toFixed(6)}' F='Width*0.5'/><Cell N='LocPinY' V='${(parseFloat(hIn) / 2).toFixed(6)}' F='Height*0.5'/>`
          + `<Cell N='Angle' V='${angRad}'/><Cell N='LayerMember' V='${vp.layerIdx}'/>`
          + `<Cell N='FillForegnd' V='${VisioConverter._escapeXml(vp.fillCol)}'/><Cell N='FillForegndTrans' V='${vp.fillTrans}'/><Cell N='FillPattern' V='${vp.noFill ? 0 : 1}'/>`
          + `<Cell N='LineColor' V='${VisioConverter._escapeXml(vp.strokeCol)}'/><Cell N='LineWeight' V='${(vp.sw / DPI).toFixed(6)}'/><Cell N='LinePattern' V='${vp.linePat}'/>`
          + (vp.rx > 0 ? `<Cell N='Rounding' V='${(vp.rx / DPI).toFixed(6)}'/>` : '')
          + `<Section N='Character'><Row IX='0'><Cell N='Font' V='${VisioConverter._escapeXml(vp.font)}'/><Cell N='Size' V='${(vp.fontSize / DPI).toFixed(6)}'/><Cell N='Style' V='${charStyle}'/><Cell N='Color' V='${VisioConverter._escapeXml(vp.textColor)}'/></Row></Section>`
          + geomXml
          + foreignXml
          + (propsRows ? `<Section N='Property'>${propsRows}</Section>` : '')
          + (vp.text ? `<Text><cp IX='0'/>${VisioConverter._escapeXml(vp.text)}</Text>` : '')
          + `</Shape>`
        );
      }

      // Export connectors on this page
      const conns = isCurrent
        ? ((canvasManager.connectorManager && canvasManager.connectorManager.connectors) || [])
        : (pg.connectors || []);

      for (const conn of conns) {
        const pts = (conn.line && conn.line.points && conn.line.points.length >= 2)
          ? conn.line.points
          : (conn.points || [conn.sourcePoint, conn.targetPoint]).filter(Boolean);
        if (pts.length < 2) continue;

        const cid = nextShapeId++;
        const p0 = pts[0], pEnd = pts[pts.length - 1];
        const bx = (p0.x / DPI).toFixed(6), by = ((pgH - p0.y) / DPI).toFixed(6);
        const ex = (pEnd.x / DPI).toFixed(6), ey = ((pgH - pEnd.y) / DPI).toFixed(6);
        const midX = (((p0.x + pEnd.x) / 2) / DPI).toFixed(6);
        const midY = (((pgH - (p0.y + pEnd.y) / 2)) / DPI).toFixed(6);
        const wIn = Math.max(0.01, Math.abs(pEnd.x - p0.x) / DPI).toFixed(6);
        const hIn = Math.max(0.01, Math.abs(pEnd.y - p0.y) / DPI).toFixed(6);

        const stCol = VisioConverter._cssColorToVisioHex((conn.style && conn.style.stroke) || (conn.line && conn.line.stroke) || '#000000', '#000000').hex;
        const stW = ((conn.style && conn.style.strokeWidth) || (conn.line && conn.line.strokeWidth) || 1.5) / DPI;
        const endArr = (conn.style && conn.style.targetArrow && conn.style.targetArrow !== 'none') ? 4 : 0;
        const begArr = (conn.style && conn.style.sourceArrow && conn.style.sourceArrow !== 'none') ? 4 : 0;

        const srcSid = objRefToVisioId.get(conn.sourceShape)
          || objIdToVisioId.get(conn.sourceShapeId || (conn.sourceShape && conn.sourceShape.shapeData && conn.sourceShape.shapeData.id));
        const tgtSid = objRefToVisioId.get(conn.targetShape)
          || objIdToVisioId.get(conn.targetShapeId || (conn.targetShape && conn.targetShape.shapeData && conn.targetShape.shapeData.id));

        const rowsXml = pts.map((pt, i) => {
          const lx = ((pt.x - p0.x) / DPI).toFixed(6);
          const ly = ((p0.y - pt.y) / DPI).toFixed(6);
          return `<Row T='${i === 0 ? 'MoveTo' : 'LineTo'}' IX='${i + 1}'><Cell N='X' V='${lx}'/><Cell N='Y' V='${ly}'/></Row>`;
        }).join('');

        const connText = conn.label || '';
        const begF = srcSid ? ` F='_WALKGLUE(BegTrigger,EndTrigger,WalkPreference)'` : '';
        const endF = tgtSid ? ` F='_WALKGLUE(EndTrigger,BegTrigger,WalkPreference)'` : '';
        shapeXmls.push(
          `<Shape ID='${cid}' NameU='Dynamic connector.${cid}' Type='Shape' LineStyle='0' FillStyle='0' TextStyle='0'>`
          + `<Cell N='PinX' V='${midX}' F='(BeginX+EndX)/2'/><Cell N='PinY' V='${midY}' F='(BeginY+EndY)/2'/>`
          + `<Cell N='Width' V='${wIn}'/><Cell N='Height' V='${hIn}'/>`
          + `<Cell N='LocPinX' V='${(parseFloat(wIn) / 2).toFixed(6)}' F='Width*0.5'/><Cell N='LocPinY' V='${(parseFloat(hIn) / 2).toFixed(6)}' F='Height*0.5'/>`
          + `<Cell N='BeginX' V='${bx}'${begF}/><Cell N='BeginY' V='${by}'${begF}/>`
          + `<Cell N='EndX' V='${ex}'${endF}/><Cell N='EndY' V='${ey}'${endF}/>`
          + (srcSid ? `<Cell N='BegTrigger' V='2' F='_XFTRIGGER(Sheet.${srcSid}!EventXFMod)'/>` : '')
          + (tgtSid ? `<Cell N='EndTrigger' V='2' F='_XFTRIGGER(Sheet.${tgtSid}!EventXFMod)'/>` : '')
          + `<Cell N='LineColor' V='${VisioConverter._escapeXml(stCol)}'/><Cell N='LineWeight' V='${stW.toFixed(6)}'/><Cell N='LinePattern' V='1'/>`
          + `<Cell N='BeginArrow' V='${begArr}'/><Cell N='EndArrow' V='${endArr}'/><Cell N='FillPattern' V='0'/>`
          + `<Section N='Geometry' IX='0'><Cell N='NoFill' V='1'/><Cell N='NoLine' V='0'/>${rowsXml}</Section>`
          + (connText ? `<Text>${VisioConverter._escapeXml(connText)}</Text>` : '')
          + `</Shape>`
        );

        if (srcSid) {
          connectsXml.push(`<Connect FromSheet='${cid}' FromCell='BeginX' FromPart='9' ToSheet='${srcSid}' ToCell='PinX' ToPart='3'/>`);
        }
        if (tgtSid) {
          connectsXml.push(`<Connect FromSheet='${cid}' FromCell='EndX' FromPart='12' ToSheet='${tgtSid}' ToCell='PinX' ToPart='3'/>`);
        }
      }

      const pageXml = `<?xml version='1.0' encoding='utf-8'?>\n<PageContents xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'><Shapes>${shapeXmls.join('')}</Shapes>${connectsXml.length ? `<Connects>${connectsXml.join('')}</Connects>` : ''}</PageContents>`;
      zip.file(`visio/pages/page${pageNum}.xml`, pageXml);

      if (pageRelsList.length > 0) {
        zip.file(`visio/pages/_rels/page${pageNum}.xml.rels`,
          `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\n<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>${pageRelsList.join('')}</Relationships>`);
      }
    }

    if (mediaExts.has('png')) {
      contentTypesOverrides.push(`<Default Extension='png' ContentType='image/png'/>`);
    }
    if (mediaExts.has('jpg')) {
      contentTypesOverrides.push(`<Default Extension='jpg' ContentType='image/jpeg'/>`);
    }

    const faceNamesXml = Array.from(usedFonts).map(f => `<FaceName NameU='${VisioConverter._escapeXml(f)}'/>`).join('');
    const firstPage = pages[0] || {};
    const firstWIn = ((firstPage.pixelWidth || 1100) / DPI).toFixed(3);
    const firstHIn = ((firstPage.pixelHeight || 850) / DPI).toFixed(3);

    zip.file('[Content_Types].xml',
      `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\n<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'><Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/><Default Extension='xml' ContentType='application/xml'/>${contentTypesOverrides.join('')}</Types>`);
    zip.file('_rels/.rels',
      `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\n<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.microsoft.com/visio/2010/relationships/document' Target='visio/document.xml'/></Relationships>`);
    zip.file('visio/_rels/document.xml.rels',
      `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\n<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.microsoft.com/visio/2010/relationships/pages' Target='pages/pages.xml'/><Relationship Id='rId2' Type='http://schemas.microsoft.com/visio/2010/relationships/windows' Target='windows.xml'/></Relationships>`);
    zip.file('visio/document.xml',
      `<?xml version='1.0' encoding='utf-8'?>\n<VisioDocument xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'><DocumentSettings TopPage='0' DefaultTextStyle='0' DefaultLineStyle='0' DefaultFillStyle='0' DefaultGuideStyle='0'><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions></DocumentSettings><Colors><ColorEntry IX='0' RGB='#000000'/><ColorEntry IX='1' RGB='#FFFFFF'/></Colors><FaceNames>${faceNamesXml}</FaceNames><StyleSheets><StyleSheet ID='0' NameU='No Style' Name='No Style'><Cell N='LineWeight' V='0.0138889'/><Cell N='LineColor' V='0'/><Cell N='LinePattern' V='1'/><Cell N='FillForegnd' V='1'/><Cell N='FillPattern' V='1'/></StyleSheet></StyleSheets><DocumentSheet NameU='TheDoc' LineStyle='0' FillStyle='0' TextStyle='0'/></VisioDocument>`);
    zip.file('visio/windows.xml',
      `<?xml version='1.0' encoding='utf-8'?>\n<Windows ClientWidth='1280' ClientHeight='800' xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'><Window ID='0' WindowType='Drawing' WindowState='1073741824' WindowLeft='0' WindowTop='0' WindowWidth='1280' WindowHeight='800' ContainerType='Page' Page='0' ViewScale='-1' ViewCenterX='${(parseFloat(firstWIn) / 2).toFixed(3)}' ViewCenterY='${(parseFloat(firstHIn) / 2).toFixed(3)}'><ShowRulers>1</ShowRulers><ShowGrid>1</ShowGrid><ShowConnectionPoints>1</ShowConnectionPoints><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions></Window></Windows>`);
    zip.file('visio/pages/_rels/pages.xml.rels',
      `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\n<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>${pagesRelsEntries.join('')}</Relationships>`);
    zip.file('visio/pages/pages.xml',
      `<?xml version='1.0' encoding='utf-8'?>\n<Pages xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'>${pagesXmlEntries.join('')}</Pages>`);

    return await zip.generateAsync({ type: 'blob' });
  }

  // ─── .VSSX Stencil Archive Parser ───────────────────────────────────────────

  static async parseVssxArchive(buffer, stencilTitle = 'Stencil') {
    if (typeof JSZip === 'undefined' && typeof require !== 'undefined') {
      global.JSZip = require('jszip');
    }
    const zip = await JSZip.loadAsync(buffer);
    const shapes = [];

    const docStr = zip.file('visio/document.xml') ? await zip.file('visio/document.xml').async('string') : '';
    const docNode = VisioConverter._parseXml(docStr);
    const styleSheets = VisioConverter._parseStyleSheets(docNode);
    const docColors = {};
    const cEl = VisioConverter._firstChild(docNode, 'Colors');
    if (cEl) {
      for (const ce of VisioConverter._childElements(cEl, 'ColorEntry')) {
        const ix = parseInt(ce.attrs.IX, 10);
        if (!isNaN(ix) && ce.attrs.RGB) docColors[ix] = ce.attrs.RGB.toUpperCase();
      }
    }
    const theme = zip.file('visio/theme/theme1.xml')
      ? VisioConverter._parseThemeXml(await zip.file('visio/theme/theme1.xml').async('string'))
      : VisioConverter._parseThemeXml('');

    const mediaMap = await VisioConverter._convertMediaToDataUrls(zip);

    if (!zip.file('visio/masters/masters.xml')) return { title: stencilTitle, shapes };

    const mastersStr = await zip.file('visio/masters/masters.xml').async('string');
    const relsStr = zip.file('visio/masters/_rels/masters.xml.rels')
      ? await zip.file('visio/masters/_rels/masters.xml.rels').async('string') : '';
    const mRels = VisioConverter._parseRelsXml(relsStr);
    const mRoot = VisioConverter._parseXml(mastersStr);

    for (const mEl of VisioConverter._childElements(mRoot, 'Master')) {
      const mId = mEl.attrs.ID || '';
      const name = mEl.attrs.NameU || mEl.attrs.Name || `Shape ${mId}`;
      const relEl = VisioConverter._firstChild(mEl, 'Rel');
      const rId = relEl && relEl.attrs['r:id'];
      const target = rId && mRels[rId] ? (mRels[rId].startsWith('visio/') ? mRels[rId] : `visio/masters/${mRels[rId]}`) : null;
      if (!target || !zip.file(target)) continue;

      const masterXml = await zip.file(target).async('string');
      const mrPath = `visio/masters/_rels/${target.split('/').pop()}.rels`;
      const shapeRels = zip.file(mrPath) ? VisioConverter._parseRelsXml(await zip.file(mrPath).async('string')) : {};
      const indexed = VisioConverter._indexMasterShapes(masterXml);
      const rootShape = indexed.rootShape;
      if (!rootShape) continue;

      const wIn = parseFloat(rootShape.cells.Width && rootShape.cells.Width.val) || 1;
      const hIn = parseFloat(rootShape.cells.Height && rootShape.cells.Height.val) || 1;
      const wPx = Math.max(24, Math.min(240, wIn * DPI));
      const hPx = Math.max(24, Math.min(240, hIn * DPI));
      const ctx = {
        styleSheets,
        docDefaults: { fillStyle: '3', lineStyle: '3', textStyle: '3' },
        docColors,
        theme,
        mediaMap,
        shapeRels,
        masterById: indexed.byId
      };
      const innerSvg = VisioConverter._parseMasterShapeXml(rootShape, wPx, hPx, true, null, null, theme, ctx);
      if (!innerSvg) continue;

      const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx.toFixed(1)}" height="${hPx.toFixed(1)}" viewBox="0 0 ${wPx.toFixed(1)} ${hPx.toFixed(1)}">${innerSvg}</svg>`;
      const iconSvg = `<svg viewBox="0 0 ${wPx.toFixed(1)} ${hPx.toFixed(1)}" width="28" height="28">${innerSvg}</svg>`;

      shapes.push({
        id: 'vssx_' + mId + '_' + name.replace(/[^a-zA-Z0-9]/g, '_'),
        name,
        svg: svgXml,
        svgXml,
        iconSvg,
        width: Math.round(wIn * DPI),
        height: Math.round(hIn * DPI),
        connectionPoints: VisioConverter._parseConnectionPoints(rootShape, null, wIn * DPI, hIn * DPI)
      });
    }

    return { title: stencilTitle, shapes };
  }
}

if (typeof window !== 'undefined') window.VisioConverter = VisioConverter;
if (typeof module !== 'undefined' && module.exports) module.exports = VisioConverter;
