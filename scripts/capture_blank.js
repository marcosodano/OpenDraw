const { spawn } = require('child_process');
const path = require('path');

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const outScreenshot = 'C:/Users/T9813424/.gemini/antigravity/brain/f05469bd-7361-46fc-bd01-4c293b13cde1/scratch/blank_launch_screenshot.png';

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronExe, ['.', '--screenshot', outScreenshot], {
  cwd: path.join(__dirname, '..'),
  env: env,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  console.log('Exited:', code);
});

