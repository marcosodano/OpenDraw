const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const lockPath = path.join(rootDir, 'package-lock.json');
const verJsonPath = path.join(rootDir, 'src', 'shared', 'version.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

function parseSemVer(v) {
  const m = String(v || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/);
  if (!m) throw new Error(`Invalid SemVer string: "${v}"`);
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function nextBuildNumber(prevBuild, dateIso) {
  const dayKey = dateIso.replace(/-/g, '');
  const m = String(prevBuild || '').match(/^(\d{8})\.(\d+)$/);
  if (m && m[1] === dayKey) {
    return `${dayKey}.${parseInt(m[2], 10) + 1}`;
  }
  return `${dayKey}.1`;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function checkConsistency() {
  const pkg = readJson(pkgPath);
  const ver = readJson(verJsonPath);
  const lock = fs.existsSync(lockPath) ? readJson(lockPath) : null;
  const changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';

  parseSemVer(pkg.version);
  const mismatches = [];
  if (ver.version !== pkg.version) mismatches.push(`src/shared/version.json (${ver.version}) != package.json (${pkg.version})`);
  if (lock && lock.version !== pkg.version) mismatches.push(`package-lock.json (${lock.version}) != package.json (${pkg.version})`);
  if (lock && lock.packages && lock.packages[''] && lock.packages[''].version !== pkg.version) {
    mismatches.push(`package-lock.json root package (${lock.packages[''].version}) != package.json (${pkg.version})`);
  }
  const clRegex = new RegExp(`^## \\[${pkg.version.replace(/\./g, '\\.')}\\]`, 'm');
  if (!clRegex.test(changelog)) {
    mismatches.push(`CHANGELOG.md missing heading for [${pkg.version}]`);
  }

  if (mismatches.length > 0) {
    console.error('[version:check] Mismatches found:');
    mismatches.forEach((m) => console.error('  - ' + m));
    process.exit(1);
  }
  console.log(`[version:check] OK — OpenDraw v${pkg.version} (Build ${ver.build}, ${ver.releaseDate}) is consistent across all manifests.`);
}

function extractBulletsFromSection(sectionText) {
  const bullets = [];
  for (const line of sectionText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && !/^-\s*_.*_$/.test(trimmed)) {
      bullets.push(trimmed.slice(2).replace(/\*\*/g, '').trim());
    }
  }
  return bullets;
}

function bumpVersion(kind, noteText, shouldBuild) {
  const pkg = readJson(pkgPath);
  const ver = readJson(verJsonPath);
  const sv = parseSemVer(pkg.version);

  if (kind === 'major') { sv.major += 1; sv.minor = 0; sv.patch = 0; }
  else if (kind === 'minor') { sv.minor += 1; sv.patch = 0; }
  else if (kind === 'patch') { sv.patch += 1; }
  else throw new Error(`Unknown bump kind: ${kind} (use patch|minor|major)`);

  const newVersion = `${sv.major}.${sv.minor}.${sv.patch}`;
  const dateIso = todayIsoDate();
  const buildId = nextBuildNumber(ver.build, dateIso);

  // 1. Update package.json & package-lock.json
  pkg.version = newVersion;
  writeJson(pkgPath, pkg);
  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath);
    lock.version = newVersion;
    if (lock.packages && lock.packages['']) lock.packages[''].version = newVersion;
    writeJson(lockPath, lock);
  }

  // 2. Rotate CHANGELOG.md [Unreleased] -> [newVersion]
  let releaseNotes = noteText ? [noteText.trim()] : [];
  if (fs.existsSync(changelogPath)) {
    const raw = fs.readFileSync(changelogPath, 'utf8');
    const unrelMatch = raw.match(/(## \[Unreleased\]\s*\r?\n)([\s\S]*?)(\r?\n---\r?\n|\r?\n## \[)/);
    if (unrelMatch) {
      const capturedBody = unrelMatch[2].trim();
      const extracted = extractBulletsFromSection(capturedBody);
      if (releaseNotes.length === 0 && extracted.length > 0) {
        releaseNotes = extracted.slice(0, 6);
      }
      const newSectionBody = noteText
        ? `### Fixed\n- ${noteText.trim()}`
        : (extracted.length > 0 ? capturedBody : `### Changed\n- Maintenance and stability release v${newVersion}.`);

      const freshUnreleased = [
        '## [Unreleased]',
        '',
        '### Added',
        '- _Add upcoming features here before cutting the next release._',
        '',
        '### Changed',
        '- _Document behavior or UI updates here._',
        '',
        '### Fixed',
        '- _Document bug fixes here._',
        '',
        '---',
        '',
        `## [${newVersion}] - ${dateIso}`,
        '',
        newSectionBody,
        ''
      ].join('\n');

      const separator = unrelMatch[3];
      const before = raw.slice(0, unrelMatch.index);
      const after = raw.slice(unrelMatch.index + unrelMatch[0].length);
      const updatedChangelog = before + freshUnreleased + (separator.startsWith('\n## [') || separator.startsWith('\r\n## [') ? '\n## [' : '') + after;
      fs.writeFileSync(changelogPath, updatedChangelog.replace(/\n{3,}/g, '\n\n'), 'utf8');
    }
  }

  if (releaseNotes.length === 0) {
    releaseNotes = [`Release v${newVersion} maintenance and reliability updates.`];
  }

  // 3. Update src/shared/version.json
  ver.version = newVersion;
  ver.build = buildId;
  ver.releaseDate = dateIso;
  ver.releaseNotes = releaseNotes;
  writeJson(verJsonPath, ver);

  console.log(`[release] Bumped OpenDraw -> v${newVersion} (Build ${buildId}, ${dateIso})`);

  // 4. Privacy audit
  execSync(`node "${path.join(__dirname, 'audit_privacy.js')}"`, { stdio: 'inherit', cwd: rootDir });

  // 5. Optional portable build
  if (shouldBuild) {
    execSync('npm run build:portable', { stdio: 'inherit', cwd: rootDir });
  }
}

const args = process.argv.slice(2);
const cmd = args[0] || 'check';
if (cmd === 'check') {
  checkConsistency();
} else if (cmd === 'bump') {
  const kind = args[1] || 'patch';
  const noteIdx = args.indexOf('--note');
  const note = (noteIdx >= 0 && args[noteIdx + 1]) ? args[noteIdx + 1] : '';
  const shouldBuild = args.includes('--build');
  bumpVersion(kind, note, shouldBuild);
} else {
  console.error('Usage: node scripts/release.js [check | bump <patch|minor|major> [--note "..."] [--build]]');
  process.exit(1);
}
