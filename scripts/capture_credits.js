const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const runnerHtml = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
let html = fs.readFileSync(runnerHtml, 'utf-8');
const injectTag = '<script id="test-credits-script">window.addEventListener("DOMContentLoaded", () => { setTimeout(() => { const tc = document.getElementById("backstage-tab-credits"); if (tc) tc.click(); }, 1200); });</script>';

if (!html.includes('id="test-credits-script"')) {
  fs.writeFileSync(runnerHtml, html.replace('</body>', injectTag + '\n</body>'));
}

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const out = 'C:/Users/T9813424/.gemini/antigravity/brain/f05469bd-7361-46fc-bd01-4c293b13cde1/opendraw_credits_verification.png';
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

console.log('Spawning Electron for Credits view screenshot...');
const child = spawn(electronExe, ['.', '--screenshot', out], {
  cwd: path.join(__dirname, '..'),
  env: env,
  stdio: 'inherit'
});

setTimeout(() => {
  child.kill();
  let cleaned = fs.readFileSync(runnerHtml, 'utf-8').replace(injectTag + '\n', '').replace(injectTag, '');
  fs.writeFileSync(runnerHtml, cleaned);
  console.log('Credits screenshot script done.');
  process.exit(0);
}, 8000);

