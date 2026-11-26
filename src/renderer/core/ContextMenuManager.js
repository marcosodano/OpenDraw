/**
 * ContextMenuManager — Desktop-grade right-click context menu for OpenDraw.
 * Replicates the Office Black Theme context menu experience.
 * 
 * Provides contextual menus for:
 * - Selected shapes & groups (Cut, Copy, Paste, Duplicate, Delete, Edit Text, Arrange, Group, Format Shape)
 * - Canvas background (Paste, Select All, Zoom to Fit, Zoom 100%, Grid, Rulers, Snap)
 * - Page tabs (New Page, Delete Page, Rename Page, Duplicate Page)
 */

class ContextMenuManager {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.canvas;
    this.menuEl = null;
    this.copiedStyle = null;

    this._createDOM();
    this._setupEvents();
  }

  _createDOM() {
    const existing = document.getElementById('opendraw-context-menu');
    if (existing) existing.remove();

    this.menuEl = document.createElement('div');
    this.menuEl.id = 'opendraw-context-menu';
    this.menuEl.className = 'context-menu';
    this.menuEl.style.cssText = `
      position: fixed;
      display: none;
      z-index: 10000;
      background: var(--bg-secondary, #2b2b2b);
      color: var(--text-primary, #ffffff);
      border: 1px solid var(--border, #484848);
      border-radius: 4px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      padding: 4px 0;
      min-width: 200px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      user-select: none;
    `;

    document.body.appendChild(this.menuEl);

    // Dismiss when clicking outside, scrolling, or pressing Escape
    const dismissOutside = (e) => {
      if (this.menuEl && this.menuEl.style.display !== 'none' && !this.menuEl.contains(e.target)) {
        this.hide();
      }
    };
    document.addEventListener('mousedown', dismissOutside, true);
    document.addEventListener('wheel', () => this.hide(), true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  _setupEvents() {
    const ignored = new Set([
      'grid-line', 'page-background', 'connector-arrow', 'connector-handle',
      'autoconnect-trigger', 'port-marker', 'guide-line', 'preview-rect',
      'border-frame', 'title-block'
    ]);
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const target = this.canvas.findTarget(e);
      if (target && !target.isGridLine && !target.isPageBg && !target.isGuide && !ignored.has(target.objectType)) {
        const active = this.canvas.getActiveObject();
        if (!active || (active !== target && (!active.getObjects || !active.getObjects().includes(target)))) {
          this.canvas.setActiveObject(target);
          this.canvas.requestRenderAll();
        }
        this.showShapeMenu(e.clientX, e.clientY, this.canvas.getActiveObject() || target);
      } else {
        this.showCanvasMenu(e.clientX, e.clientY);
      }
    };

    const container = document.getElementById('canvas-container');
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu, true);
    }
    if (this.canvas.upperCanvasEl) {
      this.canvas.upperCanvasEl.addEventListener('contextmenu', handleContextMenu, true);
    }

    // Page tabs context menu
    const pageTabsContainer = document.getElementById('page-tabs');
    if (pageTabsContainer) {
      pageTabsContainer.addEventListener('contextmenu', (e) => {
        const tab = e.target.closest('.page-tab');
        if (tab && !tab.classList.contains('page-tab-add')) {
          e.preventDefault();
          e.stopPropagation();
          const pageIndex = parseInt(tab.dataset.pageIndex, 10);
          this.showPageTabMenu(e.clientX, e.clientY, pageIndex, tab);
        }
      });
    }
  }

  /**
   * Show context menu for a selected shape or active selection.
   */
  showShapeMenu(x, y, target) {
    const hasSelection = !!target;
    const isGroup = hasSelection && target.type === 'group';
    const isMulti = hasSelection && target.type === 'activeselection';
    const selectedConns = [];
    if (isMulti && typeof target.getObjects === 'function') {
      target.getObjects().forEach(o => { if (o && o.connectorData) selectedConns.push(o.connectorData); });
    } else if (hasSelection && target.connectorData) {
      selectedConns.push(target.connectorData);
    }
    const cm = this.canvasManager.connectorManager;
    const applyArrowPreset = (mode) => {
      if (!cm || selectedConns.length === 0) return;
      const patch = {
        sourceArrow: (mode === 'source' || mode === 'both') ? 'arrow' : 'none',
        targetArrow: (mode === 'target' || mode === 'both') ? 'arrow' : 'none',
      };
      selectedConns.forEach(c => cm.updateConnectorStyle(c, patch));
    };
    const arrowItems = [];
    if (selectedConns.length > 0) {
      const c0 = selectedConns[0];
      const hasSrc = cm && cm._isArrowVisible(c0.style && c0.style.sourceArrow);
      const hasTgt = cm && cm._isArrowVisible(c0.style && c0.style.targetArrow);
      const curMode = (hasSrc && hasTgt) ? 'both' : (hasTgt ? 'target' : (hasSrc ? 'source' : 'none'));
      const curRt = (c0.style && c0.style.routingType) || 'orthogonal';
      arrowItems.push(
        { type: 'separator' },
        { icon: curMode === 'target' ? '✓' : '→', label: 'End Arrow (→)', action: () => applyArrowPreset('target'), enabled: true },
        { icon: curMode === 'source' ? '✓' : '←', label: 'Start Arrow (←)', action: () => applyArrowPreset('source'), enabled: true },
        { icon: curMode === 'both' ? '✓' : '↔', label: 'Both Arrows (↔)', action: () => applyArrowPreset('both'), enabled: true },
        { icon: curMode === 'none' ? '✓' : '—', label: 'Remove Arrows (—)', action: () => applyArrowPreset('none'), enabled: true },
        { type: 'separator' },
        { icon: curRt === 'orthogonal' ? '✓' : ' ', label: 'Right-Angle Connector', action: () => selectedConns.forEach(c => cm.updateConnectorStyle(c, { routingType: 'orthogonal' })), enabled: true },
        { icon: curRt === 'straight' ? '✓' : ' ', label: 'Straight Connector', action: () => selectedConns.forEach(c => cm.updateConnectorStyle(c, { routingType: 'straight' })), enabled: true },
        { icon: curRt === 'curved' ? '✓' : ' ', label: 'Curved Connector', action: () => selectedConns.forEach(c => cm.updateConnectorStyle(c, { routingType: 'curved' })), enabled: true }
      );
    }

    const items = [
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M12.5 2l1.5 1.5-9 9H2v-3l9-9h1.5z" fill="#0078d4"/></svg>',
        label: 'Edit Text',
        shortcut: 'F2',
        action: () => this._editText(target),
        enabled: hasSelection && !isMulti,
      },
      ...arrowItems,
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M13.5 1l-3 3 1.5 1.5 3-3-1.5-1.5zM6 4.5L1 9.5 2.5 11l5-5-1.5-1.5z" fill="#d4d4d4"/></svg>',
        label: 'Cut',
        shortcut: 'Ctrl+X',
        action: () => window.handleCut ? window.handleCut() : null,
        enabled: hasSelection,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="4" y="2" width="9" height="11" fill="none" stroke="#d4d4d4"/><rect x="2" y="4" width="9" height="11" fill="none" stroke="#888"/></svg>',
        label: 'Copy',
        shortcut: 'Ctrl+C',
        action: () => window.handleCopy ? window.handleCopy() : null,
        enabled: hasSelection,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="3" y="4" width="10" height="11" rx="1" fill="none" stroke="#d4d4d4"/><path d="M5 2h6v2H5V2z" fill="#0078d4"/></svg>',
        label: 'Paste',
        shortcut: 'Ctrl+V',
        action: () => window.handlePaste ? window.handlePaste() : null,
        enabled: true,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="2" width="7" height="7" fill="none" stroke="#0078d4"/><rect x="7" y="7" width="7" height="7" fill="none" stroke="#0078d4"/></svg>',
        label: 'Duplicate',
        shortcut: 'Ctrl+D',
        action: () => window.duplicateSelected ? window.duplicateSelected() : null,
        enabled: hasSelection,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M3 4h10v1H3zm2 2h6v8H5zm2-4h2v1H7z" fill="#e74c3c"/></svg>',
        label: 'Delete',
        shortcut: 'Del',
        action: () => this.canvasManager._deleteSelected(),
        enabled: hasSelection,
      },
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="2" width="6" height="6" fill="#666"/><rect x="6" y="6" width="8" height="8" fill="#0078d4"/></svg>',
        label: 'Bring to Front',
        shortcut: 'Ctrl+Shift+]',
        action: () => window.bringToFront ? window.bringToFront() : null,
        enabled: hasSelection,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="3" y="3" width="8" height="8" fill="#0078d4"/><rect x="7" y="7" width="6" height="6" fill="#666"/></svg>',
        label: 'Bring Forward',
        shortcut: 'Ctrl+]',
        action: () => window.bringForward ? window.bringForward() : null,
        enabled: hasSelection,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="3" y="3" width="8" height="8" fill="#666"/><rect x="7" y="7" width="6" height="6" fill="#0078d4"/></svg>',
        label: 'Send Backward',
        shortcut: 'Ctrl+[',
        action: () => window.sendBackward ? window.sendBackward() : null,
        enabled: hasSelection,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="6" y="6" width="8" height="8" fill="#666"/><rect x="2" y="2" width="6" height="6" fill="#0078d4"/></svg>',
        label: 'Send to Back',
        shortcut: 'Ctrl+Shift+[',
        action: () => window.sendToBack ? window.sendToBack() : null,
        enabled: hasSelection,
      },
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="2" width="5" height="5" fill="none" stroke="#d4d4d4"/><rect x="9" y="9" width="5" height="5" fill="none" stroke="#d4d4d4"/></svg>',
        label: 'Group',
        shortcut: 'Ctrl+G',
        action: () => window.groupSelected ? window.groupSelected() : null,
        enabled: isMulti,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="2" width="5" height="5" fill="#0078d4"/><rect x="9" y="9" width="5" height="5" fill="#0078d4"/></svg>',
        label: 'Ungroup',
        shortcut: 'Ctrl+Shift+U',
        action: () => window.ungroupSelected ? window.ungroupSelected() : null,
        enabled: isGroup,
      },
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h7c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1h-2z" fill="#f39c12"/></svg>',
        label: 'Format Painter',
        shortcut: 'Ctrl+Shift+C',
        action: () => {
          this._copyStyle(target);
          if (window.copyStyle) window.copyStyle(target);
        },
        enabled: hasSelection,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M13 3l-1-1-6 6v2h2l6-6z" fill="#f39c12"/></svg>',
        label: 'Paste Style',
        shortcut: 'Ctrl+Shift+V',
        action: () => {
          if (window.pasteStyle) window.pasteStyle(target);
          else this._pasteStyle(target);
        },
        enabled: hasSelection && !!(this.copiedStyle || (window.formatPainterStyle)),
      },
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M2 2h12v12H2z" fill="none" stroke="#0078d4" stroke-width="1.5"/></svg>',
        label: 'Format Shape...',
        action: () => {
          const propPanel = document.getElementById('properties-panel');
          if (propPanel) propPanel.classList.remove('collapsed');
        },
        enabled: hasSelection,
      },
    ];

    this._renderMenuItems(items, x, y);
  }

  /**
   * Show context menu when right clicking on empty canvas.
   */
  showCanvasMenu(x, y) {
    const items = [
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="3" y="4" width="10" height="11" rx="1" fill="none" stroke="#d4d4d4"/><path d="M5 2h6v2H5V2z" fill="#0078d4"/></svg>',
        label: 'Paste',
        shortcut: 'Ctrl+V',
        action: () => window.handlePaste ? window.handlePaste() : null,
        enabled: true,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M1 1h4v1H2v3H1V1zm14 0h-4v1h3v3h1V1zM1 15h4v-1H2v-3H1v4zm14 0h-4v-1h3v-3h1v4z" fill="#d4d4d4"/></svg>',
        label: 'Select All',
        shortcut: 'Ctrl+A',
        action: () => window.selectAll ? window.selectAll() : null,
        enabled: true,
      },
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M2 2h4v1H3v3H2V2zm8 0h4v4h-1V3h-3V2zM2 10h1v3h3v1H2v-4zm11 3h-3v1h4v-4h-1v3z" fill="#0078d4"/></svg>',
        label: 'Zoom to Fit Page',
        shortcut: 'Ctrl+Shift+F',
        action: () => this.canvasManager.zoomToFit(),
        enabled: true,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><circle cx="8" cy="8" r="6" fill="none" stroke="#0078d4"/><text x="5" y="11" font-size="8" fill="#0078d4">1</text></svg>',
        label: 'Zoom 100%',
        shortcut: 'Ctrl+0',
        action: () => this.canvasManager.zoom100(),
        enabled: true,
      },
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M1 4h14M1 8h14M1 12h14M4 1v14M8 1v14M12 1v14" stroke="#888"/></svg>',
        label: 'Grid Lines',
        action: () => this.canvasManager.gridManager.toggleGrid(),
        enabled: true,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="3" width="12" height="10" fill="none" stroke="#888"/><path d="M4 3v3m3-3v2m3-2v3" stroke="#888"/></svg>',
        label: 'Rulers',
        action: () => this.canvasManager.rulerManager.toggle(),
        enabled: true,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><circle cx="4" cy="4" r="1.5" fill="#0078d4"/><circle cx="12" cy="4" r="1.5" fill="#0078d4"/><circle cx="4" cy="12" r="1.5" fill="#0078d4"/><circle cx="12" cy="12" r="1.5" fill="#0078d4"/></svg>',
        label: 'Snap to Grid',
        action: () => this.canvasManager.gridManager.toggleSnap(),
        enabled: true,
      },
    ];

    this._renderMenuItems(items, x, y);
  }

  /**
   * Show context menu when right clicking on a page tab.
   */
  showPageTabMenu(x, y, pageIndex, tabEl) {
    const pageManager = this.canvasManager.pageManager;
    const canDelete = pageManager && pageManager.pages.length > 1;

    const items = [
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M8 3v10M3 8h10" stroke="#0078d4" stroke-width="2"/></svg>',
        label: 'Insert Page',
        action: () => pageManager ? pageManager.addPage() : null,
        enabled: true,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M12.5 2l1.5 1.5-9 9H2v-3l9-9h1.5z" fill="#0078d4"/></svg>',
        label: 'Rename Page',
        action: () => pageManager ? pageManager._promptRename(tabEl, pageIndex) : null,
        enabled: true,
      },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="2" width="7" height="7" fill="none" stroke="#0078d4"/><rect x="7" y="7" width="7" height="7" fill="none" stroke="#0078d4"/></svg>',
        label: 'Duplicate Page',
        action: async () => {
          if (!pageManager) return;
          if (pageIndex !== pageManager.currentPageIndex) {
            await pageManager.switchToPage(pageIndex);
          }
          pageManager.duplicateActivePage();
        },
        enabled: true,
      },
      { type: 'separator' },
      {
        icon: '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M3 4h10v1H3zm2 2h6v8H5zm2-4h2v1H7z" fill="#e74c3c"/></svg>',
        label: 'Delete Page',
        action: () => pageManager ? pageManager.deletePage(pageIndex) : null,
        enabled: canDelete,
      },
    ];

    this._renderMenuItems(items, x, y);
  }

  _escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  _renderMenuItems(items, x, y) {
    if (!this.menuEl) return;
    this.menuEl.innerHTML = '';

    items.forEach((item) => {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--border, #3d3d3d); margin: 4px 6px;';
        this.menuEl.appendChild(sep);
        return;
      }

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 10px;
        color: ${item.enabled ? 'var(--text-primary, #e1e1e1)' : 'var(--text-muted, #6c6c6c)'};
        cursor: ${item.enabled ? 'pointer' : 'default'};
        transition: background 0.08s;
        border-radius: 2px;
        margin: 0 3px;
      `;

      const leftCol = document.createElement('div');
      leftCol.style.cssText = 'display:flex; align-items:center; gap:8px;';
      leftCol.innerHTML = `
        <span style="display:inline-flex; width:16px; justify-content:center;">${item.icon || ''}</span>
        <span>${this._escapeHtml(item.label)}</span>
      `;

      row.appendChild(leftCol);

      if (item.shortcut) {
        const shortcutSpan = document.createElement('span');
        shortcutSpan.style.cssText = 'color:var(--text-muted, #888888); font-size:11px; margin-left:20px;';
        shortcutSpan.textContent = item.shortcut;
        row.appendChild(shortcutSpan);
      }

      if (item.enabled) {
        row.addEventListener('mouseenter', () => {
          row.style.background = 'var(--accent, #0078d4)';
          row.style.color = '#ffffff';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = 'transparent';
          row.style.color = 'var(--text-primary, #e1e1e1)';
        });
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hide();
          item.action();
        });
      }

      this.menuEl.appendChild(row);
    });

    // Smart positioning inside window boundaries
    this.menuEl.style.display = 'block';
    const menuWidth = this.menuEl.offsetWidth || 210;
    const menuHeight = this.menuEl.offsetHeight || (items.length * 26);

    const posX = (x + menuWidth > window.innerWidth) ? x - menuWidth : x;
    const posY = (y + menuHeight > window.innerHeight) ? y - menuHeight : y;

    this.menuEl.style.left = `${Math.max(6, posX)}px`;
    this.menuEl.style.top = `${Math.max(6, posY)}px`;
  }

  hide() {
    if (this.menuEl) {
      this.menuEl.style.display = 'none';
    }
  }

  _editText(target) {
    if (target && this.canvasManager.inlineTextEditor) {
      this.canvasManager.inlineTextEditor.edit(target);
    }
  }

  _copyStyle(target) {
    if (window.copyStyle) window.copyStyle(target);
  }

  _pasteStyle(target) {
    if (window.pasteStyle) window.pasteStyle(target);
  }
}

window.ContextMenuManager = ContextMenuManager;
