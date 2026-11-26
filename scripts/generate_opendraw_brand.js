const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'assets', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const scratchSheetPath = path.join(
  'C:', 'Users', 'T9813424', '.gemini', 'antigravity', 'brain',
  '0e942ece-c3e3-4edf-a6f2-0c73aa9ec864', 'scratch', 'brand_contact_sheet.png'
);
fs.mkdirSync(path.dirname(scratchSheetPath), { recursive: true });

/**
 * Shared OpenDraw Brand Palette (Brand Specification Panel 06)
 */
const BRAND_COLORS = {
  skyBlue: '#00C6FF',
  royalBlue: '#3A7BFF',
  purple: '#A855F7',
  pink: '#FF4DD2',
  coral: '#FF8A66',
  darkBg: '#0A0E17',
  lightBg: '#F8FAFF',
};

/**
 * Core parametric geometric paths inside a 256x256 normalized box.
 * variant: 'detailed' (48..1024px & UI lockups) | 'small' (16..32px icons & titlebar badge)
 * withTile: true if rendered over its own dark/light squircle background
 */
function buildMarkMarkup(idPrefix, mode = 'dark', variant = 'detailed', withTile = true) {
  const isLight = mode === 'light';
  const isSmall = variant === 'small';

  // Optical framing so the O + nib + ms balance centrally in both icon tiles and horizontal lockups
  const markTransform = isSmall
    ? 'translate(6, 12) scale(0.92)'
    : (withTile ? 'translate(22, 22) scale(0.82)' : 'translate(10, 12) scale(0.92)');

  const haloColor = isLight ? '#F8FAFF' : '#0A0E17';
  const haloWidth = isSmall ? '8' : '6';

  // Nib styling:
  // Dark: luminous icy-white -> soft lavender -> pink sheen (exact match to Panel 01)
  // Light: sleek soft-metallic lilac-periwinkle-indigo gradient (exact match to Panel 02 Light, no harsh border)
  const nibCapGrad = isLight
    ? `<linearGradient id="${idPrefix}_nibCap" x1="12%" y1="5%" x2="88%" y2="95%">
         <stop offset="0%" stop-color="#E0E7FF"/>
         <stop offset="48%" stop-color="#818CF8"/>
         <stop offset="100%" stop-color="#5B4DF0"/>
       </linearGradient>`
    : `<linearGradient id="${idPrefix}_nibCap" x1="15%" y1="5%" x2="85%" y2="95%">
         <stop offset="0%" stop-color="#FFFFFF"/>
         <stop offset="55%" stop-color="#EDE9FE"/>
         <stop offset="100%" stop-color="#D8B4FE"/>
       </linearGradient>`;

  const nibTipGrad = isLight
    ? `<linearGradient id="${idPrefix}_nibTip" x1="10%" y1="0%" x2="90%" y2="100%">
         <stop offset="0%" stop-color="#C7D2FE"/>
         <stop offset="52%" stop-color="#6366F1"/>
         <stop offset="100%" stop-color="#7C3AED"/>
       </linearGradient>`
    : `<linearGradient id="${idPrefix}_nibTip" x1="15%" y1="0%" x2="85%" y2="100%">
         <stop offset="0%" stop-color="#FFFFFF"/>
         <stop offset="58%" stop-color="#E9D5FF"/>
         <stop offset="100%" stop-color="#F5D0FE"/>
       </linearGradient>`;

  // Gradient sweep around the circular O crescent -> purple bottom (matches ms start seamlessly)
  const ringGrad = `<linearGradient id="${idPrefix}_ringGrad" x1="58%" y1="4%" x2="64%" y2="96%">
      <stop offset="0%" stop-color="${BRAND_COLORS.skyBlue}"/>
      <stop offset="36%" stop-color="${BRAND_COLORS.royalBlue}"/>
      <stop offset="82%" stop-color="${BRAND_COLORS.purple}"/>
      <stop offset="100%" stop-color="#C048F2"/>
    </linearGradient>`;

  // Seamless Purple -> Pink -> Coral transition along cursive ms tail
  const strokeGrad = `<linearGradient id="${idPrefix}_msGrad" x1="0%" y1="70%" x2="100%" y2="25%">
      <stop offset="0%" stop-color="#B24BF3"/>
      <stop offset="42%" stop-color="${BRAND_COLORS.pink}"/>
      <stop offset="100%" stop-color="${BRAND_COLORS.coral}"/>
    </linearGradient>`;

  // Subtle top highlight sheen on the cyan-blue O arc
  const sheenGrad = `<linearGradient id="${idPrefix}_sheen" x1="30%" y1="0%" x2="60%" y2="75%">
      <stop offset="0%" stop-color="#99F6FF" stop-opacity="${isLight ? '0.40' : '0.52'}"/>
      <stop offset="60%" stop-color="#3A7BFF" stop-opacity="0"/>
    </linearGradient>`;

  // Full circular 'O' crescent (tapers seamlessly at (128..134, 174..185) right into the 11.5px ms upstroke)
  const oPathDetailed = `
    M 176 74
    C 155 41, 106 32, 68 53
    C 31 74, 18 122, 38 159
    C 56 192, 95 200, 128 186
    C 134 183, 134 174, 126 174
    C 99 178, 72 162, 64 134
    C 56 105, 70 72, 99 62
    C 125 53, 150 61, 165 81
    C 170 87, 181 82, 176 74 Z
  `;

  // Optical Small 'O' crescent: noticeably bolder ring thickness + generous window for small 16-32px nib legibility
  const oPathSmall = `
    M 178 69
    C 154 32, 96 24, 55 49
    C 16 74, 8 129, 32 168
    C 54 202, 101 208, 136 186
    C 142 182, 139 169, 129 172
    C 101 180, 72 163, 66 132
    C 60 101, 76 72, 102 64
    C 127 56, 151 64, 165 82
    C 170 88, 183 77, 178 69 Z
  `;

  // Continuous flowing cursive 'm/n' + italicized calligraphic 's'
  const msDetailed = `
    <path d="M 125 181
             C 144 174, 156 150, 169 138
             C 175 133, 180 138, 176 149
             C 172 160, 168 167, 170 171
             C 171 174, 178 167, 186 157"
          fill="none" stroke="url(#${idPrefix}_msGrad)" stroke-width="11.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 210 144
             C 202 138, 189 144, 190 151
             C 191 158, 210 156, 210 166
             C 210 175, 192 181, 180 176"
          fill="none" stroke="url(#${idPrefix}_msGrad)" stroke-width="10.2" stroke-linecap="round" stroke-linejoin="round"/>
  `;

  // Optical Small bottom-right stroke: clean two-crest pink-coral wave matching Panel 03 Favicon
  const msSmall = `
    <path d="M 129 181
             C 148 174, 162 141, 178 139
             C 186 138, 182 160, 175 173
             C 186 170, 203 144, 214 148
             C 221 151, 208 184, 185 180"
          fill="none" stroke="url(#${idPrefix}_msGrad)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  `;

  // Sculpted Pen Nib cleanly poised in the upper-right O pocket (tip ends in negative space cleanly above bottom stroke)
  // Upper cap dome centered near ~(184, 78); sharp tip pointing down-left to (128, 138)
  const nibScale = isSmall ? 'translate(160, 108) scale(1.12) translate(-160, -108)' : '';

  const nibShapes = `
    <g transform="${nibScale}">
      <!-- Halo separator only around upper arc intersection -->
      ${withTile ? `
      <g stroke="${haloColor}" stroke-width="${haloWidth}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M 157 96 L 177 71 C 184 62, 198 69, 194 81 L 191 92 L 171 114 Z" fill="${haloColor}"/>
        <path d="M 151 104 L 166 118 L 135 140 C 129 144, 126 140, 130 133 Z" fill="${haloColor}"/>
      </g>` : ''}
      <!-- Pen Barrel / Cap -->
      <path d="M 157 96 L 177 71 C 184 62, 198 69, 194 81 L 191 92 L 171 114 Z"
            fill="url(#${idPrefix}_nibCap)"/>
      <!-- Crisp Diagonal Highlight Ridge on Cap -->
      <path d="M 180 73 C 184 69, 189 70, 190 73 L 169 102 L 162 96 Z"
            fill="#FFFFFF" opacity="${isLight ? '0.62' : '0.48'}"/>
      <!-- Faceted Tapered Pen Nib Tip (pointing clean into O negative space) -->
      <path d="M 151 104 L 166 118 L 135 140 C 129 144, 126 140, 130 133 Z"
            fill="url(#${idPrefix}_nibTip)"/>
      <!-- Center Split Hairline on Nib -->
      <line x1="158" y1="112" x2="134" y2="137"
            stroke="${isLight ? '#EDE9FE' : '#7E22CE'}" stroke-width="1.4" stroke-opacity="0.55" stroke-linecap="round"/>
    </g>
  `;

  return {
    defs: ringGrad + sheenGrad + strokeGrad + nibCapGrad + nibTipGrad,
    body: `
      <g transform="${markTransform}">
        <path d="${isSmall ? oPathSmall : oPathDetailed}" fill="url(#${idPrefix}_ringGrad)"/>
        ${!isSmall ? `<path d="${oPathDetailed}" fill="url(#${idPrefix}_sheen)"/>` : ''}
        ${isSmall ? msSmall : msDetailed}
        ${nibShapes}
      </g>
    `,
  };
}

