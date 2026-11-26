# OpenDraw

**OpenDraw** is a lightweight, high-precision vector diagramming workstation by **Marco Sodano**, built with Electron and Fabric.js. It supports native `.odraw` diagrams as well as Microsoft Visio files (`.vsdx`, `.vsd`, `.vssx`, `.vss`, and templates) in a fast, distraction-free desktop app.

---

## Download (Portable Edition)

OpenDraw is distributed as a **single portable Windows executable** — no classic installer, no admin privileges, and no registry clutter.

1. Go to the [**Releases page**](https://github.com/marcosodano/OpenDraw/releases/latest).
2. Download **`OpenDraw-1.0.0-portable.exe`** (or the latest `OpenDraw-X.Y.Z-portable.exe`).
3. Double-click the `.exe` to launch immediately from any folder or USB drive.

### Optional Integrity Check (PowerShell)
Each release includes a `.sha256` checksum file. To verify your download:
```powershell
Get-FileHash .\OpenDraw-1.0.0-portable.exe -Algorithm SHA256
```
Compare the output hash with the contents of `OpenDraw-1.0.0-portable.exe.sha256`.

---

## Key Features

- **Visio & Native File Support:** Open `.vsdx`, `.vsdm`, `.vstx`, `.vstm`, `.vssx`, `.vssm`, `.vsd`, `.vst`, `.vss`, and `.odraw` files, with multi-window support.
- **Smart Connectors:** Straight, orthogonal, and smooth spline curved connectors with 1-click arrow toggles, snap handles, and dynamic routing.
- **Precision Canvas:** Pixel-snapped vector grid, rulers, alignment guides, layers, multi-page tabs, and auto-layout tools.
- **Rich Editing & Review:** Inline text editing, inline comments, Find & Replace, Copy/Paste Style, and **Presentation Mode** (`F5`).
- **Adaptive Themes:** Light, Dark, System (OS), and Office Colorful themes.
- **Flexible Export:** Export diagrams to **PNG**, **SVG**, and **PDF**.

---

## Tips & Keyboard Shortcuts

Press **`F1`** inside OpenDraw at any time to open the built-in Shortcuts Reference.

### Tools & Navigation
| Shortcut | Action |
| :--- | :--- |
| `V` or `Ctrl+1` | Pointer / Select tool |
| `T` or `Ctrl+2` | Text Box tool |
| `Ctrl+3` | Connector tool |
| `H` or `Ctrl+Shift+W` | Pan canvas tool |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Zoom In / Zoom Out / Zoom 100% |
| `Ctrl+Shift+F` | Zoom to Fit diagram |
| `F5` | Toggle Presentation Mode (`Esc` to exit) |

### Editing & Formatting
| Shortcut | Action |
| :--- | :--- |
| `F2` | Edit text inside selected shape |
| `Ctrl+D` | Duplicate selected object(s) |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | Copy Style / Paste Style across shapes |
| `Ctrl+G` / `Ctrl+Shift+G` | Group / Ungroup selection |
| `Ctrl+]` / `Ctrl+[` | Bring Forward / Send Backward |
| `Ctrl+Shift+]` / `Ctrl+Shift+[` | Bring to Front / Send to Back |
| `Arrow` / `Shift+Arrow` | Nudge selection by 1 px / 10 px |
| `Ctrl+F` | Find & Replace text |
| `Ctrl+K` | Insert link |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |

### Quick Usage Tips
- **Style Reuse:** Format one shape the way you like, press `Ctrl+Shift+C`, select other shapes, and press `Ctrl+Shift+V` to apply the exact styling instantly.
- **Fine Positioning:** Hold `Shift` with arrow keys to nudge shapes in 10 px steps, or use single arrow presses for 1 px precision.
- **Clean Presenting:** Hit `F5` to hide toolbars and panels for full-screen diagram walkthroughs; press `Esc` to return to editing.

---

## Branching & Release Workflow

This repository is set up for clean, traceable future development (see [`RELEASE_GUIDE.md`](RELEASE_GUIDE.md) and [`CHANGELOG.md`](CHANGELOG.md)):

- **`main`**: Always holds the latest verified release state, tagged as `vX.Y.Z` (starting at `v1.0.0`).
- **Feature & Fix Branches**: Create a branch for any new work using conventional prefixes:
  ```powershell
  git checkout -b feat/your-feature-name
  # or
  git checkout -b fix/your-bugfix-name
  ```
- **Commit Convention**: Use `feat:` (triggers a minor bump), `fix:` (triggers a patch bump), `docs:`, `refactor:`, etc.
- **Changelog & Cutting a Release**:
  1. Document ongoing changes under `## [Unreleased]` in `CHANGELOG.md`.
  2. When ready to release on `main`, run:
     ```powershell
     npm run release:patch -- --build   # 1.0.0 -> 1.0.1 + portable .exe
     # or release:minor / release:major
     ```
  3. Commit and tag the release:
     ```powershell
     git add -A
     git commit -m "chore(release): v1.0.1"
     git tag -a v1.0.1 -m "Release 1.0.1"
     git push origin main --tags
     ```

---

## License

[MIT](package.json) — Copyright © 2026 Marco Sodano
