/**
 * PanelController — Manages collapsible side panels and stencil categories.
 * 
 * Handles:
 * - Panel collapse/expand
 * - Stencil category accordion
 * - Properties panel updates based on selection
 */
class PanelController {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this._canvasManager = canvasManager;

    this._setupPanelToggle();
    this._setupStencilCategories();
    this._setupPropertiesBinding();
    this._populateStencils();
    this._setupCommentsPane();

    window.panelController = this;

    // Restore any previously loaded external stencils on startup
    this._restorePersistedStencils();
  }

  /**
   * Setup collapse buttons and collapsed strip click for panels.
   */
  _setupPanelToggle() {
    document.querySelectorAll('.panel-collapse-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const panelId = btn.dataset.panel;
        if (panelId === 'shapes-panel') {
          this.toggleShapesPanel();
        } else if (panelId === 'properties-panel') {
          this.togglePropertiesPanel();
        } else if (panelId === 'comments-pane') {
          this.toggleCommentsPane();
        } else {
          const panel = document.getElementById(panelId);
          if (panel) panel.classList.toggle('collapsed');
        }
      });
    });

    const shapesPanel = document.getElementById('shapes-panel');
    if (shapesPanel) {
      shapesPanel.addEventListener('click', (e) => {
        // If shapes panel is collapsed, clicking anywhere on the collapsed bar expands it
        if (shapesPanel.classList.contains('collapsed')) {
          this.toggleShapesPanel(true);
        }
      });
    }
  }

  /**
   * Toggle or set the Shapes panel collapsed state.
   * @param {boolean|null} forceExpanded - true to expand, false to collapse, null to toggle
   */
  toggleShapesPanel(forceExpanded = null) {
    const panel = document.getElementById('shapes-panel');
    if (!panel) return;
    const isCurrentlyCollapsed = panel.classList.contains('collapsed');
    const shouldCollapse = (forceExpanded !== null) ? !forceExpanded : !isCurrentlyCollapsed;

    panel.classList.toggle('collapsed', shouldCollapse);

    const collapseBtn = panel.querySelector('.panel-collapse-btn');
    if (collapseBtn) {
      collapseBtn.textContent = shouldCollapse ? '▶' : '◀';
    }

    document.querySelectorAll('[data-action="toggle-shapes-panel"]').forEach((btn) => {
      btn.classList.toggle('active', !shouldCollapse);
    });

    setTimeout(() => {
      const container = document.getElementById('canvas-container');
      if (container && this._canvasManager && this._canvasManager.canvas) {
        const rect = container.getBoundingClientRect();
        this._canvasManager.canvas.setDimensions({
          width: rect.width,
          height: rect.height,
        });
        if (this._canvasManager.rulerManager) {
          this._canvasManager.rulerManager.draw();
        }
      }
    }, 250);
  }

  /**
   * Toggle or set the Properties panel collapsed state.
   * @param {boolean|null} forceExpanded - true to expand, false to collapse, null to toggle
   */
  togglePropertiesPanel(forceExpanded = null) {
    const panel = document.getElementById('properties-panel');
    if (!panel) return;
    const isCurrentlyCollapsed = panel.classList.contains('collapsed');
    const shouldCollapse = (forceExpanded !== null) ? !forceExpanded : !isCurrentlyCollapsed;

    panel.classList.toggle('collapsed', shouldCollapse);

    const collapseBtn = panel.querySelector('.panel-collapse-btn');
    if (collapseBtn) {
      collapseBtn.textContent = shouldCollapse ? '◀' : '▶';
    }

    document.querySelectorAll('[data-action="toggle-properties-panel"]').forEach((btn) => {
      btn.classList.toggle('active', !shouldCollapse);
    });

    setTimeout(() => {
      const container = document.getElementById('canvas-container');
      if (container && this._canvasManager && this._canvasManager.canvas) {
        const rect = container.getBoundingClientRect();
        this._canvasManager.canvas.setDimensions({
          width: rect.width,
          height: rect.height,
        });
        if (this._canvasManager.rulerManager) {
          this._canvasManager.rulerManager.draw();
        }
      }
    }, 250);
  }

  /**
   * Toggle or set the Comments panel collapsed state.
   * @param {boolean|null} forceExpanded - true to expand, false to collapse, null to toggle
   */
  toggleCommentsPane(forceExpanded = null) {
    const panel = document.getElementById('comments-pane');
    if (!panel) return;
    const isCurrentlyCollapsed = panel.classList.contains('collapsed');
    const shouldCollapse = (forceExpanded !== null) ? !forceExpanded : !isCurrentlyCollapsed;

    panel.classList.toggle('collapsed', shouldCollapse);

    document.querySelectorAll('[data-action="review:comments-pane"]').forEach((btn) => {
      btn.classList.toggle('active', !shouldCollapse);
    });

    if (!shouldCollapse) {
      this.refreshCommentsList();
    }

    setTimeout(() => {
      const container = document.getElementById('canvas-container');
      if (container && this._canvasManager && this._canvasManager.canvas) {
        const rect = container.getBoundingClientRect();
        this._canvasManager.canvas.setDimensions({
          width: rect.width,
          height: rect.height,
        });
        if (this._canvasManager.rulerManager) {
          this._canvasManager.rulerManager.draw();
        }
      }
    }, 250);
  }

  /**
   * Setup draggable chip and interactions for Comments Pane.
   */
  _setupCommentsPane() {
    const chip = document.getElementById('draggable-comment-chip');
    if (chip) {
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/opendraw-shape', 'comment-card');
        e.dataTransfer.setData('text/plain', 'comment-card');
        e.dataTransfer.effectAllowed = 'copy';
      });
    }

    // Note: #btn-pane-new-comment already carries data-action="review:new-comment"
    // wired by ToolbarController; avoid binding a duplicate listener here.

    // Canvas listeners to sync comments list with canvas state
    if (this._canvasManager && this._canvasManager.canvas) {
      const canvas = this._canvasManager.canvas;
      canvas.on('selection:created', (e) => this._highlightActiveComment(e.selected ? e.selected[0] : null));
      canvas.on('selection:updated', (e) => this._highlightActiveComment(e.selected ? e.selected[0] : null));
      canvas.on('selection:cleared', () => this._highlightActiveComment(null));
      canvas.on('object:added', (e) => {
        if (e.target && e.target.objectType === 'comment-card') this.refreshCommentsList();
      });
      canvas.on('object:removed', (e) => {
        if (e.target && e.target.objectType === 'comment-card') this.refreshCommentsList();
      });
      canvas.on('object:modified', (e) => {
        if (e.target && e.target.objectType === 'comment-card') this.refreshCommentsList();
      });
    }
  }

  /**
   * Refresh comments in the Comments Pane sidebar.
   */
  refreshCommentsList() {
    const container = document.getElementById('comments-list-container');
    if (!container || !this._canvasManager || !this._canvasManager.canvas) return;

    const comments = this._canvasManager.canvas.getObjects().filter(o => o.objectType === 'comment-card');
    container.innerHTML = '';

    if (comments.length === 0) {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px 16px; text-align:center; color:#888888;">
          <div style="font-size:32px; margin-bottom:10px; opacity:0.8;">💬</div>
          <div style="font-size:12px; font-weight:600; color:#d4d4d4; margin-bottom:4px;">No comments yet</div>
          <div style="font-size:11px; line-height:1.4;">Add a comment using "+ New Comment" or drag note to the canvas.</div>
        </div>
      `;
      return;
    }

    const activeObj = this._canvasManager.canvas.getActiveObject();

    comments.forEach((comment, index) => {
      const card = document.createElement('div');
      card.className = 'comment-pane-card' + (comment === activeObj ? ' active' : '');
      card.dataset.commentId = comment.id || String(index);

      const author = comment.commentAuthor || 'Marco Sodano';
      const initials = author.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'MS';
      const date = comment.commentDate || 'Just now';
      const text = comment.labelObject ? comment.labelObject.text : 'Type comment here...';

      const header = document.createElement('div');
      header.className = 'comment-pane-header';

      const authorRow = document.createElement('div');
      authorRow.className = 'comment-pane-author-row';
      authorRow.innerHTML = `
        <div class="comment-pane-avatar">${initials}</div>
        <div>
          <div class="comment-pane-author">${author}</div>
          <div class="comment-pane-time">${date}</div>
        </div>
      `;

      const delBtn = document.createElement('button');
      delBtn.className = 'comment-pane-delete-btn';
      delBtn.title = 'Delete comment';
      delBtn.textContent = '✕';

      header.appendChild(authorRow);
      header.appendChild(delBtn);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'comment-pane-body';
      bodyEl.textContent = text;

      card.appendChild(header);
      card.appendChild(bodyEl);

      // Click card to select comment on canvas
      card.addEventListener('click', (e) => {
        if (e.target.closest('.comment-pane-delete-btn')) return;
        this._canvasManager.canvas.setActiveObject(comment);
        this._canvasManager.canvas.requestRenderAll();
        this._highlightActiveComment(comment);
      });

      // Delete button
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const canvas = this._canvasManager.canvas;
        window.undoManager.record({
          name: 'Delete Comment',
          execute: () => {
            canvas.remove(comment);
            canvas.requestRenderAll();
            this.refreshCommentsList();
          },
          undo: () => {
            canvas.add(comment);
            canvas.requestRenderAll();
            this.refreshCommentsList();
          }
        });
        canvas.remove(comment);
        canvas.requestRenderAll();
        this.refreshCommentsList();
      });

      container.appendChild(card);
    });
  }

  /**
   * Highlight the currently active comment card in the comments pane.
   */
  _highlightActiveComment(activeObj) {
    const container = document.getElementById('comments-list-container');
    if (!container) return;

    const cards = container.querySelectorAll('.comment-pane-card');
    const comments = this._canvasManager.canvas.getObjects().filter(o => o.objectType === 'comment-card');

    cards.forEach((card, idx) => {
      const match = comments[idx] && comments[idx] === activeObj;
      card.classList.toggle('active', !!match);
      if (match) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  /**
   * Setup accordion behavior for stencil categories.
   */
  _setupStencilCategories() {
    document.querySelectorAll('.stencil-category-header').forEach((header) => {
      header.addEventListener('click', () => {
        const grid = header.nextElementSibling;
        const isOpen = grid.style.display !== 'none';
        grid.style.display = isOpen ? 'none' : 'grid';
        header.textContent = header.textContent.replace(/[▸▾]/, isOpen ? '▸' : '▾');
        header.classList.toggle('expanded', !isOpen);
        header.classList.toggle('active', !isOpen);
      });
    });
  }

  _setupSearch() {
    const searchInput = document.getElementById('stencil-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      const categories = document.querySelectorAll('.stencil-category');

      categories.forEach((cat) => {
        let hasVisible = false;
        const items = cat.querySelectorAll('.stencil-item');
        items.forEach((item) => {
          const text = (item.textContent || '').toLowerCase();
          const shapeType = (item.dataset.shapeType || '').toLowerCase();
          const matches = !q || text.includes(q) || shapeType.includes(q);
          item.style.display = matches ? 'flex' : 'none';
          if (matches) hasVisible = true;
        });

        const grid = cat.querySelector('.stencil-grid');
        const header = cat.querySelector('.stencil-category-header');
        if (q) {
          cat.style.display = hasVisible ? 'block' : 'none';
          if (hasVisible && grid) {
            grid.style.display = 'grid';
            if (header) header.textContent = header.textContent.replace(/[▸▾]/, '▾');
          }
        } else {
          cat.style.display = 'block';
        }
      });
    });
  }

  /**
   * Setup More Shapes flyout menu.
   */
  _setupMoreShapesMenu() {
    const moreBtn = document.getElementById('btn-more-shapes');
    if (!moreBtn) return;

    let menu = document.getElementById('more-shapes-flyout');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'more-shapes-flyout';
      menu.className = 'more-shapes-menu';
      menu.style.display = 'none';
      document.body.appendChild(menu);

      document.addEventListener('click', (e) => {
        if (!moreBtn.contains(e.target) && !menu.contains(e.target)) {
          menu.style.display = 'none';
        }
      });
    }

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menu.style.display === 'block';
      if (!isVisible) {
        this._renderMoreShapesMenu(menu);
        const rect = moreBtn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 2}px`;
        menu.style.left = `${rect.left}px`;
        menu.style.display = 'block';
      } else {
        menu.style.display = 'none';
      }
    });
  }

  /**
   * Render dynamic content of More Shapes menu including loaded custom stencils.
   */
  _renderMoreShapesMenu(menu) {
    const persisted = this._getPersistedStencils();
    let customItemsHtml = '';
    if (persisted.length > 0) {
      customItemsHtml = `
        <div class="more-shapes-divider"></div>
        <div class="more-shapes-header-label" style="padding: 4px 12px; font-size: 10px; color: #888888; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Loaded Stencils</div>
      `;
      persisted.forEach((item) => {
        customItemsHtml += `
          <div class="more-shapes-item stencil-flyout-item" data-category="${item.categoryKey}" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">✓ ${VisioConverter._escapeXml(item.title)}</span>
            <button class="more-shapes-close-btn" data-category="${item.categoryKey}" data-filepath="${VisioConverter._escapeXml(item.filePath)}" title="Close stencil" style="background:none; border:none; color:#888888; cursor:pointer; font-size:11px; padding:2px 4px; border-radius:2px;">✕</button>
          </div>
        `;
      });
    }

    menu.innerHTML = `
      <div class="more-shapes-item" data-action="toggle-cat" data-target="basic">
        <span>General &gt; Basic Shapes</span>
      </div>
      <div class="more-shapes-item" data-action="toggle-cat" data-target="flowchart">
        <span>Flowchart &gt; Basic Flowchart Shapes</span>
      </div>
      <div class="more-shapes-divider"></div>
      <div class="more-shapes-item" data-action="open-stencil-file">
        <span>Open Stencil...</span>
      </div>
      ${customItemsHtml}
    `;

    menu.querySelectorAll('[data-action="toggle-cat"]').forEach((item) => {
      item.addEventListener('click', () => {
        const catName = item.dataset.target;
        const cat = document.querySelector(`.stencil-category[data-category="${catName}"]`);
        if (cat) {
          cat.style.display = 'block';
          const header = cat.querySelector('.stencil-category-header');
          const grid = cat.querySelector('.stencil-grid');
          if (grid && grid.style.display === 'none') {
            grid.style.display = 'grid';
            if (header) {
              header.classList.add('expanded');
              header.textContent = '▾ ' + header.textContent.replace(/^[▾▸]\s*/, '');
            }
          }
          cat.scrollIntoView({ behavior: 'smooth' });
        }
        menu.style.display = 'none';
      });
    });

    menu.querySelector('[data-action="open-stencil-file"]').addEventListener('click', async () => {
      menu.style.display = 'none';
      await this.openStencilFileDialog();
    });

    menu.querySelectorAll('.stencil-flyout-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.more-shapes-close-btn')) return;
        const catKey = item.dataset.category;
        const cat = document.querySelector(`.stencil-category[data-category="${catKey}"]`);
        if (cat) {
          cat.style.display = 'block';
          const grid = cat.querySelector('.stencil-grid');
          if (grid) grid.style.display = 'grid';
          cat.scrollIntoView({ behavior: 'smooth' });
        }
        menu.style.display = 'none';
      });
    });

    menu.querySelectorAll('.more-shapes-close-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const catKey = btn.dataset.category;
        const fPath = btn.dataset.filepath;
        this.closeStencil(catKey, fPath);
        this._renderMoreShapesMenu(menu);
      });
    });
  }

  /**
   * Populate stencil grids with shape thumbnails.
   */
  _populateStencils() {
    this._setupSearch();
    this._setupMoreShapesMenu();

    const stencils = {
      basic: [
        { type: 'rectangle', label: 'Rectangle', svg: '<rect x="4" y="8" width="24" height="16" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'square', label: 'Square', svg: '<rect x="6" y="6" width="20" height="20" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'circle', label: 'Circle', svg: '<circle cx="16" cy="16" r="10" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'ellipse', label: 'Ellipse', svg: '<ellipse cx="16" cy="16" rx="12" ry="8" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'right-triangle', label: 'Right Triangle', svg: '<polygon points="6,26 26,26 6,6" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'triangle', label: 'Triangle', svg: '<polygon points="16,4 28,28 4,28" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'diamond', label: 'Diamond', svg: '<polygon points="16,4 28,16 16,28 4,16" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'rounded-rect', label: 'Rounded Rect', svg: '<rect x="4" y="8" width="24" height="16" rx="4" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'pentagon', label: 'Pentagon', svg: '<polygon points="16,4 28,12 24,28 8,28 4,12" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'hexagon', label: 'Hexagon', svg: '<polygon points="8,4 24,4 30,16 24,28 8,28 2,16" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'star-4', label: '4-Point Star', svg: '<polygon points="16,2 19,13 30,16 19,19 16,30 13,19 2,16 13,13" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'star', label: '5-Point Star', svg: '<polygon points="16,2 19,11 28,11 21,17 23,27 16,21 9,27 11,17 4,11 13,11" fill="#D9E1F2" stroke="#41719C" stroke-width="1"/>' },
        { type: 'star-6', label: '6-Point Star', svg: '<polygon points="16,2 19,9 27,6 23,13 28,19 20,19 16,27 12,19 4,19 9,13 5,6 13,9" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'star-8', label: '8-Point Star', svg: '<polygon points="16,2 18.7,9.5 25.9,6.1 22.5,13.3 30,16 22.5,18.7 25.9,25.9 18.7,22.5 16,30 13.3,22.5 6.1,25.9 9.5,18.7 2,16 9.5,13.3 6.1,6.1 13.3,9.5" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'cross', label: 'Cross', svg: '<path d="M12,4 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 z" fill="#D9E1F2" stroke="#41719C" stroke-width="1"/>' },
        { type: 'cylinder', label: 'Cylinder', svg: '<path d="M 6 8 L 6 22 A 10 4 0 0 0 26 22 L 26 8 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/><ellipse cx="16" cy="8" rx="10" ry="4" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'rotated-triangle', label: 'Rotated Triangle', svg: '<polygon points="4,6 28,6 16,26" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'heptagon', label: 'Heptagon', svg: '<polygon points="16,4 26,8 29,19 22,28 10,28 3,19 6,8" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'octagon', label: 'Octagon', svg: '<polygon points="10,4 22,4 28,10 28,22 22,28 10,28 4,22 4,10" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'parallelogram', label: 'Parallelogram', svg: '<polygon points="8,7 28,7 24,25 4,25" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'trapezoid', label: 'Trapezoid', svg: '<polygon points="8,7 24,7 28,25 4,25" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'chevron', label: 'Chevron', svg: '<polygon points="4,6 20,6 28,16 20,26 4,26 12,16" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'cube', label: 'Cube', svg: '<polygon points="5,11 11,5 29,5 29,21 23,27 5,27" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/><polyline points="5,11 23,11 23,27" fill="none" stroke="#41719C" stroke-width="1.2"/><line x1="23" y1="11" x2="29" y2="5" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'drop', label: 'Drop', svg: '<path d="M16 4 C25 15 24 26 16 26 C8 26 7 15 16 4 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'semi-circle', label: 'Semi Circle', svg: '<path d="M4 22 A12 12 0 0 1 28 22 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'cone', label: 'Cone', svg: '<path d="M16 4 L26 24 A10 4 0 0 1 6 24 Z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/>' },
        { type: 'pyramid', label: 'Pyramid', svg: '<polygon points="16,4 28,26 4,26" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/><line x1="16" y1="4" x2="16" y2="26" stroke="#41719C" stroke-width="1"/>' },
        { type: 'gear', label: 'Gear', svg: '<path d="M14,3 h4 v3.2 a9,9 0 0 1 2.8,1.2 l2.3,-2.3 2.8,2.8 -2.3,2.3 a9,9 0 0 1 1.2,2.8 H28 v4 h-3.2 a9,9 0 0 1 -1.2,2.8 l2.3,2.3 -2.8,2.8 -2.3,-2.3 a9,9 0 0 1 -2.8,1.2 V29 h-4 v-3.2 a9,9 0 0 1 -2.8,-1.2 l-2.3,2.3 -2.8,-2.8 2.3,-2.3 a9,9 0 0 1 -1.2,-2.8 H4 v-4 h3.2 a9,9 0 0 1 1.2,-2.8 L6.1,8 8.9,5.2 11.2,7.5 a9,9 0 0 1 2.8,-1.2 V3 z M16,11 a5,5 0 1 0 0,10 5,5 0 0 0 0,-10 z" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2" fill-rule="evenodd"/>' },
        { type: 'donut', label: 'Donut', svg: '<circle cx="16" cy="16" r="11" fill="#D9E1F2" stroke="#41719C" stroke-width="1.2"/><circle cx="16" cy="16" r="5" fill="#252525" stroke="#41719C" stroke-width="1"/>' },
      ],
      flowchart: [
        { type: 'fc-terminator', label: 'Start/End', svg: '<rect x="3" y="8" width="26" height="16" rx="8" fill="#70AD47" stroke="#507E32" stroke-width="1.5"/>' },
        { type: 'fc-process', label: 'Process', svg: '<rect x="3" y="7" width="26" height="18" fill="#4472C4" stroke="#2F528F" stroke-width="1.5"/>' },
        { type: 'fc-decision', label: 'Decision', svg: '<polygon points="16,3 30,16 16,29 2,16" fill="#FFC000" stroke="#BF8F00" stroke-width="1.5"/>' },
        { type: 'fc-data', label: 'Data (I/O)', svg: '<polygon points="8,7 30,7 24,25 2,25" fill="#5B9BD5" stroke="#2F7DC4" stroke-width="1.5"/>' },
        { type: 'fc-document', label: 'Document', svg: '<path d="M3,7 L29,7 L29,23 Q22,19 16,23 Q10,27 3,23 Z" fill="#ED7D31" stroke="#C65911" stroke-width="1.5"/>' },
        { type: 'fc-subprocess', label: 'Sub-process', svg: '<rect x="3" y="7" width="26" height="18" fill="#4472C4" stroke="#2F528F" stroke-width="1.5"/><line x1="7" y1="7" x2="7" y2="25" stroke="#2F528F" stroke-width="1"/><line x1="25" y1="7" x2="25" y2="25" stroke="#2F528F" stroke-width="1"/>' },
        { type: 'fc-manual-input', label: 'Manual Input', svg: '<polygon points="3,12 29,7 29,25 3,25" fill="#9DC3E6" stroke="#2F7DC4" stroke-width="1.5"/>' },
        { type: 'fc-preparation', label: 'Preparation', svg: '<polygon points="8,7 24,7 30,16 24,25 8,25 2,16" fill="#A9D18E" stroke="#507E32" stroke-width="1.5"/>' },
        { type: 'fc-connector', label: 'Connector', svg: '<circle cx="16" cy="16" r="8" fill="#4472C4" stroke="#2F528F" stroke-width="1.5"/>' },
      ],
    };

    for (const [category, shapes] of Object.entries(stencils)) {
      const grid = document.querySelector(`.stencil-category[data-category="${category}"] .stencil-grid`);
      if (!grid) continue;

      shapes.forEach((shape) => {
        const item = document.createElement('div');
        item.className = 'stencil-item';
        item.draggable = true;
        item.dataset.shapeType = shape.type;
        item.title = `Drag to canvas or double-click to add ${shape.label}`;
        const innerSvg = shape.svg.startsWith('<svg') ? shape.svg : `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${shape.svg}</svg>`;
        item.innerHTML = `
          ${innerSvg}
          <span class="stencil-item-label">${shape.label}</span>
        `;

        // Drag start: set both application format, custom svg format and standard text/plain
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/opendraw-shape', shape.type);
          e.dataTransfer.setData('text/plain', shape.type);
          if (shape.svgContent) {
            e.dataTransfer.setData('application/opendraw-custom-svg', JSON.stringify({
              svg: shape.svgContent,
              name: shape.label,
              width: shape.width || 60,
              height: shape.height || 48
            }));
          }
          e.dataTransfer.effectAllowed = 'copy';
        });

        // Click to insert
        item.addEventListener('dblclick', () => {
          const pageSize = this._canvasManager.gridManager.pageSize;
          if (shape.svgContent && window.insertCustomSvgShape) {
            window.insertCustomSvgShape(
              shape.svgContent,
              shape.label,
              pageSize.width / 2,
              pageSize.height / 2,
              shape.width || 60,
              shape.height || 48
            );
          } else {
            this._canvasManager._insertShape(
              shape.type,
              pageSize.width / 2,
              pageSize.height / 2
            );
          }
        });

        grid.appendChild(item);
      });
    }

    // Open "Basic Shapes (Metric)" and "Basic Flowchart Shapes" by default matching genuine Visio
    const basicHeader = document.querySelector('.stencil-category[data-category="basic"] .stencil-category-header');
    if (basicHeader) {
      const basicGrid = document.querySelector('.stencil-category[data-category="basic"] .stencil-grid');
      if (basicGrid) {
        basicGrid.style.display = 'grid';
        basicHeader.classList.add('active');
        basicHeader.textContent = '▾ Basic Shapes (Metric)';
      }
    }
    const fcHeader = document.querySelector('.stencil-category[data-category="flowchart"] .stencil-category-header');
    if (fcHeader) {
      const fcGrid = document.querySelector('.stencil-category[data-category="flowchart"] .stencil-grid');
      if (fcGrid) {
        fcGrid.style.display = 'grid';
        fcHeader.classList.add('active');
        fcHeader.textContent = '▾ Basic Flowchart Shapes';
      }
    }
  }

  /**
   * Setup properties panel binding to selection.
   */
  _setupPropertiesBinding() {
    const propX = document.getElementById('prop-x');
    const propY = document.getElementById('prop-y');
    const propW = document.getElementById('prop-w');
    const propH = document.getElementById('prop-h');
    const propAngle = document.getElementById('prop-angle');
    const propFill = document.getElementById('prop-fill');
    const propFillOpacity = document.getElementById('prop-fill-opacity');
    const propStroke = document.getElementById('prop-stroke');
    const propStrokeWidth = document.getElementById('prop-stroke-width');
    const propStrokeStyle = document.getElementById('prop-stroke-style');
    const propFontFamily = document.getElementById('prop-font-family');
    const propFontSize = document.getElementById('prop-font-size');
    const propFontColor = document.getElementById('prop-font-color');
    const propRoutingType = document.getElementById('prop-routing-type');
    const propArrowType = document.getElementById('prop-arrow-type');
    const shapeDataGrid = document.getElementById('shape-data-grid');
    const noSelMsg = document.querySelector('.no-selection-msg');

    // Selection changed → update property inputs
    window.eventBus.on('selection:changed', ({ objects, count }) => {
      if (count === 0) {
        if (noSelMsg) noSelMsg.style.display = 'block';
        if (shapeDataGrid) shapeDataGrid.innerHTML = '<p class="no-selection-msg">No shape selected</p>';
        return;
      }
      if (noSelMsg) noSelMsg.style.display = 'none';

      const obj = objects[0]; // Show first object's properties
      const geom = obj.geometryObject || obj;
      const label = obj.labelObject || obj;

      propX.value = Math.round(obj.left || 0);
      propY.value = Math.round(obj.top || 0);
      propW.value = Math.round((obj.width || 0) * (obj.scaleX || 1));
      propH.value = Math.round((obj.height || 0) * (obj.scaleY || 1));
      propAngle.value = Math.round(obj.angle || 0);

      if (geom.fill && typeof geom.fill === 'string') {
        propFill.value = geom.fill.startsWith('#') ? geom.fill : '#4472C4';
      }
      propFillOpacity.value = Math.round((obj.opacity !== undefined ? obj.opacity : 1) * 100);

      if (geom.stroke && typeof geom.stroke === 'string') {
        propStroke.value = geom.stroke.startsWith('#') ? geom.stroke : '#2F528F';
      }
      propStrokeWidth.value = geom.strokeWidth || 0;

      if (geom.strokeDashArray) {
        if (geom.strokeDashArray[0] === 2) propStrokeStyle.value = 'dotted';
        else propStrokeStyle.value = 'dashed';
      } else {
        propStrokeStyle.value = 'solid';
      }

      if (label && label.fontSize) {
        propFontSize.value = label.fontSize;
      }
      if (label && label.fill && typeof label.fill === 'string') {
        propFontColor.value = label.fill.startsWith('#') ? label.fill : '#000000';
      }
      if (label && label.fontFamily) {
        propFontFamily.value = label.fontFamily;
      }

      // If connector selected
      if (obj.connectorData) {
        const conn = obj.connectorData;
        const connStyle = conn.style || {};
        if (connStyle.stroke && typeof connStyle.stroke === 'string' && connStyle.stroke.startsWith('#')) {
          propStroke.value = connStyle.stroke;
        }
        if (connStyle.strokeWidth !== undefined) {
          propStrokeWidth.value = connStyle.strokeWidth;
        }
        if (connStyle.strokeDashArray) {
          propStrokeStyle.value = connStyle.strokeDashArray[0] <= 2 ? 'dotted' : 'dashed';
        } else {
          propStrokeStyle.value = 'solid';
        }
        if (propRoutingType) propRoutingType.value = connStyle.routingType || 'orthogonal';
        if (propArrowType) {
          const hasSrc = connStyle.sourceArrow && connStyle.sourceArrow !== 'none';
          const hasTgt = connStyle.targetArrow && connStyle.targetArrow !== 'none';
          propArrowType.value = (hasSrc && hasTgt) ? 'both' : (hasTgt ? 'target' : (hasSrc ? 'source' : 'none'));
        }
      }

      // Populate Shape Data Grid
      const escAttr = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      if (shapeDataGrid) {
        shapeDataGrid.innerHTML = '';
        if (!obj.shapeData) obj.shapeData = { name: obj.shapeType || '', properties: {} };
        if (!obj.shapeData.properties) obj.shapeData.properties = {};
        const props = obj.shapeData.properties;
        const entries = Object.entries(props);
        if (entries.length === 0) {
          shapeDataGrid.innerHTML = '<p class="no-selection-msg">No custom properties</p>';
        } else {
          entries.forEach(([key, val]) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '4px';
            row.style.marginBottom = '4px';
            row.style.alignItems = 'center';
            row.innerHTML = `
              <span style="font-size:11px;color:var(--text-secondary);min-width:60px;" title="${escAttr(key)}">${escAttr(key)}:</span>
              <input type="text" class="prop-input" value="${escAttr(val)}" style="flex:1;">
            `;
            const input = row.querySelector('input');
            input.addEventListener('change', () => {
              const prevVal = props[key];
              const nextVal = input.value;
              if (nextVal === prevVal) return;
              props[key] = nextVal;
              if (window.undoManager) {
                window.undoManager.record({
                  name: `Edit Property ${key}`,
                  execute: () => { props[key] = nextVal; },
                  undo: () => { props[key] = prevVal; },
                });
              }
            });
            shapeDataGrid.appendChild(row);
          });
        }
      }
    });

    // Property inputs → update selected object
    const updateGeomProp = (prop, value) => {
      const active = this._canvasManager.canvas.getActiveObject();
      if (!active) return;
      if (active.connectorData && this._canvasManager.connectorManager && (prop === 'stroke' || prop === 'strokeWidth' || prop === 'strokeDashArray')) {
        this._canvasManager.connectorManager.updateConnectorStyle(active.connectorData, { [prop]: value });
        return;
      }
      const target = active.geometryObject || active;
      const prev = target.get(prop);

      const applyProp = (val) => {
        target.set(prop, val);
        if (target.getObjects) {
          target.getObjects().forEach(child => {
            if (child.type !== 'text' && child.type !== 'textbox' && child.type !== 'i-text' && child.objectType !== 'label') {
              child.set(prop, val);
            }
          });
        }
      };

      applyProp(value);
      active.setCoords();
      this._canvasManager.canvas.requestRenderAll();

      window.undoManager.record({
        name: `Change ${prop}`,
        execute: () => { applyProp(value); active.setCoords(); this._canvasManager.canvas.requestRenderAll(); },
        undo: () => { applyProp(prev); active.setCoords(); this._canvasManager.canvas.requestRenderAll(); },
      });
    };

    const updateLabelProp = (prop, value) => {
      const active = this._canvasManager.canvas.getActiveObject();
      if (!active) return;
      if (active.connectorData && this._canvasManager.connectorManager) {
        const conn = active.connectorData;
        const prevTs = conn.textStyle ? { ...conn.textStyle } : {};
        const nextStyle = { ...prevTs, [prop]: value };
        const applyConnText = (ts) => {
          conn.textStyle = { ...ts };
          if (conn.label) this._canvasManager.connectorManager.setConnectorLabel(conn, conn.label, conn.textStyle);
        };
        applyConnText(nextStyle);
        if (window.undoManager) {
          window.undoManager.record({
            name: `Change Connector ${prop}`,
            execute: () => applyConnText(nextStyle),
            undo: () => applyConnText(prevTs),
          });
        }
        return;
      }
      const target = active.labelObject || active;
      const prev = target.get(prop);

      target.set(prop, value);
      active.setCoords();
      this._canvasManager.canvas.requestRenderAll();

      window.undoManager.record({
        name: `Change ${prop}`,
        execute: () => { target.set(prop, value); active.setCoords(); this._canvasManager.canvas.requestRenderAll(); },
        undo: () => { target.set(prop, prev); active.setCoords(); this._canvasManager.canvas.requestRenderAll(); },
      });
    };

    const updateSelected = (prop, value) => {
      const active = this._canvasManager.canvas.getActiveObject();
      if (!active || isNaN(value)) return;
      const cm = this._canvasManager.connectorManager;
      const prev = active.get(prop);
      const applySel = (v) => {
        active.set(prop, v);
        active.setCoords();
        if (cm) cm._onShapeTransform(active);
        this._canvasManager.canvas.requestRenderAll();
      };
      applySel(value);

      window.undoManager.record({
        name: `Change ${prop}`,
        execute: () => applySel(value),
        undo: () => applySel(prev),
      });
    };

    propX.addEventListener('change', () => updateSelected('left', parseFloat(propX.value)));
    propY.addEventListener('change', () => updateSelected('top', parseFloat(propY.value)));
    propAngle.addEventListener('change', () => updateSelected('angle', parseFloat(propAngle.value)));
    propFill.addEventListener('input', () => updateGeomProp('fill', propFill.value));
    propFillOpacity.addEventListener('input', () => updateSelected('opacity', parseInt(propFillOpacity.value) / 100));
    propStroke.addEventListener('input', () => updateGeomProp('stroke', propStroke.value));
    propStrokeWidth.addEventListener('change', () => updateGeomProp('strokeWidth', parseFloat(propStrokeWidth.value)));

    propStrokeStyle.addEventListener('change', () => {
      const val = propStrokeStyle.value;
      const dash = val === 'dotted' ? [2, 4] : (val === 'dashed' ? [6, 6] : null);
      updateGeomProp('strokeDashArray', dash);
    });

    propFontSize.addEventListener('change', () => updateLabelProp('fontSize', parseInt(propFontSize.value)));
    propFontColor.addEventListener('input', () => updateLabelProp('fill', propFontColor.value));
    propFontFamily.addEventListener('change', () => updateLabelProp('fontFamily', propFontFamily.value));

    if (propRoutingType) {
      propRoutingType.addEventListener('change', () => {
        const active = this._canvasManager.canvas.getActiveObject();
        if (active && active.connectorData && this._canvasManager.connectorManager) {
          this._canvasManager.connectorManager.updateConnectorStyle(active.connectorData, {
            routingType: propRoutingType.value
          });
        }
      });
    }

    if (propArrowType) {
      propArrowType.addEventListener('change', () => {
        const active = this._canvasManager.canvas.getActiveObject();
        if (active && active.connectorData && this._canvasManager.connectorManager) {
          const val = propArrowType.value;
          const patch = {
            sourceArrow: (val === 'source' || val === 'both') ? 'arrow' : 'none',
            targetArrow: (val === 'target' || val === 'both') ? 'arrow' : 'none',
          };
          this._canvasManager.connectorManager.updateConnectorStyle(active.connectorData, patch);
        }
      });
    }

    const resizeConnectorDimension = (axis, newSize) => {
      const active = this._canvasManager.canvas.getActiveObject();
      const cm = this._canvasManager.connectorManager;
      if (!active || !active.connectorData || !cm || !active.points || active.points.length < 2) return false;
      const conn = active.connectorData;
      const beforePts = active.points.map(p => ({ x: p.x, y: p.y }));
      const xs = beforePts.map(p => p.x);
      const ys = beforePts.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const curSpan = axis === 'x' ? (maxX - minX) : (maxY - minY);
      const nextPts = beforePts.map((p, idx) => {
        if (curSpan < 0.5) {
          return idx === beforePts.length - 1
            ? { x: axis === 'x' ? p.x + newSize : p.x, y: axis === 'y' ? p.y + newSize : p.y }
            : { ...p };
        }
        const origin = axis === 'x' ? minX : minY;
        const scale = newSize / curSpan;
        return {
          x: axis === 'x' ? origin + (p.x - origin) * scale : p.x,
          y: axis === 'y' ? origin + (p.y - origin) * scale : p.y,
        };
      });
      const beforeState = {
        points: beforePts,
        sourceShape: conn.sourceShape, sourcePortId: conn.sourcePortId,
        sourcePinSpec: conn.sourcePinSpec ? { ...conn.sourcePinSpec } : null,
        sourcePoint: conn.sourcePoint ? { ...conn.sourcePoint } : null,
        targetShape: conn.targetShape, targetPortId: conn.targetPortId,
        targetPinSpec: conn.targetPinSpec ? { ...conn.targetPinSpec } : null,
        targetPoint: conn.targetPoint ? { ...conn.targetPoint } : null,
        preserveGeometry: !!conn.preserveGeometry,
      };
      const applyConnPts = (pts, meta) => {
        if (meta) {
          conn.sourceShape = meta.sourceShape; conn.sourcePortId = meta.sourcePortId;
          conn.sourcePinSpec = meta.sourcePinSpec; conn.sourcePoint = meta.sourcePoint;
          conn.targetShape = meta.targetShape; conn.targetPortId = meta.targetPortId;
          conn.targetPinSpec = meta.targetPinSpec; conn.targetPoint = meta.targetPoint;
          conn.preserveGeometry = meta.preserveGeometry;
        } else {
          conn.sourceShape = null; conn.sourcePortId = null; conn.sourcePinSpec = null;
          conn.targetShape = null; conn.targetPortId = null; conn.targetPinSpec = null;
          conn.sourcePoint = { ...pts[0] };
          conn.targetPoint = { ...pts[pts.length - 1] };
          conn.preserveGeometry = true;
        }
        cm._refreshPolyline(conn.line, pts.map(p => ({ x: p.x, y: p.y })));
        cm._updateConnectorArrowsAndLabel(conn, conn.line.points);
        cm.canvas.setActiveObject(conn.line);
        cm._showEndpointHandles(conn, { preserveDragState: true });
        cm.canvas.requestRenderAll();
      };
      applyConnPts(nextPts, null);
      window.undoManager.record({
        name: axis === 'x' ? 'Resize Connector Width' : 'Resize Connector Height',
        execute: () => applyConnPts(nextPts, null),
        undo: () => applyConnPts(beforeState.points, beforeState),
      });
      return true;
    };

    // Width/Height need special handling (scale-based) with Undo & connector reroute
    propW.addEventListener('change', () => {
      const active = this._canvasManager.canvas.getActiveObject();
      const newWidth = parseFloat(propW.value);
      if (!active || isNaN(newWidth) || newWidth < 0) return;
      if (active.connectorData && resizeConnectorDimension('x', newWidth)) return;
      if (newWidth <= 0) return;
      const prevScale = active.scaleX || 1;
      const nextScale = newWidth / (active.width || 1);
      const cm = this._canvasManager.connectorManager;
      const applyW = (sx) => {
        active.set('scaleX', sx);
        active.setCoords();
        if (cm) cm._onShapeTransform(active);
        this._canvasManager.canvas.requestRenderAll();
      };
      applyW(nextScale);
      window.undoManager.record({
        name: 'Resize Width',
        execute: () => applyW(nextScale),
        undo: () => applyW(prevScale),
      });
    });

    propH.addEventListener('change', () => {
      const active = this._canvasManager.canvas.getActiveObject();
      const newHeight = parseFloat(propH.value);
      if (!active || isNaN(newHeight) || newHeight < 0) return;
      if (active.connectorData && resizeConnectorDimension('y', newHeight)) return;
      if (newHeight <= 0) return;
      const prevScale = active.scaleY || 1;
      const nextScale = newHeight / (active.height || 1);
      const cm = this._canvasManager.connectorManager;
      const applyH = (sy) => {
        active.set('scaleY', sy);
        active.setCoords();
        if (cm) cm._onShapeTransform(active);
        this._canvasManager.canvas.requestRenderAll();
      };
      applyH(nextScale);
      window.undoManager.record({
        name: 'Resize Height',
        execute: () => applyH(nextScale),
        undo: () => applyH(prevScale),
      });
    });

    // Update properties when object is modified by dragging/resizing
    if (this._canvasManager.canvas) {
      this._canvasManager.canvas.on('object:modified', (e) => {
        const obj = e.target;
        if (obj) {
          window.eventBus.emit('selection:changed', {
            objects: [obj],
            count: 1,
          });
        }
      });
    }
  }

  /**
   * Show OS file picker to load an external Visio stencil (.vssx, .vss).
   */
  async openStencilFileDialog() {
    if (window.openDraw && (window.openDraw.showOpenStencilDialog || window.openDraw.showOpenDialog)) {
      try {
        const filePath = window.openDraw.showOpenStencilDialog ? await window.openDraw.showOpenStencilDialog() : await window.openDraw.showOpenDialog();
        if (filePath) {
          await this.loadStencil(filePath);
        }
      } catch (e) {
        console.warn('Error opening stencil file:', e);
      }
    }
  }

  /**
   * Load a stencil (.vssx, .vss) and add its masters to the stencils panel.
   * @param {string} filePath - Absolute path to the stencil file
   * @param {string} [explicitTitle] - Optional custom category title
   * @param {boolean} [isRestoring=false] - Whether this load is part of session restore
   */
  async loadStencil(filePath, explicitTitle = null, isRestoring = false) {
    if (!window.openDraw) return;
    try {
      const fileNameRaw = filePath.split(/[/\\]/).pop();
      if (!isRestoring) {
        this._showToast(`Loading stencil "${fileNameRaw}"...`);
      }

      let buffer = null;
      let fileName = fileNameRaw.replace(/\.(vssx|vss|vstx|vst)$/i, '');

      if (window.openDraw.loadStencilFile) {
        const res = await window.openDraw.loadStencilFile(filePath);
        if (!res || !res.buffer) {
          throw new Error('Failed to load stencil buffer');
        }
        buffer = res.buffer;
        if (res.fileName) {
          fileName = res.fileName.replace(/\.(vssx|vss|vstx|vst)$/i, '');
        }
      } else if (window.openDraw.readBinaryFile) {
        buffer = await window.openDraw.readBinaryFile(filePath);
      }

      if (!buffer) {
        throw new Error('Could not read stencil file data');
      }

      const defaultTitle = fileName
        .replace(/_M$/i, ' (Metric)')
        .replace(/_U$/i, ' (US Units)')
        .replace(/_/g, ' ');
      const title = explicitTitle || defaultTitle;
      const isVssx = /\.vssx$/i.test(filePath);
      const categoryKey = (isVssx ? 'vssx_' : 'stencil_') + fileName.toLowerCase().replace(/[^a-z0-9]/g, '_');

      const result = await VisioConverter.parseVssxArchive(buffer, title);
      if (!result || !result.shapes || result.shapes.length === 0) {
        if (!isRestoring) this._showToast(`No shapes found in "${title}"`);
        console.warn('No shapes found in stencil:', filePath);
        return;
      }

      const container = document.getElementById('shapes-panel-content');
      if (!container) return;

      let cat = container.querySelector(`.stencil-category[data-category="${categoryKey}"]`);
      if (!cat) {
        cat = document.createElement('div');
        cat.className = 'stencil-category';
        cat.dataset.category = categoryKey;
        cat.dataset.customStencil = 'true';
        cat.dataset.filePath = filePath;
        cat.innerHTML = `
          <div class="stencil-category-header active" data-category-key="${categoryKey}" title="${filePath}">
            <span class="stencil-category-title">▾ ${result.title} (${result.shapes.length})</span>
            <button class="stencil-category-close" title="Close &quot;${result.title}&quot; stencil">✕</button>
          </div>
          <div class="stencil-grid" style="display:grid;"></div>
        `;
        // Insert imported stencil at the VERY TOP of the shapes panel
        container.insertBefore(cat, container.firstChild);

        const header = cat.querySelector('.stencil-category-header');
        const titleSpan = cat.querySelector('.stencil-category-title');
        const closeBtn = cat.querySelector('.stencil-category-close');
        const grid = cat.querySelector('.stencil-grid');

        header.addEventListener('click', (e) => {
          if (e.target.closest('.stencil-category-close')) return;
          const isExpanded = grid.style.display !== 'none';
          grid.style.display = isExpanded ? 'none' : 'grid';
          header.classList.toggle('active', !isExpanded);
          if (titleSpan) {
            titleSpan.textContent = (isExpanded ? '▸ ' : '▾ ') + `${result.title} (${result.shapes.length})`;
          }
        });

        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeStencil(categoryKey, filePath, result.title);
          });
        }
      }

      const grid = cat.querySelector('.stencil-grid');
      grid.innerHTML = '';

      result.shapes.forEach((shape) => {
        const item = document.createElement('div');
        item.className = 'stencil-item';
        item.draggable = true;
        item.title = shape.name;

        const thumbSvg = shape.iconSvg || shape.svgXml || shape.svg || '';
        const dropSvg = shape.svgXml || shape.svg || shape.iconSvg || '';
        const iconHtml = shape.imageUrl
          ? `<img src="${shape.imageUrl}" class="stencil-item-img" alt="${VisioConverter._escapeXml(shape.name)}" />`
          : thumbSvg;

        item.innerHTML = `
          <div class="stencil-item-icon">
            ${iconHtml}
          </div>
          <span class="stencil-item-label">${VisioConverter._escapeXml(shape.name)}</span>
        `;

        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/opendraw-custom-svg', JSON.stringify({
            name: shape.name,
            svg: dropSvg,
            imageUrl: shape.imageUrl || null,
            width: shape.width,
            height: shape.height,
            connectionPoints: shape.connectionPoints || []
          }));
          e.dataTransfer.setData('text/plain', `custom-svg:${shape.name}`);
          e.dataTransfer.effectAllowed = 'copy';
        });

        item.addEventListener('click', async () => {
          if (window.insertCustomSvgShape) {
            const center = this._getCanvasCenter();
            await window.insertCustomSvgShape(dropSvg, shape.name, center.x, center.y, shape.width, shape.height, shape.imageUrl || null, shape.connectionPoints || []);
          }
        });

        grid.appendChild(item);
      });

      cat.style.display = 'block';
      const header = cat.querySelector('.stencil-category-header');
      const titleSpan = cat.querySelector('.stencil-category-title');
      if (header) header.classList.add('active');
      if (titleSpan) titleSpan.textContent = `▾ ${result.title} (${result.shapes.length})`;
      grid.style.display = 'grid';
      container.scrollTop = 0;

      if (!isRestoring) {
        this._savePersistedStencil({ filePath, title: result.title, categoryKey });
        this._showToast(`Imported ${result.shapes.length} shapes from "${result.title}"`);
      }
    } catch (err) {
      console.error('Failed to load stencil archive:', err);
      if (!isRestoring) {
        this._showToast(`Failed to load stencil: ${err.message || err}`);
      }
    }
  }

  /**
   * Close and delete an external stencil from the panel and persistence.
   * @param {string} categoryKey
   * @param {string} filePath
   * @param {string} [title]
   */
  closeStencil(categoryKey, filePath, title = 'Stencil') {
    const container = document.getElementById('shapes-panel-content');
    if (container) {
      const cat = container.querySelector(`.stencil-category[data-category="${categoryKey}"]`);
      if (cat) cat.remove();
    }
    this._removePersistedStencil(filePath, categoryKey);
    this._showToast(`Closed stencil "${title}"`);
  }

  /**
   * Stencil persistence helpers (saved in localStorage)
   */
  _getPersistedStencils() {
    try {
      const raw = localStorage.getItem('opendraw_loaded_stencils');
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const filtered = parsed.filter(item => {
        const hay = `${item?.filePath || ''} ${item?.categoryKey || ''} ${item?.title || ''}`;
        return !(item?.categoryKey === 'network' || /cisco|network\s*&\s*servers/i.test(hay));
      });
      if (filtered.length !== parsed.length) {
        localStorage.setItem('opendraw_loaded_stencils', JSON.stringify(filtered));
      }
      return filtered;
    } catch (e) {
      console.warn('Failed to parse persisted stencils:', e);
      return [];
    }
  }

  _savePersistedStencil(stencilInfo) {
    try {
      const list = this._getPersistedStencils();
      const existingIdx = list.findIndex((item) => item.filePath === stencilInfo.filePath || item.categoryKey === stencilInfo.categoryKey);
      if (existingIdx >= 0) {
        list[existingIdx] = stencilInfo;
      } else {
        list.push(stencilInfo);
      }
      localStorage.setItem('opendraw_loaded_stencils', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save persisted stencil:', e);
    }
  }

  _removePersistedStencil(filePath, categoryKey) {
    try {
      let list = this._getPersistedStencils();
      list = list.filter((item) => item.filePath !== filePath && item.categoryKey !== categoryKey);
      localStorage.setItem('opendraw_loaded_stencils', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to remove persisted stencil:', e);
    }
  }

  async _restorePersistedStencils() {
    const list = this._getPersistedStencils();
    if (!list || list.length === 0) return;
    console.log(`Restoring ${list.length} persisted stencil(s)...`);
    for (const item of list) {
      if (item && item.filePath) {
        try {
          await this.loadStencil(item.filePath, item.title, true);
        } catch (err) {
          console.warn(`Could not restore stencil from "${item.filePath}":`, err);
        }
      }
    }
  }

  async loadVssxStencil(filePath, explicitTitle = null) {
    return this.loadStencil(filePath, explicitTitle);
  }

  _showToast(msg) {
    const existing = document.querySelector('.visio-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'visio-toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="#0078d4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      <span>${msg}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  _getCanvasCenter() {
    const canvas = this._canvasManager.canvas;
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    return {
      x: (w / 2 - vpt[4]) / zoom,
      y: (h / 2 - vpt[5]) / zoom
    };
  }

  /**
   * Dynamically update basic stencil icon colors to match the active diagram theme.
   */
  updateThemeColors(fill, stroke) {
    const selector = '.stencil-category[data-category="basic"] .stencil-item svg';
    const svgs = document.querySelectorAll(selector);
    svgs.forEach(svg => {
      svg.querySelectorAll('rect, circle, ellipse, polygon, path').forEach(el => {
        const currentFill = el.getAttribute('fill');
        if (currentFill && currentFill !== 'none') {
          el.setAttribute('fill', fill);
        }
        const currentStroke = el.getAttribute('stroke');
        if (currentStroke && currentStroke !== 'none') {
          el.setAttribute('stroke', stroke);
        }
      });
      svg.querySelectorAll('line').forEach(el => {
        const currentStroke = el.getAttribute('stroke');
        if (currentStroke && currentStroke !== 'none') {
          el.setAttribute('stroke', stroke);
        }
      });
    });
  }
}