/**
 * Generates an App Icon SVG (rounded squircle + coherent mark)
 */
function generateAppIconSvg(mode = 'dark', variant = 'detailed', size = 256) {
  const isLight = mode === 'light';
  const isSmall = variant === 'small';
  const id = `od_${mode}_${variant}`;
  const mark = buildMarkMarkup(id, mode, variant, true);

  const pad = isSmall ? 6 : 10;
  const box = 256 - pad * 2;
  const rx = isSmall ? 58 : 54;

  const bgDefs = isLight
    ? `<linearGradient id="${id}_bg" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#FFFFFF"/>
         <stop offset="100%" stop-color="#EDF2FF"/>
       </linearGradient>
       <linearGradient id="${id}_rim" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="#CBD5E1"/>
         <stop offset="100%" stop-color="#94A3B8"/>
       </linearGradient>`
    : `<radialGradient id="${id}_bg" cx="35%" cy="28%" r="78%">
         <stop offset="0%" stop-color="#141C2E"/>
         <stop offset="55%" stop-color="#0B101B"/>
         <stop offset="100%" stop-color="#070A11"/>
       </radialGradient>
       <linearGradient id="${id}_rim" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" stop-color="rgba(0, 198, 255, 0.36)"/>
         <stop offset="50%" stop-color="rgba(168, 85, 247, 0.25)"/>
         <stop offset="100%" stop-color="rgba(255, 138, 102, 0.32)"/>
       </linearGradient>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <defs>
    ${bgDefs}
    ${mark.defs}
    <clipPath id="${id}_clip">
      <rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${rx}"/>
    </clipPath>
  </defs>
  <rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${rx}" fill="url(#${id}_bg)"/>
  <g clip-path="url(#${id}_clip)">
    ${mark.body}
  </g>
  <rect x="${pad + 1}" y="${pad + 1}" width="${box - 2}" height="${box - 2}" rx="${rx - 1}"
        fill="none" stroke="url(#${id}_rim)" stroke-width="${isSmall ? 5 : 2.5}"/>
</svg>`;
}

