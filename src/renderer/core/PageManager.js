/**
 * PageManager — Multi-page document architecture for OpenDraw.
 * 
 * Features:
 * - Multi-page navigation (Page tabs at bottom)
 * - Add, switch, rename, and delete pages
 * - State persistence per page (shapes, connectors, zoom, pan)
 * - Seamless integration with serialization (.odraw and .vsdx)
 */

class PageManager {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.canvas;

    /** @type {Array<{id: string, name: string, objects: Array, connectors: Array, zoom: number, vpt: Array}>} */
    this.pages = [];
    this.currentPageIndex = 0;

    this.tabsContainer = document.getElementById('page-tabs');

    this._initFirstPage();
    this._setupUI();
  }

  _initFirstPage() {
    const curWidth = this.canvasManager && this.canvasManager.gridManager && this.canvasManager.gridManager.pageSize ? this.canvasManager.gridManager.pageSize.width : 11.69 * 96;
    const curHeight = this.canvasManager && this.canvasManager.gridManager && this.canvasManager.gridManager.pageSize ? this.canvasManager.gridManager.pageSize.height : 8.27 * 96;
    this.pages = [
      {
        id: 'page_1',
        name: 'Page-1',
        objects: [],
        connectors: [],
        pixelWidth: curWidth,
        pixelHeight: curHeight,
        zoom: 1,
        vpt: [1, 0, 0, 1, 50, 30],
      }
    ];
    this.currentPageIndex = 0;
  }

  _setupUI() {
    if (!this.tabsContainer) return;

    this.renderTabs();

    // Wire add page button
    const addBtn = this.tabsContainer.querySelector('.page-tab-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addPage();
      });
    }
  }

  /**
   * Render page tabs in the bottom bar.
   */
  renderTabs() {
    if (!this.tabsContainer) return;

    // Clear existing tabs (keep the + button)
    const addBtn = this.tabsContainer.querySelector('.page-tab-add');
    this.tabsContainer.innerHTML = '';

    this.pages.forEach((page, idx) => {
      const tab = document.createElement('div');
      tab.className = `page-tab ${idx === this.currentPageIndex ? 'active' : ''}`;
      tab.dataset.pageIndex = idx;
      tab.innerHTML = `<span class="tab-title">${page.name}</span>`;

      // Click to switch
      tab.addEventListener('click', () => {
        if (idx !== this.currentPageIndex) {
          this.switchToPage(idx);
        }
      });

      // Double-click to rename
      tab.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('tab-close')) return;
        this._promptRename(tab, idx);
      });

      this.tabsContainer.appendChild(tab);
    });

    if (addBtn) {
      this.tabsContainer.appendChild(addBtn);
    } else {
      const newAddBtn = document.createElement('button');
      newAddBtn.className = 'page-tab-add';
      newAddBtn.title = 'Add Page';
      newAddBtn.textContent = '+';
      newAddBtn.addEventListener('click', () => this.addPage());
      this.tabsContainer.appendChild(newAddBtn);
    }

    // Update status bar page indicator
    const statusPage = document.getElementById('status-page');
    if (statusPage) {
      statusPage.textContent = `Page ${this.currentPageIndex + 1} of ${this.pages.length}`;
    }
  }

  /**
   * Add a new page.
   * @param {string} [name]
   * @param {number} [width]
   * @param {number} [height]
   * @returns {number} Index of created page
   */
  addPage(name, width, height) {
    const pageNum = this.pages.length + 1;
    const pageName = name || `Page-${pageNum}`;

    // Save current page state first
    this._saveCurrentPageState();

    const curWidth = width || (this.canvasManager.gridManager && this.canvasManager.gridManager.pageSize ? this.canvasManager.gridManager.pageSize.width : 11.69 * 96);
    const curHeight = height || (this.canvasManager.gridManager && this.canvasManager.gridManager.pageSize ? this.canvasManager.gridManager.pageSize.height : 8.27 * 96);

    const newPage = {
      id: 'page_' + Math.random().toString(36).substr(2, 9),
      name: pageName,
      objects: [],
      connectors: [],
      pixelWidth: curWidth,
      pixelHeight: curHeight,
      zoom: 1,
      vpt: [1, 0, 0, 1, 50, 30],
    };

    this.pages.push(newPage);
    this.switchToPage(this.pages.length - 1);
    return this.pages.length - 1;
  }

  get activePageIndex() {
    return this.currentPageIndex;
  }

  set activePageIndex(v) {
    this.currentPageIndex = v;
  }

  nextPage() {
    if (this.currentPageIndex < this.pages.length - 1) {
      return this.switchToPage(this.currentPageIndex + 1);
    }
  }

  prevPage() {
    if (this.currentPageIndex > 0) {
      return this.switchToPage(this.currentPageIndex - 1);
    }
  }

  /**
   * Duplicate the active page with all its shapes and connectors.
   * @returns {Promise<number>|number} Index of duplicated page
   */
  duplicateActivePage() {
    this._saveCurrentPageState();
    const cur = this.pages[this.currentPageIndex];
    if (!cur) return this.addPage();

    const duplicatedObjects = JSON.parse(JSON.stringify(cur.objects || []));
    const idMap = new Map();
    duplicatedObjects.forEach((o) => {
      if (o.shapeData && o.shapeData.id) {
        const oldId = o.shapeData.id;
        const newId = 'shape_' + Math.random().toString(36).substr(2, 9);
        idMap.set(oldId, newId);
        o.shapeData.id = newId;
      }
    });

    const duplicatedConnectors = JSON.parse(JSON.stringify(cur.connectorSpecs || [])).map(c => ({
      ...c,
      sourceShapeId: c.sourceShapeId ? (idMap.get(c.sourceShapeId) || c.sourceShapeId) : null,
      targetShapeId: c.targetShapeId ? (idMap.get(c.targetShapeId) || c.targetShapeId) : null,
    }));

    const newPage = {
      id: 'page_' + Math.random().toString(36).substr(2, 9),
      name: `${cur.name} (Copy)`,
      objects: duplicatedObjects,
      connectors: [],
      connectorSpecs: duplicatedConnectors,
      pixelWidth: cur.pixelWidth || 11.69 * 96,
      pixelHeight: cur.pixelHeight || 8.27 * 96,
      pageColor: cur.pageColor || '#ffffff',
      layers: JSON.parse(JSON.stringify(cur.layers || [{ id: 'layer_default', name: 'Default', visible: true, locked: false, color: '#0078d4' }])),
      zoom: cur.zoom || 1,
      vpt: [...(cur.vpt || [1, 0, 0, 1, 50, 30])],
    };

    const insertIdx = this.currentPageIndex + 1;
    this.pages.splice(insertIdx, 0, newPage);
    this.switchToPage(insertIdx, true);
    return insertIdx;
  }

  /**
   * Switch to page by index.
   * @param {number} targetIndex
   * @param {boolean} [saveCurrent=true]
   */
  async switchToPage(targetIndex, saveCurrent = true) {
    if (targetIndex < 0 || targetIndex >= this.pages.length) return;

    // 0. Clear active editing/overlays cleanly before leaving page
    if (this.canvasManager.inlineTextEditor) this.canvasManager.inlineTextEditor.cancel();
    if (this.canvasManager.alignmentGuideManager) this.canvasManager.alignmentGuideManager.clearGuides();
    if (this.canvasManager.connectorManager) {
      this.canvasManager.connectorManager.hideAutoConnect();
      this.canvasManager.connectorManager._hidePorts();
      this.canvasManager.connectorManager._hideEndpointHandles();
    }

    // 1. Save current page only if requested
    if (saveCurrent && this.pages[this.currentPageIndex]) {
      this._saveCurrentPageState();
    }

    // 2. Clear canvas shapes and connectors
    const toRemove = this.canvas.getObjects().filter(
      (obj) => obj.objectType !== 'grid-line' && obj.objectType !== 'page-background'
    );
    toRemove.forEach((obj) => this.canvas.remove(obj));
    this.canvas.discardActiveObject();

    if (this.canvasManager.connectorManager) {
      this.canvasManager.connectorManager.connectors = [];
    }

    // 3. Load target page
    this.currentPageIndex = targetIndex;
    const targetPage = this.pages[targetIndex];

    // Restore page dimensions & color
    if (this.canvasManager.gridManager) {
      if (targetPage.pixelWidth && targetPage.pixelHeight) {
        this.canvasManager.gridManager.setPageSize(targetPage.pixelWidth, targetPage.pixelHeight);
      }
      if (targetPage.pageColor && this.canvasManager.gridManager.setPageColor) {
        this.canvasManager.gridManager.setPageColor(targetPage.pageColor);
      }
    }

    // Restore layers
    if (this.canvasManager.layerManager) {
      this.canvasManager.layerManager.setLayers(targetPage.layers);
    }

    // Restore viewport & keep CanvasManager zoom in sync
    if (targetPage.vpt) {
      this.canvas.setViewportTransform([...targetPage.vpt]);
    }
    if (targetPage.zoom) {
      this.canvas.setZoom(targetPage.zoom);
      this.canvasManager._zoom = targetPage.zoom;
      window.eventBus.emit('zoom:changed', Math.round(targetPage.zoom * 100));
    }

    // 4. Hydrate page content
    if (targetPage.pendingPageModel && typeof VisioConverter !== 'undefined' && VisioConverter._hydratePageIntoCanvas) {
      await VisioConverter._hydratePageIntoCanvas(targetPage, this.canvasManager);
      if (!targetPage.zoom && this.canvasManager.zoomToFit) {
        this.canvasManager.zoomToFit();
      }
    } else if (targetPage.liveShapes && targetPage.liveShapes.length > 0) {
      targetPage.liveShapes.forEach((obj) => {
        this.canvas.add(obj);
        if (obj.objectType === 'container' || obj.isContainer) {
          this.canvas.sendObjectToBack(obj);
        }
      });
      if (this.canvasManager.connectorManager) {
        const cm = this.canvasManager.connectorManager;
        cm.connectors = targetPage.connectors || [];
        (targetPage.connectors || []).forEach((c) => {
          if (c.line && !this.canvas.contains(c.line)) this.canvas.add(c.line);
          if (c.arrow && !this.canvas.contains(c.arrow)) this.canvas.add(c.arrow);
          const srcArrow = c.sourceArrowHead || c.sourceArrowObj;
          if (srcArrow && !this.canvas.contains(srcArrow)) this.canvas.add(srcArrow);
          if (c.labelObj && !this.canvas.contains(c.labelObj)) this.canvas.add(c.labelObj);
          if (cm._placeConnectorInZOrder) cm._placeConnectorInZOrder(c);
        });
        cm._keepGridAtBack();
      }
      if (!targetPage.zoom && !targetPage.vpt) {
        this.canvasManager.zoomToFit();
      }
    } else if (targetPage.objects && targetPage.objects.length > 0) {
      try {
        const enlivened = await fabric.util.enlivenObjects(targetPage.objects);
        targetPage.liveShapes = enlivened;
        enlivened.forEach((obj) => {
          obj.set({
            cornerStyle: 'circle',
            cornerColor: '#0078d4',
            cornerStrokeColor: '#ffffff',
            cornerSize: 8,
            transparentCorners: false,
            borderColor: '#0078d4',
            borderScaleFactor: 1.5,
            padding: 2,
          });
          if (obj.getObjects) {
            const kids = obj.getObjects();
            obj.geometryObject = obj.geometryObject || kids.find(c => !['text', 'i-text', 'textbox'].includes(c.type)) || kids[0];
            obj.labelObject = obj.labelObject || kids.find(c => ['text', 'i-text', 'textbox'].includes(c.type)) || null;
          }
          this.canvas.add(obj);
          if (obj.objectType === 'container' || obj.isContainer) {
            this.canvas.sendObjectToBack(obj);
          }
        });

        const connSpecs = targetPage.connectorSpecs || targetPage.connectors || [];
        if (connSpecs.length > 0 && this.canvasManager.connectorManager) {
          connSpecs.forEach((connData) => {
            const src = connData.sourceShapeId ? enlivened.find((o) => o.shapeData && o.shapeData.id === connData.sourceShapeId) : null;
            const tgt = connData.targetShapeId ? enlivened.find((o) => o.shapeData && o.shapeData.id === connData.targetShapeId) : null;
            const pts = connData.points && connData.points.length >= 2
              ? connData.points
              : ((connData.sourcePoint || connData.targetPoint)
                ? [connData.sourcePoint || { x: 100, y: 100 }, connData.targetPoint || { x: 250, y: 100 }]
                : null);
            this.canvasManager.connectorManager.createConnector(
              src || null,
              connData.sourcePortId || null,
              tgt || null,
              connData.targetPortId || null,
              {
                ...(connData.style || {}),
                routingType: connData.routingType || (connData.style && connData.style.routingType) || 'orthogonal',
                preserveGeometry: !!connData.preserveGeometry,
                label: connData.label || '',
                textStyle: connData.textStyle || null,
                skipUndo: true
              },
              pts
            );
          });
        }
      } catch (err) {
        console.warn('Failed to enliven page objects:', err);
      }
    }

    this.canvas.requestRenderAll();
    if (this.canvasManager.rulerManager) this.canvasManager.rulerManager.draw();
    if (this.canvasManager._updateScrollbars) this.canvasManager._updateScrollbars();
    this.renderTabs();
  }

  /**
   * Delete page by index.
   * @param {number} index
   */
  async deletePage(index) {
    if (this.pages.length <= 1) return;
    if (index < 0 || index >= this.pages.length) return;

    const confirmDelete = await window.openDrawDialog.confirm(`Are you sure you want to delete "${this.pages[index].name}"?`, 'Delete Page');
    if (!confirmDelete) return;

    if (index === this.currentPageIndex) {
      this.pages.splice(index, 1);
      const nextIdx = Math.min(index, this.pages.length - 1);
      await this.switchToPage(nextIdx, false);
    } else if (index < this.currentPageIndex) {
      this._saveCurrentPageState();
      this.pages.splice(index, 1);
      await this.switchToPage(this.currentPageIndex - 1, false);
    } else {
      this.pages.splice(index, 1);
      this.renderTabs();
    }
  }

  _saveCurrentPageState() {
    const cur = this.pages[this.currentPageIndex];
    if (!cur) return;

    const excluded = new Set([
      'grid-line', 'page-background', 'connector', 'connector-arrow',
      'connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line', 'preview-rect'
    ]);

    if (this.canvasManager.gridManager) {
      if (this.canvasManager.gridManager.pageSize) {
        cur.pixelWidth = this.canvasManager.gridManager.pageSize.width;
        cur.pixelHeight = this.canvasManager.gridManager.pageSize.height;
      }
      if (this.canvasManager.gridManager.getPageColor) {
        cur.pageColor = this.canvasManager.gridManager.getPageColor();
      }
    }

    const objects = this.canvas.getObjects().filter(
      (obj) => !obj.isGridLine && !obj.isPageBg && !obj.isGuide && !excluded.has(obj.objectType)
    );
    cur.liveShapes = objects;
    const customProps = ['objectType', 'shapeType', 'shapeData', 'layerId', 'connectionPoints', 'hyperlink', 'screenTip', 'visioFill', 'visioStroke', 'isContainer', 'commentAuthor', 'commentDate'];
    cur.objects = objects.map((obj) => obj.toObject(customProps));

    if (this.canvasManager.connectorManager) {
      const conns = this.canvasManager.connectorManager.connectors || [];
      cur.connectors = conns;
      cur.connectorSpecs = conns.map(c => ({
        id: c.id,
        sourceShapeId: (c.sourceShape && c.sourceShape.shapeData && c.sourceShape.shapeData.id) || c.sourceShapeId || null,
        targetShapeId: (c.targetShape && c.targetShape.shapeData && c.targetShape.shapeData.id) || c.targetShapeId || null,
        sourcePortId: c.sourcePortId || null,
        targetPortId: c.targetPortId || null,
        sourcePoint: c.sourcePoint ? { ...c.sourcePoint } : null,
        targetPoint: c.targetPoint ? { ...c.targetPoint } : null,
        points: c.line && c.line.points ? c.line.points.map(p => ({ x: p.x, y: p.y })) : (c.points || []),
        preserveGeometry: !!c.preserveGeometry,
        routingType: c.routingType || 'orthogonal',
        style: c.style ? { ...c.style } : {},
        label: c.label || ''
      }));
    }

    if (this.canvasManager.layerManager) {
      cur.layers = this.canvasManager.layerManager.layers.map(l => ({ ...l }));
    }

    cur.vpt = [...this.canvas.viewportTransform];
    cur.zoom = this.canvas.getZoom();
  }

  _promptRename(tabEl, index) {
    const titleEl = tabEl.querySelector('.tab-title');
    if (!titleEl) return;
    const oldName = this.pages[index].name;
    let cancelled = false;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.style.cssText = 'width: 80px; font-size: 11px; padding: 1px 3px; border: 1px solid #0078d4; border-radius: 2px;';

    const commitRename = () => {
      if (cancelled) return;
      cancelled = true;
      const newName = input.value.trim() || oldName;
      this.pages[index].name = newName;
      this.renderTabs();
    };

    input.addEventListener('blur', commitRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitRename();
      } else if (e.key === 'Escape') {
        cancelled = true;
        this.renderTabs();
      }
    });

    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }
}

window.PageManager = PageManager;

