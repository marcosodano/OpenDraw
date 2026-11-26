# Changelog

All notable changes to **OpenDraw** are documented in this file.

This project adheres to [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`) and follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
- **MAJOR**: Breaking file-format, architecture, or major generation shifts.
- **MINOR**: New backward-compatible features, tools, stencils, export options, or UI capabilities.
- **PATCH**: Bug fixes, visual polish, performance improvements, and compatibility refinements.

---

## [Unreleased]

### Added
- _Add upcoming features here before cutting the next release._

### Changed
- _Document behavior or UI updates here._

### Fixed
- _Document bug fixes here._

---

## [1.0.0] - 2026-11-26

### Added
- **Semantic Versioning & Release Pipeline:** Unified single-source version metadata (`package.json` + `src/shared/version.json`), live version badge in Backstage File sidebar, dynamic Credits/About details, in-app Release Notes modal, and automated `npm run release:*` bump/audit/packaging scripts.
- **Cohesive Brand System:** Full `OpenDraw` mark lockups, multi-resolution Dark/Light Windows `.ico`/`.png` application icons, and optically tuned Small Titlebar icons (`16px–32px`) reactive to Light, Dark, System (OS), and Office Colorful themes.
- **Standalone Portable Windows Executable:** Clean self-contained distribution build (`OpenDraw-1.0.0-portable.exe`) excluding local development files and private test diagrams.
- **Diagramming & Visio Compatibility Core:** High-precision Fabric vector engine supporting `.vsdx`, `.vsd`, `.vsdm`, `.vstx`, `.vst`, `.vssx`, `.vss`, and `.odraw`, multi-window file opening, orthogonal/straight/spline curved connectors, 1-click connector arrow toggles, pixel-snapped vector grid, inline comments, presentation mode, and PNG/SVG/PDF export.
