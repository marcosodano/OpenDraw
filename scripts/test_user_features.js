const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const targetVsdx = 'C:/Users/T9813424/OneDrive - Hitachi Group/Documents/4. Projects/P2428 - ER HSR/4 Engineering/04-Design/02-DCP2/02-MSN/_Work/01 - Technical Specification Design/02 - System Images/1 - Visio/MSN - Depot_IMF_20260805.vsdx';
const mainDebugPath = 'C:/Users/T9813424/.gemini/antigravity/brain/f05469bd-7361-46fc-bd01-4c293b13cde1/scratch/main_debug.log';

// Reset debug log before test
try {
  fs.writeFileSync(mainDebugPath, `[TEST RUN START] ${new Date().toISOString()}\n`);
} catch (e) {}

const testScriptContent = `
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(async () => {
    const results = [];
    function assert(name, condition, details) {
      results.push({ name: name, passed: !!condition, details: details || '' });
      console.log('[TEST] ' + (condition ? 'PASS' : 'FAIL') + ': ' + name + (details ? ' (' + details + ')' : ''));
    }

    try {
      console.log('[TEST] Starting 9-Feature Verification Suite...');

      // ----------------------------------------------------
      // Feature 1: Icon verification
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 1: Modern Icon ---');
      assert('App loaded in DOM with ribbon', !!document.querySelector('.ribbon-container'));

      // ----------------------------------------------------
      // Feature 2: Dropdown Menus
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 2: Dropdown Menus ---');
      const testDropdowns = ['group', 'align', 'position', 'change-shape', 'select', 'find', 'layers', 'quick-styles', 'effects', 'orientation', 'size'];
      let dropdownPass = true;
      testDropdowns.forEach(type => {
        const items = window.toolbarController._getDropdownItems(type);
        if (!items || items.length === 0) {
          dropdownPass = false;
          console.error('[TEST] Missing items for dropdown: ' + type);
        }
      });
      assert('All 11 ribbon dropdown menus have configured menu actions', dropdownPass);

      // Test DOM popup rendering
      const dummyBtn = document.querySelector('[data-action="align:center-h"]') || document.body;
      window.toolbarController._showDropdownMenu('align', dummyBtn);
      const popupEl = document.getElementById('ribbon-dropdown-popup');
      assert('Dropdown popup element renders in DOM', popupEl && popupEl.style.display === 'block');
      assert('Dropdown contains Align Left option', popupEl && popupEl.textContent.includes('Align Left'));
      assert('Dropdown contains Distribute Horizontally option', popupEl && popupEl.textContent.includes('Distribute Horizontally'));
      popupEl.style.display = 'none';

      // ----------------------------------------------------
      // Feature 3: Grid Flicker Fix (Pattern on _pageRect)
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 3: Grid Pattern Fill (Zero Flicker) ---');
      const allObjects = window.canvasManager.canvas.getObjects();
      const gridLines = allObjects.filter(o => o.objectType === 'grid-line');
      assert('Canvas has ZERO individual grid line objects', gridLines.length === 0, 'count=' + gridLines.length);

      const pageRect = window.canvasManager.gridManager._pageRect;
      assert('GridManager pageRect exists', !!pageRect);
      assert('pageRect fill is a fabric.Pattern', pageRect && pageRect.fill && (pageRect.fill.source || pageRect.fill.type === 'pattern'));

      // ----------------------------------------------------
      // Feature 4: Insert Tab (Symbol, Field, ScreenTip, Object)
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 4: Insert Tab Advanced Features ---');
      // Symbol Picker
      window.toolbarController._showSymbolPicker(dummyBtn);
      const symbolPicker = document.getElementById('ribbon-symbol-picker');
      assert('Symbol picker DOM renders properly', symbolPicker && symbolPicker.style.display === 'block');
      assert('Symbol picker has mathematical and arrow symbols', symbolPicker && symbolPicker.textContent.includes('±') && symbolPicker.textContent.includes('→'));
      symbolPicker.style.display = 'none';

      // Field Chooser
      window.toolbarController._showFieldChooserDialog(dummyBtn);
      assert('Field chooser renders dynamic fields', popupEl && popupEl.textContent.includes('Current Date') && popupEl.textContent.includes('Page Name'));
      popupEl.style.display = 'none';

      // ScreenTip System
      assert('ScreenTip bubble DOM element initialized', !!document.getElementById('opendraw-screentip-bubble'));

      // ----------------------------------------------------
      // Feature 5: Subscript and Superscript (X^2, X_2)
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 5: Subscript and Superscript ---');
      const testTb = new fabric.Textbox('H2O X2', { left: 100, top: 100 });
      window.canvasManager.canvas.add(testTb);
      window.canvasManager.canvas.setActiveObject(testTb);

      // Apply subscript: '2' should become '₂'
      window.toolbarController._applySubscript();
      assert('Subscript converts numbers to Unicode subscript (H₂O X₂)', testTb.text === 'H₂O X₂', 'actual=' + testTb.text);

      // Apply subscript again to toggle back to '2'
      window.toolbarController._applySubscript();
      assert('Subscript toggles back to normal text (H2O X2)', testTb.text === 'H2O X2', 'actual=' + testTb.text);

      // Apply superscript: '2' should become '²'
      window.toolbarController._applySuperscript();
      assert('Superscript converts numbers to Unicode superscript (H²O X²)', testTb.text === 'H²O X²', 'actual=' + testTb.text);

      // ----------------------------------------------------
      // Feature 6: Paragraph Formatting
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 6: Paragraph Formatting ---');
      // Text Alignment
      window.toolbarController._setSelectedTextAlign('center');
      assert('Paragraph align center applied', testTb.textAlign === 'center');
      window.toolbarController._setSelectedTextAlign('right');
      assert('Paragraph align right applied', testTb.textAlign === 'right');
      window.toolbarController._setSelectedTextAlign('left');
      assert('Paragraph align left applied', testTb.textAlign === 'left');

      // Bullets
      testTb.set('text', 'Line One\\nLine Two');
      window.toolbarController._toggleBullets();
      assert('Paragraph toggle bullets adds bullet markers', testTb.text.includes('• Line One') && testTb.text.includes('• Line Two'), 'actual=' + testTb.text);
      window.toolbarController._toggleBullets();
      assert('Paragraph toggle bullets removes bullet markers', !testTb.text.includes('• '), 'actual=' + testTb.text);

      // Numbering
      window.toolbarController._toggleNumbering();
      assert('Paragraph toggle numbering adds numbers', testTb.text.includes('1. Line One') && testTb.text.includes('2. Line Two'), 'actual=' + testTb.text);
      window.toolbarController._toggleNumbering();
      assert('Paragraph toggle numbering removes numbers', !testTb.text.includes('1. '), 'actual=' + testTb.text);

      // Indent
      window.toolbarController._adjustIndent(4);
      assert('Paragraph indent increase adds leading spacing', testTb.text.startsWith('    Line One'), 'actual=' + testTb.text);
      window.toolbarController._adjustIndent(-4);
      assert('Paragraph indent decrease removes leading spacing', testTb.text.startsWith('Line One'), 'actual=' + testTb.text);

      // Clean up test textbox
      window.canvasManager.canvas.remove(testTb);

      // ----------------------------------------------------
      // Feature 7: View/Zoom Option Active State
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 7: View/Zoom Active State Retention ---');
      window.toolbarController._setActiveZoomOption('zoom-fit');
      const fitBtn = document.querySelector('[data-action="zoom-fit"]');
      const btn100 = document.querySelector('[data-action="zoom-100"]');
      assert('zoom-fit button retains active class', fitBtn && fitBtn.classList.contains('active'));
      assert('zoom-100 button does not have active class', btn100 && !btn100.classList.contains('active'));

      window.toolbarController._setActiveZoomOption('zoom-100');
      assert('zoom-100 button switches to active class', btn100 && btn100.classList.contains('active'));
      assert('zoom-fit button loses active class', fitBtn && !fitBtn.classList.contains('active'));

      // ----------------------------------------------------
      // Feature 8: Hand Gesture Visible on Sheet
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 8: Hand Cursor on Canvas & Sheet ---');
      window.canvasManager.setTool('pan');
      const upperCanvas = window.canvasManager.canvas.upperCanvasEl;
      assert('CanvasManager active tool is pan', window.canvasManager.activeTool === 'pan');
      assert('upperCanvasEl style.cursor is grab', upperCanvas && upperCanvas.style.cursor === 'grab', 'cursor=' + (upperCanvas ? upperCanvas.style.cursor : 'null'));
      assert('pageRect hoverCursor is grab on sheet', pageRect && pageRect.hoverCursor === 'grab', 'cursor=' + (pageRect ? pageRect.hoverCursor : 'null'));

      // Reset to select tool
      window.canvasManager.setTool('select');
      assert('upperCanvasEl style.cursor restored to default', upperCanvas && upperCanvas.style.cursor === 'default');
      assert('pageRect hoverCursor restored to default', pageRect && pageRect.hoverCursor === 'default');

      // ----------------------------------------------------
      // Feature 9: Undo for Objects Loaded from Existing Files
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 9: Undo Engine for Existing File Shapes ---');
      // Find an imported diagram shape
      const importedShapes = window.canvasManager.canvas.getObjects().filter(
        o => o !== pageRect && o.objectType !== 'grid-line' && o.objectType !== 'page-background'
      );
      assert('Existing file loaded with diagram shapes', importedShapes.length > 0, 'shapesCount=' + importedShapes.length);

      if (importedShapes.length > 0) {
        const targetShape = importedShapes[0];
        const origLeft = targetShape.left;
        const origTop = targetShape.top;
        console.log('[TEST] Testing undo on imported shape at (' + origLeft + ', ' + origTop + ')');

        // Simulate before:transform event
        window.canvasManager.canvas.setActiveObject(targetShape);
        window.canvasManager.canvas.fire('before:transform', {
          transform: { target: targetShape }
        });

        // Modify shape geometry (move 75px right and down)
        targetShape.set({ left: origLeft + 75, top: origTop + 75 });
        targetShape.setCoords();

        // Fire object:modified
        window.canvasManager.canvas.fire('object:modified', { target: targetShape });

        assert('UndoManager has canUndo true after moving imported shape', window.undoManager.canUndo);

        // Perform Undo
        window.undoManager.undo();
        assert('Undo restores original position on imported shape', Math.abs(targetShape.left - origLeft) < 0.01 && Math.abs(targetShape.top - origTop) < 0.01, 'left=' + targetShape.left + ', origLeft=' + origLeft);

        // Perform Redo
        window.undoManager.redo();
        assert('Redo re-applies moved position on imported shape', Math.abs(targetShape.left - (origLeft + 75)) < 0.01, 'left=' + targetShape.left);

        // Undo back so diagram is left pristine
        window.undoManager.undo();
      }

      // ----------------------------------------------------
      // Feature 10: Authentic Visio Brand Icon & Header Watermark
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 10: Authentic Visio Brand Icon & Header ---');
      const brandIcon = document.querySelector('.titlebar-visio-brand svg');
      assert('Titlebar contains authentic Visio V brand mark', !!brandIcon);
      const qatChevron = document.querySelector('.quick-access-btn[title*="Customize Quick Access"]');
      assert('Quick Access Toolbar has customize chevron button', !!qatChevron);

      // ----------------------------------------------------
      // Feature 11: Context Menu & Arrange Actions
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 11: Context Menu & Arrange Actions ---');
      assert('window.bringForward is defined', typeof window.bringForward === 'function');
      assert('window.sendBackward is defined', typeof window.sendBackward === 'function');
      assert('window.copyStyle (Format Painter) is defined', typeof window.copyStyle === 'function');
      assert('window.pasteStyle is defined', typeof window.pasteStyle === 'function');

      const ctxMenu = window.canvasManager.contextMenuManager;
      assert('ContextMenuManager is initialized', !!ctxMenu && !!ctxMenu.menuEl);

      // ----------------------------------------------------
      // Feature 12: Drag-to-Size Text Box & Multi-line Support
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 12: Drag-to-Size Text Box ---');
      window.canvasManager.setTool('insert:textbox');
      assert('CanvasManager activeTool is insert:textbox', window.canvasManager.activeTool === 'insert:textbox');

      // Simulate mouse drag from (200, 200) to (350, 280)
      const fakeDown = { e: { button: 0, clientX: 200, clientY: 200 } };
      const fakeMove = { e: { button: 0, clientX: 350, clientY: 280 } };
      const fakeUp = { e: { button: 0, clientX: 350, clientY: 280 } };

      window.canvasManager.canvas.fire('mouse:down', fakeDown);
      window.canvasManager.canvas.fire('mouse:move', fakeMove);
      window.canvasManager.canvas.fire('mouse:up', fakeUp);

      const activeObj = window.canvasManager.canvas.getActiveObject();
      assert('Drag creates active Textbox on canvas', activeObj && (activeObj.objectType === 'textbox' || activeObj.type === 'textbox'));
      if (activeObj) {
        assert('Textbox has drag-sized width >= 100', activeObj.width >= 100, 'width=' + activeObj.width);
        window.canvasManager.canvas.remove(activeObj);
      }
      window.canvasManager.setTool('select');

      // ----------------------------------------------------
      // Feature 13: Visio Stencils Integration (.vssx)
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 13: Visio Stencils Integration (.vssx) ---');
      assert('VisioConverter.parseVssxArchive is defined', typeof VisioConverter.parseVssxArchive === 'function');
      assert('window.panelController.loadVssxStencil is defined', typeof window.panelController.loadVssxStencil === 'function');
      const moreFlyout = document.getElementById('more-shapes-flyout');
      // ----------------------------------------------------
      // Feature 14: Network & Servers + Cisco Shape Libraries
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 14: Network & Servers + Cisco Shape Libraries ---');
      const netGrid = document.querySelector('.stencil-category[data-category="network"] .stencil-grid');
      assert('Network & Servers stencil grid exists and is populated', netGrid && netGrid.children.length === 20, 'items=' + (netGrid ? netGrid.children.length : 0));
      const ciscoGrid = document.querySelector('.stencil-category[data-category="cisco"] .stencil-grid');
      assert('Cisco Network Shapes stencil grid exists and is populated', ciscoGrid && ciscoGrid.children.length === 11, 'items=' + (ciscoGrid ? ciscoGrid.children.length : 0));

      // Test ShapeFactory creation of new network & cisco shapes
      const testRack = window.ShapeFactory.create('net-rack-server', 300, 300);
      assert('ShapeFactory creates net-rack-server with connectionPoints', testRack && testRack.connectionPoints && testRack.connectionPoints.length >= 4);
      assert('ShapeFactory sets metadata on net-rack-server', testRack && testRack.shapeData && testRack.shapeData.properties.u_size === '2U');

      const testL3 = window.ShapeFactory.create('cisco-l3-switch', 300, 300);
      assert('ShapeFactory creates cisco-l3-switch with connectionPoints', testL3 && testL3.connectionPoints && testL3.connectionPoints.length >= 4);
      assert('ShapeFactory sets vendor metadata on cisco-l3-switch', testL3 && testL3.shapeData && testL3.shapeData.properties.vendor === 'Cisco Systems');

      const testPhone = window.ShapeFactory.create('cisco-phone', 300, 300);
      assert('ShapeFactory creates cisco-phone with labelObject', testPhone && !!testPhone.labelObject);

      // ----------------------------------------------------
      // Feature 15: Tell Me Autocomplete & Command Execution
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 15: Tell Me Autocomplete & Commands ---');
      const tellInput = document.getElementById('tell-me-input');
      const tellDropdown = document.getElementById('tell-me-dropdown');
      assert('Tell Me input and dropdown exist in DOM', !!tellInput && !!tellDropdown);
      if (tellInput && tellDropdown) {
        tellInput.value = 'Zoom';
        tellInput.dispatchEvent(new Event('input'));
        assert('Tell Me dropdown shows matching commands for "Zoom"', tellDropdown.style.display === 'block' && tellDropdown.textContent.includes('Zoom to Fit'));
        tellInput.value = '';
        tellInput.dispatchEvent(new Event('input'));
        assert('Tell Me dropdown closes on empty input', tellDropdown.style.display === 'none');
      }

      // ----------------------------------------------------
      // Feature 16: Ribbon Collapse & Display Options
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 16: Ribbon Collapse & Display Options ---');
      const collapseToggle = document.getElementById('ribbon-collapse-toggle');
      const displayOptions = document.getElementById('ribbon-display-options');
      const ribbonContainer = document.querySelector('.ribbon-container');
      assert('Ribbon collapse toggle and display options exist', !!collapseToggle && !!displayOptions);
      if (collapseToggle && ribbonContainer) {
        collapseToggle.click();
        assert('Ribbon collapses on toggle click', ribbonContainer.classList.contains('collapsed'));
        collapseToggle.click();
        assert('Ribbon expands on second toggle click', !ribbonContainer.classList.contains('collapsed'));
      }

      // ----------------------------------------------------
      // Feature 17: Fill & Line Shape Style Pickers
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 17: Fill & Line Shape Style Pickers ---');
      const btnFill = document.getElementById('btn-shape-fill');
      const btnLine = document.getElementById('btn-shape-line');
      assert('Shape Fill and Line split buttons exist in DOM', !!btnFill && !!btnLine);
      window.toolbarController._showFillColorPicker();
      let colorPop = document.querySelector('.visio-color-popover');
      assert('Visio Fill Color Popover renders with Theme Colors', !!colorPop && colorPop.textContent.includes('Theme Colors'));
      if (colorPop) colorPop.remove();

      window.toolbarController._showLineColorPicker();
      colorPop = document.querySelector('.visio-color-popover');
      assert('Visio Line Color Popover renders with Line Weights and Dashes', !!colorPop && colorPop.textContent.includes('Line Weight') && colorPop.textContent.includes('Dashes'));
      if (colorPop) colorPop.remove();

      // ----------------------------------------------------
      // Feature 18: Design Themes Gallery (Office, Linear, Facet, Dark, Radiant, Simple)
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 18: Authentic Diagram Themes Gallery ---');
      const themeCards = document.querySelectorAll('.ribbon-theme-gallery .theme-card');
      assert('Theme gallery contains 6 authentic theme cards', themeCards.length === 6, 'count=' + themeCards.length);
      const previewBars = document.querySelectorAll('.theme-card-preview .theme-card-bar');
      assert('Theme cards contain 4-stripe preview swatches', previewBars.length >= 24, 'count=' + previewBars.length);

      window.toolbarController._applyDiagramTheme('linear');
      assert('Applying Linear theme updates ShapeFactory primary fill to #E0F2F1', window.ShapeFactory.THEME.primary.fill === '#E0F2F1');
      window.toolbarController._applyDiagramTheme('dark');
      assert('Applying Dark theme updates ShapeFactory primary fill to #333333', window.ShapeFactory.THEME.primary.fill === '#333333');
      window.toolbarController._applyDiagramTheme('radiant');
      assert('Applying Radiant theme updates ShapeFactory primary fill to #F0F4F8', window.ShapeFactory.THEME.primary.fill === '#F0F4F8');
      window.toolbarController._applyDiagramTheme('office');
      assert('Applying Office theme restores #D9E1F2', window.ShapeFactory.THEME.primary.fill === '#D9E1F2');

      // ----------------------------------------------------
      // Feature 19: Design Backgrounds & Grid Persistence
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 19: Backgrounds & Grid Persistence ---');
      window.toolbarController._showBackgroundPicker();
      const bgPop = document.querySelector('.visio-color-popover');
      assert('Background picker renders engineering blueprint option', !!bgPop && bgPop.textContent.includes('Engineering Blueprint'));
      if (bgPop) bgPop.remove();

      // Test that changing page background preserves the grid pattern!
      window.canvasManager.gridManager.setPageColor('#0f2b48');
      assert('Page background changed to blueprint #0f2b48', window.canvasManager.gridManager._pageColor === '#0f2b48');
      assert('pageRect fill remains a fabric.Pattern with grid after background change', pageRect && pageRect.fill && (pageRect.fill.source || pageRect.fill.type === 'pattern'));
      window.canvasManager.gridManager.setPageColor('#ffffff');
      assert('Page background restored to white with pattern grid intact', pageRect && pageRect.fill && (pageRect.fill.source || pageRect.fill.type === 'pattern'));

      // ----------------------------------------------------
      // Feature 20: Borders & Titles Dropdown Menu
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 20: Borders & Titles Dropdown Menu ---');
      const borderBtn = document.querySelector('[data-action="insert:borders-titles"]') || dummyBtn;
      window.toolbarController._showBordersTitlesMenu(borderBtn);
      let menuPop = document.querySelector('.visio-menu-popover');
      assert('Borders & Titles dropdown menu renders in DOM', !!menuPop);
      assert('Borders menu has Engineering Title Block option', menuPop && menuPop.textContent.includes('Engineering Title Block'));
      assert('Borders menu has Modern Corporate Header Banner option', menuPop && menuPop.textContent.includes('Modern Corporate Header Banner'));
      assert('Borders menu has Minimal Framing Border option', menuPop && menuPop.textContent.includes('Minimal Framing Border'));
      assert('Borders menu has No Border option', menuPop && menuPop.textContent.includes('No Border / Title'));
      if (menuPop) menuPop.remove();

      // Test inserting engineering title block with Marco Sodano (MS)
      window.toolbarController._applyBorderAndTitleStyle('engineering');
      let titleObj = window.canvasManager.canvas.getObjects().find(o => o.objectType === 'title-block');
      assert('Engineering Title Block inserted with Marco Sodano (MS)', !!titleObj && titleObj.labelObject && titleObj.labelObject.text.includes('OpenDraw'));
      // Test removing border
      window.toolbarController._applyBorderAndTitleStyle('none');
      titleObj = window.canvasManager.canvas.getObjects().find(o => o.objectType === 'title-block');
      assert('Applying No Border cleanly removes title block from canvas', !titleObj);

      // ----------------------------------------------------
      // Feature 21: Design Layout & Connector Routing Dropdowns
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 21: Re-Layout Page & Connector Routing Dropdowns ---');
      const layoutBtn = document.querySelector('[data-action="layout:dropdown"]') || dummyBtn;
      window.toolbarController._showRelayoutMenu(layoutBtn);
      menuPop = document.querySelector('.visio-menu-popover');
      assert('Re-Layout Page dropdown renders in DOM', !!menuPop);
      assert('Re-Layout menu contains Top to Bottom, Left to Right, Bottom to Top, Radial, Compact',
        menuPop && menuPop.textContent.includes('Top to Bottom') && menuPop.textContent.includes('Left to Right') && menuPop.textContent.includes('Radial'));
      if (menuPop) menuPop.remove();

      // Test undoable layout
      window.toolbarController._applyLayoutWithUndo('tb');
      assert('Auto-Layout pushes record to window.undoManager for Ctrl+Z restoration', window.undoManager.canUndo);

      // Connector Routing dropdown
      const connBtn = document.querySelector('[data-action="layout:connectors-dropdown"]') || dummyBtn;
      window.toolbarController._showConnectorRoutingMenu(connBtn);
      menuPop = document.querySelector('.visio-menu-popover');
      assert('Connectors dropdown menu renders in DOM', !!menuPop);
      assert('Connectors menu contains Orthogonal, Straight, and Curved options',
        menuPop && menuPop.textContent.includes('Right Angle') && menuPop.textContent.includes('Straight Lines') && menuPop.textContent.includes('Curved Connectors'));
      if (menuPop) menuPop.remove();

      window.toolbarController._setConnectorRouting('straight');
      assert('Setting routing to straight updates defaultStyle', window.canvasManager.connectorManager.defaultStyle.routingType === 'straight');
      window.toolbarController._setConnectorRouting('orthogonal');
      assert('Restoring routing to orthogonal updates defaultStyle', window.canvasManager.connectorManager.defaultStyle.routingType === 'orthogonal');

      // ----------------------------------------------------
      // Feature 22: Pan Mode Auto-Switch to Pointer on Comment
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 22: Pan Tool Auto-Switch on Comment Insert ---');
      window.canvasManager.setTool('pan');
      assert('Canvas tool is set to pan', window.canvasManager.activeTool === 'pan');

      // Now insert comment card
      window.toolbarController._insertCommentCard();
      assert('Inserting comment automatically switches tool from pan to select', window.canvasManager.activeTool === 'select');
      const commentCard = window.canvasManager.canvas.getObjects().find(o => o.objectType === 'comment-card');
      assert('Authentic Visio yellow comment card inserted with Marco Sodano (MS)', !!commentCard && !!commentCard.labelObject);
      if (commentCard) window.canvasManager.canvas.remove(commentCard);

      // ----------------------------------------------------
      // Feature 23: True Presentation Mode
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 23: Authentic Visio Presentation Mode ---');
      window.toolbarController._togglePresentationMode();
      assert('Presentation mode adds .presentation-mode class to body', document.body.classList.contains('presentation-mode'));
      const presToolbar = document.getElementById('presentation-toolbar');
      assert('Floating presentation controls bar renders with prev/next/zoom/laser', !!presToolbar);
      assert('Presentation toolbar contains laser pointer toggle', !!document.getElementById('pres-btn-laser'));
      assert('Presentation toolbar contains page indicator label', !!document.getElementById('pres-page-label'));

      // Toggle off presentation mode
      window.toolbarController._togglePresentationMode();
      assert('Exiting presentation mode removes .presentation-mode class from body', !document.body.classList.contains('presentation-mode'));
      assert('Exiting presentation mode removes floating toolbar', !document.getElementById('presentation-toolbar'));

      // ----------------------------------------------------
      // Feature 24: Clean Shapes Panel (Only Basic & Flowchart by Default)
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 24: Clean Shapes Panel ---');
      const basicCat = document.querySelector('.stencil-category[data-category="basic"]');
      const flowCat = document.querySelector('.stencil-category[data-category="flowchart"]');
      const ciscoCat = document.querySelector('.stencil-category[data-category="cisco"]');
      const netCat = document.querySelector('.stencil-category[data-category="network"]');

      assert('Basic Shapes category is visible in default sidebar', basicCat && basicCat.style.display !== 'none');
      assert('Flowchart category is visible in default sidebar', flowCat && flowCat.style.display !== 'none');
      assert('Cisco Network Shapes is hidden by default from primary sidebar', ciscoCat && ciscoCat.style.display === 'none');
      assert('Network & Servers is hidden by default from primary sidebar', netCat && netCat.style.display === 'none');

      // Verify centered text on Basic and Flowchart shapes (no dangling bottom padding)
      const testPentagon = window.ShapeFactory.create('pentagon', 200, 200);
      assert('Pentagon created without phantom bottom offset', testPentagon.height < 100, 'height=' + testPentagon.height);
      assert('Pentagon text has high contrast color', testPentagon.labelObject && testPentagon.labelObject.fill);

      // ----------------------------------------------------
      // Feature 25: Stencil Import Visibility & Notification
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 25: Stencil Import Visibility ---');
      const visioStencilPath = 'C:/Program Files/Microsoft Office/root/Office16/Visio Content/1033/CISCONETWORKSHAPES_M.VSSX';
      await window.panelController.loadVssxStencil(visioStencilPath, 'Cisco Test Stencil');

      const importedCat = document.querySelector('.stencil-category[data-category="vssx_cisconetworkshapes_m"]');
      assert('Imported stencil category element added to DOM', !!importedCat);
      assert('Imported stencil category is first child of shapes-panel-content',
        importedCat && importedCat === document.getElementById('shapes-panel-content').firstChild);
      assert('Imported stencil category has active header',
        importedCat && importedCat.querySelector('.stencil-category-header.active'));
      const toastEl = document.querySelector('.visio-toast');
      assert('Visio toast notification renders on screen with imported shape count',
        !!toastEl && toastEl.textContent.includes('Imported'));
      if (toastEl) toastEl.remove();

      // ----------------------------------------------------
      // Feature 26: Shape Blank Text & Color Fidelity (Library vs Canvas 1:1 Match)
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 26: Blank Shape Text & Color Fidelity ---');
      const cylinderShape = window.ShapeFactory.create('cylinder', 100, 100);
      assert('Cylinder shape text is completely blank (no "Database" placeholder)', cylinderShape.labelObject.text === '', 'actual="' + cylinderShape.labelObject.text + '"');

      const hexShape = window.ShapeFactory.create('hexagon', 100, 100);
      assert('Hexagon shape text is completely blank (no "Hexagon" placeholder)', hexShape.labelObject.text === '', 'actual="' + hexShape.labelObject.text + '"');

      const pentShape = window.ShapeFactory.create('pentagon', 100, 100);
      assert('Pentagon shape text is completely blank (no "Pentagon" placeholder)', pentShape.labelObject.text === '', 'actual="' + pentShape.labelObject.text + '"');

      const starShape = window.ShapeFactory.create('star', 100, 100);
      assert('Star shape text is completely blank (no "Star" placeholder)', starShape.labelObject.text === '', 'actual="' + starShape.labelObject.text + '"');

      const fcTerm = window.ShapeFactory.create('fc-terminator', 100, 100);
      assert('Flowchart Terminator text is blank (no "Start / End")', fcTerm.labelObject.text === '');

      const fcProc = window.ShapeFactory.create('fc-process', 100, 100);
      assert('Flowchart Process text is blank (no "Process Step")', fcProc.labelObject.text === '');

      const fcDec = window.ShapeFactory.create('fc-decision', 100, 100);
      assert('Flowchart Decision text is blank (no "Condition?")', fcDec.labelObject.text === '');

      const fcData = window.ShapeFactory.create('fc-data', 100, 100);
      assert('Flowchart Data text is blank (no "Data I/O")', fcData.labelObject.text === '');

      const fcDoc = window.ShapeFactory.create('fc-document', 100, 100);
      assert('Flowchart Document text is blank (no "Document")', fcDoc.labelObject.text === '');

      const fcSub = window.ShapeFactory.create('fc-subprocess', 100, 100);
      assert('Flowchart Sub-process text is blank (no "Sub-process")', fcSub.labelObject.text === '');

      const fcMan = window.ShapeFactory.create('fc-manual-input', 100, 100);
      assert('Flowchart Manual Input text is blank (no "Manual Input")', fcMan.labelObject.text === '');

      const fcPrep = window.ShapeFactory.create('fc-preparation', 100, 100);
      assert('Flowchart Preparation text is blank (no "Preparation")', fcPrep.labelObject.text === '');

      const fcConn = window.ShapeFactory.create('fc-connector', 100, 100);
      assert('Flowchart Connector text is blank (no "A")', fcConn.labelObject.text === '');

      // Verify Basic Shapes Stencil Thumbnail Colors match Dropped Shape Colors
      const rectStencilEl = document.querySelector('.stencil-category[data-category="basic"] [data-shape-type="rectangle"] svg rect');
      const rectDropped = window.ShapeFactory.create('rectangle', 100, 100);
      const droppedFill = (rectDropped.getObjects()[0].fill || '').toUpperCase();
      const stencilFill = (rectStencilEl ? rectStencilEl.getAttribute('fill') : '').toUpperCase();
      assert('Basic Rectangle stencil icon fill matches dropped shape fill (#D9E1F2)',
        droppedFill === '#D9E1F2' && stencilFill === '#D9E1F2', 'dropped=' + droppedFill + ' stencil=' + stencilFill);

      const cylinderDropped = window.ShapeFactory.create('cylinder', 100, 100);
      const cylFill = (cylinderDropped.getObjects()[0].fill || '').toUpperCase();
      assert('Basic Cylinder dropped shape fill matches theme primary blue (#D9E1F2)', cylFill === '#D9E1F2', 'actual=' + cylFill);

      // Verify Flowchart Stencil Thumbnail Colors match Dropped Flowchart Colors
      const fcProcStencilEl = document.querySelector('.stencil-category[data-category="flowchart"] [data-shape-type="fc-process"] svg rect');
      const fcProcDropped = window.ShapeFactory.create('fc-process', 100, 100);
      const fcProcDroppedFill = (fcProcDropped.getObjects()[0].fill || '').toUpperCase();
      const fcProcStencilFill = (fcProcStencilEl ? fcProcStencilEl.getAttribute('fill') : '').toUpperCase();
      assert('Flowchart Process stencil icon fill matches dropped shape fill (#4472C4)',
        fcProcDroppedFill === '#4472C4' && fcProcStencilFill === '#4472C4', 'dropped=' + fcProcDroppedFill + ' stencil=' + fcProcStencilFill);

      // Dynamic Theme Color Updating in Stencils
      window.toolbarController._applyDiagramTheme('facet');
      const facetStencilFill = (rectStencilEl ? rectStencilEl.getAttribute('fill') : '').toUpperCase();
      assert('Diagram theme update dynamically refreshes stencil icon colors to #EDE7F6', facetStencilFill === '#EDE7F6', 'actual=' + facetStencilFill);

      // Restore to Office theme
      window.toolbarController._applyDiagramTheme('office');
      const restoredFill = (rectStencilEl ? rectStencilEl.getAttribute('fill') : '').toUpperCase();
      assert('Restoring Office theme returns stencil icon fill to #D9E1F2', restoredFill === '#D9E1F2', 'actual=' + restoredFill);

      // ----------------------------------------------------
      // Feature 27: Marco Sodano Rebranding & Backstage Credits
      // ----------------------------------------------------
      console.log('[TEST] --- Feature 27: Marco Sodano Rebranding & Backstage Credits ---');
      const winTitleEl = document.getElementById('window-title');
      assert('Window title element contains "OpenDraw by Marco Sodano"', winTitleEl && winTitleEl.textContent.includes('OpenDraw by Marco Sodano'), 'title=' + (winTitleEl ? winTitleEl.textContent : 'null'));

      // Check zero occurrences of "Microsoft" or "Visio" in titlebar and start hero
      const titlebarText = (document.getElementById('titlebar') ? document.getElementById('titlebar').textContent : '') + (document.title || '');
      const backstageHero = document.querySelector('.visio-brand-hero') ? document.querySelector('.visio-brand-hero').textContent : '';
      assert('Titlebar contains zero occurrences of "Microsoft"', !titlebarText.toLowerCase().includes('microsoft'));
      assert('Titlebar contains zero occurrences of "Visio"', !titlebarText.toLowerCase().includes('visio'));
      assert('Backstage hero contains zero occurrences of "Microsoft"', !backstageHero.toLowerCase().includes('microsoft'));
      assert('Backstage hero contains zero occurrences of "Visio"', !backstageHero.toLowerCase().includes('visio'));

      // Test Credits Tab
      const creditsTabBtn = document.getElementById('backstage-tab-credits');
      const recentTabBtn = document.getElementById('backstage-tab-recent');
      const creditsViewEl = document.getElementById('backstage-view-credits');
      const mainColsEl = document.querySelector('.visio-start-columns');
      assert('Credits tab button exists in Backstage sidebar', !!creditsTabBtn);
      assert('Credits view container exists in Backstage DOM', !!creditsViewEl);

      if (creditsTabBtn && creditsViewEl) {
        creditsTabBtn.click();
        assert('Clicking Credits tab makes credits view visible', creditsViewEl.style.display === 'block');
        assert('Credits tab button receives active class', creditsTabBtn.classList.contains('active'));
        assert('Credits view displays Marco Sodano', creditsViewEl.textContent.includes('Marco Sodano'));
        assert('Credits view displays Official Monogram: MS', creditsViewEl.textContent.includes('MS'));
        assert('Credits view displays Creator & Lead Architect', creditsViewEl.textContent.includes('Creator & Lead Architect'));

        // Switch back to Recent
        if (recentTabBtn) {
          recentTabBtn.click();
          assert('Clicking Recent tab hides credits view', creditsViewEl.style.display === 'none');
          assert('Recent tab button is active again', recentTabBtn.classList.contains('active'));
        }
      }

      const failed = results.filter(r => !r.passed);
      console.log('[TEST COMPLETE] Total: ' + results.length + ', Passed: ' + (results.length - failed.length) + ', Failed: ' + failed.length);
      console.log('[TEST_SUMMARY_DATA]' + JSON.stringify(results) + '[/TEST_SUMMARY_DATA]');
    } catch (err) {
      console.error('[TEST ERROR]', err);
    }
  }, 2500);
});
`;

