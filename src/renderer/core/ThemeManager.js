/**
 * ThemeManager — UI Theme & Diagram Palette Controller for OpenDraw.
 * 
 * Features:
 * - Application UI Themes (Office Light, Dark Mode, Modern Emerald, Classic Purple)
 * - Diagram Color Palettes for cohesive Visio-style shape styling
 * - Theme persistence via localStorage
 */

class ThemeManager {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.canvas;

    this.uiThemes = {
      'office-black': {
        name: 'Office Black',
        vars: {
          '--bg-primary': '#2b2b2b',
          '--bg-secondary': '#1e1e1e',
          '--bg-tertiary': '#333333',
          '--bg-canvas': '#484848',
          '--bg-page': '#ffffff',
          '--text-primary': '#ffffff',
          '--text-secondary': '#d4d4d4',
          '--text-muted': '#888888',
          '--accent': '#0078d4',
          '--accent-hover': '#106ebe',
          '--accent-light': '#203548',
          '--border': '#383838',
          '--border-light': '#444444',
          '--border-dark': '#262626',
          '--titlebar-bg': '#2b2b2b',
          '--titlebar-text': '#ffffff',
          '--titlebar-text-muted': '#d4d4d4',
          '--titlebar-hover': '#3a3a3a',
          '--titlebar-border': '#262626',
          '--titlebar-search-bg': '#333333',
          '--titlebar-search-border': '#444444',
        },
      },
      'office-dark-gray': {
        name: 'Office Dark Gray',
        vars: {
          '--bg-primary': '#4a4a4a',
          '--bg-secondary': '#3b3b3b',
          '--bg-tertiary': '#555555',
          '--bg-canvas': '#666666',
          '--bg-page': '#ffffff',
          '--text-primary': '#ffffff',
          '--text-secondary': '#e2e2e2',
          '--text-muted': '#b0b0b0',
          '--accent': '#0078d4',
          '--accent-hover': '#106ebe',
          '--accent-light': '#2c4c69',
          '--border': '#5c5c5c',
          '--border-light': '#6b6b6b',
          '--border-dark': '#323232',
          '--titlebar-bg': '#4a4a4a',
          '--titlebar-text': '#ffffff',
          '--titlebar-text-muted': '#e2e2e2',
          '--titlebar-hover': '#5a5a5a',
          '--titlebar-border': '#323232',
          '--titlebar-search-bg': '#555555',
          '--titlebar-search-border': '#6b6b6b',
        },
      },
      'office-blue': {
        name: 'Office Colorful',
        vars: {
          '--bg-primary': '#f3f3f3',
          '--bg-secondary': '#ffffff',
          '--bg-tertiary': '#e8e8e8',
          '--bg-canvas': '#c0c0c0',
          '--bg-page': '#ffffff',
          '--text-primary': '#1a1a1a',
          '--text-secondary': '#444444',
          '--text-muted': '#767676',
          '--accent': '#2b579a',
          '--accent-hover': '#1e4278',
          '--accent-light': '#deecf9',
          '--border': '#d1d1d1',
          '--border-light': '#e5e5e5',
          '--border-dark': '#a0a0a0',
          '--titlebar-bg': '#2b579a',
          '--titlebar-text': '#ffffff',
          '--titlebar-text-muted': '#e1ebf8',
          '--titlebar-hover': '#1e4278',
          '--titlebar-border': '#1e4278',
          '--titlebar-search-bg': 'rgba(255, 255, 255, 0.16)',
          '--titlebar-search-border': 'rgba(255, 255, 255, 0.28)',
        },
      },
      'office-white': {
        name: 'Office White',
        vars: {
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#fafafa',
          '--bg-tertiary': '#f0f0f0',
          '--bg-canvas': '#dcdcdc',
          '--bg-page': '#ffffff',
          '--text-primary': '#1f1f1f',
          '--text-secondary': '#555555',
          '--text-muted': '#8a8a8a',
          '--accent': '#0078d4',
          '--accent-hover': '#106ebe',
          '--accent-light': '#deecf9',
          '--border': '#e0e0e0',
          '--border-light': '#ebebeb',
          '--border-dark': '#bcbcbc',
          '--titlebar-bg': '#ffffff',
          '--titlebar-text': '#1f1f1f',
          '--titlebar-text-muted': '#555555',
          '--titlebar-hover': '#e8e8e8',
          '--titlebar-border': '#d6d6d6',
          '--titlebar-search-bg': '#f0f0f0',
          '--titlebar-search-border': '#d0d0d0',
        },
      },
      'dark': {
        name: 'Dark Mode',
        vars: {
          '--bg-primary': '#1e1e1e',
          '--bg-secondary': '#252526',
          '--bg-tertiary': '#2d2d30',
          '--bg-canvas': '#181818',
          '--bg-page': '#ffffff',
          '--text-primary': '#f0f0f0',
          '--text-secondary': '#cccccc',
          '--text-muted': '#888888',
          '--accent': '#0078d4',
          '--accent-hover': '#106ebe',
          '--accent-light': '#3a4d5e',
          '--border': '#3e3e42',
          '--border-light': '#4e4e52',
          '--border-dark': '#686868',
          '--titlebar-bg': '#1e1e1e',
          '--titlebar-text': '#f0f0f0',
          '--titlebar-text-muted': '#cccccc',
          '--titlebar-hover': '#333337',
          '--titlebar-border': '#3e3e42',
          '--titlebar-search-bg': '#2d2d30',
          '--titlebar-search-border': '#4e4e52',
        },
      },
      'emerald': {
        name: 'Modern Emerald',
        vars: {
          '--bg-primary': '#f0f5f2',
          '--bg-secondary': '#ffffff',
          '--bg-tertiary': '#e2ece6',
          '--bg-canvas': '#b0c4b8',
          '--bg-page': '#ffffff',
          '--text-primary': '#1b2d23',
          '--text-secondary': '#40594a',
          '--text-muted': '#789382',
          '--accent': '#107c41',
          '--accent-hover': '#0b5a2f',
          '--accent-light': '#dff6dd',
          '--border': '#c2d8cc',
          '--border-light': '#dceae2',
          '--border-dark': '#8fae9b',
          '--titlebar-bg': '#107c41',
          '--titlebar-text': '#ffffff',
          '--titlebar-text-muted': '#ddf4e4',
          '--titlebar-hover': '#0b5a2f',
          '--titlebar-border': '#0b5a2f',
          '--titlebar-search-bg': 'rgba(255, 255, 255, 0.16)',
          '--titlebar-search-border': 'rgba(255, 255, 255, 0.28)',
        },
      },
      'purple': {
        name: 'Classic Purple',
        vars: {
          '--bg-primary': '#f5f0f7',
          '--bg-secondary': '#ffffff',
          '--bg-tertiary': '#ebe2ef',
          '--bg-canvas': '#b8a8c2',
          '--bg-page': '#ffffff',
          '--text-primary': '#261b2e',
          '--text-secondary': '#544263',
          '--text-muted': '#887499',
          '--accent': '#5c2d91',
          '--accent-hover': '#472270',
          '--accent-light': '#efebf7',
          '--border': '#d2c2db',
          '--border-light': '#e5daec',
          '--border-dark': '#9f8cae',
          '--titlebar-bg': '#5c2d91',
          '--titlebar-text': '#ffffff',
          '--titlebar-text-muted': '#ebe2f7',
          '--titlebar-hover': '#472270',
          '--titlebar-border': '#472270',
          '--titlebar-search-bg': 'rgba(255, 255, 255, 0.16)',
          '--titlebar-search-border': 'rgba(255, 255, 255, 0.28)',
        },
      },
    };

