/**
 * EventBus — Lightweight pub/sub system for decoupled communication.
 * 
 * Used throughout OpenDraw to connect components without tight coupling.
 * Example: canvas emits 'zoom:changed', status bar listens and updates display.
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const fn of [...listeners]) {
        if (fn === callback || fn._originalCallback === callback) {
          listeners.delete(fn);
        }
      }
    }
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event 
   * @param {*} data 
   */
  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      [...listeners].forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`EventBus error in handler for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Subscribe to an event, but only fire once.
   * @param {string} event 
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const wrappedCallback = (data) => {
      this.off(event, wrappedCallback);
      callback(data);
    };
    wrappedCallback._originalCallback = callback;
    return this.on(event, wrappedCallback);
  }
}

const openDrawDialog = {
  _show({ title = 'OpenDraw', message = '', mode = 'alert', defaultValue = '', placeholder = '', okText = 'OK', cancelText = 'Cancel' }) {
    if (typeof document === 'undefined' || !document.body) {
      return Promise.resolve(mode === 'confirm' ? true : mode === 'prompt' ? defaultValue : undefined);
    }
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'od-modal-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100000;display:flex;align-items:center;justify-content:center;';

      const box = document.createElement('div');
      box.className = 'od-modal-box';
      box.style.cssText = 'background:var(--bg-secondary,#252526);color:var(--text-primary,#f0f0f0);border:1px solid var(--border,#454545);border-radius:6px;min-width:340px;max-width:480px;box-shadow:0 12px 32px rgba(0,0,0,0.5);font-family:inherit;overflow:hidden;';

      const hdr = document.createElement('div');
      hdr.style.cssText = 'padding:10px 14px;background:var(--bg-primary,#2b2b2b);border-bottom:1px solid var(--border,#3c3c3c);font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center;';
      hdr.textContent = title;

      const body = document.createElement('div');
      body.style.cssText = 'padding:14px;font-size:12.5px;line-height:1.45;white-space:pre-wrap;';
      body.textContent = message;

      let input = null;
      if (mode === 'prompt') {
        input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue || '';
        input.placeholder = placeholder || '';
        input.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin-top:10px;padding:6px 8px;background:var(--bg-tertiary,#1e1e1e);color:var(--text-primary,#fff);border:1px solid var(--accent,#2b579a);border-radius:3px;font-size:12.5px;outline:none;';
        body.appendChild(input);
      }

      const footer = document.createElement('div');
      footer.style.cssText = 'padding:10px 14px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--border,#3c3c3c);';

      const finish = (val) => {
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(val);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          finish(mode === 'confirm' ? false : null);
        } else if (e.key === 'Enter') {
          e.stopPropagation();
          finish(mode === 'prompt' ? input.value : true);
        }
      };

      if (mode !== 'alert') {
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelText;
        cancelBtn.style.cssText = 'padding:5px 14px;border-radius:3px;border:1px solid var(--border,#555);background:transparent;color:var(--text-primary,#eee);cursor:pointer;font-size:12px;';
        cancelBtn.onclick = () => finish(mode === 'confirm' ? false : null);
        footer.appendChild(cancelBtn);
      }

      const okBtn = document.createElement('button');
      okBtn.textContent = okText;
      okBtn.style.cssText = 'padding:5px 16px;border-radius:3px;border:none;background:var(--accent,#2b579a);color:#fff;cursor:pointer;font-size:12px;font-weight:600;';
      okBtn.onclick = () => finish(mode === 'prompt' ? input.value : true);
      footer.appendChild(okBtn);

      box.appendChild(hdr);
      box.appendChild(body);
      box.appendChild(footer);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      document.addEventListener('keydown', onKey, true);
      setTimeout(() => {
        if (input) { input.focus(); input.select(); } else okBtn.focus();
      }, 10);
    });
  },
  alert(message, title = 'OpenDraw') {
    return this._show({ title, message, mode: 'alert', okText: 'OK' });
  },
  confirm(message, title = 'Confirm') {
    return this._show({ title, message, mode: 'confirm', okText: 'Yes', cancelText: 'No' });
  },
  prompt(message, defaultValue = '', title = 'OpenDraw') {
    return this._show({ title, message, mode: 'prompt', defaultValue, okText: 'OK', cancelText: 'Cancel' });
  }
};

window.openDrawDialog = openDrawDialog;
window.eventBus = new EventBus();