/**
 * Horizontal Brand Lockup SVG (Pure floating emblem + OpenDraw + BY MARCO SODANO, matching Panel 03 Horizontal)
 */
function generateLogoLockupSvg(mode = 'dark') {
  const isLight = mode === 'light';
  const id = `od_lockup_${mode}`;
  const mark = buildMarkMarkup(id, mode, 'detailed', false);
  const titleColor = isLight ? '#0A0E17' : '#F8FAFF';
  const subColor = isLight ? '#475569' : '#94A3B8';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" width="640" height="160">
  <defs>
    ${mark.defs}
  </defs>
  <g transform="translate(8, 8) scale(0.5625)">
    ${mark.body}
  </g>
  <text x="168" y="88" font-family="'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
        font-weight="700" font-size="64" letter-spacing="-1.5" fill="${titleColor}">OpenDraw</text>
  <text x="172" y="122" font-family="'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
        font-weight="600" font-size="18.5" letter-spacing="6.8" fill="${subColor}">BY MARCO SODANO</text>
</svg>`;
}

/**
 * Pack PNG frames into Vista+ multi-resolution ICO binary
 */
function createMultiResIco(pngFrames) {
  const count = pngFrames.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + 16 * count;
  const entries = [];
  const dataChunks = [];

  for (const { size, buffer } of pngFrames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    dataChunks.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...dataChunks]);
}

async function run() {
  const svgs = {
    'opendraw-icon-dark.svg': generateAppIconSvg('dark', 'detailed', 256),
    'opendraw-icon-light.svg': generateAppIconSvg('light', 'detailed', 256),
    'opendraw-small-dark.svg': generateAppIconSvg('dark', 'small', 24),
    'opendraw-small-light.svg': generateAppIconSvg('light', 'small', 24),
    'opendraw-logo-dark.svg': generateLogoLockupSvg('dark'),
    'opendraw-logo-light.svg': generateLogoLockupSvg('light'),
  };

  for (const [name, content] of Object.entries(svgs)) {
    fs.writeFileSync(path.join(iconsDir, name), content, 'utf8');
  }

  const electronExe = path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe');
  const tempScript = path.join(__dirname, '_render_brand_tmp.js');
  const tempOutJson = path.join(__dirname, '_render_brand_out.json');

  const smallSizes = [16, 20, 24, 32];
  const detailedSizes = [48, 64, 128, 256, 512];

  const renderHtml = `<!DOCTYPE html><html><body style="margin:0;background:transparent;">
  <script>
    window.renderSvgPng = (svgText, w, h) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png').split(',')[1]);
      };
      img.onerror = (e) => reject(e);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    });

    window.renderSheet = (payload) => new Promise(async (resolve) => {
      const W = 1260, H = 740;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');

      ctx.fillStyle = '#0A0E17';
      ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = '#F8FAFF';
      ctx.fillRect(W / 2, 0, W / 2, H);

      ctx.fillStyle = '#334155';
      ctx.fillRect(W / 2 - 1, 0, 2, H);

      const drawDataImg = (b64, x, y, w, h) => new Promise((res) => {
        const i = new Image();
        i.onload = () => { ctx.drawImage(i, x, y, w, h); res(); };
        i.src = 'data:image/png;base64,' + b64;
      });

      const drawLabel = (txt, x, y, color) => {
        ctx.fillStyle = color;
        ctx.font = '600 14px "Segoe UI", sans-serif';
        ctx.fillText(txt, x, y);
      };

      drawLabel('DARK THEME SUITE', 32, 34, '#94A3B8');
      drawLabel('LIGHT THEME SUITE', W / 2 + 32, 34, '#475569');

      await drawDataImg(payload.dark['256'], 40, 56, 200, 200);
      drawLabel('App Icon (256px)', 40, 276, '#E2E8F0');
      await drawDataImg(payload.light['256'], W / 2 + 40, 56, 200, 200);
      drawLabel('App Icon (256px)', W / 2 + 40, 276, '#0F172A');

      ctx.imageSmoothingEnabled = false;
      await drawDataImg(payload.dark['32'], 280, 72, 64, 64);
      await drawDataImg(payload.dark['16'], 368, 88, 48, 48);
      ctx.imageSmoothingEnabled = true;
      await drawDataImg(payload.dark['32'], 280, 175, 32, 32);
      await drawDataImg(payload.dark['24'], 324, 179, 24, 24);
      await drawDataImg(payload.dark['16'], 360, 183, 16, 16);
      drawLabel('Small: 32px / 16px (zoomed + 1:1)', 280, 232, '#94A3B8');

      ctx.imageSmoothingEnabled = false;
      await drawDataImg(payload.light['32'], W / 2 + 280, 72, 64, 64);
      await drawDataImg(payload.light['16'], W / 2 + 368, 88, 48, 48);
      ctx.imageSmoothingEnabled = true;
      await drawDataImg(payload.light['32'], W / 2 + 280, 175, 32, 32);
      await drawDataImg(payload.light['24'], W / 2 + 324, 179, 24, 24);
      await drawDataImg(payload.light['16'], W / 2 + 360, 183, 16, 16);
      drawLabel('Small: 32px / 16px (zoomed + 1:1)', W / 2 + 280, 232, '#475569');

      await drawDataImg(payload.lockupDark, 32, 325, 560, 140);
      drawLabel('Horizontal Lockup (Dark)', 32, 485, '#94A3B8');
      await drawDataImg(payload.lockupLight, W / 2 + 32, 325, 560, 140);
      drawLabel('Horizontal Lockup (Light)', W / 2 + 32, 485, '#475569');

      ctx.fillStyle = '#2B2B2B';
      ctx.fillRect(32, 528, 560, 38);
      await drawDataImg(payload.dark['24'], 44, 535, 24, 24);
      drawLabel('Drawing1 - OpenDraw by Marco Sodano', 190, 552, '#FFFFFF');
      drawLabel('Simulated Titlebar Small Icon (Dark)', 32, 588, '#94A3B8');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(W / 2 + 32, 528, 560, 38);
      ctx.strokeStyle = '#D6D6D6';
      ctx.strokeRect(W / 2 + 32, 528, 560, 38);
      await drawDataImg(payload.light['24'], W / 2 + 44, 535, 24, 24);
      drawLabel('Drawing1 - OpenDraw by Marco Sodano', W / 2 + 190, 552, '#1F1F1F');
      drawLabel('Simulated Titlebar Small Icon (Light)', W / 2 + 32, 588, '#475569');

      ctx.fillStyle = '#2B579A';
      ctx.fillRect(32, 622, 560, 38);
      await drawDataImg(payload.dark['24'], 44, 629, 24, 24);
      drawLabel('Office Colorful Titlebar (uses Dark Small Icon)', 92, 646, '#FFFFFF');

      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(W / 2 + 32, 622, 560, 38);
      await drawDataImg(payload.light['24'], W / 2 + 44, 629, 24, 24);
      drawLabel('Explorer / Light Chrome (uses Light Small Icon)', W / 2 + 92, 646, '#0F172A');

      resolve(c.toDataURL('image/png').split(',')[1]);
    });
  </script></body></html>`;

  const electronWorker = `
    const { app, BrowserWindow } = require('electron');
    const fs = require('fs');
    app.whenReady().then(async () => {
      const win = new BrowserWindow({
        width: 1280, height: 800, show: false,
        webPreferences: { offscreen: true }
      });
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(${JSON.stringify(renderHtml)}));
      const svgs = ${JSON.stringify(svgs)};
      const smallSizes = ${JSON.stringify(smallSizes)};
      const detailedSizes = ${JSON.stringify(detailedSizes)};
      const out = { dark: {}, light: {} };

      for (const mode of ['dark', 'light']) {
        const smallSvg = svgs['opendraw-small-' + mode + '.svg'];
        const detSvg = svgs['opendraw-icon-' + mode + '.svg'];
        for (const sz of smallSizes) {
          out[mode][sz] = await win.webContents.executeJavaScript('window.renderSvgPng(' + JSON.stringify(smallSvg) + ',' + sz + ',' + sz + ')');
        }
        for (const sz of detailedSizes) {
          out[mode][sz] = await win.webContents.executeJavaScript('window.renderSvgPng(' + JSON.stringify(detSvg) + ',' + sz + ',' + sz + ')');
        }
      }
      out.lockupDark = await win.webContents.executeJavaScript('window.renderSvgPng(' + JSON.stringify(svgs['opendraw-logo-dark.svg']) + ', 640, 160)');
      out.lockupLight = await win.webContents.executeJavaScript('window.renderSvgPng(' + JSON.stringify(svgs['opendraw-logo-light.svg']) + ', 640, 160)');
      out.contactSheet = await win.webContents.executeJavaScript('window.renderSheet(' + JSON.stringify(out) + ')');

      fs.writeFileSync(${JSON.stringify(tempOutJson)}, JSON.stringify(out), 'utf8');
      app.quit();
    });
  `;

  fs.writeFileSync(tempScript, electronWorker, 'utf8');
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;

  await new Promise((resolve, reject) => {
    const child = spawn(electronExe, [tempScript], { env, stdio: 'inherit' });
    child.on('exit', (code) => {
      try { fs.unlinkSync(tempScript); } catch (_) {}
      if (code === 0) resolve();
      else reject(new Error('Electron brand renderer exited with code ' + code));
    });
  });

  const rendered = JSON.parse(fs.readFileSync(tempOutJson, 'utf8'));
  try { fs.unlinkSync(tempOutJson); } catch (_) {}

  fs.writeFileSync(scratchSheetPath, Buffer.from(rendered.contactSheet, 'base64'));
  console.log('Saved contact sheet at:', scratchSheetPath);

  const icoSizes = [256, 128, 64, 48, 32, 24, 16];
  for (const mode of ['dark', 'light']) {
    for (const sz of [16, 24, 32, 256, 512]) {
      fs.writeFileSync(
        path.join(iconsDir, `opendraw-${mode}-${sz}.png`),
        Buffer.from(rendered[mode][String(sz)], 'base64')
      );
    }
    const icoFrames = icoSizes.map((sz) => ({
      size: sz,
      buffer: Buffer.from(rendered[mode][String(sz)], 'base64'),
    }));
    const icoBuf = createMultiResIco(icoFrames);
    fs.writeFileSync(path.join(iconsDir, `opendraw_${mode}.ico`), icoBuf);
  }

  fs.copyFileSync(path.join(iconsDir, 'opendraw-dark-256.png'), path.join(iconsDir, 'icon.png'));
  fs.copyFileSync(path.join(iconsDir, 'opendraw_dark.ico'), path.join(iconsDir, 'icon.ico'));

  console.log('Generated PNG & Multi-Res ICO brand files in:', iconsDir);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
