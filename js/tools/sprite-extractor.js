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
    overlayCanvas: null,
    canvasWrapper: null,

    init() {
        this.setupUpload();
        this.setupControls();
        this.setupZoom();
        this.setupOverlayCanvas();
    },

    setupOverlayCanvas() {
        // Create overlay canvas for drawing bounds
        const mainCanvas = document.getElementById('extractor-canvas');
        
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.id = 'extractor-overlay-canvas';
        this.overlayCanvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            display: none;
        `;
        
        // Insert after main canvas
        mainCanvas.parentNode.insertBefore(this.overlayCanvas, mainCanvas.nextSibling);
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
                this.updateSpriteGrid();
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

        // Setup overlay canvas
        this.overlayCanvas.width = canvas.width;
        this.overlayCanvas.height = canvas.height;
        this.overlayCanvas.style.display = 'block';

        document.getElementById('extractor-info').innerHTML = `
            <strong>Size:</strong> ${this.image.width} × ${this.image.height} px
        `;

        // Create a wrapper div for both canvases so they transform together
        this.setupCanvasWrapper();

        if (this.zoomController) {
            this.zoomController.resetZoom();
        }
        this.drawBoundsOverlay();
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
                transform-origin: center center;
            `;
            
            // Move canvas into wrapper
            canvas.parentNode.insertBefore(wrapper, canvas);
            wrapper.appendChild(canvas);
            wrapper.appendChild(this.overlayCanvas);
        }
        
        this.canvasWrapper = wrapper;
        
        // Tell zoom controller to use wrapper as content
        if (this.zoomController) {
            this.zoomController.setContent(wrapper);
        }
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

                this.updateSpriteGrid();
                this.drawBoundsOverlay();

                document.getElementById('extractor-count').textContent = this.detectedSprites.length;
                document.getElementById('extractor-download-all').disabled = this.detectedSprites.length === 0;

                if (this.detectedSprites.length > 0) {
                    Utils.showToast(`Detected ${this.detectedSprites.length} sprites!`, 'success');
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
        Utils.showToast('Click and drag on the image to select sprites', 'info');
        this.setupManualDrawing();
    },

    setupManualDrawing() {
        const canvas = document.getElementById('extractor-canvas');
        let isDrawing = false;
        let startX, startY;
        let tempRect = null;

        const getCanvasCoords = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        canvas.style.cursor = 'crosshair';
        canvas.style.pointerEvents = 'auto';

        canvas.onmousedown = (e) => {
            if (document.getElementById('extractor-mode').value !== 'manual') return;
            
            isDrawing = true;
            const coords = getCanvasCoords(e);
            startX = coords.x;
            startY = coords.y;
            tempRect = { x: startX, y: startY, width: 0, height: 0 };
        };

        canvas.onmousemove = (e) => {
            if (!isDrawing || !tempRect) return;
            
            const coords = getCanvasCoords(e);
            tempRect.x = Math.min(startX, coords.x);
            tempRect.y = Math.min(startY, coords.y);
            tempRect.width = Math.abs(coords.x - startX);
            tempRect.height = Math.abs(coords.y - startY);
            
            this.drawBoundsOverlay(tempRect);
        };

        canvas.onmouseup = () => {
            if (!isDrawing || !tempRect) return;
            isDrawing = false;

            if (tempRect.width > 5 && tempRect.height > 5) {
                this.detectedSprites.push({
                    index: this.detectedSprites.length + 1,
                    x: Math.round(tempRect.x),
                    y: Math.round(tempRect.y),
                    width: Math.round(tempRect.width),
                    height: Math.round(tempRect.height)
                });
                this.updateSpriteGrid();
                document.getElementById('extractor-count').textContent = this.detectedSprites.length;
                document.getElementById('extractor-download-all').disabled = false;
            }

            tempRect = null;
            this.drawBoundsOverlay();
        };
    },

    updateSpriteGrid() {
        const grid = document.getElementById('extractor-sprite-grid');

        if (this.detectedSprites.length === 0) {
            grid.innerHTML = '<div class="sprite-list-empty">No sprites detected yet</div>';
            return;
        }

        grid.innerHTML = this.detectedSprites.map((sprite, i) => `
            <div class="sprite-grid-item" data-index="${i}">
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
                grid.querySelectorAll('.sprite-grid-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedSprite = i;
                this.drawBoundsOverlay();
            });

            item.addEventListener('dblclick', () => {
                this.downloadSprite(sprite, i);
            });
        });
    },

    drawBoundsOverlay(tempRect = null) {
        if (!this.overlayCanvas || !this.image) return;
        
        const ctx = this.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw detected sprites
        this.detectedSprites.forEach((sprite, i) => {
            const isSelected = i === this.selectedSprite;
            
            // Fill
            ctx.fillStyle = isSelected ? 'rgba(63, 185, 80, 0.2)' : 'rgba(88, 166, 255, 0.15)';
            ctx.fillRect(sprite.x, sprite.y, sprite.width, sprite.height);
            
            // Border
            ctx.strokeStyle = isSelected ? '#3fb950' : '#58a6ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(sprite.x, sprite.y, sprite.width, sprite.height);
            
            // Label
            ctx.fillStyle = isSelected ? '#3fb950' : '#58a6ff';
            ctx.font = 'bold 12px sans-serif';
            const label = String(sprite.index || i + 1);
            const labelWidth = ctx.measureText(label).width + 6;
            ctx.fillRect(sprite.x, sprite.y - 16, labelWidth, 16);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, sprite.x + 3, sprite.y - 4);
        });
        
        // Draw temp rect if in manual mode
        if (tempRect && tempRect.width > 0 && tempRect.height > 0) {
            ctx.fillStyle = 'rgba(88, 166, 255, 0.2)';
            ctx.fillRect(tempRect.x, tempRect.y, tempRect.width, tempRect.height);
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(tempRect.x, tempRect.y, tempRect.width, tempRect.height);
            ctx.setLineDash([]);
        }
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

        Utils.showLoading('Downloading sprites...');

        try {
            for (let i = 0; i < this.detectedSprites.length; i++) {
                const sprite = this.detectedSprites[i];
                const canvas = this.extractSprite(sprite);
                const link = document.createElement('a');
                link.download = `sprite_${i + 1}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                await new Promise(r => setTimeout(r, 100));
            }
            Utils.showToast(`Downloaded ${this.detectedSprites.length} sprites!`, 'success');
        } catch (error) {
            console.error('Download error:', error);
            Utils.showToast('Error downloading sprites', 'error');
        } finally {
            Utils.hideLoading();
        }
    }
};

// Tool is initialized by App.loadView() when the view is loaded
