const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const runnerHtml = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
let html = fs.readFileSync(runnerHtml, 'utf-8');
const injectTag = '<script id="test-design-script">window.addEventListener("DOMContentLoaded", () => { setTimeout(() => { const bs = document.getElementById("backstage-menu"); if (bs) bs.style.display = "none"; const dt = document.querySelector(\'[data-tab="design"]\'); if (dt) dt.click(); }, 1200); });</script>';

if (!html.includes('id="test-design-script"')) {
  fs.writeFileSync(runnerHtml, html.replace('</body>', injectTag + '\n</body>'));
}

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const out = 'C:/Users/T9813424/.gemini/antigravity/brain/f05469bd-7361-46fc-bd01-4c293b13cde1/scratch/design_tab_verification.png';
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

console.log('Spawning Electron for Design tab screenshot...');
const child = spawn(electronExe, ['.', '--screenshot', out], {
  cwd: path.join(__dirname, '..'),
  env: env,
  stdio: 'inherit'
});

setTimeout(() => {
  child.kill();
  let cleaned = fs.readFileSync(runnerHtml, 'utf-8').replace(injectTag + '\n', '').replace(injectTag, '');
  fs.writeFileSync(runnerHtml, cleaned);
  console.log('Screenshot script done.');
  process.exit(0);
}, 8000);

