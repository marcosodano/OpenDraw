const { spawn } = require('child_process');
const path = require('path');

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const targetVsdx = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
const outScreenshot = 'C:/Users/T9813424/.gemini/antigravity/brain/f05469bd-7361-46fc-bd01-4c293b13cde1/current_screenshot.png';

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

console.log('Spawning Electron with exact arguments:');
console.log('Target:', targetVsdx);
console.log('Output:', outScreenshot);

const child = spawn(electronExe, ['.', targetVsdx, '--screenshot', outScreenshot], {
  cwd: path.join(__dirname, '..'),
  env: env,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  console.log('Electron process exited with code:', code);
  process.exit(code || 0);
});

