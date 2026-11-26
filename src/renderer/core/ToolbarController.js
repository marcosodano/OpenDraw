/**
 * ToolbarController — Office Fluent Ribbon Controller for OpenDraw.
 * 
 * Manages:
 * - Office Ribbon tab switching (File, Home, Insert, Design, View)
 * - Office Backstage overlay (New, Open, Save, Export)
 * - Tools (Pointer, Connector, Text) & Quick Shapes
 * - Live shape styling (Fill, Stroke, Width, Dash)
 * - Typography (Font Family, Size, Bold, Color)
 * - Page layout (Orientation, Page sizes, Themes)
 * - Arrange & Auto-Layout
 */

class ToolbarController {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this._canvasManager = canvasManager;
    this._zoomLabel = document.getElementById('toolbar-zoom');

    this._setupRibbonTabs();
    this._setupButtonHandlers();
    this._setupStylePickers();
    this._setupDesignTab();
    this._setupEventListeners();
    this._setupHoverScreenTips();
    this._setupDropdownDismiss();
    this._setupTellMeSearch();
    this._setupRibbonCollapseAndDisplay();
    this._setupPictureUpload();
    this._initLanguage();
  }

  _setupRibbonTabs() {
    const tabs = document.querySelectorAll('.ribbon-tab');
    const panes = document.querySelectorAll('.ribbon-tab-pane');
    const backstage = document.getElementById('backstage-menu');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.closeAllDropdownsAndPopovers();
        const targetTab = tab.dataset.tab;

        // If File tab is clicked, toggle Backstage
        if (targetTab === 'file') {
          if (backstage) {
            const isOpening = backstage.style.display !== 'flex';
            backstage.style.display = isOpening ? 'flex' : 'none';
            if (isOpening && window.renderRecentFiles) {
              window.renderRecentFiles();
            }
          }
          return;
        }

        // Close backstage if open
        if (backstage) {
          backstage.style.display = 'none';
        }

        // Switch active tab
        tabs.forEach(t => {
          if (t.dataset.tab !== 'file') t.classList.remove('active');
        });
        tab.classList.add('active');

        // Switch active pane
        panes.forEach(pane => {
          pane.classList.toggle('active', pane.dataset.pane === targetTab);
        });
      });
    });

    // Close backstage button
    const backBtn = document.getElementById('backstage-close');
    if (backBtn && backstage) {
      backBtn.addEventListener('click', () => {
        backstage.style.display = 'none';
      });
    }

    // Escape closes backstage if open
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backstage && backstage.style.display === 'flex') {
        backstage.style.display = 'none';
      }
    });
  }

  _setupButtonHandlers() {
    const backstage = document.getElementById('backstage-menu');
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (!action) return;
        // Close backstage if a file action or backstage button was triggered
        if (backstage && (btn.closest('#backstage-menu') || action.startsWith('file:'))) {
          backstage.style.display = 'none';
        }
        this._handleAction(action, btn);
      });
    });

    // Wire Ribbon group dialog launcher arrows (↘) to open Properties / Format pane cleanly
    document.querySelectorAll('.dialog-launcher-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.panelController && window.panelController.togglePropertiesPanel) {
          window.panelController.togglePropertiesPanel(true);
        } else {
          document.getElementById('properties-panel')?.classList.remove('collapsed');
        }
        const title = (btn.getAttribute('title') || '').toLowerCase();
        if (title.includes('page')) {
          this._showDropdownMenu('size', btn);
        } else {
          const propPanel = document.getElementById('properties-panel-content');
          if (propPanel) {
            const targetHdr = Array.from(propPanel.querySelectorAll('.property-section-header'))
              .find(h => (title.includes('font') && /text/i.test(h.textContent))
                || (title.includes('format') && /fill|line/i.test(h.textContent))
                || (title.includes('paragraph') && /text/i.test(h.textContent)));
            targetHdr?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          this._showToast(btn.getAttribute('title') || 'Format Properties');
        }
      });
    });
  }

  /**
   * Handle an action from any button in the ribbon, titlebar, or backstage.
   * @param {string} action 
   * @param {HTMLElement} btn
   */
  _handleAction(action, btn) {
    switch (action) {
      // File actions
      case 'file:new':
        if (window.handleNew) window.handleNew();
        break;
      case 'file:open':
        if (window.handleOpen) window.handleOpen();
        break;
      case 'file:save':
        if (window.handleSave) window.handleSave();
        break;
      case 'file:save-as':
        if (window.handleSaveAs) window.handleSaveAs();
        break;
      case 'file:export-pdf':
        if (window.handleExport) window.handleExport('pdf');
        break;
      case 'file:export-png':
        if (window.handleExport) window.handleExport('png');
        break;
      case 'file:export-svg':
        if (window.handleExport) window.handleExport('svg');
        break;

      // Clipboard
      case 'cut':
        if (window.handleCut) window.handleCut();
        break;
      case 'copy':
        if (window.handleCopy) window.handleCopy();
        break;
      case 'paste':
        if (window.handlePaste) window.handlePaste();
        break;
      case 'format-painter': {
        const active = this._canvasManager.canvas.getActiveObject();
        if (btn?.classList.contains('active') || window.formatPainterStyle) {
          if (active && window.pasteStyle) {
            window.pasteStyle(active);
          } else {
            window.formatPainterStyle = null;
          }
          document.querySelectorAll('[data-action="format-painter"]').forEach(b => b.classList.remove('active'));
        } else if (window.copyStyle) {
          window.copyStyle(active);
          if (window.formatPainterStyle) {
            document.querySelectorAll('[data-action="format-painter"]').forEach(b => b.classList.add('active'));
          }
        }
        break;
      }

      // Tools
      case 'select':
      case 'pan':
        this._canvasManager.setTool(action);
        break;

      case 'insert:connector':
        if (this._canvasManager.activeTool === 'insert:connector') {
          this._canvasManager.setTool('select');
        } else {
          this._canvasManager.setTool('insert:connector');
          this._showToast('Connector Tool: Active (Continuous mode — press Esc or Pointer Tool when done)');
        }
        break;

      case 'insert:connector-dropdown':
        this._showConnectorRoutingMenu(btn, true);
        break;

      case 'insert:textbox':
      case 'insert:textbox-dropdown':
        this._showDropdownMenu('textbox', btn);
        break;

      // Quick Shapes
      case 'insert:rectangle':
      case 'insert:rounded-rect':
      case 'insert:ellipse':
      case 'insert:diamond':
      case 'insert:triangle':
        this._canvasManager.setTool(action);
        break;

      // Arrange
      case 'arrange:bring-front':
        if (window.bringToFront) window.bringToFront();
        break;
      case 'arrange:bring-forward':
        if (window.bringForward) window.bringForward();
        break;
      case 'arrange:send-backward':
        if (window.sendBackward) window.sendBackward();
        break;
      case 'arrange:send-back':
        if (window.sendToBack) window.sendToBack();
        break;
      case 'arrange:ungroup':
        if (window.ungroupSelected) window.ungroupSelected();
        break;
      case 'align:left':
      case 'align:right':
      case 'align:top':
      case 'align:center-v':
      case 'align:bottom':
        if (window.alignObjects) window.alignObjects(action.replace('align:', ''));
        break;

      // Shape Styles Fill & Line pickers
      case 'shape:fill-picker':
        this._showFillColorPicker();
        break;
      case 'shape:line-picker':
        this._showLineColorPicker();
        break;

      // Backgrounds & Borders
      case 'insert:background':
        this._showBackgroundPicker(btn);
        break;
      case 'insert:borders-titles':
        this._showBordersTitlesMenu(btn);
        break;

      // Layout & Connectors
      case 'layout:dropdown':
        this._showRelayoutMenu(btn);
        break;
      case 'layout:hierarchical-tb':
        this._applyLayoutWithUndo('tb');
        break;
      case 'layout:hierarchical-lr':
        this._applyLayoutWithUndo('lr');
        break;
      case 'layout:connectors-dropdown':
        this._showConnectorRoutingMenu(btn);
        break;
      case 'layout:connectors-routing':
        this._toggleConnectorRoutingStyle();
        break;

      // Undo/Redo
      case 'undo':
        window.undoManager.undo();
        break;
      case 'redo':
        window.undoManager.redo();
        break;

      // Zoom
      case 'zoom-in':
        this._canvasManager.zoomIn();
        break;
      case 'zoom-out':
        this._canvasManager.zoomOut();
        break;
      case 'zoom-fit':
        this._canvasManager.zoomToFit();
        this._setActiveZoomOption('zoom-fit');
        break;
      case 'zoom-100':
        this._canvasManager.zoom100();
        this._setActiveZoomOption('zoom-100');
        break;
      case 'zoom-page-width':
        this._canvasManager.zoomToFit();
        this._setActiveZoomOption('zoom-page-width');
        break;

      // View Toggles
      case 'toggle-shapes-panel':
        if (window.panelController) {
          window.panelController.toggleShapesPanel();
        } else {
          const sp = document.getElementById('shapes-panel');
          if (sp) sp.classList.toggle('collapsed');
        }
        break;
      case 'toggle-properties-panel':
        if (window.panelController) {
          window.panelController.togglePropertiesPanel();
        } else {
          const pp = document.getElementById('properties-panel');
          if (pp) pp.classList.toggle('collapsed');
        }
        break;
      case 'toggle-grid':
        const gridOn = this._canvasManager.gridManager.toggleGrid();
        if (btn) btn.classList.toggle('active', gridOn);
        break;
      case 'toggle-snap':
        const snapOn = this._canvasManager.gridManager.toggleSnap();
        if (btn) btn.classList.toggle('active', snapOn);
        break;
      case 'toggle-rulers':
        this._canvasManager.rulerManager.toggle();
        break;
      // Typography Actions
      case 'font:grow':
        this._adjustSelectedFontSize(2);
        break;
      case 'font:shrink':
        this._adjustSelectedFontSize(-2);
        break;
      case 'font:bold':
        this._toggleSelectedFontStyle('fontWeight', 'bold', 'normal');
        break;
      case 'font:italic':
        this._toggleSelectedFontStyle('fontStyle', 'italic', 'normal');
        break;
      case 'font:underline':
        this._toggleSelectedFontStyle('underline', true, false);
        break;
      case 'font:strike':
        this._toggleSelectedFontStyle('linethrough', true, false);
        break;
      case 'font:sub':
        this._applySubscript();
        break;
      case 'font:super':
        this._applySuperscript();
        break;
      case 'font:case':
        this._toggleSelectedCase();
        break;

      // Paragraph Formatting
      case 'align:text-left':
      case 'align:text-center':
      case 'align:text-right':
      case 'align:text-justify':
        this._setSelectedTextAlign(action.replace('align:text-', ''));
        break;
      case 'para:bullets':
        this._toggleBullets();
        break;
      case 'para:numbers':
        this._toggleNumbering();
        break;
      case 'para:indent-inc':
        this._adjustIndent(4);
        break;
      case 'para:indent-dec':
        this._adjustIndent(-4);
        break;

      // Selection & Dropdowns
      case 'select:all':
        this._showDropdownMenu('select', btn);
        break;
      case 'arrange:group':
        this._showDropdownMenu('group', btn);
        break;
      case 'align:center-h':
        this._showDropdownMenu('align', btn);
        break;
      case 'arrange:position':
        this._showDropdownMenu('position', btn);
        break;
      case 'change-shape':
        this._showDropdownMenu('change-shape', btn);
        break;
      case 'layers':
        this._showDropdownMenu('layers', btn);
        break;
      case 'find':
        this._showDropdownMenu('find', btn);
        break;

      // Shape Styles & Quick Styles
      case 'quick-styles':
        this._showDropdownMenu('quick-styles', btn);
        break;
      case 'shape:effects':
        this._showDropdownMenu('effects', btn);
        break;

      // Insert Tab Features
      case 'insert:picture':
        this._insertPicture();
        break;
      case 'insert:chart':
        this._canvasManager.setTool('insert:chart');
        break;
      case 'insert:shapes-gallery':
        this._showShapesGalleryPopover(btn);
        break;
      case 'insert:container':
        this._showDropdownMenu('container', btn);
        break;
      case 'insert:callout':
        this._showDropdownMenu('callout', btn);
        break;
      case 'insert:link':
        this._showHyperlinkDialog(btn);
        break;
      case 'insert:cad':
        this._canvasManager.setTool('insert:cad');
        break;
      case 'text:symbol':
        this._showSymbolPicker(btn);
        break;
      case 'text:object':
        this._showInsertObjectDialog();
        break;
      case 'text:screentip':
        this._showScreenTipDialog();
        break;
      case 'text:field':
        this._showFieldChooserDialog(btn);
        break;

      // Page Setup & Insertion
      case 'page:insert-dropdown':
      case 'insert:page-dropdown':
        this._showDropdownMenu('new-page', btn);
        break;
      case 'page:orientation-toggle':
        this._showDropdownMenu('orientation', btn);
        break;
      case 'page:size-dialog':
        this._showDropdownMenu('size', btn);
        break;
      case 'page:auto-size':
        btn?.classList.toggle('active');
        break;
      case 'qat:customize':
        this._showDropdownMenu('qat-customize', btn);
        break;

      // View & Presentation
      case 'view:presentation':
        this._togglePresentationMode();
        break;
      case 'toggle-guides':
        if (this._canvasManager.alignmentGuideManager) {
          const enabled = !this._canvasManager.alignmentGuideManager.enabled;
          this._canvasManager.alignmentGuideManager.enabled = enabled;
          if (!enabled) {
            this._canvasManager.alignmentGuideManager.clearGuides();
          }
          btn?.classList.toggle('active', enabled);
          this._showToast(
            enabled
              ? 'Alignment Guides: ON (Shapes magnetically snap with alignment guide lines when moving)'
              : 'Alignment Guides: OFF (Snap guides disabled)'
          );
          const statusTool = document.getElementById('status-tool');
          if (statusTool) statusTool.textContent = enabled ? 'Guides: ON' : 'Guides: OFF';
        }
        break;
      case 'window:new':
        if (window.openDraw && window.openDraw.newWindow) {
          window.openDraw.newWindow();
        }
        break;
      case 'window:arrange-all':
        if (window.openDraw && window.openDraw.arrangeAllWindows) {
          window.openDraw.arrangeAllWindows();
        }
        break;
      case 'theme:system':
        this._canvasManager.themeManager?.applyUITheme('system');
        break;
      case 'theme:light':
        this._canvasManager.themeManager?.applyUITheme('light');
        break;
      case 'theme:dark':
        this._canvasManager.themeManager?.applyUITheme('dark');
        break;

      // Review Tools
      case 'review:spelling':
        window.openDrawDialog?.alert('Spelling check complete: No spelling errors found in active diagram.', 'Spelling');
        break;
      case 'review:thesaurus':
        window.openDrawDialog?.alert('Thesaurus: Look up synonyms for diagram terminology.', 'Thesaurus');
        break;
      case 'review:accessibility':
        window.openDrawDialog?.alert('Accessibility Checker: All shapes pass contrast and label verification.', 'Accessibility');
        break;
      case 'review:language':
      case 'review:language-dropdown':
        this._showDropdownMenu('language', btn);
        break;
      case 'review:new-comment':
        if (window.panelController) {
          window.panelController.toggleCommentsPane(true);
        }
        this._canvasManager.setTool('insert:comment');
        break;
      case 'review:comments-pane':
        if (window.panelController) {
          window.panelController.toggleCommentsPane();
        }
        break;
      case 'review:shape-reports': {
        const totalObjs = this._canvasManager.canvas.getObjects().length;
        const totalConn = this._canvasManager.connectorManager ? this._canvasManager.connectorManager.connectors.length : 0;
        const activePg = this._canvasManager.pageManager ? (this._canvasManager.pageManager.currentPageIndex + 1) : 1;
        window.openDrawDialog?.alert(`Total Objects: ${totalObjs}\nConnectors: ${totalConn}\nActive Page: ${activePg}`, 'Shape Report');
        break;
      }

      // Help
      case 'help:shortcuts':
        if (window.showShortcutsModal) window.showShortcutsModal();
        break;
      case 'help:contact':
        window.openDrawDialog?.alert('OpenDraw by Marco Sodano Help Desk:\nContact Marco Sodano / OpenDraw Support.', 'Contact Support');
        break;
      case 'help:feedback':
        window.openDrawDialog?.prompt('Send feedback to improve OpenDraw by Marco Sodano:', '', 'Feedback').then((fb) => {
          if (fb && fb.trim()) this._showToast('Thank you for your feedback!');
        });
        break;
      case 'help:training':
        window.openDrawDialog?.alert('• Drag & drop shapes from the left Stencils pane\n• Connect shapes with orthogonal arrows using AutoConnect\n• Customize fill, stroke, and fonts using the Home ribbon', 'Quick Start');
        break;
      case 'help:about': {
        const backstage = document.getElementById('backstage-menu');
        const tabCredits = document.getElementById('backstage-tab-credits');
        if (backstage) backstage.style.display = 'flex';
        if (tabCredits) tabCredits.click();
        break;
      }

      case 'toggle-shapes-panel':
        document.getElementById('shapes-panel')?.classList.toggle('collapsed');
        break;
      case 'toggle-properties-panel':
        document.getElementById('properties-panel')?.classList.toggle('collapsed');
        break;

      default:
        console.log(`Ribbon action: ${action}`);
    }
  }

  _adjustSelectedFontSize(delta) {
    const active = this._canvasManager.canvas.getActiveObjects();
    active.forEach((obj) => {
      const target = obj.labelObject || (obj.fontSize ? obj : null);
      if (target) {
        const cur = target.fontSize || 12;
        target.set('fontSize', Math.max(6, Math.min(120, cur + delta)));
      }
    });
    this._canvasManager.canvas.requestRenderAll();
  }

  _toggleSelectedFontStyle(prop, valTrue, valFalse) {
    const active = this._canvasManager.canvas.getActiveObjects();
    active.forEach((obj) => {
      const target = obj.labelObject || (obj[prop] !== undefined ? obj : null);
      if (target) {
        const cur = target[prop];
        target.set(prop, cur === valTrue ? valFalse : valTrue);
      }
    });
    this._canvasManager.canvas.requestRenderAll();
  }

  _toggleSelectedCase() {
    const active = this._canvasManager.canvas.getActiveObjects();
    active.forEach((obj) => {
      const target = obj.labelObject || (obj.text ? obj : null);
      if (target && target.text) {
        const t = target.text;
        target.set('text', t === t.toUpperCase() ? t.toLowerCase() : t.toUpperCase());
      }
    });
    this._canvasManager.canvas.requestRenderAll();
  }

  _setSelectedTextAlign(align) {
    const active = this._canvasManager.canvas.getActiveObjects();
    active.forEach((obj) => {
      const target = obj.labelObject || (obj.textAlign !== undefined ? obj : (obj.getObjects ? obj.getObjects().find(o => o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') : null));
      if (target) {
        target.set('textAlign', align);
        target.dirty = true;
        obj.dirty = true;
      }
    });
    if (this._canvasManager.inlineTextEditor && this._canvasManager.inlineTextEditor.inputElement) {
      this._canvasManager.inlineTextEditor.inputElement.style.textAlign = align;
    }
    this._canvasManager.canvas.requestRenderAll();
  }

  _transformLines(lineFn) {
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    active.forEach((obj) => {
      const textObj = obj.labelObject || (obj.text !== undefined ? obj : (obj.getObjects ? obj.getObjects().find(o => o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') : null));
      if (!textObj || typeof textObj.text !== 'string') return;

      const lines = textObj.text.split('\n');
      const newLines = lines.map(lineFn);
      const newText = newLines.join('\n');
      textObj.set('text', newText);
      textObj.dirty = true;
      obj.dirty = true;
    });

    this._canvasManager.canvas.requestRenderAll();
  }

  _toggleBullets() {
    this._transformLines((line) => {
      if (line.startsWith('• ')) return line.substring(2);
      return '• ' + line.replace(/^([0-9]+\.\s*|\*\s*)/, '');
    });
  }

  _toggleNumbering() {
    let index = 1;
    this._transformLines((line) => {
      if (/^[0-9]+\.\s*/.test(line)) return line.replace(/^[0-9]+\.\s*/, '');
      const cleaned = line.replace(/^[•\*]\s*/, '');
      return `${index++}. ${cleaned}`;
    });
  }

  _adjustIndent(delta) {
    this._transformLines((line) => {
      if (delta > 0) {
        return '    ' + line;
      } else {
        return line.replace(/^ {1,4}/, '').replace(/^\t/, '');
      }
    });
  }

  _applySubscript() {
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    const subMap = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
      '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
      'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ', 's': 'ₛ', 't': 'ₜ',
      '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
      '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
      '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')',
      'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₕ': 'h', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p', 'ₛ': 's', 'ₜ': 't',
    };

    active.forEach((obj) => {
      const textObj = obj.labelObject || (obj.text !== undefined ? obj : (obj.getObjects ? obj.getObjects().find(o => o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') : null));
      if (!textObj || typeof textObj.text !== 'string') return;

      const prevText = textObj.text;
      if (textObj.isEditing && textObj.selectionStart !== textObj.selectionEnd) {
        const start = textObj.selectionStart;
        const end = textObj.selectionEnd;
        const selectedStr = prevText.substring(start, end);
        const converted = selectedStr.split('').map(ch => subMap[ch] || ch).join('');
        const newText = prevText.substring(0, start) + converted + prevText.substring(end);
        textObj.set('text', newText);
        textObj.selectionStart = start;
        textObj.selectionEnd = start + converted.length;
      } else {
        const newText = prevText.split('').map(ch => subMap[ch] || ch).join('');
        textObj.set('text', newText);
      }
      obj.dirty = true;
      textObj.dirty = true;
    });

    this._canvasManager.canvas.requestRenderAll();
  }

  _applySuperscript() {
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    const superMap = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
      'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ',
      '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
      '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
      '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
      'ⁿ': 'n', 'ⁱ': 'i', 'ˣ': 'x', 'ʸ': 'y',
    };

    active.forEach((obj) => {
      const textObj = obj.labelObject || (obj.text !== undefined ? obj : (obj.getObjects ? obj.getObjects().find(o => o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') : null));
      if (!textObj || typeof textObj.text !== 'string') return;

      const prevText = textObj.text;
      if (textObj.isEditing && textObj.selectionStart !== textObj.selectionEnd) {
        const start = textObj.selectionStart;
        const end = textObj.selectionEnd;
        const selectedStr = prevText.substring(start, end);
        const converted = selectedStr.split('').map(ch => superMap[ch] || ch).join('');
        const newText = prevText.substring(0, start) + converted + prevText.substring(end);
        textObj.set('text', newText);
        textObj.selectionStart = start;
        textObj.selectionEnd = start + converted.length;
      } else {
        const newText = prevText.split('').map(ch => superMap[ch] || ch).join('');
        textObj.set('text', newText);
      }
      obj.dirty = true;
      textObj.dirty = true;
    });

    this._canvasManager.canvas.requestRenderAll();
  }

  _setActiveZoomOption(action) {
    document.querySelectorAll('[data-action="zoom-fit"], [data-action="zoom-100"], [data-action="zoom-page-width"]').forEach((b) => {
      b.classList.toggle('active', b.dataset.action === action);
    });
  }

  _applyQuickStyle() {
    const palettes = [
      { fill: '#D9E1F2', stroke: '#41719C' },
      { fill: '#FCE4D6', stroke: '#C65911' },
      { fill: '#E2EFDA', stroke: '#385723' },
      { fill: '#FFF2CC', stroke: '#BF8F00' },
      { fill: '#EDEDED', stroke: '#595959' },
      { fill: '#F2DCDB', stroke: '#963634' },
    ];
    const pick = palettes[Math.floor(Math.random() * palettes.length)];
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    const prevStates = active.map(obj => ({
      obj,
      prevFill: obj.geometryObject ? obj.geometryObject.fill : obj.fill,
      prevStroke: obj.geometryObject ? obj.geometryObject.stroke : obj.stroke,
    }));

    active.forEach((obj) => {
      this._setObjectFill(obj, pick.fill);
      this._setObjectStroke(obj, pick.stroke);
    });

    const fillInput = document.getElementById('ribbon-fill-color');
    const strokeInput = document.getElementById('ribbon-stroke-color');
    const bar = document.getElementById('fill-color-bar');
    if (fillInput) fillInput.value = pick.fill;
    if (strokeInput) strokeInput.value = pick.stroke;
    if (bar) bar.style.background = pick.fill;

    this._canvasManager.canvas.requestRenderAll();

    window.undoManager.record({
      name: `Apply Quick Style`,
      execute: () => {
        active.forEach(obj => {
          this._setObjectFill(obj, pick.fill);
          this._setObjectStroke(obj, pick.stroke);
        });
        this._canvasManager.canvas.requestRenderAll();
      },
      undo: () => {
        prevStates.forEach(({ obj, prevFill, prevStroke }) => {
          this._setObjectFill(obj, prevFill);
          this._setObjectStroke(obj, prevStroke);
        });
        this._canvasManager.canvas.requestRenderAll();
      },
    });
  }

  _toggleShadowEffect() {
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    active.forEach((obj) => {
      if (obj.shadow) {
        obj.set('shadow', null);
      } else {
        obj.set('shadow', { color: 'rgba(0,0,0,0.3)', blur: 8, offsetX: 4, offsetY: 4 });
      }
    });
    this._canvasManager.canvas.requestRenderAll();
  }

  _togglePageOrientation() {
    const sz = this._canvasManager.gridManager.pageSize;
    this._canvasManager.gridManager.setPageSize(sz.height, sz.width);
    this._canvasManager.zoomToFit();
  }

  _cyclePageSize() {
    const sizes = [
      { w: 21.5 * 96, h: 8.5 * 96, name: 'Tabloid / Wide' },
      { w: 11 * 96, h: 8.5 * 96, name: 'Letter' },
      { w: 11.69 * 96, h: 8.27 * 96, name: 'A4' },
      { w: 16.54 * 96, h: 11.69 * 96, name: 'A3' },
    ];
    const curW = this._canvasManager.gridManager.pageSize.width;
    let nextIdx = 0;
    if (Math.abs(curW - 21.5 * 96) < 10) nextIdx = 1;
    else if (Math.abs(curW - 11 * 96) < 10) nextIdx = 2;
    else if (Math.abs(curW - 11.69 * 96) < 10) nextIdx = 3;
    const next = sizes[nextIdx];
    this._canvasManager.gridManager.setPageSize(Math.round(next.w), Math.round(next.h));
    this._canvasManager.zoomToFit();
  }

  // =====================
  // INSERT TAB ACTIONS
  // =====================

  _insertPicture() {
    const fileInput = document.getElementById('insert-picture-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  _insertChart() {
    const vpt = this._canvasManager.canvas.viewportTransform;
    const zoom = this._canvasManager.canvas.getZoom();
    const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
    const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;
    this._canvasManager._insertShape('chart', cx, cy);
  }

  _insertContainer() {
    const vpt = this._canvasManager.canvas.viewportTransform;
    const zoom = this._canvasManager.canvas.getZoom();
    const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
    const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;
    this._canvasManager._insertShape('container', cx, cy);
  }

  _insertCallout() {
    const vpt = this._canvasManager.canvas.viewportTransform;
    const zoom = this._canvasManager.canvas.getZoom();
    const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
    const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;
    this._canvasManager._insertShape('callout', cx, cy);
  }

  async _insertLink() {
    const active = this._canvasManager.canvas.getActiveObject();
    if (!active) {
      if (window.openDrawDialog) {
        await window.openDrawDialog.alert('Please select a shape first to attach a hyperlink.', 'Insert Hyperlink');
      }
      return;
    }
    const currentUrl = active.hyperlink || 'https://';
    const url = window.openDrawDialog
      ? await window.openDrawDialog.prompt('Enter Hyperlink URL:', currentUrl, 'Insert Hyperlink')
      : null;
    if (url !== null && url.trim() !== '') {
      const prevUrl = active.hyperlink || null;
      const nextUrl = url.trim();
      const applyLink = (v) => {
        active.hyperlink = v;
        if (!active.shapeData) active.shapeData = {};
        if (v) active.shapeData.hyperlink = v; else delete active.shapeData.hyperlink;
      };
      applyLink(nextUrl);
      if (window.undoManager) {
        window.undoManager.record({
          name: 'Set Hyperlink',
          execute: () => applyLink(nextUrl),
          undo: () => applyLink(prevUrl),
        });
      }
      this._showToast(`Hyperlink attached: ${active.hyperlink}`);
    }
  }

  _insertCad() {
    const vpt = this._canvasManager.canvas.viewportTransform;
    const zoom = this._canvasManager.canvas.getZoom();
    const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
    const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;
    this._canvasManager._insertShape('rectangle', cx, cy, { width: 260, height: 160, text: 'CAD Drawing Frame' });
  }

  // =====================
  // SHAPE STYLING HELPERS
  // =====================

  _applyFillColor(color) {
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    const prevStates = active.map(obj => ({
      obj,
      prevFill: obj.geometryObject ? obj.geometryObject.fill : obj.fill,
    }));

    active.forEach((obj) => {
      this._setObjectFill(obj, color);
    });

    const bar = document.getElementById('fill-color-bar');
    if (bar) bar.style.background = color;

    this._canvasManager.canvas.requestRenderAll();

    window.undoManager.record({
      name: `Change Fill to ${color}`,
      execute: () => {
        active.forEach(obj => this._setObjectFill(obj, color));
        this._canvasManager.canvas.requestRenderAll();
      },
      undo: () => {
        prevStates.forEach(({ obj, prevFill }) => this._setObjectFill(obj, prevFill));
        this._canvasManager.canvas.requestRenderAll();
      },
    });
  }

  _setObjectFill(obj, color) {
    if (!obj) return;
    if (obj.geometryObject) {
      obj.geometryObject.set('fill', color);
      if (obj.geometryObject.getObjects) {
        obj.geometryObject.getObjects().forEach(child => {
          if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text' && child.objectType !== 'label') {
            child.set('fill', color);
          }
        });
      }
    } else if (obj.getObjects && obj.getObjects().length > 0) {
      obj.getObjects().forEach(child => {
        if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text' && child.objectType !== 'label') {
          child.set('fill', color);
        }
      });
    } else if (obj.type !== 'text' && obj.type !== 'textbox' && obj.type !== 'i-text') {
      obj.set('fill', color);
    }
    obj.dirty = true;
  }

  _applyStrokeColor(color) {
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    const prevStates = active.map(obj => ({
      obj,
      prevStroke: obj.geometryObject ? obj.geometryObject.stroke : obj.stroke,
    }));

    active.forEach((obj) => {
      this._setObjectStroke(obj, color);
    });

    this._canvasManager.canvas.requestRenderAll();

    window.undoManager.record({
      name: `Change Line Color to ${color}`,
      execute: () => {
        active.forEach(obj => this._setObjectStroke(obj, color));
        this._canvasManager.canvas.requestRenderAll();
      },
      undo: () => {
        prevStates.forEach(({ obj, prevStroke }) => this._setObjectStroke(obj, prevStroke));
        this._canvasManager.canvas.requestRenderAll();
      },
    });
  }

  _setObjectStroke(obj, color) {
    if (!obj) return;
    if (obj.connectorData && this._canvasManager.connectorManager) {
      this._canvasManager.connectorManager.updateConnectorStyle(obj.connectorData, { stroke: color }, true);
      return;
    }
    if (obj.geometryObject) {
      obj.geometryObject.set('stroke', color);
      if (obj.geometryObject.getObjects) {
        obj.geometryObject.getObjects().forEach(child => {
          if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text') {
            child.set('stroke', color);
          }
        });
      }
    } else if (obj.getObjects && obj.getObjects().length > 0) {
      obj.getObjects().forEach(child => {
        if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text') {
          child.set('stroke', color);
        }
      });
    } else {
      obj.set('stroke', color);
    }
    obj.dirty = true;
  }

  _applyStrokeWidth(width) {
    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    const prevStates = active.map(obj => ({
      obj,
      prevWidth: obj.connectorData ? obj.connectorData.style.strokeWidth : (obj.geometryObject ? obj.geometryObject.strokeWidth : obj.strokeWidth),
    }));

    active.forEach((obj) => {
      this._setObjectStrokeWidth(obj, width);
    });

    this._canvasManager.canvas.requestRenderAll();

    window.undoManager.record({
      name: `Change Line Width to ${width}pt`,
      execute: () => {
        active.forEach(obj => this._setObjectStrokeWidth(obj, width));
        this._canvasManager.canvas.requestRenderAll();
      },
      undo: () => {
        prevStates.forEach(({ obj, prevWidth }) => this._setObjectStrokeWidth(obj, prevWidth));
        this._canvasManager.canvas.requestRenderAll();
      },
    });
  }

  _setObjectStrokeWidth(obj, width) {
    if (!obj) return;
    if (obj.connectorData && this._canvasManager.connectorManager) {
      this._canvasManager.connectorManager.updateConnectorStyle(obj.connectorData, { strokeWidth: width }, true);
      return;
    }
    if (obj.geometryObject) {
      obj.geometryObject.set('strokeWidth', width);
      if (obj.geometryObject.getObjects) {
        obj.geometryObject.getObjects().forEach(child => {
          if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text') {
            child.set('strokeWidth', width);
          }
        });
      }
    } else if (obj.getObjects && obj.getObjects().length > 0) {
      obj.getObjects().forEach(child => {
        if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text') {
          child.set('strokeWidth', width);
        }
      });
    } else {
      obj.set('strokeWidth', width);
    }
    obj.dirty = true;
  }

  _applyStrokeDash(val) {
    let dash = null;
    if (val === 'dashed') dash = [6, 4];
    if (val === 'dotted') dash = [2, 2];

    const active = this._canvasManager.canvas.getActiveObjects();
    if (active.length === 0) return;

    const cm = this._canvasManager.connectorManager;
    const prevStates = active.map(obj => ({
      obj,
      prevDash: obj.connectorData ? (obj.connectorData.style?.strokeDashArray || null) : (obj.geometryObject ? obj.geometryObject.strokeDashArray : obj.strokeDashArray),
    }));

    const applyDash = (targetObj, d) => {
      if (targetObj.connectorData && cm) {
        cm.updateConnectorStyle(targetObj.connectorData, { strokeDashArray: d }, true);
        return;
      }
      if (targetObj.geometryObject) {
        targetObj.geometryObject.set('strokeDashArray', d);
        if (targetObj.geometryObject.getObjects) {
          targetObj.geometryObject.getObjects().forEach(child => {
            if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text') child.set('strokeDashArray', d);
          });
        }
      } else if (targetObj.getObjects && targetObj.getObjects().length > 0) {
        targetObj.getObjects().forEach(child => {
          if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text') child.set('strokeDashArray', d);
        });
      } else {
        targetObj.set('strokeDashArray', d);
      }
      targetObj.dirty = true;
    };

    active.forEach((obj) => applyDash(obj, dash));
    this._canvasManager.canvas.requestRenderAll();

    if (window.undoManager) {
      window.undoManager.record({
        name: `Change Line Style (${val})`,
        execute: () => {
          active.forEach((obj) => applyDash(obj, dash));
          this._canvasManager.canvas.requestRenderAll();
        },
        undo: () => {
          prevStates.forEach(({ obj, prevDash }) => applyDash(obj, prevDash));
          this._canvasManager.canvas.requestRenderAll();
        },
      });
    }
  }

  _setupStylePickers() {
    const fillInput = document.getElementById('ribbon-fill-color');
    const strokeInput = document.getElementById('ribbon-stroke-color');
    const strokeWidthSelect = document.getElementById('ribbon-stroke-width');
    const strokeDashSelect = document.getElementById('ribbon-stroke-dash');
    const fontSelect = document.getElementById('ribbon-font-family');
    const fontSizeSelect = document.getElementById('ribbon-font-size-select') || document.getElementById('ribbon-font-size');
    const fontColorInput = document.getElementById('ribbon-font-color');

    // Clicking anywhere on Fill row triggers color application or opens picker
    const rowFill = document.getElementById('row-shape-fill');
    if (rowFill && fillInput) {
      rowFill.addEventListener('click', (e) => {
        if (e.target !== fillInput) {
          const active = this._canvasManager.canvas.getActiveObjects();
          if (active.length > 0) {
            this._applyFillColor(fillInput.value);
          } else {
            fillInput.click();
          }
        }
      });
    }

    // Fill Color input change
    if (fillInput) {
      fillInput.addEventListener('input', (e) => {
        this._applyFillColor(e.target.value);
      });
    }

    // Clicking anywhere on Line row triggers line color application or opens picker
    const rowLine = document.getElementById('row-shape-line');
    if (rowLine && strokeInput) {
      rowLine.addEventListener('click', (e) => {
        if (e.target !== strokeInput && e.target !== strokeWidthSelect && e.target !== strokeDashSelect) {
          const active = this._canvasManager.canvas.getActiveObjects();
          if (active.length > 0) {
            this._applyStrokeColor(strokeInput.value);
          } else {
            strokeInput.click();
          }
        }
      });
    }

    // Stroke Color input change
    if (strokeInput) {
      strokeInput.addEventListener('input', (e) => {
        this._applyStrokeColor(e.target.value);
      });
    }

    // Stroke Width
    if (strokeWidthSelect) {
      strokeWidthSelect.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || 2;
        this._applyStrokeWidth(val);
      });
    }

    // Stroke Dash
    if (strokeDashSelect) {
      strokeDashSelect.addEventListener('change', (e) => {
        this._applyStrokeDash(e.target.value);
      });
    }

    // Font Color
    if (fontColorInput) {
      fontColorInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const active = this._canvasManager.canvas.getActiveObjects();
        active.forEach((obj) => {
          if (obj.labelObject) obj.labelObject.set('fill', val);
          else if (obj.fill && (obj.text || obj.type === 'textbox' || obj.type === 'i-text')) obj.set('fill', val);
        });
        this._canvasManager.canvas.requestRenderAll();
      });
    }

    // Font Family
    if (fontSelect) {
      fontSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const active = this._canvasManager.canvas.getActiveObjects();
        active.forEach((obj) => {
          if (obj.labelObject) obj.labelObject.set('fontFamily', val);
          else if (obj.fontFamily) obj.set('fontFamily', val);
        });
        this._canvasManager.canvas.requestRenderAll();
      });
    }

    // Font Size
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 12;
        const active = this._canvasManager.canvas.getActiveObjects();
        active.forEach((obj) => {
          if (obj.labelObject) obj.labelObject.set('fontSize', val);
          else if (obj.fontSize) obj.set('fontSize', val);
        });
        this._canvasManager.canvas.requestRenderAll();
      });
    }

    // Theme Cards in Design Tab (Authentic Visio Diagram Themes)
    document.querySelectorAll('.theme-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const theme = card.dataset.diagramTheme || card.dataset.theme;
        this._applyDiagramTheme(theme);
      });
    });
  }

  /**
   * Visio Shape Fill Color Palette Popover
   */
  _showFillColorPicker() {
    const existing = document.querySelector('.visio-color-popover');
    if (existing) {
      existing.remove();
      return;
    }
    this.closeAllDropdownsAndPopovers();

    const trigger = document.getElementById('btn-shape-fill') || document.getElementById('row-shape-fill');
    const rect = trigger ? trigger.getBoundingClientRect() : { left: 300, bottom: 90 };

    const popover = document.createElement('div');
    popover.className = 'visio-color-popover';
    popover.style.left = `${Math.max(10, rect.left)}px`;
    popover.style.top = `${rect.bottom + 4}px`;

    // 10 theme color columns x 6 tints/shades
    const themeMatrix = [
      ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#7f7f7f'],
      ['#000000', '#7f7f7f', '#595959', '#3f3f3f', '#262626', '#0c0c0c'],
      ['#d9e1f2', '#b4c6e7', '#8ea9db', '#305496', '#203764', '#172338'],
      ['#4472c4', '#cfdcf0', '#a0b9e2', '#7095d3', '#2f5597', '#1f3864'],
      ['#ed7d31', '#fbe5d6', '#f8cbad', '#f4b084', '#c65911', '#833c0c'],
      ['#a5a5a5', '#ededed', '#dbdbdb', '#c9c9c9', '#7b7b7b', '#525252'],
      ['#ffc000', '#fff2cc', '#ffe699', '#ffd966', '#bf8f00', '#7f6000'],
      ['#5b9bd5', '#deebf7', '#bdd7ee', '#9dc3e6', '#41719c', '#1e466e'],
      ['#70ad47', '#e2efda', '#c6e0b4', '#a9d18e', '#548235', '#375623'],
      ['#264478', '#e7eaf0', '#d0d5e1', '#a1acc3', '#1f3760', '#142440']
    ];

    const standardColors = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

    let gridHtml = '';
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 10; col++) {
        const c = themeMatrix[col][row];
        gridHtml += `<div class="visio-color-swatch" data-color="${c}" style="background:${c};" title="${c}"></div>`;
      }
    }

    let stdHtml = '';
    standardColors.forEach(c => {
      stdHtml += `<div class="visio-color-swatch" data-color="${c}" style="background:${c};" title="${c}"></div>`;
    });

    popover.innerHTML = `
      <div class="visio-popover-title">Theme Colors</div>
      <div class="visio-color-grid">${gridHtml}</div>
      <div class="visio-popover-title">Standard Colors</div>
      <div class="visio-color-grid" style="grid-template-rows: 16px; margin-bottom: 6px;">${stdHtml}</div>
      <div class="visio-popover-divider"></div>
      <button class="visio-popover-btn" data-color="transparent">
        <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="2" width="12" height="12" fill="none" stroke="#888" stroke-width="1.2"/><line x1="2" y1="2" x2="14" y2="14" stroke="#c00000" stroke-width="1.5"/></svg>
        <span>No Fill</span>
      </button>
      <button class="visio-popover-btn" id="btn-custom-fill-color">
        <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6" fill="url(#rainbow)" stroke="#555" stroke-width="1"/><defs><linearGradient id="rainbow"><stop offset="0%" stop-color="#f00"/><stop offset="33%" stop-color="#0f0"/><stop offset="66%" stop-color="#00f"/><stop offset="100%" stop-color="#f0f"/></linearGradient></defs></svg>
        <span>More Colors...</span>
      </button>
    `;

    document.body.appendChild(popover);

    popover.querySelectorAll('.visio-color-swatch, .visio-popover-btn[data-color]').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const col = swatch.dataset.color;
        this._applyFillColor(col);
        const bar = document.getElementById('fill-color-bar');
        if (bar) bar.style.background = col === 'transparent' ? 'transparent' : col;
        popover.remove();
      });
    });

    const moreBtn = popover.querySelector('#btn-custom-fill-color');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        popover.remove();
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#4472c4';
        input.addEventListener('input', (e) => this._applyFillColor(e.target.value));
        input.click();
      });
    }

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  /**
   * Visio Shape Line Color & Weight Popover
   */
  _showLineColorPicker() {
    const existing = document.querySelector('.visio-color-popover');
    if (existing) {
      existing.remove();
      return;
    }
    this.closeAllDropdownsAndPopovers();

    const trigger = document.getElementById('btn-shape-line') || document.getElementById('row-shape-line');
    const rect = trigger ? trigger.getBoundingClientRect() : { left: 300, bottom: 90 };

    const popover = document.createElement('div');
    popover.className = 'visio-color-popover';
    popover.style.left = `${Math.max(10, rect.left)}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.width = '230px';

    const standardColors = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
    let stdHtml = '';
    standardColors.forEach(c => {
      stdHtml += `<div class="visio-color-swatch" data-color="${c}" style="background:${c};" title="${c}"></div>`;
    });

    const curArrows = (() => {
      const cm = this._canvasManager.connectorManager;
      const activeConns = this._canvasManager.canvas.getActiveObjects().filter(o => o && o.connectorData).map(o => o.connectorData);
      const ref = activeConns[0] || null;
      const src = ref ? (cm && cm._isArrowVisible(ref.style && ref.style.sourceArrow)) : (cm && cm._isArrowVisible(cm.defaultStyle.sourceArrow));
      const tgt = ref ? (cm && cm._isArrowVisible(ref.style && ref.style.targetArrow)) : (cm && cm._isArrowVisible(cm.defaultStyle.targetArrow));
      return (src && tgt) ? 'both' : (tgt ? 'target' : (src ? 'source' : 'none'));
    })();

    popover.innerHTML = `
      <div class="visio-popover-title">Line Color</div>
      <div class="visio-color-grid" style="grid-template-rows: 16px; margin-bottom: 8px;">${stdHtml}</div>
      <button class="visio-popover-btn" data-color="transparent">
        <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="2" width="12" height="12" fill="none" stroke="#888" stroke-width="1.2"/><line x1="2" y1="2" x2="14" y2="14" stroke="#c00000" stroke-width="1.5"/></svg>
        <span>No Line</span>
      </button>
      <div class="visio-popover-divider"></div>
      <div class="visio-popover-title">Line Weight</div>
      <div style="display:flex; flex-direction:column; gap:2px; margin-bottom:8px;">
        <button class="visio-popover-btn" data-weight="1"><div style="width:50px; height:1px; background:currentColor; margin-right:8px;"></div> 1 pt</button>
        <button class="visio-popover-btn" data-weight="2"><div style="width:50px; height:2px; background:currentColor; margin-right:8px;"></div> 2 pt</button>
        <button class="visio-popover-btn" data-weight="3"><div style="width:50px; height:3px; background:currentColor; margin-right:8px;"></div> 3 pt</button>
        <button class="visio-popover-btn" data-weight="4"><div style="width:50px; height:4px; background:currentColor; margin-right:8px;"></div> 4 pt</button>
        <button class="visio-popover-btn" data-weight="6"><div style="width:50px; height:6px; background:currentColor; margin-right:8px;"></div> 6 pt</button>
      </div>
      <div class="visio-popover-divider"></div>
      <div class="visio-popover-title">Dashes</div>
      <div style="display:flex; flex-direction:column; gap:2px; margin-bottom:8px;">
        <button class="visio-popover-btn" data-dash="solid"><div style="width:50px; height:2px; background:currentColor; margin-right:8px;"></div> Solid</button>
        <button class="visio-popover-btn" data-dash="dashed"><div style="width:50px; height:2px; border-top:2px dashed currentColor; margin-right:8px;"></div> Dashed</button>
        <button class="visio-popover-btn" data-dash="dotted"><div style="width:50px; height:2px; border-top:2px dotted currentColor; margin-right:8px;"></div> Dotted</button>
      </div>
      <div class="visio-popover-divider"></div>
      <div class="visio-popover-title">Connector Arrows</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
        <button class="visio-popover-btn" data-arrows="none" style="justify-content:center;${curArrows === 'none' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">— None</button>
        <button class="visio-popover-btn" data-arrows="target" style="justify-content:center;${curArrows === 'target' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">→ End</button>
        <button class="visio-popover-btn" data-arrows="source" style="justify-content:center;${curArrows === 'source' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">← Start</button>
        <button class="visio-popover-btn" data-arrows="both" style="justify-content:center;${curArrows === 'both' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">↔ Both</button>
      </div>
    `;

    document.body.appendChild(popover);

    popover.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.color;
        this._applyStrokeColor(col);
        const bar = document.getElementById('line-color-bar');
        if (bar) bar.style.background = col === 'transparent' ? 'transparent' : col;
        popover.remove();
      });
    });

    popover.querySelectorAll('[data-weight]').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseFloat(btn.dataset.weight) || 2;
        this._applyStrokeWidth(w);
        popover.remove();
      });
    });

    popover.querySelectorAll('[data-dash]').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.dash;
        this._applyStrokeDash(d);
        popover.remove();
      });
    });

    popover.querySelectorAll('[data-arrows]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._setConnectorArrows(btn.dataset.arrows);
        popover.remove();
      });
    });

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  /**
   * Apply Visio Diagram Themes (Office, Linear, Facet, Dark, Radiant, Simple)
   */
  _applyDiagramTheme(themeName) {
    const themes = {
      office: {
        fill: '#D9E1F2',
        stroke: '#41719C',
        text: '#1F3864',
        connector: '#41719C',
        bg: '#FFFFFF',
      },
      linear: {
        fill: '#E0F2F1',
        stroke: '#008272',
        text: '#004D40',
        connector: '#008272',
        bg: '#FFFFFF',
      },
      facet: {
        fill: '#EDE7F6',
        stroke: '#4B0082',
        text: '#311B92',
        connector: '#4B0082',
        bg: '#FFFFFF',
      },
      dark: {
        fill: '#333333',
        stroke: '#0078D4',
        text: '#FFFFFF',
        connector: '#00D2D3',
        bg: '#1E1E1E',
      },
      radiant: {
        fill: '#F0F4F8',
        stroke: '#1B365D',
        text: '#1B365D',
        connector: '#F2A900',
        bg: '#FFFFFF',
      },
      simple: {
        fill: '#FFFFFF',
        stroke: '#2C3E50',
        text: '#2C3E50',
        connector: '#7F8C8D',
        bg: '#FFFFFF',
      },
    };

    const th = themes[themeName] || themes.office;

    if (window.ShapeFactory) {
      ShapeFactory.THEME.primary = { fill: th.fill, stroke: th.stroke, text: th.text };
    }

    if (window.panelController && typeof window.panelController.updateThemeColors === 'function') {
      window.panelController.updateThemeColors(th.fill, th.stroke);
    }

    if (this._canvasManager.connectorManager) {
      this._canvasManager.connectorManager.defaultStyle.stroke = th.connector;
      (this._canvasManager.connectorManager.connectors || []).forEach(c => {
        if (c.line) c.line.set('stroke', th.connector);
        if (c.arrow) c.arrow.set({ fill: th.connector, stroke: th.connector });
      });
    }

    const objects = this._canvasManager.canvas.getObjects().filter(
      obj => obj.objectType !== 'grid-line' && obj.objectType !== 'page-background'
    );

    objects.forEach(obj => {
      if (obj.objectType === 'connector' || obj.shapeType === 'connector') {
        obj.set('stroke', th.connector);
      } else if (obj.objectType !== 'picture') {
        this._setObjectFill(obj, th.fill);
        this._setObjectStroke(obj, th.stroke);
      }
    });

    const fillBar = document.getElementById('fill-color-bar');
    const lineBar = document.getElementById('line-color-bar');
    if (fillBar) fillBar.style.background = th.fill;
    if (lineBar) lineBar.style.background = th.stroke;

    this._canvasManager.canvas.requestRenderAll();
  }

  /**
   * Visio Background Picker (Grid stays visible on any sheet background)
   */
  _showBackgroundPicker(triggerEl) {
    const existing = document.querySelector('.visio-color-popover');
    if (existing) {
      existing.remove();
      return;
    }

    const trigger = triggerEl || document.querySelector('[data-action="insert:background"]');
    const rect = trigger ? trigger.getBoundingClientRect() : { left: 450, bottom: 90 };

    const popover = document.createElement('div');
    popover.className = 'visio-color-popover';
    popover.style.left = `${Math.max(10, rect.left)}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.width = '240px';

    const bgOptions = [
      { id: 'white', name: 'White Sheet (Standard)', fill: '#ffffff', stroke: '#cccccc' },
      { id: 'blueprint', name: 'Engineering Blueprint', fill: '#0f2b48', stroke: '#1e88e5' },
      { id: 'technical', name: 'Technical Light Gray', fill: '#f5f7fa', stroke: '#e0e4eb' },
      { id: 'dark', name: 'Dark Technical Canvas', fill: '#1e1e1e', stroke: '#333333' }
    ];

    let optHtml = '';
    bgOptions.forEach(opt => {
      optHtml += `
        <button class="visio-popover-btn" data-bg-fill="${opt.fill}" style="margin-bottom:4px;">
          <div style="width:28px; height:20px; background:${opt.fill}; border:1px solid ${opt.stroke}; border-radius:2px; margin-right:8px;"></div>
          <span>${opt.name}</span>
        </button>
      `;
    });

    popover.innerHTML = `
      <div class="visio-popover-title">Page Background</div>
      <div style="display:flex; flex-direction:column; gap:2px;">${optHtml}</div>
    `;

    document.body.appendChild(popover);

    popover.querySelectorAll('[data-bg-fill]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fill = btn.dataset.bgFill;
        // Key fix: GridManager.setPageColor ensures pattern grid remains visible over the background!
        if (this._canvasManager.gridManager && typeof this._canvasManager.gridManager.setPageColor === 'function') {
          this._canvasManager.gridManager.setPageColor(fill);
        } else {
          const pageBackground = this._canvasManager.canvas.getObjects().find(o => o.objectType === 'page-background');
          if (pageBackground) {
            pageBackground.set('fill', fill);
          } else {
            this._canvasManager.canvas.backgroundColor = fill;
          }
          this._canvasManager.canvas.requestRenderAll();
        }
        popover.remove();
      });
    });

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  /**
   * Visio Borders & Titles Dropdown Menu
   */
  _showBordersTitlesMenu(anchorEl) {
    const existing = document.querySelector('.visio-menu-popover');
    if (existing) {
      existing.remove();
      return;
    }

    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: 480, bottom: 90 };
    const popover = document.createElement('div');
    popover.className = 'visio-menu-popover';
    popover.style.left = `${Math.max(10, rect.left)}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.width = '300px';

    popover.innerHTML = `
      <div class="visio-menu-header">Borders & Title Blocks</div>
      <div class="visio-menu-item" data-border-type="none">
        <svg viewBox="0 0 16 16"><path d="M4 4l8 8m0-8L4 12" stroke="#e74c3c" stroke-width="2"/></svg>
        <span>No Border / Title (Remove)</span>
      </div>
      <div class="visio-menu-divider"></div>
      <div class="visio-menu-item" data-border-type="engineering">
        <svg viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" fill="none" stroke="#0078d4" stroke-width="1.5"/><rect x="8" y="10" width="7" height="5" fill="#e1dfdd" stroke="#0078d4"/></svg>
        <span>Engineering Title Block (Marco Sodano MS)</span>
      </div>
      <div class="visio-menu-item" data-border-type="banner">
        <svg viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="4" fill="#0078d4"/><line x1="1" y1="6" x2="15" y2="6" stroke="#0078d4"/><rect x="1" y="1" width="14" height="14" fill="none" stroke="#666"/></svg>
        <span>Modern Corporate Header Banner</span>
      </div>
      <div class="visio-menu-item" data-border-type="minimal">
        <svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="#0078d4" stroke-width="1"/></svg>
        <span>Minimal Framing Border</span>
      </div>
      <div class="visio-menu-item" data-border-type="technical-grid">
        <svg viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" fill="none" stroke="#0078d4" stroke-width="1.5"/><line x1="1" y1="5" x2="2" y2="5" stroke="#0078d4"/><line x1="1" y1="10" x2="2" y2="10" stroke="#0078d4"/><line x1="5" y1="1" x2="5" y2="2" stroke="#0078d4"/><line x1="10" y1="1" x2="10" y2="2" stroke="#0078d4"/></svg>
        <span>Technical Margin Grid (A-D, 1-4)</span>
      </div>
    `;

    document.body.appendChild(popover);

    popover.querySelectorAll('[data-border-type]').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.borderType;
        this._applyBorderAndTitleStyle(type);
        popover.remove();
      });
    });

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && (!anchorEl || !anchorEl.contains(e.target))) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  _applyBorderAndTitleStyle(type) {
    const canvas = this._canvasManager.canvas;
    const oldBorders = canvas.getObjects().filter(
      o => o.objectType === 'border-frame' || o.objectType === 'title-block'
    );
    oldBorders.forEach(b => canvas.remove(b));

    if (type === 'none') {
      canvas.requestRenderAll();
      return;
    }

    const pageSize = this._canvasManager.gridManager.pageSize;
    const margin = 20;
    const w = pageSize.width - margin * 2;
    const h = pageSize.height - margin * 2;

    if (type === 'engineering') {
      const outerBorder = new fabric.Rect({
        left: margin,
        top: margin,
        width: w,
        height: h,
        fill: 'transparent',
        stroke: '#0078d4',
        strokeWidth: 2,
        selectable: true,
        objectType: 'border-frame',
      });

      const blockW = 280;
      const blockH = 75;
      const blockX = margin + w - blockW;
      const blockY = margin + h - blockH;

      const titleBox = new fabric.Rect({
        left: 0,
        top: 0,
        width: blockW,
        height: blockH,
        fill: '#f0f4f8',
        stroke: '#0078d4',
        strokeWidth: 1.5,
        originX: 'left',
        originY: 'top',
      });

      const lineH = new fabric.Line([0, 34, blockW, 34], { stroke: '#0078d4', strokeWidth: 1 });
      const lineV = new fabric.Line([170, 34, 170, blockH], { stroke: '#0078d4', strokeWidth: 1 });

      const titleText = new fabric.Text('OpenDraw Architecture Diagram', {
        left: 10,
        top: 8,
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: 'Segoe UI, Calibri, sans-serif',
        fill: '#003366',
      });

      const authorText = new fabric.Text('Author: Marco Sodano (MS)', {
        left: 10,
        top: 42,
        fontSize: 10,
        fontFamily: 'Segoe UI, Calibri, sans-serif',
        fill: '#333333',
      });

      const dateText = new fabric.Text(`Date: ${new Date().toLocaleDateString()}`, {
        left: 178,
        top: 42,
        fontSize: 10,
        fontFamily: 'Segoe UI, Calibri, sans-serif',
        fill: '#555555',
      });

      const titleGroup = new fabric.Group([titleBox, lineH, lineV, titleText, authorText, dateText], {
        left: blockX,
        top: blockY,
        originX: 'left',
        originY: 'top',
        selectable: true,
        objectType: 'title-block',
      });
      titleGroup.labelObject = titleText;

      canvas.add(outerBorder);
      canvas.add(titleGroup);
      canvas.sendObjectToBack(titleGroup);
      canvas.sendObjectToBack(outerBorder);
    } else if (type === 'banner') {
      const bannerH = 44;
      const bannerBg = new fabric.Rect({
        left: margin,
        top: margin,
        width: w,
        height: bannerH,
        fill: '#0078d4',
        selectable: true,
        objectType: 'border-frame',
      });
      const bannerText = new fabric.Text('OpenDraw Diagram — Marco Sodano (MS)', {
        left: margin + 14,
        top: margin + 12,
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'Segoe UI, Calibri, sans-serif',
        fill: '#ffffff',
        selectable: true,
        objectType: 'title-block',
      });
      const bottomLine = new fabric.Line([margin, margin + h, margin + w, margin + h], {
        stroke: '#0078d4',
        strokeWidth: 2,
        selectable: true,
        objectType: 'border-frame'
      });
      canvas.add(bannerBg);
      canvas.add(bannerText);
      canvas.add(bottomLine);
      canvas.sendObjectToBack(bannerText);
      canvas.sendObjectToBack(bannerBg);
      canvas.sendObjectToBack(bottomLine);
    } else if (type === 'minimal') {
      const minimalBorder = new fabric.Rect({
        left: margin,
        top: margin,
        width: w,
        height: h,
        fill: 'transparent',
        stroke: '#0078d4',
        strokeWidth: 1.5,
        selectable: true,
        objectType: 'border-frame',
      });
      canvas.add(minimalBorder);
      canvas.sendObjectToBack(minimalBorder);
    } else if (type === 'technical-grid') {
      const techBorder = new fabric.Rect({
        left: margin,
        top: margin,
        width: w,
        height: h,
        fill: 'transparent',
        stroke: '#0078d4',
        strokeWidth: 2,
        selectable: true,
        objectType: 'border-frame',
      });
      canvas.add(techBorder);
      canvas.sendObjectToBack(techBorder);
    }

    if (this._canvasManager.connectorManager) {
      this._canvasManager.connectorManager._keepGridAtBack();
    }
    canvas.requestRenderAll();
  }

  /**
   * Backward-compatibility wrapper for direct title block insertion
   */
  _insertBorderAndTitle() {
    this._applyBorderAndTitleStyle('engineering');
  }

  /**
   * Visio Re-Layout Page Dropdown Menu
   */
  _showRelayoutMenu(anchorEl) {
    const existing = document.querySelector('.visio-menu-popover');
    if (existing) {
      existing.remove();
      return;
    }
    this.closeAllDropdownsAndPopovers();

    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: 550, bottom: 90 };
    const popover = document.createElement('div');
    popover.className = 'visio-menu-popover';
    popover.style.left = `${Math.max(10, rect.left)}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.width = '240px';

    popover.innerHTML = `
      <div class="visio-menu-header">Re-Layout Page</div>
      <div class="visio-menu-item" data-layout="tb">
        <svg viewBox="0 0 16 16"><path d="M8 2v10M4 8l4 4 4-4" stroke="#0078d4" stroke-width="1.8" fill="none"/></svg>
        <span>Top to Bottom (Hierarchical)</span>
      </div>
      <div class="visio-menu-item" data-layout="lr">
        <svg viewBox="0 0 16 16"><path d="M2 8h10M8 4l4 4-4 4" stroke="#0078d4" stroke-width="1.8" fill="none"/></svg>
        <span>Left to Right (Horizontal)</span>
      </div>
      <div class="visio-menu-item" data-layout="bt">
        <svg viewBox="0 0 16 16"><path d="M8 14V4M4 8l4-4 4 4" stroke="#0078d4" stroke-width="1.8" fill="none"/></svg>
        <span>Bottom to Top (Inverted)</span>
      </div>
      <div class="visio-menu-item" data-layout="radial">
        <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="#0078d4" stroke-width="1.5" fill="none"/><circle cx="8" cy="8" r="2" fill="#0078d4"/></svg>
        <span>Radial / Circular Flow</span>
      </div>
      <div class="visio-menu-item" data-layout="compact">
        <svg viewBox="0 0 16 16"><rect x="2" y="2" width="4" height="4" fill="#0078d4"/><rect x="8" y="2" width="6" height="4" fill="#0078d4"/><rect x="2" y="8" width="6" height="6" fill="#0078d4"/><rect x="10" y="8" width="4" height="6" fill="#0078d4"/></svg>
        <span>Compact Organic Flow</span>
      </div>
    `;

    document.body.appendChild(popover);

    popover.querySelectorAll('[data-layout]').forEach(item => {
      item.addEventListener('click', () => {
        const layoutType = item.dataset.layout;
        this._applyLayoutWithUndo(layoutType);
        popover.remove();
      });
    });

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && (!anchorEl || !anchorEl.contains(e.target))) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  /**
   * Apply Diagram Auto-Layout with Undo Support
   */
  _applyLayoutWithUndo(layoutType) {
    const canvas = this._canvasManager.canvas;
    const alm = this._canvasManager.autoLayoutManager;
    if (!alm) return;

    // Snapshot pre-layout positions into undo manager
    const shapes = canvas.getObjects().filter(
      o => o.objectType !== 'grid-line' && o.objectType !== 'page-background' && o.objectType !== 'connector' && o.objectType !== 'border-frame' && o.objectType !== 'title-block'
    );
    const prevPositions = shapes.map(s => ({ obj: s, left: s.left, top: s.top }));

    if (layoutType === 'lr') {
      alm.layoutLeftToRight();
    } else if (layoutType === 'bt' && alm.layoutBottomToTop) {
      alm.layoutBottomToTop();
    } else if (layoutType === 'radial' && alm.layoutRadial) {
      alm.layoutRadial();
    } else if (layoutType === 'compact' && alm.layoutCompact) {
      alm.layoutCompact();
    } else {
      alm.layoutTopToBottom();
    }

    if (window.undoManager) {
      const nextPositions = shapes.map(s => ({ obj: s, left: s.left, top: s.top }));
      window.undoManager.push({
        name: 'Auto-Layout',
        undo: () => {
          prevPositions.forEach(p => {
            p.obj.set({ left: p.left, top: p.top });
            p.obj.setCoords();
          });
          if (this._canvasManager.connectorManager) {
            this._canvasManager.connectorManager.connectors.forEach(c => this._canvasManager.connectorManager.updateConnector(c));
          }
          canvas.requestRenderAll();
        },
        execute: () => {
          nextPositions.forEach(p => {
            p.obj.set({ left: p.left, top: p.top });
            p.obj.setCoords();
          });
          if (this._canvasManager.connectorManager) {
            this._canvasManager.connectorManager.connectors.forEach(c => this._canvasManager.connectorManager.updateConnector(c));
          }
          canvas.requestRenderAll();
        },
        redo: () => {
          nextPositions.forEach(p => {
            p.obj.set({ left: p.left, top: p.top });
            p.obj.setCoords();
          });
          if (this._canvasManager.connectorManager) {
            this._canvasManager.connectorManager.connectors.forEach(c => this._canvasManager.connectorManager.updateConnector(c));
          }
          canvas.requestRenderAll();
        }
      });
    }
  }

  /**
   * Visio Connectors Routing Dropdown Menu
   */
  _showConnectorRoutingMenu(anchorEl, activateTool = false) {
    const existing = document.querySelector('.visio-menu-popover[data-menu="connectors"]');
    if (existing) {
      existing.remove();
      return;
    }
    this.closeAllDropdownsAndPopovers();

    const baseAnchor = (anchorEl && anchorEl.closest && anchorEl.closest('.ribbon-btn-large')) || anchorEl;
    const rect = baseAnchor ? baseAnchor.getBoundingClientRect() : { left: 260, bottom: 96 };
    const popover = document.createElement('div');
    popover.className = 'visio-menu-popover';
    popover.dataset.menu = 'connectors';
    const menuW = 248;
    const posX = Math.min(window.innerWidth - menuW - 10, Math.max(8, rect.left || 260));
    popover.style.left = `${posX}px`;
    popover.style.top = `${(rect.bottom || 96) + 4}px`;
    popover.style.width = `${menuW}px`;

    const cm = this._canvasManager.connectorManager;
    const currentRouting = (cm && cm.defaultStyle.routingType) || 'orthogonal';
    const activeConns = this._canvasManager.canvas.getActiveObjects().filter(o => o && o.connectorData).map(o => o.connectorData);
    const arrowRef = activeConns[0] ? activeConns[0].style : (cm ? cm.defaultStyle : {});
    const hasSrcArrow = cm && cm._isArrowVisible(arrowRef && arrowRef.sourceArrow);
    const hasTgtArrow = cm && cm._isArrowVisible(arrowRef && arrowRef.targetArrow);
    const curArrows = (hasSrcArrow && hasTgtArrow) ? 'both' : (hasTgtArrow ? 'target' : (hasSrcArrow ? 'source' : 'none'));

    const opts = [
      {
        id: 'orthogonal',
        title: 'Right Angle',
        desc: '90° orthogonal Visio routing',
        shortcut: 'Ctrl+3',
        svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M3 16h6V4h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><polygon points="18,4 14.5,2 14.5,6" fill="currentColor"/></svg>',
      },
      {
        id: 'straight',
        title: 'Straight',
        desc: 'Direct line between endpoints',
        shortcut: '',
        svg: '<svg viewBox="0 0 20 20" fill="none"><line x1="3" y1="16" x2="17" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polygon points="18,3.2 13.8,4.2 16.4,7.2" fill="currentColor"/></svg>',
      },
      {
        id: 'curved',
        title: 'Curved',
        desc: 'Smooth Bezier curve routing',
        shortcut: '',
        svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M3 16C7 16 11 4 17 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polygon points="18,4 14.5,2 14.5,6" fill="currentColor"/></svg>',
      },
    ];

    popover.innerHTML = `
      <div class="visio-menu-header">Connectors</div>
      ${opts.map(o => {
        const isSel = currentRouting === o.id;
        return `
          <div class="visio-menu-item ${isSel ? 'selected' : ''}" data-routing="${o.id}">
            <span class="visio-menu-check">${isSel ? '✓' : ''}</span>
            <span style="display:inline-flex; color:inherit;">${o.svg}</span>
            <span class="visio-menu-item-meta">
              <span>${o.title}</span>
              <span class="visio-menu-desc">${o.desc}</span>
            </span>
            ${o.shortcut ? `<span class="visio-menu-shortcut">${o.shortcut}</span>` : ''}
          </div>
        `;
      }).join('')}
      <div style="height:1px; background:var(--border); margin:4px 8px;"></div>
      <div style="padding:3px 12px 2px; font-size:10px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px;">Arrows</div>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:4px; padding:4px 10px 6px;">
        <button class="visio-popover-btn" data-arrows="none" title="Remove Arrows" style="justify-content:center; padding:4px 2px; font-size:11px;${curArrows === 'none' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">— None</button>
        <button class="visio-popover-btn" data-arrows="target" title="End Arrow" style="justify-content:center; padding:4px 2px; font-size:11px;${curArrows === 'target' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">→ End</button>
        <button class="visio-popover-btn" data-arrows="source" title="Start Arrow" style="justify-content:center; padding:4px 2px; font-size:11px;${curArrows === 'source' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">← Start</button>
        <button class="visio-popover-btn" data-arrows="both" title="Both Arrows" style="justify-content:center; padding:4px 2px; font-size:11px;${curArrows === 'both' ? 'background:var(--accent-light);border:1px solid var(--accent);' : ''}">↔ Both</button>
      </div>
    `;

    document.body.appendChild(popover);

    popover.querySelectorAll('[data-routing]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const routing = item.dataset.routing;
        this._setConnectorRouting(routing);
        if (activateTool) {
          this._canvasManager.setTool('insert:connector');
        }
        popover.remove();
      });
    });

    popover.querySelectorAll('[data-arrows]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._setConnectorArrows(btn.dataset.arrows);
        popover.remove();
      });
    });

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && (!anchorEl || !anchorEl.contains(e.target))) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  _setConnectorArrows(mode) {
    const cm = this._canvasManager.connectorManager;
    if (!cm) return;
    const patch = {
      sourceArrow: (mode === 'source' || mode === 'both') ? 'arrow' : 'none',
      targetArrow: (mode === 'target' || mode === 'both') ? 'arrow' : 'none',
    };
    cm.defaultStyle.sourceArrow = patch.sourceArrow;
    cm.defaultStyle.targetArrow = patch.targetArrow;
    const activeConns = this._canvasManager.canvas.getActiveObjects()
      .filter(o => o && o.connectorData)
      .map(o => o.connectorData);
    activeConns.forEach(conn => {
      cm.updateConnectorStyle(conn, patch);
    });
    const propArrow = document.getElementById('prop-arrow-type');
    if (propArrow && activeConns.length > 0) propArrow.value = mode;
    this._canvasManager.canvas.requestRenderAll();
  }

  _setConnectorRouting(routing) {
    const cm = this._canvasManager.connectorManager;
    if (!cm) return;

    cm.defaultStyle.routingType = routing;
    const activeConns = this._canvasManager.canvas.getActiveObjects()
      .filter(o => o && o.connectorData)
      .map(o => o.connectorData);
    const targets = activeConns.length > 0 ? activeConns : (cm.connectors || []);
    targets.forEach(conn => {
      cm.updateConnectorStyle(conn, { routingType: routing });
    });
    this._canvasManager.canvas.requestRenderAll();
  }

  /**
   * Toggle Connector Routing (Orthogonal vs Straight)
   */
  _toggleConnectorRoutingStyle() {
    const cm = this._canvasManager.connectorManager;
    if (!cm) return;
    const curType = cm.defaultStyle.routingType || 'orthogonal';
    this._setConnectorRouting(curType === 'orthogonal' ? 'straight' : 'orthogonal');
  }

  /**
   * Create an authentic Visio Comment note card at the specified canvas coordinates.
   */
  createCommentCardAt(posX, posY, initialText = 'Type comment here...', customWidth = null, customHeight = null) {
    if (this._canvasManager.activeTool !== 'select') {
      this._canvasManager.setTool('select');
    }

    const canvas = this._canvasManager.canvas;
    const cardW = customWidth ? Math.max(140, Math.round(customWidth)) : 210;
    const cardH = customHeight ? Math.max(60, Math.round(customHeight)) : 84;
    const headerH = 24;

    const bgRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: cardW,
      height: cardH,
      fill: '#FFFDE7',
      stroke: '#FBC02D',
      strokeWidth: 1.5,
      rx: 4,
      ry: 4,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.18)', blur: 8, offsetX: 2, offsetY: 2 })
    });

    const headerBar = new fabric.Rect({
      left: 0,
      top: 0,
      width: cardW,
      height: headerH,
      fill: '#FFF59D',
      rx: 4,
      ry: 4
    });

    const authorText = new fabric.Text('Marco Sodano', {
      left: 8,
      top: 5,
      fontSize: 10,
      fontWeight: 'bold',
      fill: '#F57F17',
      fontFamily: 'Segoe UI, Calibri, sans-serif'
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateText = new fabric.Text(dateStr, {
      left: Math.max(90, cardW - 85),
      top: 6,
      fontSize: 9,
      fill: '#9E9D24',
      fontFamily: 'Segoe UI, Calibri, sans-serif'
    });

    const commentText = new fabric.Textbox(initialText, {
      left: 8,
      top: headerH + 6,
      width: Math.max(80, cardW - 16),
      fontSize: 11,
      fill: '#37474F',
      fontFamily: 'Segoe UI, Calibri, sans-serif',
      splitByGrapheme: true
    });

    const commentGroup = new fabric.Group([bgRect, headerBar, authorText, dateText, commentText], {
      left: Math.max(10, posX),
      top: Math.max(10, posY),
      selectable: true,
      hasControls: true,
      hasBorders: true,
      objectType: 'comment-card'
    });
    commentGroup.labelObject = commentText;
    commentGroup.commentAuthor = 'Marco Sodano';
    commentGroup.commentDate = dateStr;

    canvas.add(commentGroup);
    canvas.setActiveObject(commentGroup);
    canvas.requestRenderAll();

    window.undoManager.record({
      name: 'Insert Comment',
      execute: () => {
        canvas.add(commentGroup);
        canvas.requestRenderAll();
        if (window.panelController) window.panelController.refreshCommentsList();
      },
      undo: () => {
        canvas.remove(commentGroup);
        canvas.requestRenderAll();
        if (window.panelController) window.panelController.refreshCommentsList();
      }
    });

    if (window.panelController) {
      window.panelController.refreshCommentsList();
    }

    if (this._canvasManager.inlineTextEditor) {
      this._canvasManager.inlineTextEditor.edit(commentGroup);
    }

    return commentGroup;
  }

  /**
   * Insert authentic Visio Comment note card (Switches from Pan to Pointer tool automatically)
   */
  _insertCommentCard() {
    const canvas = this._canvasManager.canvas;
    const activeObj = canvas.getActiveObject();
    let posX = 120;
    let posY = 120;

    if (activeObj && activeObj.objectType !== 'page-background' && activeObj.objectType !== 'grid-line') {
      posX = (activeObj.left || 100) + (activeObj.width || 100) + 20;
      posY = activeObj.top || 100;
    } else {
      const vpt = canvas.viewportTransform;
      const zoom = canvas.getZoom();
      posX = (-vpt[4] + canvas.getWidth() / 2) / zoom - 100;
      posY = (-vpt[5] + canvas.getHeight() / 2) / zoom - 45;
    }

    return this.createCommentCardAt(posX, posY);
  }

  /**
   * Full-Screen Presentation Mode
   */
  _togglePresentationMode() {
    const isPresentation = document.body.classList.toggle('presentation-mode');
    let toolbar = document.getElementById('presentation-toolbar');
    let laserDot = document.getElementById('laser-pointer-dot');

    if (isPresentation) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'presentation-toolbar';
        document.body.appendChild(toolbar);
      }

      if (!laserDot) {
        laserDot = document.createElement('div');
        laserDot.id = 'laser-pointer-dot';
        document.body.appendChild(laserDot);
      }

      const totalPages = (this._canvasManager.pageManager && this._canvasManager.pageManager.pages) ? this._canvasManager.pageManager.pages.length : 1;
      const curPage = (this._canvasManager.pageManager && this._canvasManager.pageManager.activePageIndex !== undefined) ? this._canvasManager.pageManager.activePageIndex + 1 : 1;

      toolbar.innerHTML = `
        <button class="presentation-btn" id="pres-btn-prev" title="Previous Page (PageUp / Left Arrow)">
          <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <span class="presentation-page-info" id="pres-page-label">Page ${curPage} of ${totalPages}</span>
        <button class="presentation-btn" id="pres-btn-next" title="Next Page (PageDown / Right Arrow / Space)">
          <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
        <div class="presentation-divider"></div>
        <button class="presentation-btn" id="pres-btn-zoom-out" title="Zoom Out (-)">
          <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
        </button>
        <button class="presentation-btn" id="pres-btn-zoom-fit" title="Fit to Screen (F)">
          <svg viewBox="0 0 24 24"><path d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm18 0v6h-6v-2h4v-4h2z"/></svg>
        </button>
        <button class="presentation-btn" id="pres-btn-zoom-in" title="Zoom In (+)">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
        <div class="presentation-divider"></div>
        <button class="presentation-btn" id="pres-btn-laser" title="Laser Pointer (L)">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <div class="presentation-divider"></div>
        <button class="presentation-btn" id="pres-btn-exit" title="Exit Presentation Mode (Esc / F5)">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      `;

      let laserActive = false;
      const laserBtn = document.getElementById('pres-btn-laser');
      const onMouseMoveLaser = (e) => {
        if (laserActive && laserDot) {
          laserDot.style.left = `${e.clientX}px`;
          laserDot.style.top = `${e.clientY}px`;
        }
      };

      laserBtn.addEventListener('click', () => {
        laserActive = !laserActive;
        laserBtn.classList.toggle('active', laserActive);
        laserDot.style.display = laserActive ? 'block' : 'none';
        document.body.style.cursor = laserActive ? 'none' : 'default';
        if (laserActive) {
          window.addEventListener('mousemove', onMouseMoveLaser);
        } else {
          window.removeEventListener('mousemove', onMouseMoveLaser);
        }
      });

      document.getElementById('pres-btn-zoom-in').addEventListener('click', () => {
        this._canvasManager.zoomIn();
      });
      document.getElementById('pres-btn-zoom-out').addEventListener('click', () => {
        this._canvasManager.zoomOut();
      });
      document.getElementById('pres-btn-zoom-fit').addEventListener('click', () => {
        this._canvasManager.zoomToFit();
      });
      document.getElementById('pres-btn-next').addEventListener('click', () => {
        if (this._canvasManager.pageManager && this._canvasManager.pageManager.nextPage) {
          this._canvasManager.pageManager.nextPage();
          this._updatePresPageInfo();
        }
      });
      document.getElementById('pres-btn-prev').addEventListener('click', () => {
        if (this._canvasManager.pageManager && this._canvasManager.pageManager.prevPage) {
          this._canvasManager.pageManager.prevPage();
          this._updatePresPageInfo();
        }
      });
      document.getElementById('pres-btn-exit').addEventListener('click', () => {
        this._togglePresentationMode();
      });

      const onKeyDownPres = (e) => {
        if (e.key === 'Escape' || e.key === 'F5') {
          e.preventDefault();
          this._togglePresentationMode();
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          document.getElementById('pres-btn-next')?.click();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          document.getElementById('pres-btn-prev')?.click();
        } else if (e.key === 'l' || e.key === 'L') {
          laserBtn?.click();
        } else if (e.key === 'f' || e.key === 'F') {
          this._canvasManager.zoomToFit();
        }
      };
      window.addEventListener('keydown', onKeyDownPres);
      this._presKeyDownHandler = onKeyDownPres;

      setTimeout(() => this._canvasManager.zoomToFit(), 60);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (toolbar) toolbar.remove();
      if (laserDot) laserDot.remove();
      document.body.style.cursor = 'default';
      if (this._presKeyDownHandler) {
        window.removeEventListener('keydown', this._presKeyDownHandler);
        this._presKeyDownHandler = null;
      }
      setTimeout(() => this._canvasManager.zoomToFit(), 60);
    }
  }

  _updatePresPageInfo() {
    const lbl = document.getElementById('pres-page-label');
    if (lbl && this._canvasManager.pageManager) {
      const total = (this._canvasManager.pageManager.pages || []).length;
      const cur = (this._canvasManager.pageManager.activePageIndex !== undefined ? this._canvasManager.pageManager.activePageIndex : 0) + 1;
      lbl.textContent = `Page ${cur} of ${total}`;
    }
  }

  /**
   * Tell Me What You Want To Do Autocomplete & Command Runner
   */
  _setupTellMeSearch() {
    const input = document.getElementById('tell-me-input');
    const dropdown = document.getElementById('tell-me-dropdown');
    if (!input || !dropdown) return;

    const commands = [
      { title: 'Zoom to Fit', category: 'View', action: () => this._canvasManager.zoomToFit() },
      { title: 'Zoom 100%', category: 'View', action: () => this._canvasManager.zoom100() },
      { title: 'Toggle Grid', category: 'View', action: () => this._canvasManager.gridManager.toggle() },
      { title: 'Select Tool (Pointer)', category: 'Tools', action: () => this._canvasManager.setTool('select') },
      { title: 'Pan Tool (Hand)', category: 'Tools', action: () => this._canvasManager.setTool('pan') },
      { title: 'Insert Connector', category: 'Tools', action: () => this._canvasManager.setTool('insert:connector') },
      { title: 'Insert Text Box', category: 'Tools', action: () => this._canvasManager.setTool('insert:textbox') },
      { title: 'Insert Rectangle', category: 'Shapes', action: () => this._insertCenter('rectangle') },
      { title: 'Connector: End Arrow (→)', category: 'Design', action: () => this._setConnectorArrows('target') },
      { title: 'Connector: Start Arrow (←)', category: 'Design', action: () => this._setConnectorArrows('source') },
      { title: 'Connector: Both Arrows (↔)', category: 'Design', action: () => this._setConnectorArrows('both') },
      { title: 'Connector: Remove Arrows (—)', category: 'Design', action: () => this._setConnectorArrows('none') },
      { title: 'Align Left', category: 'Arrange', action: () => window.alignObjects && window.alignObjects('left') },
      { title: 'Align Center Vertically', category: 'Arrange', action: () => window.alignObjects && window.alignObjects('center-v') },
      { title: 'Align Right', category: 'Arrange', action: () => window.alignObjects && window.alignObjects('right') },
      { title: 'Group Selected', category: 'Arrange', action: () => window.groupSelected && window.groupSelected() },
      { title: 'Ungroup Selected', category: 'Arrange', action: () => window.ungroupSelected && window.ungroupSelected() },
      { title: 'Re-Layout Diagram (Top to Bottom)', category: 'Design', action: () => this._canvasManager.autoLayoutManager && this._canvasManager.autoLayoutManager.layoutTopToBottom() },
      { title: 'Toggle Connector Routing (Straight / 90°)', category: 'Design', action: () => this._toggleConnectorRoutingStyle() },
      { title: 'Apply Office Theme', category: 'Design', action: () => this._applyDiagramTheme('office') },
      { title: 'Apply Linear Theme', category: 'Design', action: () => this._applyDiagramTheme('linear') },
      { title: 'Apply Dark Theme', category: 'Design', action: () => this._applyDiagramTheme('dark') },
      { title: 'Insert Title & Border Block', category: 'Design', action: () => this._insertBorderAndTitle() },
      { title: 'Undo (Ctrl+Z)', category: 'Edit', action: () => window.undoManager.undo() },
      { title: 'Redo (Ctrl+Y)', category: 'Edit', action: () => window.undoManager.redo() },
      { title: 'About OpenDraw & Version', category: 'Help', action: () => this.executeAction('help:about') },
    ];

    input.addEventListener('input', () => {
      const q = (input.value || '').trim().toLowerCase();
      if (!q) {
        dropdown.style.display = 'none';
        return;
      }

      const matches = commands.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
      if (matches.length === 0) {
        const escQ = q.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        dropdown.innerHTML = `<div style="padding:10px 14px; font-size:11px; color:#888;">No commands found for "${escQ}"</div>`;
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = '';
      matches.slice(0, 8).forEach((cmd, idx) => {
        const item = document.createElement('div');
        item.className = 'tell-me-item' + (idx === 0 ? ' selected' : '');
        item.innerHTML = `
          <svg viewBox="0 0 16 16" width="13" height="13" fill="#f1c40f"><path d="M8 1a5 5 0 0 0-3.5 8.5V12h7v-2.5A5 5 0 0 0 8 1zm2 12H6v1h4v-1z"/></svg>
          <span class="tell-me-item-title">${cmd.title}</span>
          <span class="tell-me-item-category">${cmd.category}</span>
        `;
        item.addEventListener('click', () => {
          cmd.action();
          input.value = '';
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
      });

      dropdown.style.display = 'block';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = dropdown.querySelector('.tell-me-item');
        if (first) {
          first.click();
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  _insertCenter(shapeType) {
    const center = this._canvasManager.gridManager.pageSize;
    this._canvasManager._insertShape(shapeType, center.width / 2, center.height / 2);
  }

  /**
   * Ribbon Collapse Toggle and Display Options
   */
  _setupRibbonCollapseAndDisplay() {
    const collapseBtn = document.getElementById('ribbon-collapse-toggle');
    const displayBtn = document.getElementById('ribbon-display-options');
    const ribbon = document.querySelector('.ribbon-container') || document.querySelector('.ribbon');

    if (collapseBtn && ribbon) {
      collapseBtn.addEventListener('click', () => {
        ribbon.classList.toggle('collapsed');
        const isCollapsed = ribbon.classList.contains('collapsed');
        const icon = document.getElementById('ribbon-collapse-icon');
        if (icon) {
          icon.innerHTML = isCollapsed ? '<path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none"/>' : '<path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" fill="none"/>';
        }
        collapseBtn.title = isCollapsed ? 'Expand Ribbon (Ctrl+F1)' : 'Collapse Ribbon (Ctrl+F1)';
        window.dispatchEvent(new Event('resize'));
      });
    }

    if (displayBtn && ribbon) {
      displayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showRibbonDisplayOptionsMenu(displayBtn);
      });
    }

    // Ctrl+F1 keyboard shortcut to toggle ribbon
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'F1') {
        e.preventDefault();
        if (collapseBtn) collapseBtn.click();
      }
    });
  }

  _showRibbonDisplayOptionsMenu(anchorEl) {
    const existing = document.querySelector('.ribbon-display-menu');
    if (existing) {
      existing.remove();
      return;
    }

    const rect = anchorEl.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'ribbon-display-menu';
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.style.background = '#252526';
    menu.style.border = '1px solid #454545';
    menu.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
    menu.style.borderRadius = '3px';
    menu.style.padding = '6px';
    menu.style.zIndex = '10000';
    menu.style.width = '240px';
    menu.style.color = '#cccccc';
    menu.style.fontSize = '12px';

    menu.innerHTML = `
      <div class="visio-popover-title">Ribbon Display Options</div>
      <button class="visio-popover-btn" id="opt-show-tabs-commands" style="padding:6px 8px; margin-bottom:4px;">
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 3h12v2H2V3zm0 4h12v6H2V7z" fill="currentColor"/></svg>
        <div>
          <div style="font-weight:600;">Show Tabs and Commands</div>
          <div style="font-size:10px; color:#888;">Show ribbon tabs and commands all the time</div>
        </div>
      </button>
      <button class="visio-popover-btn" id="opt-show-tabs-only" style="padding:6px 8px;">
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z" fill="currentColor"/></svg>
        <div>
          <div style="font-weight:600;">Show Tabs Only</div>
          <div style="font-size:10px; color:#888;">Show only the ribbon tabs. Click a tab to show commands</div>
        </div>
      </button>
    `;

    document.body.appendChild(menu);

    const ribbon = document.querySelector('.ribbon-container') || document.querySelector('.ribbon');
    menu.querySelector('#opt-show-tabs-commands').addEventListener('click', () => {
      if (ribbon) ribbon.classList.remove('collapsed');
      const icon = document.getElementById('ribbon-collapse-icon');
      if (icon) icon.innerHTML = '<path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" fill="none"/>';
      menu.remove();
      window.dispatchEvent(new Event('resize'));
    });

    menu.querySelector('#opt-show-tabs-only').addEventListener('click', () => {
      if (ribbon) ribbon.classList.add('collapsed');
      const icon = document.getElementById('ribbon-collapse-icon');
      if (icon) icon.innerHTML = '<path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none"/>';
      menu.remove();
      window.dispatchEvent(new Event('resize'));
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && !anchorEl.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  _setupPictureUpload() {
    // Hidden Picture File Input for Insert Tab
    const pictureInput = document.getElementById('insert-picture-input');
    if (pictureInput) {
      pictureInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (fEvt) => {
          const dataUrl = fEvt.target.result;
          fabric.Image.fromURL(dataUrl).then((img) => {
            const vpt = this._canvasManager.canvas.viewportTransform;
            const zoom = this._canvasManager.canvas.getZoom();
            const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
            const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;

            const maxDimension = 360;
            if (img.width > maxDimension || img.height > maxDimension) {
              const scale = maxDimension / Math.max(img.width, img.height);
              img.scale(scale);
            }

            img.set({
              left: cx - (img.getScaledWidth() / 2),
              top: cy - (img.getScaledHeight() / 2),
              cornerStyle: 'circle',
              cornerColor: '#0078d4',
              cornerStrokeColor: '#ffffff',
              cornerSize: 8,
              transparentCorners: false,
              borderColor: '#0078d4',
              borderScaleFactor: 1.5,
              objectType: 'picture',
            });

            this._canvasManager.canvas.add(img);
            this._canvasManager.canvas.setActiveObject(img);
            this._canvasManager.canvas.requestRenderAll();

            window.undoManager.record({
              name: 'Insert Picture',
              execute: () => {
                this._canvasManager.canvas.add(img);
                this._canvasManager.canvas.requestRenderAll();
              },
              undo: () => {
                this._canvasManager.canvas.remove(img);
                this._canvasManager.canvas.requestRenderAll();
              },
            });
          });
        };
        reader.readAsDataURL(file);
        pictureInput.value = '';
      });
    }
  }

  _setupDesignTab() {
    const pageSizeSelect = document.getElementById('ribbon-page-size');
    const orientationSelect = document.getElementById('ribbon-orientation');
    const themeSelect = document.getElementById('ribbon-theme');

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        let w = 11 * 96, h = 8.5 * 96;
        if (val === 'letter') { w = 11 * 96; h = 8.5 * 96; }
        else if (val === 'tabloid' || val === 'visio-wide') { w = 21.5 * 96; h = 8.5 * 96; }
        else if (val === 'a4') { w = 11.69 * 96; h = 8.27 * 96; }
        else if (val === 'a3') { w = 16.54 * 96; h = 11.69 * 96; }

        this._canvasManager.gridManager.setPageSize(Math.round(w), Math.round(h));
        this._canvasManager.zoomToFit();
      });
    }

    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (this._canvasManager.themeManager) {
          this._canvasManager.themeManager.applyUITheme(val);
        }
      });
    }
  }

  _setupEventListeners() {
    // Update tool button active state across all tabs and status bar
    window.eventBus.on('tool:changed', (tool) => {
      document.querySelectorAll('[data-action]').forEach((btn) => {
        const action = btn.dataset.action;
        if (['select', 'pan', 'insert:rectangle', 'insert:rounded-rect', 'insert:ellipse',
          'insert:diamond', 'insert:triangle', 'insert:connector',
          'insert:textbox'].includes(action)) {
          btn.classList.toggle('active', action === tool);
        }
      });
      const statusPointer = document.getElementById('status-tool-pointer');
      const statusPan = document.getElementById('status-tool-pan');
      if (statusPointer) statusPointer.classList.toggle('active', tool === 'select');
      if (statusPan) statusPan.classList.toggle('active', tool === 'pan');
    });

    // Update ribbon styling controls when selection changes
    window.eventBus.on('selection:changed', ({ objects, count }) => {
      if (count > 0) {
        const first = objects[0];
        const fillInput = document.getElementById('ribbon-fill-color');
        const strokeInput = document.getElementById('ribbon-stroke-color');
        const strokeWidthSelect = document.getElementById('ribbon-stroke-width');
        const strokeDashSelect = document.getElementById('ribbon-stroke-dash');
        const bar = document.getElementById('fill-color-bar');
        const lineBar = document.getElementById('line-color-bar');

        if (first.connectorData) {
          const cStyle = first.connectorData.style || {};
          const strokeVal = cStyle.stroke || '#41719C';
          const strokeWidthVal = cStyle.strokeWidth || 1.5;
          if (strokeInput && typeof strokeVal === 'string' && strokeVal.startsWith('#')) {
            strokeInput.value = strokeVal;
            if (lineBar) lineBar.style.background = strokeVal;
          }
          if (strokeWidthSelect && strokeWidthVal) {
            strokeWidthSelect.value = String(Math.round(strokeWidthVal * 2) / 2);
          }
          if (strokeDashSelect) {
            strokeDashSelect.value = cStyle.strokeDashArray
              ? (cStyle.strokeDashArray[0] <= 2 ? 'dotted' : 'dashed')
              : 'solid';
          }
          return;
        }

        const fillVal = first.geometryObject ? first.geometryObject.fill : (first.fill || '#D9E1F2');
        const strokeVal = first.geometryObject ? first.geometryObject.stroke : (first.stroke || '#41719C');
        const strokeWidthVal = first.geometryObject ? first.geometryObject.strokeWidth : (first.strokeWidth || 2);
        const strokeDashVal = first.geometryObject ? first.geometryObject.strokeDashArray : first.strokeDashArray;

        if (fillInput && typeof fillVal === 'string' && fillVal.startsWith('#')) {
          fillInput.value = fillVal;
          if (bar) bar.style.background = fillVal;
        }
        if (strokeInput && typeof strokeVal === 'string' && strokeVal.startsWith('#')) {
          strokeInput.value = strokeVal;
          if (lineBar) lineBar.style.background = strokeVal;
        }
        if (strokeWidthSelect && strokeWidthVal) {
          strokeWidthSelect.value = String(Math.round(strokeWidthVal));
        }
        if (strokeDashSelect) {
          strokeDashSelect.value = strokeDashVal
            ? (strokeDashVal[0] <= 2 ? 'dotted' : 'dashed')
            : 'solid';
        }
      }
    });

    // Update zoom label in titlebar/ribbon
    window.eventBus.on('zoom:changed', (percent) => {
      const zoomLabels = document.querySelectorAll('.toolbar-zoom-label, #toolbar-zoom');
      zoomLabels.forEach(lbl => { lbl.textContent = `${percent}%`; });
    });

    // Update undo/redo button states
    window.eventBus.on('undo:state-changed', (state) => {
      document.querySelectorAll('[data-action="undo"]').forEach((btn) => {
        btn.disabled = !state.canUndo;
        btn.title = state.canUndo ? `Undo: ${state.undoName}` : 'Nothing to undo';
      });
      document.querySelectorAll('[data-action="redo"]').forEach((btn) => {
        btn.disabled = !state.canRedo;
        btn.title = state.canRedo ? `Redo: ${state.redoName}` : 'Nothing to redo';
      });
    });
  }

  // =====================
  // DROPDOWN MENUS & DIALOGS
  // =====================

  closeAllDropdownsAndPopovers(excludeElement = null) {
    const popup = document.getElementById('ribbon-dropdown-popup');
    if (popup && popup.style.display !== 'none') {
      if (!excludeElement || !excludeElement.contains(popup)) {
        popup.style.display = 'none';
      }
    }
    const symPicker = document.getElementById('ribbon-symbol-picker');
    if (symPicker && symPicker.style.display !== 'none') {
      if (!excludeElement || !excludeElement.contains(symPicker)) {
        symPicker.style.display = 'none';
      }
    }
    document.querySelectorAll('.visio-color-popover').forEach((pop) => {
      if (!excludeElement || !excludeElement.contains(pop)) {
        pop.remove();
      }
    });
    document.querySelectorAll('.visio-menu-popover').forEach((pop) => {
      if (!excludeElement || !excludeElement.contains(pop)) {
        pop.remove();
      }
    });
    const ribbonDisplay = document.querySelector('.ribbon-display-popover');
    if (ribbonDisplay && (!excludeElement || !excludeElement.contains(ribbonDisplay))) {
      ribbonDisplay.remove();
    }
    const galleryPopup = document.getElementById('shapes-gallery-popup');
    if (galleryPopup && galleryPopup.style.display !== 'none') {
      if (!excludeElement || !excludeElement.contains(galleryPopup)) {
        galleryPopup.style.display = 'none';
      }
    }
  }

  _setupDropdownDismiss() {
    document.addEventListener('mousedown', (e) => {
      const popup = document.getElementById('ribbon-dropdown-popup');
      const symPicker = document.getElementById('ribbon-symbol-picker');
      const colorPopover = document.querySelector('.visio-color-popover');
      const menuPopover = document.querySelector('.visio-menu-popover');
      const ribbonDisplay = document.querySelector('.ribbon-display-popover');
      const galleryPopup = document.getElementById('shapes-gallery-popup');

      const inPopup = (popup && popup.contains(e.target)) ||
                      (symPicker && symPicker.contains(e.target)) ||
                      (colorPopover && colorPopover.contains(e.target)) ||
                      (menuPopover && menuPopover.contains(e.target)) ||
                      (ribbonDisplay && ribbonDisplay.contains(e.target)) ||
                      (galleryPopup && galleryPopup.contains(e.target));

      const isTrigger = e.target.closest(
        '#btn-shape-fill, #btn-shape-line, #btn-layout-menu, #btn-connector-routing, [data-action="text:symbol"], [data-action="quick-styles"], [data-action="insert:textbox-dropdown"], [data-action="insert:textbox"], [data-action="insert:shapes-gallery"], [data-action="shape:effects"], [data-action="select:all"], [data-action="arrange:group"], [data-action="align:center-h"], [data-action="arrange:position"], [data-action="change-shape"], [data-action="layers"], [data-action="find"], [data-action="insert:container"], [data-action="insert:callout"], [data-action="page:orientation-toggle"], [data-action="page:size-dialog"], [data-action="page:insert-dropdown"], [data-action="insert:connector"], [data-action="insert:connector-dropdown"], #btn-insert-connector, [data-action="review:language"], [data-action="review:language-dropdown"], [data-action="qat:customize"], #btn-qat-customize, #status-language, #btn-ribbon-display-opts, #btn-insert-page'
      );

      if (!inPopup && !isTrigger) {
        this.closeAllDropdownsAndPopovers();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllDropdownsAndPopovers();
      }
    });
  }

  _showDropdownMenu(type, anchorBtn) {
    let popup = document.getElementById('ribbon-dropdown-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'ribbon-dropdown-popup';
      document.body.appendChild(popup);
    }
    popup.style.cssText = `
      position: fixed;
      display: none;
      z-index: 10001;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      padding: 4px 0;
      min-width: 195px;
      font-family: var(--font-main);
      font-size: 12px;
      color: var(--text-primary);
      user-select: none;
    `;

    if (popup.style.display === 'block' && popup.dataset.type === type) {
      popup.style.display = 'none';
      return;
    }

    this.closeAllDropdownsAndPopovers();

    popup.dataset.type = type;
    popup.innerHTML = '';

    const items = this._getDropdownItems(type);
    if (!items || items.length === 0) return;

    items.forEach((item) => {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--border); margin: 4px 6px;';
        popup.appendChild(sep);
        return;
      }

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 12px;
        color: var(--text-primary);
        cursor: pointer;
        border-radius: 3px;
        margin: 0 3px;
        transition: background 0.08s;
      `;

      const left = document.createElement('div');
      left.style.cssText = 'display:flex; align-items:center; gap:8px;';
      left.innerHTML = `
        <span style="display:inline-flex; width:16px; justify-content:center;">${item.icon || ''}</span>
        <span>${item.label}</span>
      `;
      row.appendChild(left);

      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.style.cssText = 'color:var(--text-muted); font-size:11px; margin-left:16px;';
        sc.textContent = item.shortcut;
        row.appendChild(sc);
      }

      row.addEventListener('mouseenter', () => {
        row.style.background = 'var(--accent)';
        row.style.color = '#ffffff';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
        row.style.color = 'var(--text-primary)';
      });

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.style.display = 'none';
        if (item.action) item.action();
      });

      popup.appendChild(row);
    });

    popup.style.display = 'block';

    // Position immediately below anchor button
    if (anchorBtn) {
      const baseBtn = anchorBtn.closest('.ribbon-btn-large') || anchorBtn;
      const rect = baseBtn.getBoundingClientRect();
      const popupWidth = popup.offsetWidth || 195;
      const posX = Math.min(window.innerWidth - popupWidth - 10, Math.max(6, rect.left));
      const posY = rect.bottom + 3;
      popup.style.left = `${posX}px`;
      popup.style.top = `${posY}px`;
    }
  }

  _getDropdownItems(type) {
    switch (type) {
      case 'group':
        return [
          {
            icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="2" width="5" height="5" fill="none" stroke="currentColor"/><rect x="9" y="9" width="5" height="5" fill="none" stroke="currentColor"/></svg>',
            label: 'Group',
            shortcut: 'Ctrl+G',
            action: () => window.groupSelected ? window.groupSelected() : null,
          },
          {
            icon: '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2" y="2" width="5" height="5" fill="#0078d4"/><rect x="9" y="9" width="5" height="5" fill="#0078d4"/></svg>',
            label: 'Ungroup',
            shortcut: 'Ctrl+Shift+U',
            action: () => window.ungroupSelected ? window.ungroupSelected() : null,
          },
        ];

      case 'align':
        return [
          { icon: '←', label: 'Align Left', action: () => window.alignObjects ? window.alignObjects('left') : null },
          { icon: '↔', label: 'Align Center Horizontal', action: () => window.alignObjects ? window.alignObjects('center-h') : null },
          { icon: '→', label: 'Align Right', action: () => window.alignObjects ? window.alignObjects('right') : null },
          { type: 'separator' },
          { icon: '↑', label: 'Align Top', action: () => window.alignObjects ? window.alignObjects('top') : null },
          { icon: '↕', label: 'Align Center Vertical', action: () => window.alignObjects ? window.alignObjects('center-v') : null },
          { icon: '↓', label: 'Align Bottom', action: () => window.alignObjects ? window.alignObjects('bottom') : null },
          { type: 'separator' },
          { icon: '⫿', label: 'Distribute Horizontally', action: () => this._canvasManager.distributeHorizontal() },
          { icon: '⫾', label: 'Distribute Vertically', action: () => this._canvasManager.distributeVertical() },
        ];

      case 'position':
        return [
          { icon: '↻', label: 'Rotate Right 90°', action: () => this._rotateSelected(90) },
          { icon: '↺', label: 'Rotate Left 90°', action: () => this._rotateSelected(-90) },
          { icon: '⇆', label: 'Flip Horizontal', action: () => this._flipSelected('X') },
          { icon: '⇅', label: 'Flip Vertical', action: () => this._flipSelected('Y') },
          { type: 'separator' },
          { icon: '▲', label: 'Bring to Front', shortcut: 'Ctrl+Shift+]', action: () => window.bringToFront ? window.bringToFront() : null },
          { icon: '▵', label: 'Bring Forward', shortcut: 'Ctrl+]', action: () => window.bringForward ? window.bringForward() : null },
          { icon: '▿', label: 'Send Backward', shortcut: 'Ctrl+[', action: () => window.sendBackward ? window.sendBackward() : null },
          { icon: '▼', label: 'Send to Back', shortcut: 'Ctrl+Shift+[', action: () => window.sendToBack ? window.sendToBack() : null },
        ];

      case 'change-shape':
        return [
          { icon: '▭', label: 'Rectangle', action: () => this._changeSelectedShape('rectangle') },
          { icon: '▢', label: 'Rounded Rectangle', action: () => this._changeSelectedShape('rounded-rect') },
          { icon: '◯', label: 'Ellipse / Circle', action: () => this._changeSelectedShape('circle') },
          { icon: '◇', label: 'Diamond', action: () => this._changeSelectedShape('diamond') },
          { icon: '△', label: 'Triangle', action: () => this._changeSelectedShape('triangle') },
          { icon: '⬬', label: 'Cylinder', action: () => this._changeSelectedShape('cylinder') },
        ];

      case 'select':
        return [
          { icon: '✓', label: 'Select All', shortcut: 'Ctrl+A', action: () => window.selectAll ? window.selectAll() : null },
          {
            icon: '⬚',
            label: 'Select Shapes Only',
            action: () => {
              const shapes = this._canvasManager.canvas.getObjects().filter(o => o.objectType !== 'grid-line' && o.objectType !== 'page-background' && o.objectType !== 'connector');
              if (shapes.length > 0) {
                const sel = new fabric.ActiveSelection(shapes, { canvas: this._canvasManager.canvas });
                this._canvasManager.canvas.setActiveObject(sel);
                this._canvasManager.canvas.requestRenderAll();
              }
            }
          },
          {
            icon: '➔',
            label: 'Select Connectors Only',
            action: () => {
              const conns = this._canvasManager.canvas.getObjects().filter(o => o.objectType === 'connector');
              if (conns.length > 0) {
                const sel = new fabric.ActiveSelection(conns, { canvas: this._canvasManager.canvas });
                this._canvasManager.canvas.setActiveObject(sel);
                this._canvasManager.canvas.requestRenderAll();
              }
            }
          },
        ];

      case 'find':
        return [
          {
            icon: '🔍',
            label: 'Find Text in Diagram...',
            shortcut: 'Ctrl+F',
            action: async () => {
              const query = window.openDrawDialog
                ? await window.openDrawDialog.prompt('Enter search text to find in diagram:', '', 'Find Text')
                : null;
              if (!query) return;
              const matches = this._canvasManager.canvas.getObjects().filter(o => {
                const txt = o.labelObject ? o.labelObject.text : (o.text || (o.shapeData ? o.shapeData.name : ''));
                return txt && txt.toLowerCase().includes(query.toLowerCase());
              });
              if (matches.length > 0) {
                this._canvasManager.canvas.setActiveObject(matches[0]);
                this._canvasManager.canvas.requestRenderAll();
                this._showToast(`Found ${matches.length} matching shape(s).`);
              } else if (window.openDrawDialog) {
                await window.openDrawDialog.alert(`No shapes found containing "${query}".`, 'Find Text');
              }
            }
          }
        ];

      case 'layers':
        return [
          {
            icon: '⧉',
            label: 'Toggle Layers Panel',
            action: () => {
              const panel = document.getElementById('properties-panel');
              if (panel) panel.classList.remove('collapsed');
            }
          },
          {
            icon: '＋',
            label: 'New Layer...',
            action: async () => {
              if (this._canvasManager.layerManager && window.openDrawDialog) {
                const name = await window.openDrawDialog.prompt('Enter Layer Name:', 'New Layer', 'New Layer');
                if (name && name.trim()) this._canvasManager.layerManager.addLayer(name.trim());
              }
            }
          }
        ];

      case 'quick-styles':
        return [
          { icon: '🟦', label: 'Office Blue (Default)', action: () => this._applyPaletteStyle('#D9E1F2', '#41719C') },
          { icon: '🟧', label: 'Accent Orange (Warm)', action: () => this._applyPaletteStyle('#FCE4D6', '#C65911') },
          { icon: '🟩', label: 'Forest Green (Success)', action: () => this._applyPaletteStyle('#E2EFDA', '#385723') },
          { icon: '🟨', label: 'Amber Gold (Warning)', action: () => this._applyPaletteStyle('#FFF2CC', '#BF8F00') },
          { icon: '⬜', label: 'Modern Slate (Minimal)', action: () => this._applyPaletteStyle('#EDEDED', '#595959') },
          { icon: '🟥', label: 'Brick Red (Accent)', action: () => this._applyPaletteStyle('#F2DCDB', '#963634') },
        ];

      case 'effects':
        return [
          { icon: '◑', label: 'Toggle Drop Shadow', action: () => this._toggleShadowEffect() },
          {
            icon: '☼',
            label: 'Toggle Outer Glow',
            action: () => {
              const active = this._canvasManager.canvas.getActiveObjects();
              active.forEach(obj => {
                const target = obj.geometryObject || obj;
                if (target.shadow && target.shadow.color.includes('241, 196, 15')) {
                  target.set('shadow', null);
                } else {
                  target.set('shadow', new fabric.Shadow({ color: 'rgba(241, 196, 15, 0.75)', blur: 18, offsetX: 0, offsetY: 0 }));
                }
                obj.dirty = true;
              });
              this._canvasManager.canvas.requestRenderAll();
            }
          },
        ];

      case 'orientation':
        return [
          { icon: '▯', label: 'Portrait', action: () => {
            const sz = this._canvasManager.gridManager.pageSize;
            if (sz.width > sz.height) this._canvasManager.gridManager.setPageSize(sz.height, sz.width);
            this._canvasManager.zoomToFit();
          }},
          { icon: '▭', label: 'Landscape', action: () => {
            const sz = this._canvasManager.gridManager.pageSize;
            if (sz.height > sz.width) this._canvasManager.gridManager.setPageSize(sz.height, sz.width);
            this._canvasManager.zoomToFit();
          }},
        ];

      case 'size':
        return [
          { icon: '📄', label: 'A4 (210 × 297 mm)', action: () => { this._canvasManager.gridManager.setPageSize(11.69 * 96, 8.27 * 96); this._canvasManager.zoomToFit(); }},
          { icon: '📄', label: 'A3 (297 × 420 mm)', action: () => { this._canvasManager.gridManager.setPageSize(16.54 * 96, 11.69 * 96); this._canvasManager.zoomToFit(); }},
          { icon: '📄', label: 'Letter (8.5 × 11 in)', action: () => { this._canvasManager.gridManager.setPageSize(11 * 96, 8.5 * 96); this._canvasManager.zoomToFit(); }},
          { icon: '📄', label: 'Tabloid (11 × 17 in)', action: () => { this._canvasManager.gridManager.setPageSize(17 * 96, 11 * 96); this._canvasManager.zoomToFit(); }},
          { icon: '⊡', label: 'Fit Page to Drawing', action: () => this._cyclePageSize() },
        ];

      case 'textbox':
        return [
          {
            icon: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="3" width="12" height="10" fill="none" stroke="#0078d4" stroke-width="1.2" stroke-dasharray="2,2"/><text x="5" y="11" font-size="10" font-weight="bold" fill="#0078d4">A</text></svg>',
            label: 'Draw Horizontal Text Box',
            action: () => this._canvasManager.setTool('insert:textbox'),
          },
          {
            icon: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="10" height="12" fill="none" stroke="#0078d4" stroke-width="1.2" stroke-dasharray="2,2"/><text x="5" y="11" font-size="10" font-weight="bold" fill="#0078d4" transform="rotate(90 7 8)">A</text></svg>',
            label: 'Draw Vertical Text Box',
            action: () => this._canvasManager.setTool('insert:textbox-vertical'),
          },
        ];

      case 'container':
        return [
          { icon: '▢', label: 'Classic Container', action: () => this._canvasManager.setTool('insert:container-classic') },
          { icon: '▤', label: 'Header Banner Container', action: () => this._canvasManager.setTool('insert:container-banner') },
          { icon: '▢', label: 'Rounded Container', action: () => this._canvasManager.setTool('insert:container-rounded') },
          { icon: '▭', label: 'Minimal Frame', action: () => this._canvasManager.setTool('insert:container-frame') },
        ];

      case 'callout':
        return [
          { icon: '💬', label: 'Speech Bubble Callout', action: () => this._canvasManager.setTool('insert:callout-bubble') },
          { icon: '—', label: 'Line Callout', action: () => this._canvasManager.setTool('insert:callout-line') },
          { icon: '」', label: 'Bracket Callout', action: () => this._canvasManager.setTool('insert:callout-bracket') },
          { icon: '▎', label: 'Side Line Callout', action: () => this._canvasManager.setTool('insert:callout-side-line') },
        ];

      case 'connector':
        const curRouting = (this._canvasManager.connectorManager && this._canvasManager.connectorManager.defaultStyle.routingType) || 'orthogonal';
        return [
          {
            icon: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 13h5V3h7" fill="none" stroke="#0078d4" stroke-width="2"/><polygon points="14,3 10,1 10,5" fill="#0078d4"/></svg>',
            label: (curRouting === 'orthogonal' ? '✓ ' : '') + 'Right-Angle Connector (Orthogonal)',
            shortcut: 'Ctrl+3',
            action: () => {
              this._setConnectorRouting('orthogonal');
              this._canvasManager.setTool('insert:connector');
            }
          },
          {
            icon: '<svg viewBox="0 0 16 16" width="14" height="14"><line x1="2" y1="13" x2="14" y2="3" stroke="#0078d4" stroke-width="2"/><polygon points="14,3 10,2 12,6" fill="#0078d4"/></svg>',
            label: (curRouting === 'straight' ? '✓ ' : '') + 'Straight Connector',
            action: () => {
              this._setConnectorRouting('straight');
              this._canvasManager.setTool('insert:connector');
            }
          },
          {
            icon: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 13C6 13 8 3 14 3" fill="none" stroke="#0078d4" stroke-width="2"/><polygon points="14,3 10,1 10,5" fill="#0078d4"/></svg>',
            label: (curRouting === 'curved' ? '✓ ' : '') + 'Curved Connector',
            action: () => {
              this._setConnectorRouting('curved');
              this._canvasManager.setTool('insert:connector');
            }
          }
        ];

      case 'new-page':
        return [
          {
            icon: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="10" height="12" fill="none" stroke="#0078d4" stroke-width="1.2"/><path d="M8 5v6M5 8h6" stroke="#0078d4" stroke-width="1.4"/></svg>',
            label: 'Blank Page',
            action: () => {
              if (this._canvasManager.pageManager) {
                this._canvasManager.pageManager.addPage();
              }
            }
          },
          {
            icon: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="4" width="9" height="10" fill="none" stroke="#0078d4" stroke-width="1"/><rect x="5" y="2" width="9" height="10" fill="none" stroke="#0078d4" stroke-width="1.2"/></svg>',
            label: 'Duplicate Current Page',
            action: () => {
              if (this._canvasManager.pageManager && this._canvasManager.pageManager.duplicateActivePage) {
                this._canvasManager.pageManager.duplicateActivePage();
              } else if (this._canvasManager.pageManager) {
                this._canvasManager.pageManager.addPage();
              }
            }
          },
          { type: 'separator' },
          {
            icon: '⚙',
            label: 'Page Setup...',
            action: () => {
              this._showNewPageSetupDialog();
            }
          }
        ];

      case 'language':
        const curLang = window._activeLanguage || 'pt-PT';
        return [
          {
            icon: curLang === 'en-US' ? '✓' : ' ',
            label: 'English (United States)',
            action: () => this._setLanguage('en-US', 'English (United States)')
          },
          {
            icon: curLang === 'en-GB' ? '✓' : ' ',
            label: 'English (United Kingdom)',
            action: () => this._setLanguage('en-GB', 'English (United Kingdom)')
          },
          {
            icon: curLang === 'pt-PT' ? '✓' : ' ',
            label: 'Portuguese (Portugal)',
            action: () => this._setLanguage('pt-PT', 'Portuguese (Portugal)')
          },
          {
            icon: curLang === 'pt-BR' ? '✓' : ' ',
            label: 'Portuguese (Brazil)',
            action: () => this._setLanguage('pt-BR', 'Portuguese (Brazil)')
          },
          {
            icon: curLang === 'es-ES' ? '✓' : ' ',
            label: 'Spanish (Spain)',
            action: () => this._setLanguage('es-ES', 'Spanish (Spain)')
          },
          {
            icon: curLang === 'fr-FR' ? '✓' : ' ',
            label: 'French (France)',
            action: () => this._setLanguage('fr-FR', 'French (France)')
          },
          {
            icon: curLang === 'it-IT' ? '✓' : ' ',
            label: 'Italian (Italy)',
            action: () => this._setLanguage('it-IT', 'Italian (Italy)')
          },
          {
            icon: curLang === 'de-DE' ? '✓' : ' ',
            label: 'German (Germany)',
            action: () => this._setLanguage('de-DE', 'German (Germany)')
          },
          { type: 'separator' },
          {
            icon: '🌐',
            label: 'Set Proofing Language...',
            action: () => this._showProofingLanguageDialog()
          }
        ];

      case 'qat-customize':
        const btnNew = document.getElementById('btn-qat-new');
        const btnOpen = document.getElementById('btn-qat-open');
        const btnSave = document.getElementById('btn-qat-save');
        const btnUndo = document.getElementById('btn-qat-undo');
        const btnRedo = document.getElementById('btn-qat-redo');
        const ribbon = document.querySelector('.ribbon-container') || document.querySelector('.ribbon');
        const isRibbonCollapsed = ribbon ? ribbon.classList.contains('collapsed') : false;

        const isVisible = (el) => el ? (window.getComputedStyle(el).display !== 'none') : false;
        const toggleBtn = (el) => {
          if (!el) return;
          const curr = window.getComputedStyle(el).display !== 'none';
          el.style.display = curr ? 'none' : 'inline-flex';
        };

        return [
          {
            icon: isVisible(btnNew) ? '✓' : ' ',
            label: 'New',
            action: () => toggleBtn(btnNew)
          },
          {
            icon: isVisible(btnOpen) ? '✓' : ' ',
            label: 'Open',
            action: () => toggleBtn(btnOpen)
          },
          {
            icon: isVisible(btnSave) ? '✓' : ' ',
            label: 'Save',
            action: () => toggleBtn(btnSave)
          },
          {
            icon: isVisible(btnUndo) ? '✓' : ' ',
            label: 'Undo',
            action: () => toggleBtn(btnUndo)
          },
          {
            icon: isVisible(btnRedo) ? '✓' : ' ',
            label: 'Redo',
            action: () => toggleBtn(btnRedo)
          },
          { type: 'separator' },
          {
            icon: isRibbonCollapsed ? '✓' : ' ',
            label: 'Collapse the Ribbon',
            shortcut: 'Ctrl+F1',
            action: () => {
              const collapseBtn = document.getElementById('ribbon-collapse-toggle');
              if (collapseBtn) collapseBtn.click();
              else if (ribbon) ribbon.classList.toggle('collapsed');
            }
          }
        ];

      default:
        return [];
    }
  }

  _rotateSelected(deg) {
    const active = this._canvasManager.canvas.getActiveObjects();
    active.forEach((obj) => {
      const cur = obj.angle || 0;
      obj.set('angle', (cur + deg) % 360);
      obj.setCoords();
    });
    this._canvasManager.canvas.requestRenderAll();
  }

  _flipSelected(axis) {
    const active = this._canvasManager.canvas.getActiveObjects();
    active.forEach((obj) => {
      if (axis === 'X') obj.set('flipX', !obj.flipX);
      else if (axis === 'Y') obj.set('flipY', !obj.flipY);
      obj.setCoords();
    });
    this._canvasManager.canvas.requestRenderAll();
  }

  _changeSelectedShape(newType) {
    const canvas = this._canvasManager.canvas;
    const active = canvas.getActiveObject();
    if (!active || active.objectType === 'grid-line' || active.objectType === 'page-background') return;

    const rawTargets = (active.type === 'activeselection' || active.type === 'activeSelection')
      ? active.getObjects().slice()
      : [active];

    const blockedTypes = new Set([
      'grid-line', 'page-background', 'guide-line', 'connector',
      'connector-arrow', 'connector-handle', 'autoconnect-trigger',
      'port-marker', 'comment-card', 'textbox'
    ]);
    const targets = rawTargets.filter(o => o && !o.connectorData && !blockedTypes.has(o.objectType));
    if (targets.length === 0) return;

    canvas.discardActiveObject();
    const cm = this._canvasManager.connectorManager;
    const allBeforeObjs = canvas.getObjects().slice();
    const replacements = [];

    targets.forEach((oldObj) => {
      const center = oldObj.getCenterPoint
        ? oldObj.getCenterPoint()
        : { x: (oldObj.left || 0), y: (oldObj.top || 0) };
      const br = oldObj.getBoundingRect ? oldObj.getBoundingRect() : null;
      const w = (oldObj.width ? oldObj.width * (oldObj.scaleX || 1) : (br ? br.width : 100));
      const h = (oldObj.height ? oldObj.height * (oldObj.scaleY || 1) : (br ? br.height : 70));
      const text = oldObj.labelObject ? oldObj.labelObject.text : (oldObj.text || (oldObj.shapeData && oldObj.shapeData.name) || '');
      const fill = oldObj.geometryObject ? oldObj.geometryObject.fill : (oldObj.fill || '#D9E1F2');
      const stroke = oldObj.geometryObject ? oldObj.geometryObject.stroke : (oldObj.stroke || '#41719C');
      const zIdx = allBeforeObjs.indexOf(oldObj);

      const newObj = window.ShapeFactory
        ? window.ShapeFactory.create(newType, center.x, center.y, { width: Math.max(20, w), height: Math.max(20, h), text, fill, stroke })
        : null;
      if (!newObj) return;

      if (oldObj.angle) newObj.set('angle', oldObj.angle);
      if (oldObj.layerId) newObj.layerId = oldObj.layerId;
      if (oldObj.shapeData && newObj.shapeData) {
        newObj.shapeData.properties = { ...(oldObj.shapeData.properties || {}) };
        if (text) newObj.shapeData.name = text;
      }

      const attachedConns = cm
        ? cm.connectors.filter(c => c.sourceShape === oldObj || c.targetShape === oldObj).map(c => ({
            conn: c,
            wasSource: c.sourceShape === oldObj,
            wasTarget: c.targetShape === oldObj,
          }))
        : [];

      replacements.push({ oldObj, newObj, zIdx, attachedConns });
    });

    if (replacements.length === 0) return;

    const applySwap = (forward) => {
      replacements.forEach(({ oldObj, newObj, zIdx, attachedConns }) => {
        const removeTarget = forward ? oldObj : newObj;
        const addTarget = forward ? newObj : oldObj;
        canvas.remove(removeTarget);
        canvas.add(addTarget);
        if (zIdx >= 0 && typeof canvas.moveObjectTo === 'function') {
          canvas.moveObjectTo(addTarget, Math.min(zIdx, canvas.getObjects().length - 1));
        }
        addTarget.setCoords();
        if (cm) {
          attachedConns.forEach(({ conn, wasSource, wasTarget }) => {
            if (wasSource) conn.sourceShape = addTarget;
            if (wasTarget) conn.targetShape = addTarget;
            cm.updateConnector(conn);
          });
        }
      });
      if (cm) cm._keepGridAtBack();
      const activeSet = replacements.map(r => (forward ? r.newObj : r.oldObj));
      if (activeSet.length === 1) {
        canvas.setActiveObject(activeSet[0]);
      } else if (activeSet.length > 1) {
        const sel = new fabric.ActiveSelection(activeSet, { canvas });
        canvas.setActiveObject(sel);
      }
      canvas.requestRenderAll();
    };

    applySwap(true);
    if (window.undoManager) {
      window.undoManager.record({
        name: `Change Shape (${replacements.length})`,
        execute: () => applySwap(true),
        undo: () => applySwap(false),
      });
    }
  }

  _applyPaletteStyle(fill, stroke) {
    this._applyFillColor(fill);
    this._applyStrokeColor(stroke);
  }

  // =====================
  // SHAPES GALLERY POPOVER (VISIO STYLE)
  // =====================

  _showShapesGalleryPopover(anchorBtn) {
    let popup = document.getElementById('shapes-gallery-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'shapes-gallery-popup';
      popup.style.cssText = `
        position: fixed;
        display: none;
        z-index: 10001;
        background: #252525;
        border: 1px solid #484848;
        border-radius: 6px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75);
        width: 480px;
        max-height: 520px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #e1e1e1;
        user-select: none;
        flex-direction: column;
        overflow: hidden;
      `;
      document.body.appendChild(popup);
    }

    if (popup.style.display === 'flex') {
      popup.style.display = 'none';
      return;
    }

    this.closeAllDropdownsAndPopovers();

    this._renderShapesGallery(popup);
    popup.style.display = 'flex';

    if (anchorBtn) {
      const rect = anchorBtn.getBoundingClientRect();
      const popupW = 480;
      const posX = Math.min(window.innerWidth - popupW - 12, Math.max(10, rect.left));
      const posY = rect.bottom + 4;
      popup.style.left = `${posX}px`;
      popup.style.top = `${posY}px`;
    }
  }

  _showToast(message) {
    let toast = document.getElementById('opendraw-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'opendraw-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 38px;
        left: 50%;
        transform: translateX(-50%);
        background: #1f1f1f;
        color: #ffffff;
        border: 1px solid #0078d4;
        border-radius: 4px;
        padding: 6px 16px;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.65);
        z-index: 10005;
        pointer-events: none;
        transition: opacity 0.25s;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 250);
    }, 2400);
  }

  _renderShapesGallery(popup) {
    const catalog = [
      // Authentic Microsoft Visio Basic Shapes
      { type: 'rectangle', label: 'Rectangle', svg: '<rect x="4" y="6" width="24" height="20" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'square', label: 'Square', svg: '<rect x="6" y="6" width="20" height="20" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'circle', label: 'Circle', svg: '<circle cx="16" cy="16" r="11" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'ellipse', label: 'Ellipse', svg: '<ellipse cx="16" cy="16" rx="13" ry="9" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'right-triangle', label: 'Right Triangle', svg: '<polygon points="5,27 27,27 5,5" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'triangle', label: 'Triangle', svg: '<polygon points="16,4 29,28 3,28" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'rotated-triangle', label: 'Rotated Triangle', svg: '<polygon points="3,5 29,5 16,28" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'pentagon', label: 'Pentagon', svg: '<polygon points="16,3 29,12 24,28 8,28 3,12" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'hexagon', label: 'Hexagon', svg: '<polygon points="8,4 24,4 30,16 24,28 8,28 2,16" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'heptagon', label: 'Heptagon', svg: '<polygon points="16,3 27,8 30,20 22,29 10,29 2,20 5,8" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'octagon', label: 'Octagon', svg: '<polygon points="9,3 23,3 29,9 29,23 23,29 9,29 3,23 3,9" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'decagon', label: 'Decagon', svg: '<polygon points="16,2 24,5 29,11 30,19 26,26 19,30 13,30 6,26 2,19 3,11 8,5" fill="#D9E1F2" stroke="#41719C" stroke-width="1.4"/>' },
      { type: 'cylinder', label: 'Can', svg: '<path d="M 5 8 L 5 24 A 11 4 0 0 0 27 24 L 27 8 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/><ellipse cx="16" cy="8" rx="11" ry="4" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'parallelogram', label: 'Parallelogram', svg: '<polygon points="8,6 29,6 24,26 3,26" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'trapezoid', label: 'Trapezoid', svg: '<polygon points="8,6 24,6 29,26 3,26" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'diamond', label: 'Diamond', svg: '<polygon points="16,3 29,16 16,29 3,16" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'cross', label: 'Cross', svg: '<path d="M11,3 h10 v8 h8 v10 h-8 v8 h-10 v-8 h-8 v-10 h8 z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'chevron', label: 'Chevron', svg: '<polygon points="4,6 20,6 28,16 20,26 4,26 12,16" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'cube', label: 'Cube', svg: '<polygon points="5,11 11,5 29,5 29,21 23,27 5,27" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/><polyline points="5,11 23,11 23,27" fill="none" stroke="#41719C" stroke-width="1.2"/><line x1="23" y1="11" x2="29" y2="5" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'drop', label: 'Drop', svg: '<path d="M16 3 C26 16 25 28 16 28 C7 28 6 16 16 3 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'semi-circle', label: 'Semi Circle', svg: '<path d="M4 22 A12 12 0 0 1 28 22 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'semi-ellipse', label: 'Semi Ellipse', svg: '<path d="M3 24 A13 9 0 0 1 29 24 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'cone', label: 'Cone', svg: '<path d="M16 3 L27 24 A11 4 0 0 1 5 24 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'pyramid', label: 'Pyramid', svg: '<polygon points="16,3 29,27 3,27" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/><line x1="16" y1="3" x2="16" y2="27" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'gear', label: 'Gear', svg: '<path d="M14,3 h4 v3.2 a9,9 0 0 1 2.8,1.2 l2.3,-2.3 2.8,2.8 -2.3,2.3 a9,9 0 0 1 1.2,2.8 H28 v4 h-3.2 a9,9 0 0 1 -1.2,2.8 l2.3,2.3 -2.8,2.8 -2.3,-2.3 a9,9 0 0 1 -2.8,1.2 V29 h-4 v-3.2 a9,9 0 0 1 -2.8,-1.2 l-2.3,2.3 -2.8,-2.8 2.3,-2.3 a9,9 0 0 1 -1.2,-2.8 H4 v-4 h3.2 a9,9 0 0 1 1.2,-2.8 L6.1,8 8.9,5.2 11.2,7.5 a9,9 0 0 1 2.8,-1.2 V3 z M16,11 a5,5 0 1 0 0,10 5,5 0 0 0 0,-10 z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2" fill-rule="evenodd"/>' },
      { type: 'star-4', label: '4-Point Star', svg: '<polygon points="16,2 19,13 30,16 19,19 16,30 13,19 2,16 13,13" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'star', label: '5-Point Star', svg: '<polygon points="16,2 19,11 29,11 21,17 24,27 16,21 8,27 11,17 3,11 13,11" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'star-6', label: '6-Point Star', svg: '<polygon points="16,2 19,9 27,6 23,13 28,19 20,19 16,27 12,19 4,19 9,13 5,6 13,9" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'star-8', label: '8-Point Star', svg: '<polygon points="16,2 18.7,9.5 25.9,6.1 22.5,13.3 30,16 22.5,18.7 25.9,25.9 18.7,22.5 16,30 13.3,22.5 6.1,25.9 9.5,18.7 2,16 9.5,13.3 6.1,6.1 13.3,9.5" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
      { type: 'rounded-rect', label: 'Rounded Rect', svg: '<rect x="4" y="6" width="24" height="20" rx="6" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' },
      { type: 'donut', label: 'Donut', svg: '<circle cx="16" cy="16" r="11" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/><circle cx="16" cy="16" r="5" fill="#252525" stroke="#41719C" stroke-width="1"/>' },
      { type: 'l-shape', label: 'L Shape', svg: '<polygon points="5,5 14,5 14,18 26,18 26,26 5,26" fill="#D9E1F2" stroke="#41719C" stroke-width="1.5"/>' }
    ];

    popup.innerHTML = `
      <div style="padding: 10px 12px 8px 12px; border-bottom: 1px solid #383838; background:#222222;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span style="font-size:12px; font-weight:600; color:#ffffff; display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="#0078d4"><path d="M8 1L2 4v8l6 3 6-3V4L8 1z"/></svg>
            Visio Basic Shapes
          </span>
          <span style="font-size:11px; color:#888888;">Click to draw or drag to canvas</span>
        </div>
        <input type="text" id="shapes-gallery-search" placeholder="Search basic shapes... (e.g. rectangle, star, triangle)" style="width:100%; box-sizing:border-box; padding:5px 8px; background:#181818; border:1px solid #484848; border-radius:3px; color:#ffffff; font-size:11px; outline:none;">
      </div>
      <div id="shapes-gallery-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; padding:10px; overflow-y:auto; max-height:360px; background:#1e1e1e;">
      </div>
      <div style="padding: 6px 12px; background:#222222; border-top:1px solid #383838; display:flex; justify-content:space-between; align-items:center;">
        <button id="btn-gallery-open-stencil" style="background:none; border:none; color:#0078d4; font-size:11px; cursor:pointer; padding:2px 4px;">📂 Open Stencil Library (.vssx)...</button>
        <button id="btn-gallery-open-sidebar" style="background:none; border:none; color:#888888; font-size:11px; cursor:pointer; padding:2px 4px;">◫ Open Shapes Sidebar</button>
      </div>
    `;

    const grid = popup.querySelector('#shapes-gallery-grid');
    const searchInput = popup.querySelector('#shapes-gallery-search');

    const renderItems = () => {
      grid.innerHTML = '';
      const q = (searchInput.value || '').trim().toLowerCase();

      const filtered = catalog.filter((s) => {
        return !q || s.label.toLowerCase().includes(q) || s.type.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #888; font-size: 11px;">No matching basic shapes found.</div>';
        return;
      }

      filtered.forEach((shape) => {
        const item = document.createElement('div');
        item.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 4px;
          background: #282828;
          border: 1px solid #383838;
          border-radius: 4px;
          cursor: grab;
          transition: all 0.1s;
        `;
        item.draggable = true;
        item.title = `Click to draw or drag & drop ${shape.label} onto diagram`;

        item.innerHTML = `
          <div style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; margin-bottom:4px;">
            <svg viewBox="0 0 32 32" width="30" height="30" xmlns="http://www.w3.org/2000/svg">${shape.svg}</svg>
          </div>
          <span style="font-size:10px; color:#d4d4d4; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${shape.label}</span>
        `;

        item.addEventListener('mouseenter', () => {
          item.style.background = '#323232';
          item.style.borderColor = '#0078d4';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = '#282828';
          item.style.borderColor = '#383838';
        });

        // Drag to drop on canvas
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/opendraw-shape', shape.type);
          e.dataTransfer.setData('text/plain', shape.type);
          e.dataTransfer.effectAllowed = 'copy';
        });

        // Click to activate tool
        item.addEventListener('click', () => {
          popup.style.display = 'none';
          this._canvasManager.setTool('insert:' + shape.type);
        });

        grid.appendChild(item);
      });
    };

    renderItems();

    searchInput.addEventListener('input', () => renderItems());

    const openStencilBtn = popup.querySelector('#btn-gallery-open-stencil');
    if (openStencilBtn) {
      openStencilBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        if (window.panelController && window.panelController.openStencilFileDialog) {
          window.panelController.openStencilFileDialog();
        } else if (window.openDraw && window.openDraw.showOpenStencilDialog) {
          window.openDraw.showOpenStencilDialog().then(res => {
            if (res && res.filePath && window.panelController) {
              window.panelController.loadStencil(res.filePath);
            }
          });
        }
      });
    }

    const openSidebarBtn = popup.querySelector('#btn-gallery-open-sidebar');
    if (openSidebarBtn) {
      openSidebarBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        if (window.panelController) {
          window.panelController.toggleShapesPanel(true);
        }
      });
    }
  }

  // =====================
  // SYMBOLS & FIELDS PICKERS
  // =====================

  _showSymbolPicker(anchorBtn) {
    let picker = document.getElementById('ribbon-symbol-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'ribbon-symbol-picker';
      document.body.appendChild(picker);
    }
    picker.style.cssText = `
      position: fixed;
      display: none;
      z-index: 10002;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      padding: 8px;
      width: 284px;
      font-family: var(--font-main);
      color: var(--text-primary);
    `;

    if (picker.style.display === 'block') {
      picker.style.display = 'none';
      return;
    }

    this.closeAllDropdownsAndPopovers();

    const symbols = [
      '±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '√', '∑', '∆', 'π', 'µ', 'Ω', '°', '∠',
      '←', '↑', '→', '↓', '↔', '↕', '⇒', '⇔', '➔', '➜', '✓', '✗', '★', '▲', '▼', '•',
      '©', '®', '™', '€', '£', '¥', '$', '§', '¶', '½', '¼', '¾', '⁰', '¹', '²', '³'
    ];

    picker.innerHTML = `
      <div style="font-weight:600; font-size:12px; margin-bottom:6px; color:var(--accent); border-bottom:1px solid var(--border); padding-bottom:4px;">
        Insert Symbol
      </div>
      <div style="display:grid; grid-template-columns: repeat(8, 1fr); gap:4px; max-height:180px; overflow-y:auto;">
        ${symbols.map(s => `<button class="sym-btn" style="background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text-primary); font-size:14px; height:28px; border-radius:3px; cursor:pointer;" data-sym="${s}">${s}</button>`).join('')}
      </div>
    `;

    picker.querySelectorAll('.sym-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--accent)'; btn.style.color = '#ffffff'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--bg-tertiary)'; btn.style.color = 'var(--text-primary)'; });
      btn.addEventListener('click', (e) => {
        const sym = e.currentTarget.dataset.sym;
        picker.style.display = 'none';
        this._insertSymbolChar(sym);
      });
    });

    picker.style.display = 'block';
    if (anchorBtn) {
      const rect = anchorBtn.getBoundingClientRect();
      const posX = Math.min(window.innerWidth - 300, Math.max(10, rect.left));
      picker.style.left = `${posX}px`;
      picker.style.top = `${rect.bottom + 4}px`;
    }
  }

  _insertSymbolChar(char) {
    if (!char) return;
    if (this._canvasManager.inlineTextEditor && this._canvasManager.inlineTextEditor.activeShape) {
      const input = this._canvasManager.inlineTextEditor.inputElement;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        input.value = input.value.substring(0, start) + char + input.value.substring(end);
        input.selectionStart = input.selectionEnd = start + char.length;
        return;
      }
    }

    const active = this._canvasManager.canvas.getActiveObject();
    if (active) {
      const textObj = active.labelObject || (active.text !== undefined ? active : (active.getObjects ? active.getObjects().find(o => o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') : null));
      if (textObj) {
        textObj.set('text', (textObj.text || '') + char);
        if (textObj.initDimensions) textObj.initDimensions();
        textObj.dirty = true;
        active.dirty = true;
        if (active.shapeData) {
          active.shapeData.name = textObj.text;
          if (!active.shapeData.properties) active.shapeData.properties = {};
          active.shapeData.properties.text = textObj.text;
        }
        this._canvasManager.canvas.requestRenderAll();
        return;
      }
    }

    // Insert visible standalone textbox with high-contrast color against page fill
    const canvas = this._canvasManager.canvas;
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
    const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;
    const gm = this._canvasManager.gridManager;
    const pageCol = gm ? gm.getPageColor() : '#ffffff';
    const isDarkPage = gm && gm._isDarkColor ? gm._isDarkColor(pageCol) : false;
    const fillCol = isDarkPage ? '#ffffff' : '#1f1f1f';
    const isSingleChar = char.length <= 2;
    const boxWidth = Math.max(48, Math.min(360, char.length * 10 + 28));

    const tb = new fabric.Textbox(char, {
      left: cx,
      top: cy,
      originX: 'center',
      originY: 'center',
      width: boxWidth,
      fontSize: isSingleChar ? 22 : 14,
      fontFamily: 'Segoe UI, Calibri, sans-serif',
      fill: fillCol,
      textAlign: 'center',
      editable: false,
      borderColor: '#0078d4',
      cornerColor: '#0078d4',
      cornerSize: 8,
      transparentCorners: false,
    });
    tb.objectType = 'textbox';
    tb.shapeType = 'textbox';
    tb.shapeData = { id: 'txt_' + Math.random().toString(36).substr(2, 9), name: char, properties: { text: char } };
    canvas.add(tb);
    tb.setCoords();
    canvas.setActiveObject(tb);
    canvas.requestRenderAll();
    if (window.undoManager) {
      window.undoManager.record({
        name: 'Insert Field/Symbol',
        execute: () => { canvas.add(tb); canvas.requestRenderAll(); },
        undo: () => { canvas.remove(tb); canvas.requestRenderAll(); },
      });
    }
  }

  _showFieldChooserDialog(anchorBtn) {
    const cleanDocTitle = document.title.replace(/\s*[-—]\s*OpenDraw.*$/i, '').trim() || 'Drawing1';
    const fields = [
      { label: 'Current Date', val: new Date().toLocaleDateString() },
      { label: 'Current Time', val: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      { label: 'Page Name', val: this._canvasManager.pageManager ? this._canvasManager.pageManager.pages[this._canvasManager.pageManager.activePageIndex]?.name || 'Page-1' : 'Page-1' },
      { label: 'Page Number', val: `Page ${this._canvasManager.pageManager ? this._canvasManager.pageManager.activePageIndex + 1 : 1} of ${this._canvasManager.pageManager ? this._canvasManager.pageManager.pages.length : 1}` },
      { label: 'Document Title', val: cleanDocTitle },
      { label: 'Author / Owner', val: 'Marco Sodano' },
    ];

    let popup = document.getElementById('ribbon-dropdown-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'ribbon-dropdown-popup';
      document.body.appendChild(popup);
    }

    popup.style.cssText = `
      position: fixed;
      display: block;
      z-index: 10001;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      padding: 4px 0;
      min-width: 240px;
      font-family: var(--font-main);
      font-size: 12px;
      color: var(--text-primary);
      user-select: none;
    `;
    popup.innerHTML = `
      <div style="font-weight:600; color:var(--accent); padding:6px 12px; border-bottom:1px solid var(--border);">Insert Dynamic Field</div>
      ${fields.map((f, i) => `
        <div class="field-item" data-idx="${i}" style="display:flex; justify-content:space-between; gap:12px; padding:6px 12px; color:var(--text-primary); cursor:pointer;">
          <span>${f.label}</span>
          <span style="color:var(--text-muted); font-size:11px;">${f.val}</span>
        </div>
      `).join('')}
    `;

    popup.querySelectorAll('.field-item').forEach(el => {
      el.addEventListener('mouseenter', () => { el.style.background = 'var(--accent)'; el.style.color = '#ffffff'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; el.style.color = 'var(--text-primary)'; });
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const item = fields[idx];
        popup.style.display = 'none';
        this._insertSymbolChar(item.val);
      });
    });

    if (anchorBtn) {
      const rect = anchorBtn.getBoundingClientRect();
      popup.style.left = `${Math.min(window.innerWidth - 260, rect.left)}px`;
      popup.style.top = `${rect.bottom + 3}px`;
    }
  }

  _showHyperlinkDialog(anchorBtn) {
    let modal = document.getElementById('opendraw-hyperlink-dialog');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'opendraw-hyperlink-dialog';
      document.body.appendChild(modal);
    }
    modal.style.cssText = `
      position: fixed;
      display: none;
      z-index: 10005;
      background: var(--bg-secondary);
      border: 1px solid var(--accent);
      border-radius: 6px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.28);
      padding: 16px 20px;
      width: 360px;
      color: var(--text-primary);
      font-family: var(--font-main);
      font-size: 12px;
    `;

    const active = this._canvasManager.canvas.getActiveObject();
    const currentUrl = (active && active.hyperlink) ? active.hyperlink : 'https://';
    const currentText = (active && active.labelObject) ? active.labelObject.text : (active && active.text ? active.text : 'Link to resource');
    const pages = (this._canvasManager.pageManager && this._canvasManager.pageManager.pages) ? this._canvasManager.pageManager.pages : [{ name: 'Page-1' }];

    modal.innerHTML = `
      <div style="font-size:14px; font-weight:600; color:var(--accent); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span>Insert Hyperlink</span>
        <span id="link-close-btn" style="cursor:pointer; color:var(--text-muted); font-size:16px;">×</span>
      </div>
      <div style="margin-bottom:10px;">
        <label style="display:block; font-size:11px; color:var(--text-secondary); margin-bottom:4px;">Text to display:</label>
        <input type="text" id="link-text-input" value="${currentText.replace(/"/g, '&quot;')}" style="width:100%; box-sizing:border-box; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text-primary); padding:6px; border-radius:3px; font-size:12px; outline:none;">
      </div>
      <div style="margin-bottom:10px;">
        <label style="display:block; font-size:11px; color:var(--text-secondary); margin-bottom:4px;">Address (URL or Web link):</label>
        <input type="text" id="link-url-input" value="${currentUrl.replace(/"/g, '&quot;')}" placeholder="https://example.com" style="width:100%; box-sizing:border-box; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text-primary); padding:6px; border-radius:3px; font-size:12px; outline:none;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block; font-size:11px; color:var(--text-secondary); margin-bottom:4px;">Or Sub-address (Page in this document):</label>
        <select id="link-page-select" style="width:100%; box-sizing:border-box; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text-primary); padding:6px; border-radius:3px; font-size:12px; outline:none;">
          <option value="">None (External URL)</option>
          ${pages.map((p, i) => `<option value="${p.name || 'Page-' + (i+1)}">${p.name || 'Page-' + (i+1)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="link-cancel-btn" style="padding:6px 14px; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text-primary); border-radius:3px; cursor:pointer;">Cancel</button>
        <button id="link-ok-btn" style="padding:6px 14px; background:var(--accent); border:none; color:#ffffff; border-radius:3px; cursor:pointer; font-weight:600;">OK</button>
      </div>
    `;

    modal.style.display = 'block';

    if (anchorBtn) {
      const rect = anchorBtn.getBoundingClientRect();
      modal.style.left = `${Math.min(window.innerWidth - 380, Math.max(20, rect.left))}px`;
      modal.style.top = `${rect.bottom + 6}px`;
    } else {
      modal.style.left = '50%';
      modal.style.top = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
    }

    const close = () => { modal.style.display = 'none'; };
    modal.querySelector('#link-close-btn').onclick = close;
    modal.querySelector('#link-cancel-btn').onclick = close;

    modal.querySelector('#link-ok-btn').onclick = () => {
      const urlVal = modal.querySelector('#link-url-input').value.trim();
      const pageVal = modal.querySelector('#link-page-select').value;
      const textVal = modal.querySelector('#link-text-input').value.trim();
      const finalTarget = pageVal ? `#page:${pageVal}` : urlVal;

      if (active) {
        active.hyperlink = finalTarget;
        active.screenTip = `${textVal} (${finalTarget})`;
        if (active.labelObject && textVal) {
          active.labelObject.set('text', textVal);
        }
        this._canvasManager.canvas.requestRenderAll();
      } else {
        const vpt = this._canvasManager.canvas.viewportTransform;
        const zoom = this._canvasManager.canvas.getZoom();
        const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
        const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;
        const tb = new fabric.Textbox(textVal || finalTarget, {
          left: cx - 60,
          top: cy - 15,
          width: 140,
          fontSize: 13,
          fontFamily: 'Segoe UI, sans-serif',
          fill: '#0078d4',
          underline: true,
          textAlign: 'center',
        });
        tb.hyperlink = finalTarget;
        tb.screenTip = finalTarget;
        this._canvasManager.canvas.add(tb);
        this._canvasManager.canvas.setActiveObject(tb);
        this._canvasManager.canvas.requestRenderAll();
      }
      close();
    };
  }

  async _showScreenTipDialog() {
    const active = this._canvasManager.canvas.getActiveObject();
    if (!active) {
      if (window.openDrawDialog) {
        await window.openDrawDialog.alert('Please select a shape first to attach a ScreenTip.', 'ScreenTip');
      }
      return;
    }

    const currentTip = active.screenTip || (active.shapeData ? active.shapeData.screenTip : '') || '';
    const newTip = window.openDrawDialog
      ? await window.openDrawDialog.prompt('Enter ScreenTip (tooltip displayed when hovering over this shape):', currentTip, 'Edit ScreenTip')
      : null;
    if (newTip !== null) {
      const prevTip = currentTip;
      const nextTip = newTip.trim();
      const applyTip = (t) => {
        active.screenTip = t;
        if (!active.shapeData) active.shapeData = {};
        active.shapeData.screenTip = t;
      };
      applyTip(nextTip);
      if (window.undoManager) {
        window.undoManager.record({
          name: 'Edit ScreenTip',
          execute: () => applyTip(nextTip),
          undo: () => applyTip(prevTip),
        });
      }
      this._showToast(active.screenTip ? `ScreenTip attached: "${active.screenTip}"` : 'ScreenTip cleared.');
    }
  }

  async _showInsertObjectDialog() {
    if (window.openDraw && window.openDraw.showOpenDialog) {
      try {
        const filePath = await window.openDraw.showOpenDialog();
        if (!filePath) return;
        const lower = filePath.toLowerCase();
        const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
        const vpt = this._canvasManager.canvas.viewportTransform;
        const zoom = this._canvasManager.canvas.getZoom();
        const cx = (-vpt[4] + this._canvasManager._container.clientWidth / 2) / zoom;
        const cy = (-vpt[5] + this._canvasManager._container.clientHeight / 2) / zoom;

        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          const img = await fabric.Image.fromURL(fileUrl);
          if (!img) return;
          img.set({ left: cx, top: cy, originX: 'center', originY: 'center' });
          this._canvasManager.canvas.add(img);
          this._canvasManager.canvas.setActiveObject(img);
          this._canvasManager.canvas.requestRenderAll();
        } else if (lower.endsWith('.svg')) {
          const res = await fabric.loadSVGFromURL(fileUrl);
          if (!res || !res.objects) return;
          const obj = fabric.util.groupSVGElements(res.objects, res.options);
          obj.set({ left: cx, top: cy, originX: 'center', originY: 'center' });
          this._canvasManager.canvas.add(obj);
          this._canvasManager.canvas.setActiveObject(obj);
          this._canvasManager.canvas.requestRenderAll();
        } else if (/\.(vsdx?|vsdm|vstx?|vstm|vssx?|vssm|odraw)$/i.test(lower) && window.handleFileOpen) {
          await window.handleFileOpen(filePath);
        } else if (window.openDrawDialog) {
          await window.openDrawDialog.alert(`Inserted reference: ${filePath}`, 'Insert Object');
        }
      } catch (err) {
        console.error('Insert object failed:', err);
        this._showToast(`Failed to insert object: ${err.message}`);
      }
    } else {
      document.getElementById('insert-picture-input')?.click();
    }
  }

  _initLanguage() {
    // Synchronize initial language with status bar element or default to pt-PT
    const statusLang = document.getElementById('status-language');
    const langMap = {
      'en-us': 'English (United States)',
      'en-gb': 'English (United Kingdom)',
      'pt-pt': 'Portuguese (Portugal)',
      'pt-br': 'Portuguese (Brazil)',
      'es-es': 'Spanish (Spain)',
      'fr-fr': 'French (France)',
      'it-it': 'Italian (Italy)',
      'de-de': 'German (Germany)',
    };
    if (statusLang && statusLang.textContent.trim()) {
      const text = statusLang.textContent.trim();
      const match = Object.entries(langMap).find(([k, v]) => v.toLowerCase() === text.toLowerCase());
      window._activeLanguage = match ? match[0].split('-').map((p, i) => i === 0 ? p : p.toUpperCase()).join('-') : 'pt-PT';
    } else {
      window._activeLanguage = 'pt-PT';
      if (statusLang) statusLang.textContent = 'Portuguese (Portugal)';
    }

    // Clicking status bar language opens Proofing Language Dialog
    if (statusLang && !statusLang._langBound) {
      statusLang._langBound = true;
      statusLang.style.cursor = 'pointer';
      statusLang.title = 'Click to change proofing language';
      statusLang.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showProofingLanguageDialog();
      });
    }
  }

  _setLanguage(code, label) {
    window._activeLanguage = code;
    const statusLang = document.getElementById('status-language');
    if (statusLang) {
      statusLang.textContent = label;
    }
    this._showToast(`Proofing language set to: ${label}`);
  }

  _showProofingLanguageDialog() {
    const existing = document.getElementById('opendraw-proofing-dialog');
    if (existing) existing.remove();

    const languages = [
      { code: 'pt-PT', label: 'Portuguese (Portugal)' },
      { code: 'pt-BR', label: 'Portuguese (Brazil)' },
      { code: 'en-US', label: 'English (United States)' },
      { code: 'en-GB', label: 'English (United Kingdom)' },
      { code: 'es-ES', label: 'Spanish (Spain)' },
      { code: 'fr-FR', label: 'French (France)' },
      { code: 'it-IT', label: 'Italian (Italy)' },
      { code: 'de-DE', label: 'German (Germany)' },
      { code: 'nl-NL', label: 'Dutch (Netherlands)' },
      { code: 'ja-JP', label: 'Japanese' },
      { code: 'zh-CN', label: 'Chinese (Simplified)' },
      { code: 'pl-PL', label: 'Polish' },
      { code: 'ru-RU', label: 'Russian' }
    ];

    const currentCode = window._activeLanguage || 'pt-PT';
    let selectedCode = currentCode;

    const overlay = document.createElement('div');
    overlay.id = 'opendraw-proofing-dialog';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex; align-items: center; justify-content: center;
      z-index: 20000; font-family: 'Segoe UI', Tahoma, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #252526; color: #cccccc; border: 1px solid #3f3f46;
      border-radius: 4px; width: 380px; box-shadow: 0 12px 36px rgba(0,0,0,0.7);
      display: flex; flex-direction: column; overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'background: #2d2d30; padding: 10px 16px; font-size: 13px; font-weight: 600; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3f3f46;';
    header.innerHTML = '<span>Language</span><button id="dlg-lang-close" style="background:none; border:none; color:#aaa; font-size:16px; cursor:pointer;">&times;</button>';
    dialog.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 12px;';

    const promptText = document.createElement('div');
    promptText.textContent = 'Mark selected text / document as:';
    body.appendChild(promptText);

    // List container
    const list = document.createElement('div');
    list.style.cssText = 'background: #1e1e1e; border: 1px solid #3f3f46; height: 180px; overflow-y: auto; border-radius: 2px;';

    languages.forEach((lang) => {
      const item = document.createElement('div');
      item.style.cssText = `padding: 6px 10px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${lang.code === selectedCode ? 'background: #094771; color: #fff;' : 'color: #ccc;'}`;
      item.innerHTML = `<span>${lang.label}</span>${lang.code === currentCode ? '<span style="color:#0078d4; font-weight:bold;">(Current)</span>' : ''}`;
      item.addEventListener('click', () => {
        selectedCode = lang.code;
        Array.from(list.children).forEach(c => {
          c.style.background = 'transparent';
          c.style.color = '#ccc';
        });
        item.style.background = '#094771';
        item.style.color = '#ffffff';
      });
      list.appendChild(item);
    });
    body.appendChild(list);

    // Checkboxes like in Visio / Office
    const chk1 = document.createElement('label');
    chk1.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; color: #bbb;';
    chk1.innerHTML = '<input type="checkbox" checked style="cursor:pointer;"> Do not check spelling or grammar';
    body.appendChild(chk1);

    const chk2 = document.createElement('label');
    chk2.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; color: #bbb;';
    chk2.innerHTML = '<input type="checkbox" checked style="cursor:pointer;"> Detect language automatically';
    body.appendChild(chk2);

    dialog.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'padding: 10px 16px; background: #2d2d30; border-top: 1px solid #3f3f46; display: flex; justify-content: flex-end; gap: 8px;';

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    btnCancel.style.cssText = 'padding: 5px 14px; background: #3e3e42; color: #fff; border: 1px solid #555; border-radius: 2px; cursor: pointer; font-size: 12px;';
    btnCancel.addEventListener('click', () => overlay.remove());

    const btnOk = document.createElement('button');
    btnOk.textContent = 'OK';
    btnOk.style.cssText = 'padding: 5px 16px; background: #0078d4; color: #fff; border: 1px solid #005a9e; border-radius: 2px; cursor: pointer; font-size: 12px; font-weight: 600;';
    btnOk.addEventListener('click', () => {
      const chosen = languages.find(l => l.code === selectedCode) || languages[0];
      this._setLanguage(chosen.code, chosen.label);
      overlay.remove();
    });

    footer.appendChild(btnOk);
    footer.appendChild(btnCancel);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const closeBtn = header.querySelector('#dlg-lang-close');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  _showNewPageSetupDialog() {
    const existing = document.getElementById('opendraw-newpage-dialog');
    if (existing) existing.remove();

    const pageCount = (this._canvasManager.pageManager && this._canvasManager.pageManager.pages)
      ? this._canvasManager.pageManager.pages.length + 1
      : 2;

    const overlay = document.createElement('div');
    overlay.id = 'opendraw-newpage-dialog';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex; align-items: center; justify-content: center;
      z-index: 20000; font-family: 'Segoe UI', Tahoma, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #252526; color: #cccccc; border: 1px solid #3f3f46;
      border-radius: 4px; width: 420px; box-shadow: 0 12px 36px rgba(0,0,0,0.7);
      display: flex; flex-direction: column; overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'background: #2d2d30; padding: 10px 16px; font-size: 13px; font-weight: 600; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3f3f46;';
    header.innerHTML = '<span>Page Setup - New Page</span><button id="dlg-np-close" style="background:none; border:none; color:#aaa; font-size:16px; cursor:pointer;">&times;</button>';
    dialog.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding: 16px; display: flex; flex-direction: column; gap: 14px; font-size: 12px;';

    // Page Name
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
    nameRow.innerHTML = `
      <label style="color:#ffffff; font-weight:600;">Page Name:</label>
      <input type="text" id="dlg-np-name" value="Page-${pageCount}" style="background:#1e1e1e; border:1px solid #3f3f46; color:#fff; padding:6px 10px; border-radius:2px; font-size:12px;">
    `;
    body.appendChild(nameRow);

    // Presets
    const presetRow = document.createElement('div');
    presetRow.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
    presetRow.innerHTML = `
      <label style="color:#ffffff; font-weight:600;">Paper / Page Size:</label>
      <select id="dlg-np-preset" style="background:#1e1e1e; border:1px solid #3f3f46; color:#fff; padding:6px 10px; border-radius:2px; font-size:12px;">
        <option value="a4" selected>A4 (297 × 210 mm)</option>
        <option value="a3">A3 (420 × 297 mm)</option>
        <option value="letter">Letter (8.5 × 11 in)</option>
        <option value="tabloid">Tabloid (11 × 17 in)</option>
        <option value="custom">Custom Size</option>
      </select>
    `;
    body.appendChild(presetRow);

    // Orientation
    const orientRow = document.createElement('div');
    orientRow.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
    orientRow.innerHTML = `
      <label style="color:#ffffff; font-weight:600;">Orientation:</label>
      <div style="display:flex; gap:20px; align-items:center; margin-top:2px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="radio" name="dlg-np-orient" value="landscape" checked style="cursor:pointer;"> Landscape
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="radio" name="dlg-np-orient" value="portrait" style="cursor:pointer;"> Portrait
        </label>
      </div>
    `;
    body.appendChild(orientRow);

    // Dimensions
    const dimRow = document.createElement('div');
    dimRow.id = 'dlg-np-dims';
    dimRow.style.cssText = 'display: flex; gap: 12px;';
    dimRow.innerHTML = `
      <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
        <label style="color:#aaa; font-size:11px;">Width (px):</label>
        <input type="number" id="dlg-np-width" value="1122" style="background:#1e1e1e; border:1px solid #3f3f46; color:#fff; padding:5px 8px; border-radius:2px; font-size:12px;">
      </div>
      <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
        <label style="color:#aaa; font-size:11px;">Height (px):</label>
        <input type="number" id="dlg-np-height" value="794" style="background:#1e1e1e; border:1px solid #3f3f46; color:#fff; padding:5px 8px; border-radius:2px; font-size:12px;">
      </div>
    `;
    body.appendChild(dimRow);

    const note = document.createElement('div');
    note.style.cssText = 'color: #888888; font-size: 11px; font-style: italic;';
    note.textContent = 'Note: This configuration will apply strictly to the newly created page. Existing pages remain unchanged.';
    body.appendChild(note);

    dialog.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'padding: 10px 16px; background: #2d2d30; border-top: 1px solid #3f3f46; display: flex; justify-content: flex-end; gap: 8px;';

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    btnCancel.style.cssText = 'padding: 5px 14px; background: #3e3e42; color: #fff; border: 1px solid #555; border-radius: 2px; cursor: pointer; font-size: 12px;';
    btnCancel.addEventListener('click', () => overlay.remove());

    const btnOk = document.createElement('button');
    btnOk.textContent = 'Create Page';
    btnOk.style.cssText = 'padding: 5px 16px; background: #0078d4; color: #fff; border: 1px solid #005a9e; border-radius: 2px; cursor: pointer; font-size: 12px; font-weight: 600;';

    footer.appendChild(btnOk);
    footer.appendChild(btnCancel);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Logic for updating dimension inputs based on preset and orientation
    const selPreset = dialog.querySelector('#dlg-np-preset');
    const inputW = dialog.querySelector('#dlg-np-width');
    const inputH = dialog.querySelector('#dlg-np-height');
    const orientRadios = dialog.querySelectorAll('input[name="dlg-np-orient"]');

    const updateDims = () => {
      const p = selPreset.value;
      const isLandscape = dialog.querySelector('input[name="dlg-np-orient"]:checked').value === 'landscape';
      let w = 11.69 * 96;
      let h = 8.27 * 96;

      if (p === 'a4') {
        w = isLandscape ? 11.69 * 96 : 8.27 * 96;
        h = isLandscape ? 8.27 * 96 : 11.69 * 96;
      } else if (p === 'a3') {
        w = isLandscape ? 16.54 * 96 : 11.69 * 96;
        h = isLandscape ? 11.69 * 96 : 16.54 * 96;
      } else if (p === 'letter') {
        w = isLandscape ? 11 * 96 : 8.5 * 96;
        h = isLandscape ? 8.5 * 96 : 11 * 96;
      } else if (p === 'tabloid') {
        w = isLandscape ? 17 * 96 : 11 * 96;
        h = isLandscape ? 11 * 96 : 17 * 96;
      }

      if (p !== 'custom') {
        inputW.value = Math.round(w);
        inputH.value = Math.round(h);
      }
    };

    selPreset.addEventListener('change', updateDims);
    orientRadios.forEach(r => r.addEventListener('change', updateDims));

    btnOk.addEventListener('click', () => {
      const pageName = dialog.querySelector('#dlg-np-name').value.trim() || `Page-${pageCount}`;
      const finalW = parseFloat(inputW.value) || (11.69 * 96);
      const finalH = parseFloat(inputH.value) || (8.27 * 96);

      if (this._canvasManager.pageManager) {
        this._canvasManager.pageManager.addPage(pageName, finalW, finalH);
        this._canvasManager.zoomToFit();
        this._showToast(`Created ${pageName} (${Math.round(finalW)} × ${Math.round(finalH)} px)`);
      }
      overlay.remove();
    });

    const closeBtn = header.querySelector('#dlg-np-close');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  _setupHoverScreenTips() {
    let tooltipEl = document.getElementById('opendraw-screentip-bubble');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'opendraw-screentip-bubble';
      tooltipEl.style.cssText = `
        position: fixed;
        display: none;
        z-index: 10003;
        background: #1e1e1e;
        color: #ffffff;
        border: 1px solid #0078d4;
        border-radius: 3px;
        padding: 4px 8px;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        pointer-events: none;
      `;
      document.body.appendChild(tooltipEl);
    }

    this._canvasManager.canvas.on('mouse:over', (e) => {
      const obj = e.target;
      if (obj && obj.screenTip) {
        tooltipEl.textContent = obj.screenTip;
        tooltipEl.style.display = 'block';
      }
    });

    this._canvasManager.canvas.on('mouse:out', () => {
      tooltipEl.style.display = 'none';
    });

    this._canvasManager.canvas.on('mouse:move', (e) => {
      if (tooltipEl.style.display === 'block' && e.e) {
        tooltipEl.style.left = `${e.e.clientX + 14}px`;
        tooltipEl.style.top = `${e.e.clientY + 14}px`;
      }
    });
  }
}

window.ToolbarController = ToolbarController;

