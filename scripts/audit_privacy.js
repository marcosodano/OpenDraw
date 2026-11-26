const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const checkDist = args.includes('--dist');

// Forbidden patterns that must NEVER appear inside runtime app code, assets, metadata, or portable ASAR
const FORBIDDEN_PATTERNS = [
  { name: 'Windows username', regex: /T9813424/i },
  { name: 'Company identifier', regex: /Hitachi/i },
  { name: 'OneDrive path', regex: /OneDrive/i },
  { name: 'Project code P2428', regex: /P2428/i },
  { name: 'Internal project DCP2', regex: /\bDCP2\b/i },
  { name: 'Internal diagram BMIS/ICMS/HSR', regex: /BMIS\s*_|Etihad_Stations|HSR_OFN|ICMS_Architecture|MSN\s*-\s*(Overall|Depot|OCC|Online|OTDR|Redundancy|Regenerator|Station|Trackside)|MSN_Single_Line/i },
  { name: 'Local Windows user directory', regex: /C:\\Users\\|\/Users\//i },
  { name: 'AppData path reference', regex: /\\AppData\\|\/AppData\//i },
];

const FORBIDDEN_ASAR_FILES = [
  /^tests\//i,
  /^scripts\//i,
  /^0 - old\//i,
  /^status\.md$/i,
  /^changelog\.md$/i,
  /^release_guide\.md$/i,
  /\.vsdx$/i,
  /\.vss$/i,
  /\.vssx$/i,
  /\.vbs$/i,
  /\.bat$/i,
  /debug_.*\.txt$/i,
  /test_runner_injector\.js$/i,
];

const TEXT_EXTS = new Set(['.js', '.json', '.html', '.css', '.svg', '.txt', '.yml', '.yaml']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function scanBuffer(label, buf, findings) {
  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.regex.test(line)) {
        findings.push(`${label}:${i + 1} [${rule.name}] -> ${line.trim().slice(0, 120)}`);
      }
    }
  }
}

/**
 * Parse ASAR pickle/JSON header + inspect file list and non-node_modules payloads cleanly.
 */
function inspectAsar(asarPath, findings) {
  const buf = fs.readFileSync(asarPath);
  if (buf.length < 16) {
    findings.push(`Invalid ASAR file size: ${asarPath}`);
    return { fileCount: 0, appFiles: [] };
  }
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.subarray(16, 16 + jsonLen).toString('utf8').replace(/\0+$/, '');
  const headerObj = JSON.parse(jsonStr);
  const headerSize = 8 + buf.readUInt32LE(4);

  const entries = [];
  function collect(node, prefix) {
    if (!node || !node.files) return;
    for (const [name, child] of Object.entries(node.files)) {
      const rel = prefix ? `${prefix}/${name}` : name;
      if (child.files) {
        collect(child, rel);
      } else {
        entries.push({
          rel,
          size: child.size || 0,
          offset: child.offset ? parseInt(child.offset, 10) : -1,
          unpacked: !!child.unpacked,
        });
      }
    }
  }
  collect(headerObj, '');

  for (const ent of entries) {
    for (const pat of FORBIDDEN_ASAR_FILES) {
      if (pat.test(ent.rel)) {
        findings.push(`app.asar forbidden file bundled: ${ent.rel}`);
      }
    }
    // Deep scan bundled app files (skip third-party node_modules libs)
    if (!ent.rel.startsWith('node_modules/') && !ent.unpacked && ent.offset >= 0) {
      const ext = path.extname(ent.rel).toLowerCase();
      if (TEXT_EXTS.has(ext)) {
        const start = headerSize + ent.offset;
        const slice = buf.subarray(start, start + ent.size);
        scanBuffer(`app.asar/${ent.rel}`, slice, findings);
      }
    }
  }

  return { fileCount: entries.length, appFiles: entries.filter(e => !e.rel.startsWith('node_modules/')).map(e => e.rel) };
}

function main() {
  const findings = [];

  // 1. Source & assets & package.json scan
  const scanRoots = [
    ...walk(path.join(rootDir, 'src')),
    ...walk(path.join(rootDir, 'assets')),
    path.join(rootDir, 'package.json'),
  ];
  for (const f of scanRoots) {
    if (!fs.existsSync(f)) continue;
    const ext = path.extname(f).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    scanBuffer(rel, fs.readFileSync(f), findings);
  }

  // 2. Portable build artifact & ASAR audit when --dist is passed
  if (checkDist) {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const distDir = path.join(rootDir, 'dist');
    const asarPath = path.join(distDir, 'win-unpacked', 'resources', 'app.asar');
    const portableExe = path.join(distDir, `OpenDraw-${pkg.version}-portable.exe`);

    if (!fs.existsSync(asarPath)) {
      findings.push(`Missing ASAR bundle: ${asarPath}`);
    } else {
      const { fileCount, appFiles } = inspectAsar(asarPath, findings);
      console.log(`[privacy-audit] Audited app.asar (${fileCount} total entries, ${appFiles.length} app files):`);
      console.log(`  App files sample: ${appFiles.slice(0, 12).join(', ')}${appFiles.length > 12 ? ' ...' : ''}`);
    }

    if (!fs.existsSync(portableExe)) {
      findings.push(`Missing portable executable: ${portableExe}`);
    } else {
      const exeBuf = fs.readFileSync(portableExe);
      const sha256 = crypto.createHash('sha256').update(exeBuf).digest('hex');
      const shaFile = `${portableExe}.sha256`;
      fs.writeFileSync(shaFile, `${sha256} *${path.basename(portableExe)}\n`, 'utf8');
      const sizeMb = (exeBuf.length / (1024 * 1024)).toFixed(2);
      console.log(`[privacy-audit] Portable EXE ready: ${path.basename(portableExe)} (${sizeMb} MB)`);
      console.log(`[privacy-audit] SHA-256: ${sha256}`);
    }
  }

  if (findings.length > 0) {
    console.error('[privacy-audit] FAILED with personal/work data leaks or packaging issues:');
    for (const f of findings) console.error('  - ' + f);
    process.exit(1);
  }

  console.log(`[privacy-audit] PASSED (0 personal, corporate, local-path, or test leaks detected${checkDist ? ', dist verified' : ''}).`);
}

main();
