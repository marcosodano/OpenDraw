const fs = require('fs');

// Verify that ConnectorManager properly manages selection of connectors vs shapes vs containers
console.log('Testing ConnectorManager logic...');

class MockCanvas {
  constructor() {
    this.events = {};
    this.objects = [];
    this._activeObject = null;
  }
  on(event, handler) { this.events[event] = handler; }
  emit(event, data) { if (this.events[event]) this.events[event](data); }
  add(obj) { this.objects.push(obj); }
  remove(obj) {
    const i = this.objects.indexOf(obj);
    if (i !== -1) this.objects.splice(i, 1);
  }
  bringObjectToFront(obj) {}
  sendObjectToBack(obj) {}
  requestRenderAll() {}
  setActiveObject(obj) { this._activeObject = obj; }
  getActiveObject() { return this._activeObject; }
}

global.fabric = {
  Circle: class {
    constructor(opts) { Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    setCoords() {}
  },
  Polyline: class {
    constructor(points, opts) { this.points = points; Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    setCoords() {}
  },
  Polygon: class {
    constructor(points, opts) { this.points = points; Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
  },
  Group: class {
    constructor(objects, opts) { this.objects = objects; Object.assign(this, opts); }
    set(opts) { Object.assign(this, opts); }
    setCoords() {}
  }
};

global.window = {
  eventBus: {
    emit: (evt, data) => {
      // console.log('Event emitted:', evt, data);
    }
  }
};

const ConnectorManager = require('../src/renderer/core/ConnectorManager.js');

const mockCanvas = new MockCanvas();
const mockCanvasManager = {
  canvas: mockCanvas,
  activeTool: 'select',
};

const cm = new ConnectorManager(mockCanvasManager);

// 1. Test connector line object
const mockConnLine = new global.fabric.Polyline([{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 100 }], {
  objectType: 'connector',
  shapeType: 'connector',
});
const mockConnData = {
  id: 'test_conn',
  line: mockConnLine,
  sourcePoint: { x: 10, y: 10 },
  targetPoint: { x: 50, y: 100 },
};
mockConnLine.connectorData = mockConnData;

// Test selection of connector
mockCanvas.emit('selection:created', { selected: [mockConnLine] });

console.log('1. Selected connector handles count:', cm.endpointHandles.length);
console.log('   Handle 0 pos:', cm.endpointHandles[0]?.left, cm.endpointHandles[0]?.top);
console.log('   Handle 1 pos:', cm.endpointHandles[1]?.left, cm.endpointHandles[1]?.top);
console.log('   AutoConnect triggers count:', cm.autoConnectTriggers.length);

if (cm.endpointHandles.length === 2 && cm.autoConnectTriggers.length === 0) {
  console.log('PASS: Connector correctly displays endpoint handles and hides AutoConnect triggers!');
} else {
  console.error('FAIL: Connector selection handling is incorrect!');
  process.exit(1);
}

// 2. Test container object
const mockContainer = {
  objectType: 'container',
  getBoundingRect: () => ({ left: 100, top: 100, width: 200, height: 200 })
};
mockCanvas.emit('selection:created', { selected: [mockContainer] });
console.log('2. Selected container handles count:', cm.endpointHandles.length);
console.log('   AutoConnect triggers on container count:', cm.autoConnectTriggers.length);

if (cm.endpointHandles.length === 0 && cm.autoConnectTriggers.length === 0) {
  console.log('PASS: Container correctly shows no AutoConnect triggers and no endpoint handles!');
} else {
  console.error('FAIL: Container selection handling is incorrect!');
  process.exit(1);
}

// 3. Test equipment shape object
const mockDevice = {
  objectType: 'shape',
  getBoundingRect: () => ({ left: 50, top: 50, width: 60, height: 40 })
};
mockCanvas.emit('selection:created', { selected: [mockDevice] });
console.log('3. Selected device handles count:', cm.endpointHandles.length);
console.log('   AutoConnect triggers on device count:', cm.autoConnectTriggers.length);

if (cm.endpointHandles.length === 0 && cm.autoConnectTriggers.length === 4) {
  console.log('PASS: Equipment device correctly displays 4 AutoConnect triggers!');
} else {
  console.error('FAIL: Device selection handling is incorrect!');
  process.exit(1);
}

console.log('\nALL CONNECTOR SELECTION TESTS PASSED!');