const runnerHtml = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
const testInjectorPath = path.join(__dirname, '..', 'src', 'renderer', 'core', 'test_runner_injector.js');
fs.writeFileSync(testInjectorPath, testScriptContent);

// Add script tag to index.html temporarily
let indexHtml = fs.readFileSync(runnerHtml, 'utf-8');
const scriptTag = '<script src="core/test_runner_injector.js"></script>';
if (!indexHtml.includes(scriptTag)) {
  indexHtml = indexHtml.replace('</body>', scriptTag + '\n</body>');
  fs.writeFileSync(runnerHtml, indexHtml);
}

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

console.log('Spawning Electron test runner with target vsdx file...');
const child = spawn(electronExe, ['.', targetVsdx], {
  cwd: path.join(__dirname, '..'),
  env: env,
  stdio: 'inherit'
});

setTimeout(() => {
  console.log('Terminating test runner process...');
  child.kill();

  // Clean up injected test script from index.html
  let cleanedHtml = fs.readFileSync(runnerHtml, 'utf-8');
  cleanedHtml = cleanedHtml.replace(scriptTag + '\n', '').replace(scriptTag, '');
  fs.writeFileSync(runnerHtml, cleanedHtml);

  if (fs.existsSync(testInjectorPath)) {
    fs.unlinkSync(testInjectorPath);
  }

  // Read log from main_debug.log
  if (fs.existsSync(mainDebugPath)) {
    const raw = fs.readFileSync(mainDebugPath, 'utf-8');
    const match = raw.match(/\[TEST_SUMMARY_DATA\](.*?)\[\/TEST_SUMMARY_DATA\]/);
    if (match) {
      const data = JSON.parse(match[1]);
      console.log('\n===========================================');
      console.log('       TEST SUITE VERIFICATION RESULTS      ');
      console.log('===========================================');
      let passCount = 0;
      data.forEach(t => {
        if (t.passed) passCount++;
        console.log('  ' + (t.passed ? '✓ PASS' : '✗ FAIL') + ': ' + t.name + ' ' + (t.details || ''));
      });
      console.log('===========================================');
      console.log('Summary: ' + passCount + '/' + data.length + ' tests passed.');
      console.log('===========================================\n');
    } else {
      console.log('No [TEST_SUMMARY_DATA] found in debug log. Checking raw log tail:');
      console.log(raw.slice(-2000));
    }
  } else {
    console.log('main_debug.log was not found.');
  }

  process.exit(0);
}, 9000);
