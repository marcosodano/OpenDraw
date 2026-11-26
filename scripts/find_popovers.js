const fs = require('fs');
const content = fs.readFileSync('src/renderer/core/ToolbarController.js', 'utf8');

const regexes = [
  /document\.(?:getElementById|querySelector(?:All)?)\(['"]([^'"]+)['"]\)/g,
  /className\s*=\s*['"]([^'"]+)['"]/g,
  /classList\.add\(['"]([^'"]+)['"]\)/g
];

const results = new Set();
for (const re of regexes) {
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1].includes('pop') || m[1].includes('menu') || m[1].includes('dropdown')) {
      results.add(m[1]);
    }
  }
}
console.log('Matches:', Array.from(results));