    this.shapePalettes = {
      blue: { fill: '#deecf9', stroke: '#0078d4', text: '#1a1a1a' },
      green: { fill: '#dff6dd', stroke: '#107c41', text: '#1a1a1a' },
      orange: { fill: '#fde7e9', stroke: '#d83b01', text: '#1a1a1a' },
      purple: { fill: '#efebf7', stroke: '#5c2d91', text: '#1a1a1a' },
      monochrome: { fill: '#f3f2f1', stroke: '#323130', text: '#1a1a1a' },
    };

    // Cohesive Light alias + clean system defaults
    this.uiThemes['light'] = {
      name: 'Light',
      vars: { ...this.uiThemes['office-white'].vars },
    };
    this._osTheme = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';

    const savedTheme = localStorage.getItem('opendraw-theme');
    const isValid = savedTheme === 'system' || (savedTheme && this.uiThemes[savedTheme]);
    this.currentThemeId = isValid ? savedTheme : 'system';
    this._setupUI();
    this.applyUITheme(this.currentThemeId);
    this._watchSystemTheme();
  }

  _watchSystemTheme() {
    if (typeof window === 'undefined') return;
    if (window.openDraw && window.openDraw.getSystemTheme) {
      window.openDraw.getSystemTheme().then((sys) => {
        if (sys === 'dark' || sys === 'light') {
          this._osTheme = sys;
          if (this.currentThemeId === 'system') this.applyUITheme('system');
        }
      }).catch(() => {});
    }
    if (window.openDraw && window.openDraw.onMenuAction) {
      window.openDraw.onMenuAction((channel, sysTheme) => {
        if (channel === 'theme:system-updated' && (sysTheme === 'dark' || sysTheme === 'light')) {
          this._osTheme = sysTheme;
          if (this.currentThemeId === 'system') this.applyUITheme('system');
        }
      });
    }
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (ev) => {
        this._osTheme = ev.matches ? 'dark' : 'light';
        if (this.currentThemeId === 'system') this.applyUITheme('system');
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
    }
  }

  _setupUI() {
    // Add theme selector to properties panel
    const propContent = document.getElementById('properties-panel-content');
    if (!propContent) return;

    const themeSection = document.createElement('div');
    themeSection.className = 'property-section';
    themeSection.id = 'property-section-themes';
    themeSection.innerHTML = `
      <div class="property-section-header">Themes & Palettes</div>
      <div class="property-row">
        <label class="prop-label">UI Theme</label>
        <select id="select-ui-theme" class="prop-input">
          <option value="system">Follow System (OS)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="office-black">Office Black</option>
          <option value="office-dark-gray">Office Dark Gray</option>
          <option value="office-blue">Office Colorful</option>
          <option value="office-white">Office White</option>
          <option value="emerald">Modern Emerald</option>
          <option value="purple">Classic Purple</option>
        </select>
      </div>
      <div class="property-row" style="margin-top:6px;">
        <label class="prop-label">Color Palette</label>
        <div style="display:flex;gap:6px;">
          <button class="palette-swatch" data-palette="blue" style="width:20px;height:20px;border-radius:3px;border:1px solid #0078d4;background:#deecf9;cursor:pointer;" title="Office Blue"></button>
          <button class="palette-swatch" data-palette="green" style="width:20px;height:20px;border-radius:3px;border:1px solid #107c41;background:#dff6dd;cursor:pointer;" title="Emerald Green"></button>
          <button class="palette-swatch" data-palette="orange" style="width:20px;height:20px;border-radius:3px;border:1px solid #d83b01;background:#fde7e9;cursor:pointer;" title="Warm Orange"></button>
          <button class="palette-swatch" data-palette="purple" style="width:20px;height:20px;border-radius:3px;border:1px solid #5c2d91;background:#efebf7;cursor:pointer;" title="Classic Purple"></button>
          <button class="palette-swatch" data-palette="monochrome" style="width:20px;height:20px;border-radius:3px;border:1px solid #323130;background:#f3f2f1;cursor:pointer;" title="Monochrome"></button>
        </div>
      </div>
    `;

    propContent.appendChild(themeSection);

    const themeSelect = themeSection.querySelector('#select-ui-theme');
    themeSelect.value = this.currentThemeId;
    themeSelect.addEventListener('change', (e) => {
      this.applyUITheme(e.target.value);
    });

    themeSection.querySelectorAll('.palette-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pal = btn.dataset.palette;
        if (pal && this.shapePalettes[pal]) {
          this.applyShapePalette(this.shapePalettes[pal]);
        }
      });
    });
  }

  /**
   * Apply an application UI theme ('system' | 'light' | 'dark' | ...).
   * @param {string} themeId
   */
  applyUITheme(themeId) {
    const requested = themeId || 'system';
    const resolvedId = requested === 'system'
      ? (this._osTheme === 'dark' ? 'dark' : 'light')
      : requested;
    const theme = this.uiThemes[resolvedId];
    if (!theme) return;

    this.currentThemeId = requested;
    this.resolvedThemeId = resolvedId;
    const isDarkSurface = ['dark', 'office-black', 'office-dark-gray'].includes(resolvedId);
    const isLightTitlebar = ['light', 'office-white'].includes(resolvedId);
    const surfaceMode = isDarkSurface ? 'dark' : 'light';
    const titlebarSurfaceMode = isLightTitlebar ? 'light' : 'dark';
    const windowIconMode = isLightTitlebar
      ? 'light'
      : (isDarkSurface ? 'dark' : (this._osTheme === 'dark' ? 'dark' : 'light'));

    localStorage.setItem('opendraw-theme', requested);
    document.documentElement.setAttribute('data-theme', resolvedId);
    document.documentElement.setAttribute('data-theme-mode', requested);
    document.documentElement.setAttribute('data-theme-surface', surfaceMode);
    document.documentElement.setAttribute('data-titlebar-surface', titlebarSurfaceMode);

    const faviconEl = document.getElementById('app-favicon');
    if (faviconEl) {
      faviconEl.setAttribute('href', `../../assets/icons/opendraw-small-${titlebarSurfaceMode}.svg`);
    }
    if (window.openDraw && window.openDraw.setWindowTheme) {
      window.openDraw.setWindowTheme(windowIconMode);
    }

    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    const themeSelect = document.getElementById('select-ui-theme');
    if (themeSelect && themeSelect.value !== requested) themeSelect.value = requested;
    document.querySelectorAll('[data-action="theme:system"], [data-action="theme:light"], [data-action="theme:dark"]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.action === `theme:${requested}`);
    });

    // Update canvas background color & rulers
    if (this.canvas) {
      this.canvas.backgroundColor = theme.vars['--bg-canvas'];
      if (this.canvasManager && this.canvasManager.gridManager) {
        this.canvasManager.gridManager._createGrid();
      }
      if (this.canvasManager && this.canvasManager.rulerManager) {
        this.canvasManager.rulerManager.draw();
      }
      this.canvas.requestRenderAll();
    }
  }

  /**
   * Apply a color palette to selected shapes or all shapes.
   * @param {{fill: string, stroke: string, text: string}} palette 
   */
  applyShapePalette(palette) {
    const active = this.canvas.getActiveObject();
    const skipTypes = new Set([
      'grid-line', 'page-background', 'connector', 'connector-arrow',
      'connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line', 'preview-rect'
    ]);
    const isTarget = (o) => o && !o.isGridLine && !o.isPageBg && !o.isGuide && !skipTypes.has(o.objectType);
    let targets = [];

    if (active) {
      targets = ((active.type || '').toLowerCase() === 'activeselection' && active.getObjects)
        ? active.getObjects().filter(isTarget)
        : (isTarget(active) ? [active] : []);
    } else {
      targets = this.canvas.getObjects().filter(isTarget);
    }

    if (targets.length === 0) return;

    const isTextObj = (o) => o && (o.type === 'text' || o.type === 'i-text' || o.type === 'textbox');
    const collectParts = (obj) => {
      const geoms = [];
      const texts = [];
      const walk = (n) => {
        if (!n) return;
        if (isTextObj(n)) { texts.push(n); return; }
        if (n.getObjects) {
          n.getObjects().forEach(walk);
        } else {
          geoms.push(n);
        }
      };
      walk(obj);
      return { geoms, texts };
    };

    const oldStyles = targets.map((obj) => {
      const { geoms, texts } = collectParts(obj);
      return {
        obj,
        geomSnaps: geoms.map(g => ({ node: g, fill: g.fill, stroke: g.stroke })),
        textSnaps: texts.map(t => ({ node: t, fill: t.fill })),
      };
    });

    const applyToTargets = () => {
      targets.forEach((obj) => {
        const { geoms, texts } = collectParts(obj);
        geoms.forEach((g) => g.set({ fill: palette.fill, stroke: palette.stroke }));
        if (palette.text) texts.forEach((t) => t.set('fill', palette.text));
        obj.dirty = true;
      });
      this.canvas.requestRenderAll();
    };

    applyToTargets();

    window.undoManager.record({
      name: 'Apply Theme Palette',
      execute: applyToTargets,
      undo: () => {
        oldStyles.forEach(({ obj, geomSnaps, textSnaps }) => {
          geomSnaps.forEach(({ node, fill, stroke }) => node.set({ fill, stroke }));
          textSnaps.forEach(({ node, fill }) => node.set('fill', fill));
          obj.dirty = true;
        });
        this.canvas.requestRenderAll();
      },
    });
  }
}

window.ThemeManager = ThemeManager;

