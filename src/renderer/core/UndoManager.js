/**
 * UndoManager — Command pattern implementation for Undo/Redo.
 * 
 * Each action is recorded as a command with execute() and undo() methods.
 * Supports configurable stack depth.
 */
class UndoManager {
  /**
   * @param {number} [maxHistory=100] - Maximum number of undo steps
   */
  constructor(maxHistory = 100) {
    /** @type {Array<{name: string, execute: Function, undo: Function}>} */
    this._undoStack = [];
    /** @type {Array<{name: string, execute: Function, undo: Function}>} */
    this._redoStack = [];
    this._maxHistory = maxHistory;
    this._isExecuting = false; // Prevent re-entry
  }

  /**
   * Execute a command and push it onto the undo stack.
   * @param {{name: string, execute: Function, undo: Function}} command
   */
  execute(command) {
    if (this._isExecuting) return;
    
    this._isExecuting = true;
    try {
      command.execute();
      this._undoStack.push(command);
      
      // Executing a new command clears the redo stack
      this._redoStack = [];
      
      // Trim to max history
      if (this._undoStack.length > this._maxHistory) {
        this._undoStack.shift();
      }
      
      this._emitState();
    } finally {
      this._isExecuting = false;
    }
  }

  /**
   * Record a command without executing it (for actions already performed).
   * @param {{name: string, execute: Function, undo: Function}} command
   */
  record(command) {
    if (this._isExecuting || !command) return;
    this._undoStack.push(command);
    this._redoStack = [];
    
    if (this._undoStack.length > this._maxHistory) {
      this._undoStack.shift();
    }
    
    this._emitState();
  }

  sync() {
    this._emitState();
  }

  /**
   * Push/record a command (alias for record).
   * @param {{name: string, execute: Function, undo: Function}} command
   */
  push(command) {
    this.record(command);
  }

  /**
   * Undo the last command.
   */
  undo() {
    if (!this.canUndo) return;
    
    this._isExecuting = true;
    try {
      const command = this._undoStack.pop();
      command.undo();
      this._redoStack.push(command);
      this._emitState();
    } finally {
      this._isExecuting = false;
    }
  }

  /**
   * Redo the last undone command.
   */
  redo() {
    if (!this.canRedo) return;
    
    this._isExecuting = true;
    try {
      const command = this._redoStack.pop();
      command.execute();
      this._undoStack.push(command);
      this._emitState();
    } finally {
      this._isExecuting = false;
    }
  }

  /** @returns {boolean} Whether undo is available */
  get canUndo() {
    return this._undoStack.length > 0;
  }

  /** @returns {boolean} Whether redo is available */
  get canRedo() {
    return this._redoStack.length > 0;
  }

  /**
   * Clear all history.
   */
  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._emitState();
  }

  /**
   * Emit state change for UI updates.
   */
  _emitState() {
    if (window.eventBus) {
      window.eventBus.emit('undo:state-changed', {
        canUndo: this.canUndo,
        canRedo: this.canRedo,
        undoName: this.canUndo ? this._undoStack[this._undoStack.length - 1].name : null,
        redoName: this.canRedo ? this._redoStack[this._redoStack.length - 1].name : null,
      });
    }
  }
}

// Global singleton
window.undoManager = new UndoManager();

