/**
 * Sprite Sheet Extractor Tool
 * Automatically detects and extracts individual sprites from a sprite sheet
 */

const SpriteExtractor = {
    image: null,
    imageData: null,
    detectedSprites: [],
    selectedSprite: null,
    zoomController: null,
    boundsContainer: null,
    isEditing: false,
    editMode: null, // 'move', 'resize-nw', 'resize-ne', 'resize-sw', 'resize-se', 'resize-n', 'resize-s', 'resize-e', 'resize-w'
    editStartX: 0,
    editStartY: 0,
    editStartSprite: null,

    init() {
        this.setupUpload();
        this.setupControls();
        this.setupZoom();
    },

    setupUpload() {
        const uploadArea = document.getElementById('extractor-upload');
        const input = document.getElementById('extractor-input');

        uploadArea.addEventListener('click', () => input.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files[0]) {
                this.loadImage(e.dataTransfer.files[0]);
            }
        });

        input.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.loadImage(e.target.files[0]);
            }
        });
    },

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.displayImage();
                this.detectedSprites = [];
                this.selectedSprite = null;
                this.updateSpriteGrid();
                this.drawBounds();
                Utils.showToast('Image loaded. Click "Detect Sprites" to find sprites.', 'success');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    displayImage() {
        const canvas = document.getElementById('extractor-canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        canvas.width = this.image.width;
        canvas.height = this.image.height;
        ctx.drawImage(this.image, 0, 0);
        
        this.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        canvas.style.display = 'block';
        const placeholder = document.querySelector('#extractor-preview .preview-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        document.getElementById('extractor-info').innerHTML = `
            <strong>Size:</strong> ${this.image.width} × ${this.image.height} px
        `;

        // Create wrapper and bounds container
        this.setupCanvasWrapper();

        if (this.zoomController) {
            this.zoomController.resetZoom();
        }
    },

    setupCanvasWrapper() {
        const canvas = document.getElementById('extractor-canvas');
        
        // Check if wrapper already exists
        let wrapper = document.getElementById('extractor-canvas-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'extractor-canvas-wrapper';
            wrapper.style.cssText = `
                position: relative;
                display: inline-block;
            `;
            
            // Move canvas into wrapper
            canvas.parentNode.insertBefore(wrapper, canvas);
            wrapper.appendChild(canvas);
        }
        
        // Create or get bounds container
        let boundsContainer = document.getElementById('extractor-bounds-container');
        if (!boundsContainer) {
            boundsContainer = document.createElement('div');
            boundsContainer.id = 'extractor-bounds-container';
            wrapper.appendChild(boundsContainer);
        }
        
        boundsContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: ${this.image.width}px;
            height: ${this.image.height}px;
            pointer-events: none;
        `;
        
        this.boundsContainer = boundsContainer;
        
        // Tell zoom controller to use wrapper as content
        if (this.zoomController) {
            this.zoomController.setContent(wrapper);
        }
        
        // Setup interaction handlers
        this.setupInteraction();
    },

    setupInteraction() {
        const container = this.boundsContainer;
        if (!container) return;
        
        // Enable pointer events on the bounds container
        container.style.pointerEvents = 'auto';
        
        // Mouse handlers for editing bounds
        container.onmousedown = (e) => this.handleMouseDown(e);
        container.onmousemove = (e) => this.handleMouseMove(e);
        container.onmouseup = (e) => this.handleMouseUp(e);
        container.onmouseleave = (e) => this.handleMouseUp(e);
        
        // Keyboard handler for delete
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedSprite !== null) {
                this.deleteSelectedSprite();
            }
        });
    },

    getMouseCoords(e) {
        const rect = this.boundsContainer.getBoundingClientRect();
        const scaleX = this.image.width / rect.width;
        const scaleY = this.image.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    },

    handleMouseDown(e) {
        const coords = this.getMouseCoords(e);
        const target = e.target;
        
        // Check if clicking on a resize handle
        if (target.classList.contains('sprite-resize-handle')) {
            e.stopPropagation();
            const spriteIndex = parseInt(target.closest('.sprite-bound').dataset.index);
            this.selectedSprite = spriteIndex;
            this.isEditing = true;
            this.editMode = target.dataset.handle;
            this.editStartX = coords.x;
            this.editStartY = coords.y;
            this.editStartSprite = { ...this.detectedSprites[spriteIndex] };
            this.drawBounds();
            return;
        }
        
        // Check if clicking on a sprite bound
        if (target.classList.contains('sprite-bound') || target.closest('.sprite-bound')) {
            e.stopPropagation();
            const bound = target.classList.contains('sprite-bound') ? target : target.closest('.sprite-bound');
            const spriteIndex = parseInt(bound.dataset.index);
            this.selectedSprite = spriteIndex;
            this.isEditing = true;
            this.editMode = 'move';
            this.editStartX = coords.x;
            this.editStartY = coords.y;
            this.editStartSprite = { ...this.detectedSprites[spriteIndex] };
            this.drawBounds();
            this.updateSpriteGridSelection();
            return;
        }
        
        // Clicking on empty space - deselect or start new selection in manual mode
        if (document.getElementById('extractor-mode').value === 'manual') {
            this.selectedSprite = null;
            this.isEditing = true;
            this.editMode = 'create';
            this.editStartX = coords.x;
            this.editStartY = coords.y;
            this.editStartSprite = { x: coords.x, y: coords.y, width: 0, height: 0 };
            this.drawBounds();
        } else {
            this.selectedSprite = null;
            this.drawBounds();
            this.updateSpriteGridSelection();
        }
    },

    handleMouseMove(e) {
        if (!this.isEditing || !this.editStartSprite) return;
        
        const coords = this.getMouseCoords(e);
        const dx = coords.x - this.editStartX;
        const dy = coords.y - this.editStartY;
        
        if (this.editMode === 'create') {
            // Creating new sprite
            const x = Math.min(this.editStartX, coords.x);
            const y = Math.min(this.editStartY, coords.y);
            const width = Math.abs(coords.x - this.editStartX);
            const height = Math.abs(coords.y - this.editStartY);
            this.editStartSprite = { x, y, width, height };
            this.drawBounds(this.editStartSprite);
            return;
        }
        
        const sprite = this.detectedSprites[this.selectedSprite];
        if (!sprite) return;
        
        const start = this.editStartSprite;
        
        switch (this.editMode) {
            case 'move':
                sprite.x = Math.max(0, Math.min(this.image.width - sprite.width, start.x + dx));
                sprite.y = Math.max(0, Math.min(this.image.height - sprite.height, start.y + dy));
                break;
            case 'resize-nw':
                sprite.x = Math.min(start.x + start.width - 10, start.x + dx);
                sprite.y = Math.min(start.y + start.height - 10, start.y + dy);
                sprite.width = start.width - (sprite.x - start.x);
                sprite.height = start.height - (sprite.y - start.y);
                break;
            case 'resize-ne':
                sprite.y = Math.min(start.y + start.height - 10, start.y + dy);
                sprite.width = Math.max(10, start.width + dx);
                sprite.height = start.height - (sprite.y - start.y);
                break;
            case 'resize-sw':
                sprite.x = Math.min(start.x + start.width - 10, start.x + dx);
                sprite.width = start.width - (sprite.x - start.x);
                sprite.height = Math.max(10, start.height + dy);
                break;
            case 'resize-se':
                sprite.width = Math.max(10, start.width + dx);
                sprite.height = Math.max(10, start.height + dy);
                break;
            case 'resize-n':
                sprite.y = Math.min(start.y + start.height - 10, start.y + dy);
                sprite.height = start.height - (sprite.y - start.y);
                break;
            case 'resize-s':
                sprite.height = Math.max(10, start.height + dy);
                break;
            case 'resize-w':
                sprite.x = Math.min(start.x + start.width - 10, start.x + dx);
                sprite.width = start.width - (sprite.x - start.x);
                break;
            case 'resize-e':
                sprite.width = Math.max(10, start.width + dx);
                break;
        }
        
        // Clamp to image bounds
        sprite.x = Math.max(0, sprite.x);
        sprite.y = Math.max(0, sprite.y);
        sprite.width = Math.min(sprite.width, this.image.width - sprite.x);
        sprite.height = Math.min(sprite.height, this.image.height - sprite.y);
        
        this.drawBounds();
    },

    handleMouseUp(e) {
        if (this.editMode === 'create' && this.editStartSprite) {
            const newSprite = this.editStartSprite;
            if (newSprite.width > 5 && newSprite.height > 5) {
                this.detectedSprites.push({
                    index: this.detectedSprites.length + 1,
                    x: Math.round(newSprite.x),
                    y: Math.round(newSprite.y),
                    width: Math.round(newSprite.width),
                    height: Math.round(newSprite.height)
                });
                this.selectedSprite = this.detectedSprites.length - 1;
                this.updateSpriteGrid();
                document.getElementById('extractor-count').textContent = this.detectedSprites.length;
                document.getElementById('extractor-download-all').disabled = false;
            }
        } else if (this.isEditing && this.selectedSprite !== null) {
            // Round sprite values after editing
            const sprite = this.detectedSprites[this.selectedSprite];
            if (sprite) {
                sprite.x = Math.round(sprite.x);
                sprite.y = Math.round(sprite.y);
                sprite.width = Math.round(sprite.width);
                sprite.height = Math.round(sprite.height);
            }
            this.updateSpriteGrid();
        }
        
        this.isEditing = false;
        this.editMode = null;
        this.editStartSprite = null;
        this.drawBounds();
    },

    deleteSelectedSprite() {
        if (this.selectedSprite === null) return;
        
        this.detectedSprites.splice(this.selectedSprite, 1);
        // Renumber sprites
        this.detectedSprites.forEach((s, i) => s.index = i + 1);
        this.selectedSprite = null;
        
        document.getElementById('extractor-count').textContent = this.detectedSprites.length;
        document.getElementById('extractor-download-all').disabled = this.detectedSprites.length === 0;
        
        this.updateSpriteGrid();
        this.drawBounds();
        Utils.showToast('Sprite deleted', 'info');
    },

    setupControls() {
        const modeSelect = document.getElementById('extractor-mode');
        const gridOptions = document.getElementById('extractor-grid-options');
        const autoOptions = document.getElementById('extractor-auto-options');
        const sensitivitySlider = document.getElementById('extractor-sensitivity');
        const sensitivityValue = document.getElementById('extractor-sensitivity-value');
        const minSizeSlider = document.getElementById('extractor-min-size');
        const minSizeValue = document.getElementById('extractor-min-size-value');

        modeSelect.addEventListener('change', () => {
            const mode = modeSelect.value;
            gridOptions.style.display = mode === 'grid' ? 'block' : 'none';
            autoOptions.style.display = mode === 'auto' ? 'block' : 'none';
        });

        sensitivitySlider.addEventListener('input', () => {
            sensitivityValue.textContent = sensitivitySlider.value;
        });

        minSizeSlider.addEventListener('input', () => {
            minSizeValue.textContent = minSizeSlider.value;
        });

        document.getElementById('extractor-detect').addEventListener('click', () => this.detect());
        document.getElementById('extractor-download-all').addEventListener('click', () => this.downloadAll());
    },

    setupZoom() {
        this.zoomController = Utils.createZoomController('extractor-preview');
    },

    detect() {
        if (!this.image) {
            Utils.showToast('Please load an image first', 'error');
            return;
        }

        Utils.showLoading('Detecting sprites...');

        setTimeout(() => {
            try {
                const mode = document.getElementById('extractor-mode').value;
                
                switch (mode) {
                    case 'grid':
                        this.detectGrid();
                        break;
                    case 'manual':
                        this.startManualSelection();
                        break;
                    case 'auto':
                    default:
                        this.detectAuto();
                        break;
                }

                this.selectedSprite = null;
                this.updateSpriteGrid();
                this.drawBounds();

                document.getElementById('extractor-count').textContent = this.detectedSprites.length;
                document.getElementById('extractor-download-all').disabled = this.detectedSprites.length === 0;

                if (this.detectedSprites.length > 0) {
                    Utils.showToast(`Detected ${this.detectedSprites.length} sprites! Click to select, drag to move/resize, Delete key to remove.`, 'success');
                } else {
                    Utils.showToast('No sprites detected. Try adjusting settings.', 'warning');
                }
            } catch (error) {
                console.error('Detection error:', error);
                Utils.showToast('Error detecting sprites: ' + error.message, 'error');
            } finally {
                Utils.hideLoading();
            }
        }, 50);
    },

    detectAuto() {
        const sensitivity = parseInt(document.getElementById('extractor-sensitivity').value);
        const minSize = parseInt(document.getElementById('extractor-min-size').value);

        const width = this.image.width;
        const height = this.image.height;
        const data = this.imageData.data;

        // Create binary mask of non-transparent pixels
        const mask = new Uint8Array(width * height);
        for (let i = 0; i < mask.length; i++) {
            mask[i] = data[i * 4 + 3] > sensitivity ? 1 : 0;
        }

        // Find connected components using flood fill
        const visited = new Uint8Array(width * height);
        const sprites = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (mask[idx] && !visited[idx]) {
                    const bounds = this.floodFillBounds(mask, visited, x, y, width, height);
                    
                    // Filter by minimum size
                    if (bounds.width >= minSize && bounds.height >= minSize) {
                        sprites.push(bounds);
                    }
                }
            }
        }

        // Merge overlapping bounds
        this.detectedSprites = this.mergeOverlapping(sprites);

        // Sort by position (top-left to bottom-right)
        this.detectedSprites.sort((a, b) => {
            const rowA = Math.floor(a.y / 32);
            const rowB = Math.floor(b.y / 32);
            if (rowA !== rowB) return rowA - rowB;
            return a.x - b.x;
        });

        // Number the sprites
        this.detectedSprites.forEach((s, i) => s.index = i + 1);
    },

    floodFillBounds(mask, visited, startX, startY, width, height) {
        const stack = [[startX, startY]];
        let minX = startX, maxX = startX, minY = startY, maxY = startY;

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const idx = y * width + x;

            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            if (visited[idx] || !mask[idx]) continue;

            visited[idx] = 1;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            // 4-connected neighbors
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    },

    mergeOverlapping(sprites) {
        const merged = [];
        const used = new Set();

        for (let i = 0; i < sprites.length; i++) {
            if (used.has(i)) continue;

            let current = { ...sprites[i] };
            used.add(i);

            for (let j = i + 1; j < sprites.length; j++) {
                if (used.has(j)) continue;

                const other = sprites[j];
                const gap = 2;

                if (current.x - gap <= other.x + other.width &&
                    current.x + current.width + gap >= other.x &&
                    current.y - gap <= other.y + other.height &&
                    current.y + current.height + gap >= other.y) {
                    
                    const newX = Math.min(current.x, other.x);
                    const newY = Math.min(current.y, other.y);
                    current = {
                        x: newX,
                        y: newY,
                        width: Math.max(current.x + current.width, other.x + other.width) - newX,
                        height: Math.max(current.y + current.height, other.y + other.height) - newY
                    };
                    used.add(j);
                }
            }

            merged.push(current);
        }

        return merged;
    },

    detectGrid() {
        const cols = parseInt(document.getElementById('extractor-cols').value) || 4;
        const rows = parseInt(document.getElementById('extractor-rows').value) || 4;

        const cellWidth = Math.floor(this.image.width / cols);
        const cellHeight = Math.floor(this.image.height / rows);

        this.detectedSprites = [];
        let index = 1;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                this.detectedSprites.push({
                    index,
                    x: col * cellWidth,
                    y: row * cellHeight,
                    width: cellWidth,
                    height: cellHeight
                });
                index++;
            }
        }
    },

    startManualSelection() {
        Utils.showToast('Click and drag to create sprites. Click existing sprites to select. Press Delete to remove.', 'info');
    },

    updateSpriteGrid() {
        const grid = document.getElementById('extractor-sprite-grid');

        if (this.detectedSprites.length === 0) {
            grid.innerHTML = '<div class="sprite-list-empty">No sprites detected yet</div>';
            return;
        }

        grid.innerHTML = this.detectedSprites.map((sprite, i) => `
            <div class="sprite-grid-item ${i === this.selectedSprite ? 'selected' : ''}" data-index="${i}">
                <canvas></canvas>
                <span class="sprite-index">${sprite.index || i + 1}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.sprite-grid-item').forEach((item, i) => {
            const sprite = this.detectedSprites[i];
            const canvas = item.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 60;
            canvas.height = 60;

            const scale = Math.min(60 / sprite.width, 60 / sprite.height);
            const w = sprite.width * scale;
            const h = sprite.height * scale;

            ctx.drawImage(
                this.image,
                sprite.x, sprite.y, sprite.width, sprite.height,
                (60 - w) / 2, (60 - h) / 2, w, h
            );

            item.addEventListener('click', () => {
                this.selectedSprite = i;
                this.drawBounds();
                this.updateSpriteGridSelection();
            });

            item.addEventListener('dblclick', () => {
                this.downloadSprite(sprite, i);
            });
        });
    },

    updateSpriteGridSelection() {
        const grid = document.getElementById('extractor-sprite-grid');
        grid.querySelectorAll('.sprite-grid-item').forEach((item, i) => {
            item.classList.toggle('selected', i === this.selectedSprite);
        });
    },

    drawBounds(tempSprite = null) {
        if (!this.boundsContainer || !this.image) return;
        
        // Clear existing bounds
        this.boundsContainer.innerHTML = '';
        
        // Draw detected sprites
        this.detectedSprites.forEach((sprite, i) => {
            const isSelected = i === this.selectedSprite;
            this.createSpriteBound(sprite, i, isSelected);
        });
        
        // Draw temp sprite if creating new one
        if (tempSprite && tempSprite.width > 0 && tempSprite.height > 0) {
            this.createSpriteBound(tempSprite, -1, false, true);
        }
    },

    createSpriteBound(sprite, index, isSelected, isTemp = false) {
        const bound = document.createElement('div');
        bound.className = 'sprite-bound' + (isSelected ? ' selected' : '') + (isTemp ? ' temp' : '');
        bound.dataset.index = index;
        
        const borderColor = isTemp ? '#58a6ff' : (isSelected ? '#3fb950' : '#58a6ff');
        const bgColor = isTemp ? 'rgba(88, 166, 255, 0.2)' : (isSelected ? 'rgba(63, 185, 80, 0.2)' : 'rgba(88, 166, 255, 0.15)');
        
        bound.style.cssText = `
            position: absolute;
            left: ${sprite.x}px;
            top: ${sprite.y}px;
            width: ${sprite.width}px;
            height: ${sprite.height}px;
            background: ${bgColor};
            border: 2px solid ${borderColor};
            box-sizing: border-box;
            cursor: ${isTemp ? 'default' : 'move'};
            pointer-events: ${isTemp ? 'none' : 'auto'};
            ${isTemp ? 'border-style: dashed;' : ''}
        `;
        
        // Add label
        if (!isTemp) {
            const label = document.createElement('div');
            label.className = 'sprite-label';
            label.style.cssText = `
                position: absolute;
                top: -18px;
                left: -2px;
                background: ${borderColor};
                color: #fff;
                font-size: 11px;
                font-weight: bold;
                padding: 1px 4px;
                border-radius: 2px 2px 0 0;
                pointer-events: none;
                white-space: nowrap;
            `;
            label.textContent = sprite.index || index + 1;
            bound.appendChild(label);
        }
        
        // Add resize handles if selected
        if (isSelected && !isTemp) {
            const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
            handles.forEach(pos => {
                const handle = document.createElement('div');
                handle.className = 'sprite-resize-handle';
                handle.dataset.handle = `resize-${pos}`;
                
                let cursor = pos + '-resize';
                if (pos === 'n' || pos === 's') cursor = 'ns-resize';
                if (pos === 'e' || pos === 'w') cursor = 'ew-resize';
                if (pos === 'nw' || pos === 'se') cursor = 'nwse-resize';
                if (pos === 'ne' || pos === 'sw') cursor = 'nesw-resize';
                
                let left = '50%', top = '50%';
                if (pos.includes('w')) { left = '0'; }
                if (pos.includes('e')) { left = '100%'; }
                if (pos.includes('n')) { top = '0'; }
                if (pos.includes('s')) { top = '100%'; }
                if (pos === 'n' || pos === 's') { left = '50%'; }
                if (pos === 'w' || pos === 'e') { top = '50%'; }
                
                handle.style.cssText = `
                    position: absolute;
                    left: ${left};
                    top: ${top};
                    width: 10px;
                    height: 10px;
                    background: #fff;
                    border: 2px solid ${borderColor};
                    border-radius: 2px;
                    transform: translate(-50%, -50%);
                    cursor: ${cursor};
                    pointer-events: auto;
                    z-index: 10;
                `;
                bound.appendChild(handle);
            });
        }
        
        this.boundsContainer.appendChild(bound);
    },

    extractSprite(sprite) {
        const padding = document.getElementById('extractor-padding').checked ? 1 : 0;

        const canvas = document.createElement('canvas');
        canvas.width = sprite.width + padding * 2;
        canvas.height = sprite.height + padding * 2;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            this.image,
            sprite.x, sprite.y, sprite.width, sprite.height,
            padding, padding, sprite.width, sprite.height
        );

        return canvas;
    },

    downloadSprite(sprite, index) {
        const canvas = this.extractSprite(sprite);
        const link = document.createElement('a');
        link.download = `sprite_${index + 1}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    },

    async downloadAll() {
        if (this.detectedSprites.length === 0) {
            Utils.showToast('No sprites to download', 'error');
            return;
        }

        Utils.showLoading('Creating zip file...');

        try {
            const zip = new JSZip();
            const spritesFolder = zip.folder('sprites');
            
            for (let i = 0; i < this.detectedSprites.length; i++) {
                const sprite = this.detectedSprites[i];
                const canvas = this.extractSprite(sprite);
                
                // Convert canvas to blob
                const dataUrl = canvas.toDataURL('image/png');
                const base64Data = dataUrl.split(',')[1];
                
                spritesFolder.file(`sprite_${i + 1}.png`, base64Data, { base64: true });
            }
            
            // Generate and download zip
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'sprites.zip';
            link.click();
            URL.revokeObjectURL(link.href);
            
            Utils.showToast(`Downloaded ${this.detectedSprites.length} sprites as zip!`, 'success');
        } catch (error) {
            console.error('Download error:', error);
            Utils.showToast('Error creating zip file', 'error');
        } finally {
            Utils.hideLoading();
        }
    }
};

// Tool is initialized by App.loadView() when the view is loaded
