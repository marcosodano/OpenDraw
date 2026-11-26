# OpenDraw — Change Tracking & Release Workflow Guide

A concise, repeatable workflow for tracking future changes, versioning **OpenDraw**, verifying privacy hygiene, and building clean portable releases.

---

## 1. Semantic Versioning Rules (`MAJOR.MINOR.PATCH`)

- **`PATCH` (`1.0.0` → `1.0.1`)**: Bug fixes, rendering corrections, connector edge-case fixes, UI polish (no new major features or breaking changes).
- **`MINOR` (`1.0.0` → `1.1.0`)**: New user-facing capabilities (e.g., new export format, new shape library, new alignment tool) that preserve existing `.odraw` / `.vsdx` compatibility.
- **`MAJOR` (`1.0.0` → `2.0.0`)**: Redesigns, breaking `.odraw` schema changes, or Electron/engine overhaul.

The canonical version number lives in **`package.json`**, mirrored with build date and curated app release notes in **`src/shared/version.json`**. Both the Electron main process (`app.getVersion()`) and the renderer UI read from these automatically—never hardcode version strings manually in HTML/JS.

---

## 2. Recommended Methods to Track Future Changes

### Method A: Changelog-Driven Tracking (`CHANGELOG.md` `[Unreleased]`) — Simplest Daily Habit
1. As you fix bugs or add features, jot one bullet under `## [Unreleased]` in `CHANGELOG.md` under `Added`, `Changed`, or `Fixed`.
2. When ready to publish:
   ```powershell
   npm run release:patch
   ```
   This automatically promotes everything under `[Unreleased]` into a dated release header (`## [1.0.1] - YYYY-MM-DD`), syncs `src/shared/version.json`, runs the privacy check, and prepares a fresh changelog template.

### Method B: Git + Conventional Commits + Release Tags (Best Practice — Git `2.56` is already installed)
1. Initialize version control once inside the OpenDraw root (clean `.gitignore` is already included so `node_modules/`, `Tests/`, `dist/`, and local backups are never committed):
   ```powershell
   git init
   git branch -M main
   git config user.name "Marco Sodano"
   git config user.email "noreply@users.noreply.github.com"   # keep personal/work email private!
   ```
2. Work using small structured commits:
   - `feat: add Swimlane container support` → triggers **MINOR** bump
   - `fix: keep arrow alignment when rotating shapes` → triggers **PATCH** bump
   - `refactor:` / `style:` / `perf:` / `docs:`
3. Tag each verified release (`git tag -a v1.0.1 -m "Release 1.0.1"`) and optionally push to a private GitHub/GitLab repository so you have full commit diff history, rollback points, and downloadable GitHub Releases.

### Method C: Pre-Release Quality Gate & Build Manifest
Before distributing any portable `.exe` externally:
1. Run `npm run test:visio` (plus visual spot checks).
2. Run `npm run release:patch -- --note "Short summary" --build` (or run `npm run build:portable`).
3. Verify the privacy audit passes (`0` PC usernames, company names, local paths, or `Tests/` diagrams inside `app.asar`).
4. Distribute **only** `dist/OpenDraw-X.Y.Z-portable.exe` (and optionally `dist/OpenDraw-X.Y.Z-portable.exe.sha256` for integrity verification).

---

## 3. Useful Commands Reference

| Command | Purpose |
| :--- | :--- |
| `npm run version:check` | Verify `package.json`, `package-lock.json`, `version.json`, and `CHANGELOG.md` match |
| `npm run release:patch` | Bump `PATCH` (`1.0.0 → 1.0.1`), rotate `CHANGELOG.md`, stamp `version.json`, audit privacy |
| `npm run release:minor` | Bump `MINOR` (`1.0.0 → 1.1.0`), rotate `CHANGELOG.md`, stamp `version.json`, audit privacy |
| `npm run release:major` | Bump `MAJOR` (`1.0.0 → 2.0.0`), rotate `CHANGELOG.md`, stamp `version.json`, audit privacy |
| `npm run release:patch -- --build` | Bump version + immediately compile portable `.exe` |
| `npm run privacy:audit` | Scan `src/`, `assets/`, `package.json`, and `dist/` for personal/work leaks |
| `npm run build:portable` | Run privacy pre-check, compile `dist/OpenDraw-X.Y.Z-portable.exe`, audit ASAR, write `.sha256` |
