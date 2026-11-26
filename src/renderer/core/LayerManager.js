/**
 * LayerManager — Layer management system for OpenDraw.
 * 
 * Features:
 * - Named layers with visibility (Eye) and lock (Lock) toggles
 * - Assign shapes to layers
 * - Create, rename, delete layers
 * - Prevents locked layers from being selected or edited
 */

class LayerManager {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.canvas;

    /** @type {Array<{id: string, name: string, visible: boolean, locked: boolean, color: string}>} */
    this.layers = [
      { id: 'layer_default', name: 'Default', visible: true, locked: false, color: '#0078d4' },
      { id: 'layer_background', name: 'Background', visible: true, locked: false, color: '#107c41' },
      { id: 'layer_annotations', name: 'Annotations', visible: true, locked: false, color: '#d83b01' },
    ];
    this.activeLayerId = 'layer_default';

    this._setupUI();
    this._setupInterception();
  }

  _setupUI() {
    // Add Layers section to Properties panel
    const propContent = document.getElementById('properties-panel-content');
    if (!propContent) return;

    const layerSection = document.createElement('div');
    layerSection.className = 'property-section';
    layerSection.id = 'property-section-layers';
    layerSection.innerHTML = `
      <div class="property-section-header" style="display:flex;justify-content:space-between;align-items:center;">
        <span>Layers</span>
        <button id="btn-add-layer" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:14px;font-weight:bold;" title="Add Layer">+</button>
      </div>
      <div id="layers-list" style="display:flex;flex-direction:column;gap:4px;padding:4px 0;"></div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:6px;">
        <span style="font-size:11px;color:var(--text-secondary);">Assign to:</span>
        <select id="select-shape-layer" class="prop-input" style="flex:1;">
        </select>
      </div>
    `;

    propContent.appendChild(layerSection);

    const isSystemObj = (obj) => {
      if (!obj) return true;
      if (obj.isGridLine || obj.isPageBg || obj.isGuide) return true;
      return ['grid-line', 'page-background', 'connector-arrow', 'connector-handle', 'autoconnect-trigger', 'port-marker', 'guide-line', 'preview-rect'].includes(obj.objectType);
    };
    this._isSystemObj = isSystemObj;

    const addBtn = layerSection.querySelector('#btn-add-layer');
    addBtn.addEventListener('click', async () => {
      const name = await window.openDrawDialog.prompt('Enter new layer name:', `Layer ${this.layers.length + 1}`, 'Add Layer');
      if (name && name.trim()) {
        this.addLayer(name.trim());
      }
    });

    const assignSelect = layerSection.querySelector('#select-shape-layer');
    assignSelect.addEventListener('change', () => {
      const active = this.canvas.getActiveObject();
      if (!active) return;
      const newLayerId = assignSelect.value;
      const layer = this.layers.find(l => l.id === newLayerId);
      const targets = active.type === 'activeselection' ? active.getObjects() : [active];
      const prevs = targets.map(t => ({ obj: t, layerId: t.layerId || 'layer_default', visible: t.visible, selectable: t.selectable, evented: t.evented }));

      const applyAssign = (id, lay) => {
        targets.forEach((t) => {
          t.layerId = id;
          if (lay) {
            t.set({ visible: lay.visible, selectable: !lay.locked, evented: !lay.locked });
          }
        });
        if (layer && (layer.locked || !layer.visible)) this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
      };
      applyAssign(newLayerId, layer);
      if (window.undoManager) {
        window.undoManager.record({
          name: 'Assign Layer',
          execute: () => applyAssign(newLayerId, this.layers.find(l => l.id === newLayerId)),
          undo: () => {
            prevs.forEach(p => p.obj.set({ layerId: p.layerId, visible: p.visible, selectable: p.selectable, evented: p.evented }));
            this.canvas.requestRenderAll();
          }
        });
      }
    });

    window.eventBus.on('selection:changed', ({ objects, count }) => {
      if (count > 0 && objects[0]) {
        assignSelect.value = objects[0].layerId || 'layer_default';
      }
    });

    this.renderLayers();
  }

  _escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  renderLayers() {
    const list = document.getElementById('layers-list');
    const assignSelect = document.getElementById('select-shape-layer');
    if (!list || !assignSelect) return;

    list.innerHTML = '';
    assignSelect.innerHTML = '';

    this.layers.forEach((layer) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 6px;
        background: ${layer.id === this.activeLayerId ? 'var(--accent-light)' : 'transparent'};
        border-radius: 3px;
        font-size: 11px;
      `;

      const safeName = this._escapeHtml(layer.name);
      item.innerHTML = `
        <span class="layer-select-btn" style="display:flex;align-items:center;gap:6px;flex:1;cursor:pointer;min-width:0;overflow:hidden;">
          <span style="width:8px;height:8px;border-radius:50%;background:${layer.color};display:inline-block;flex-shrink:0;"></span>
          <span style="font-weight:${layer.id === this.activeLayerId ? '600' : 'normal'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeName}</span>
        </span>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="layer-toggle-vis" style="background:none;border:none;cursor:pointer;font-size:12px;" title="${layer.visible ? 'Hide Layer' : 'Show Layer'}">
            ${layer.visible ? '👁️' : '🕶️'}
          </button>
          <button class="layer-toggle-lock" style="background:none;border:none;cursor:pointer;font-size:12px;" title="${layer.locked ? 'Unlock Layer' : 'Lock Layer'}">
            ${layer.locked ? '🔒' : '🔓'}
          </button>
          ${layer.id !== 'layer_default' ? `<button class="layer-delete-btn" style="background:none;border:none;cursor:pointer;font-size:11px;opacity:0.75;" title="Delete Layer">✕</button>` : ''}
        </div>
      `;

      const selSpan = item.querySelector('.layer-select-btn');
      selSpan.addEventListener('click', () => {
        this.activeLayerId = layer.id;
        this.renderLayers();
      });
      selSpan.addEventListener('dblclick', async (e) => {
        e.stopPropagation();
        const renamed = await window.openDrawDialog.prompt('Rename layer:', layer.name, 'Rename Layer');
        if (renamed && renamed.trim()) {
          layer.name = renamed.trim();
          this.renderLayers();
        }
      });

      // Visibility toggle
      item.querySelector('.layer-toggle-vis').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleVisibility(layer.id);
      });

      // Lock toggle
      item.querySelector('.layer-toggle-lock').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLock(layer.id);
      });

      const delBtn = item.querySelector('.layer-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteLayer(layer.id);
        });
      }

      list.appendChild(item);

      // Populate assign dropdown
      const opt = document.createElement('option');
      opt.value = layer.id;
      opt.textContent = layer.name;
      assignSelect.appendChild(opt);
    });
  }

  addLayer(name) {
    const id = 'layer_' + Math.random().toString(36).substr(2, 9);
    const colors = ['#0078d4', '#107c41', '#d83b01', '#5c2d91', '#008272', '#b4009e'];
    const color = colors[this.layers.length % colors.length];

    this.layers.push({
      id: id,
      name: name,
      visible: true,
      locked: false,
      color: color,
    });

    this.renderLayers();
  }

  deleteLayer(layerId) {
    if (layerId === 'layer_default' || this.layers.length <= 1) return;
    this.layers = this.layers.filter(l => l.id !== layerId);
    this.canvas.getObjects().forEach((obj) => {
      if (!this._isSystemObj(obj) && obj.layerId === layerId) {
        obj.layerId = 'layer_default';
      }
    });
    if (this.activeLayerId === layerId) this.activeLayerId = this.layers[0].id;
    this.canvas.requestRenderAll();
    this.renderLayers();
  }

  toggleVisibility(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return;

    layer.visible = !layer.visible;
    const active = this.canvas.getActiveObject();

    this.canvas.getObjects().forEach((obj) => {
      if (this._isSystemObj && this._isSystemObj(obj)) return;
      if ((obj.layerId || 'layer_default') === layerId) {
        obj.set('visible', layer.visible);
        if (!layer.visible && active === obj) this.canvas.discardActiveObject();
      }
    });

    this.canvas.requestRenderAll();
    this.renderLayers();
  }

  toggleLock(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return;

    layer.locked = !layer.locked;

    this.canvas.getObjects().forEach((obj) => {
      if (this._isSystemObj && this._isSystemObj(obj)) return;
      if ((obj.layerId || 'layer_default') === layerId) {
        obj.set({
          selectable: !layer.locked,
          evented: !layer.locked,
        });
      }
    });

    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.renderLayers();
  }

  setLayers(newLayers) {
    if (Array.isArray(newLayers) && newLayers.length > 0) {
      this.layers = newLayers.map(l => ({ ...l }));
    } else {
      this.layers = [{ id: 'layer_default', name: 'Default', visible: true, locked: false, color: '#0078d4' }];
    }
    this.activeLayerId = this.layers[0].id;
    this.renderLayers();
  }

  _setupInterception() {
    this.canvas.on('object:added', (e) => {
      const obj = e.target;
      if (obj && !obj.layerId && !(this._isSystemObj && this._isSystemObj(obj))) {
        obj.layerId = this.activeLayerId;
      }
    });
  }
}

window.LayerManager = LayerManager;

