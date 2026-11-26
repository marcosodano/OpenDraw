/**
 * InlineTextEditor — In-place text editing for shapes on canvas.
 * 
 * Activated by double-clicking any shape. Positions a floating textarea
 * directly over the shape's text label, allowing rapid inline diagram authoring.
 */

class InlineTextEditor {
  /**
   * @param {CanvasManager} canvasManager
   */
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.activeShape = null;
    this.inputElement = null;

    this._createDOMElement();
    this._setupCanvasListener();
  }

  _createDOMElement() {
    this.inputElement = document.createElement('textarea');
    this.inputElement.id = 'inline-text-editor';
    this.inputElement.style.position = 'absolute';
    this.inputElement.style.display = 'none';
    this.inputElement.style.zIndex = '1000';
    this.inputElement.style.border = '1px solid var(--accent, #0078d4)';
    this.inputElement.style.outline = '2px solid rgba(0, 120, 212, 0.35)';
    this.inputElement.style.borderRadius = '2px';
    this.inputElement.style.background = 'var(--bg-secondary, #ffffff)';
    this.inputElement.style.color = 'var(--text-primary, #1f1f1f)';
    this.inputElement.style.padding = '4px 6px';
    this.inputElement.style.margin = '0';
    this.inputElement.style.resize = 'none';
    this.inputElement.style.boxSizing = 'border-box';
    this.inputElement.style.overflow = 'hidden';
    this.inputElement.style.fontFamily = 'Calibri, Segoe UI, sans-serif';
    this.inputElement.style.textAlign = 'center';

    const container = document.getElementById('canvas-container');
    container.appendChild(this.inputElement);

    // Commit on blur
    this.inputElement.addEventListener('blur', () => this.commit());

    // Keyboard handlers: Enter (Shift+Enter for newline, or Enter in text box) or Esc to cancel
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (this.activeShape && (this.activeShape.shapeType === 'textbox' || this.activeShape.type === 'textbox' || this.activeShape.objectType === 'textbox')) {
          // In authentic Visio text boxes, Enter creates a new line
          return;
        }
        e.preventDefault();
        this.commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
    });
  }

  _setupCanvasListener() {
    this.canvasManager.canvas.on('mouse:dblclick', (e) => {
      const target = e.target;
      if (!target || target.selectable === false || target.type === 'activeselection') return;
      const blocked = new Set([
        'grid-line', 'page-background', 'connector-arrow', 'connector-handle',
        'autoconnect-trigger', 'port-marker', 'guide-line', 'preview-rect',
        'border-frame', 'title-block'
      ]);
      if (target.isGridLine || target.isPageBg || target.isGuide || blocked.has(target.objectType)) return;

      this.edit(target);
    });
  }

  /**
   * Open the editor for the specified shape.
   * @param {fabric.Object} shape
   */
  edit(shape) {
    if (!shape || shape.selectable === false || shape.type === 'activeselection') return;
    this.activeShape = shape;

    // Support connector labels
    if (shape.connectorData && this.canvasManager.connectorManager) {
      const conn = shape.connectorData;
      const pts = conn.line && conn.line.points ? conn.line.points : [];
      let mid = { x: shape.left || 100, y: shape.top || 100 };
      if (pts.length >= 2) {
        const i = Math.floor((pts.length - 1) / 2);
        mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
      }
      const zoom = this.canvasManager.canvas.getZoom() || 1;
      const vpt = this.canvasManager.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const sx = mid.x * vpt[0] + vpt[4];
      const sy = mid.y * vpt[3] + vpt[5];
      this.inputElement.value = conn.label || '';
      this.inputElement.style.textAlign = 'center';
      this.inputElement.style.left = `${Math.round(sx - 80)}px`;
      this.inputElement.style.top = `${Math.round(sy - 16)}px`;
      this.inputElement.style.width = '160px';
      this.inputElement.style.height = '32px';
      this.inputElement.style.transform = '';
      this.inputElement.style.fontSize = `${Math.max(11, Math.round(12 * zoom))}px`;
      this.inputElement.style.display = 'block';
      this.inputElement.focus();
      this.inputElement.select();
      return;
    }

    // Find the text target object
    let textTarget = shape.labelObject;
    if (!textTarget) {
      if (shape.text !== undefined) {
        textTarget = shape;
      } else {
        textTarget = this._findNestedText(shape);
      }
    }

    let currentText = '';
    if (textTarget && textTarget.text !== undefined) {
      currentText = textTarget.text;
    } else if (shape.shapeData && shape.shapeData.name) {
      currentText = shape.shapeData.name;
    }

    const canvas = this.canvasManager.canvas;
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];

    const targetObj = textTarget || shape;

    let sceneCenter = null;
    if (typeof targetObj.getCenterPoint === 'function') {
      const m = targetObj.calcTransformMatrix ? targetObj.calcTransformMatrix() : null;
      if (m) {
        sceneCenter = { x: m[4], y: m[5] };
      } else {
        sceneCenter = targetObj.getCenterPoint();
      }
    }
    if (!sceneCenter) {
      sceneCenter = {
        x: (shape.left || 0) + ((shape.width || 0) * (shape.scaleX || 1)) / 2,
        y: (shape.top || 0) + ((shape.height || 0) * (shape.scaleY || 1)) / 2,
      };
    }

    const isCommentCard = shape.objectType === 'comment-card';
    if (isCommentCard) {
      const cardRect = shape.getBoundingRect ? shape.getBoundingRect() : null;
      const sx = cardRect ? (cardRect.left * vpt[0] + vpt[4]) : (screenCenterX - 90);
      const sy = cardRect ? (cardRect.top * vpt[3] + vpt[5]) : (screenCenterY - 40);
      const sw = cardRect ? cardRect.width * zoom : 190 * zoom;
      const sh = cardRect ? cardRect.height * zoom : 80 * zoom;
      const hdrOffset = Math.round(24 * zoom);
      const bodyW = Math.max(100, Math.round(sw - 12));
      const bodyH = Math.max(36, Math.round(sh - hdrOffset - 6));

      this.inputElement.value = currentText;
      this.inputElement.style.background = '#fffef5';
      this.inputElement.style.color = '#37474f';
      this.inputElement.style.border = '1.5px solid #f59e0b';
      this.inputElement.style.outline = 'none';
      this.inputElement.style.textAlign = 'left';
      this.inputElement.style.left = `${Math.round(sx + 6)}px`;
      this.inputElement.style.top = `${Math.round(sy + hdrOffset + 2)}px`;
      this.inputElement.style.width = `${bodyW}px`;
      this.inputElement.style.height = `${bodyH}px`;
      this.inputElement.style.transform = '';
      this.inputElement.style.fontSize = `${Math.max(11, Math.round(11 * zoom))}px`;
      this.inputElement.style.display = 'block';
      this.inputElement.focus();
      this.inputElement.select();
      return;
    }

    const screenCenterX = sceneCenter.x * vpt[0] + vpt[4];
    const screenCenterY = sceneCenter.y * vpt[3] + vpt[5];

    const targetW = (textTarget && textTarget.width > 20) ? textTarget.width : (shape.width || 120);
    const targetH = (textTarget && textTarget.height > 16) ? textTarget.height : (shape.height || 60);
    const scaleX = textTarget ? ((textTarget.scaleX || 1) * (textTarget.group ? (shape.scaleX || 1) : 1)) : (shape.scaleX || 1);
    const scaleY = textTarget ? ((textTarget.scaleY || 1) * (textTarget.group ? (shape.scaleY || 1) : 1)) : (shape.scaleY || 1);
    const editWidth = Math.max(120, Math.min(targetW * scaleX * zoom + 30, 600));
    const editHeight = Math.max(34, Math.min(targetH * scaleY * zoom + 16, 400));
    const baseFontSize = (textTarget && textTarget.fontSize) || 12;

    this.inputElement.value = currentText;
    this.inputElement.style.background = 'var(--bg-secondary, #ffffff)';
    this.inputElement.style.color = 'var(--text-primary, #1f1f1f)';
    this.inputElement.style.border = '1px solid var(--accent, #0078d4)';
    this.inputElement.style.outline = '2px solid rgba(0, 120, 212, 0.35)';
    this.inputElement.style.textAlign = (textTarget && textTarget.textAlign) || 'center';
    this.inputElement.style.left = `${Math.round(screenCenterX - editWidth / 2)}px`;
    this.inputElement.style.top = `${Math.round(screenCenterY - editHeight / 2)}px`;
    this.inputElement.style.width = `${Math.round(editWidth)}px`;
    this.inputElement.style.height = `${Math.round(editHeight)}px`;
    this.inputElement.style.transform = shape.angle ? `rotate(${shape.angle}deg)` : '';
    this.inputElement.style.fontSize = `${Math.max(11, Math.round(baseFontSize * zoom))}px`;
    this.inputElement.style.display = 'block';

    this.inputElement.focus();
    this.inputElement.select();
  }

  /**
   * Commit edited text to shape.
   */
  commit() {
    if (!this.activeShape) return;

    const newText = this.inputElement.value;
    const shape = this.activeShape;

    if (shape.connectorData && this.canvasManager.connectorManager) {
      const conn = shape.connectorData;
      const prev = conn.label || '';
      if (newText !== prev) {
        const cm = this.canvasManager.connectorManager;
        const setLbl = (val) => {
          if (cm.setConnectorLabel) cm.setConnectorLabel(conn, val);
          else { conn.label = val; cm.updateConnector(conn); }
        };
        setLbl(newText);
        if (window.undoManager) {
          window.undoManager.record({
            name: 'Edit Connector Label',
            execute: () => setLbl(newText),
            undo: () => setLbl(prev),
          });
        }
      }
      this._hide();
      return;
    }

    let textTarget = shape.labelObject;
    if (!textTarget) {
      if (shape.text !== undefined) {
        textTarget = shape;
      } else {
        textTarget = this._findNestedText(shape);
      }
    }

    const prevText = textTarget ? textTarget.text : ((shape.shapeData && (shape.shapeData.properties?.text ?? shape.shapeData.name)) || '');
    let createdDynamicLabel = null;

    if (newText !== prevText) {
      if (textTarget) {
        textTarget.set('text', newText);
        if (textTarget.initDimensions) textTarget.initDimensions();
        textTarget.dirty = true;
      } else if (shape.isType && shape.isType('group')) {
        const m = shape.calcTransformMatrix();
        const scenePt = fabric.util.transformPoint(new fabric.Point(0, (shape.height || 40) / 2 + 12), m);
        createdDynamicLabel = new fabric.IText(newText, {
          fontSize: 12,
          fontFamily: 'Segoe UI, Calibri, sans-serif',
          fill: '#000000',
          originX: 'center',
          originY: 'center',
          left: scenePt.x,
          top: scenePt.y,
          selectable: false,
          evented: false,
        });
        shape.add(createdDynamicLabel);
        shape.labelObject = createdDynamicLabel;
        textTarget = createdDynamicLabel;
      }

      if (textTarget && textTarget.group && textTarget.group !== shape) {
        let g = textTarget.group;
        while (g && g !== shape) {
          if (g.triggerLayout) g.triggerLayout();
          g.dirty = true;
          g = g.group;
        }
      }
      if (shape.triggerLayout) shape.triggerLayout();
      shape.dirty = true;
      if (shape.shapeData) {
        shape.shapeData.name = newText;
        if (!shape.shapeData.properties) shape.shapeData.properties = {};
        shape.shapeData.properties.text = newText;
      }

      shape.setCoords();
      this.canvasManager.canvas.requestRenderAll();

      const applyTextVal = (val) => {
        if (createdDynamicLabel) {
          if (val === prevText && shape.remove) {
            shape.remove(createdDynamicLabel);
            shape.labelObject = null;
          } else if (shape.add && !shape.contains(createdDynamicLabel)) {
            createdDynamicLabel.set('text', val);
            shape.add(createdDynamicLabel);
            shape.labelObject = createdDynamicLabel;
          } else {
            createdDynamicLabel.set('text', val);
          }
        } else if (textTarget) {
          textTarget.set('text', val);
          if (textTarget.initDimensions) textTarget.initDimensions();
          textTarget.dirty = true;
          if (textTarget.group && textTarget.group !== shape) {
            let g = textTarget.group;
            while (g && g !== shape) {
              if (g.triggerLayout) g.triggerLayout();
              g.dirty = true;
              g = g.group;
            }
          }
        }
        if (shape.triggerLayout) shape.triggerLayout();
        if (shape.shapeData) {
          shape.shapeData.name = val;
          if (!shape.shapeData.properties) shape.shapeData.properties = {};
          shape.shapeData.properties.text = val;
        }
        shape.dirty = true;
        shape.setCoords();
        this.canvasManager.canvas.requestRenderAll();
      };

      window.undoManager.record({
        name: 'Edit Text',
        execute: () => applyTextVal(newText),
        undo: () => applyTextVal(prevText),
      });

      this.canvasManager.canvas.fire('object:modified', { target: shape });
      window.eventBus.emit('selection:changed', {
        objects: [shape],
        count: 1,
      });
    }

    this._hide();
  }

  _findNestedText(obj) {
    if (!obj || typeof obj.getObjects !== 'function') return null;
    const children = obj.getObjects();
    for (const o of children) {
      if (o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') {
        return o;
      }
    }
    for (const o of children) {
      if (typeof o.getObjects === 'function') {
        const nested = this._findNestedText(o);
        if (nested) return nested;
      }
    }
    return null;
  }

  /**
   * Cancel editing without changes.
   */
  cancel() {
    this._hide();
  }

  _hide() {
    this.inputElement.style.display = 'none';
    this.activeShape = null;
  }
}

window.InlineTextEditor = InlineTextEditor;

