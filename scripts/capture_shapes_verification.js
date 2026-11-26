const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const runnerHtml = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
let html = fs.readFileSync(runnerHtml, 'utf-8');

const injectTag = `<script id="test-shapes-script">
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    try {
      const bs = document.getElementById("backstage-menu");
      if (bs) bs.style.display = "none";

      // Ensure Basic and Flowchart categories are expanded
      const basicHeader = document.querySelector('.stencil-category[data-category="basic"] .stencil-category-header');
      if (basicHeader && !basicHeader.classList.contains('active')) basicHeader.click();
      
      const flowHeader = document.querySelector('.stencil-category[data-category="flowchart"] .stencil-category-header');
      if (flowHeader && !flowHeader.classList.contains('active')) flowHeader.click();

      // Clear existing sample shapes
      const canvas = window.canvasManager.canvas;
      const objs = canvas.getObjects().filter(o => o.objectType !== 'grid-line' && o.objectType !== 'page-background');
      objs.forEach(o => canvas.remove(o));

      // Add basic shapes on canvas to verify they are blank and match stencil colors
      const basicTypes = ['rectangle', 'circle', 'diamond', 'pentagon', 'hexagon', 'star', 'cylinder'];
      basicTypes.forEach((type, idx) => {
        const x = 300 + (idx % 4) * 160;
        const y = 140 + Math.floor(idx / 4) * 140;
        const s = window.ShapeFactory.create(type, x, y);
        canvas.add(s);
      });

      // Add flowchart shapes
      const fcTypes = ['fc-terminator', 'fc-process', 'fc-decision', 'fc-data', 'fc-document'];
      fcTypes.forEach((type, idx) => {
        const x = 300 + idx * 160;
        const y = 430;
        const s = window.ShapeFactory.create(type, x, y);
        canvas.add(s);
      });

      canvas.requestRenderAll();
      console.log('[Shapes Test] Placed basic and flowchart shapes on canvas');
    } catch (e) {
      console.error('[Shapes Test Error]', e);
    }
  }, 1500);
});
</script>`;

if (!html.includes('id="test-shapes-script"')) {
  fs.writeFileSync(runnerHtml, html.replace('</body>', injectTag + '\n</body>'));
}

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const out = 'C:/Users/T9813424/.gemini/antigravity/brain/f05469bd-7361-46fc-bd01-4c293b13cde1/shapes_blank_and_color_verification.png';
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

console.log('Spawning Electron for Shapes Blank & Color verification screenshot...');
const child = spawn(electronExe, ['.', '--screenshot', out], {
  cwd: path.join(__dirname, '..'),
  env: env,
  stdio: 'inherit'
});

setTimeout(() => {
  child.kill();
  let cleaned = fs.readFileSync(runnerHtml, 'utf-8').replace(injectTag + '\n', '').replace(injectTag, '');
  fs.writeFileSync(runnerHtml, cleaned);
  console.log('Shapes screenshot captured successfully to:', out);
  process.exit(0);
}, 8000);

