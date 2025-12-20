/**
 * Texture Atlas Packer Tool
 * Combines multiple sprites into a single texture atlas
 */

const AtlasPacker = {
    sprites: [],
    result: null,
    atlasData: null,
    zoomController: null,

    init() {
        this.setupUpload();
        this.setupControls();
        this.setupZoom();
    },

    setupUpload() {
        const uploadArea = document.getElementById('atlas-upload');
        const input = document.getElementById('atlas-input');

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
            if (e.dataTransfer.files.length > 0) {
                this.loadImages(Array.from(e.dataTransfer.files));
            }
        });

        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadImages(Array.from(e.target.files));
            }
        });
    },

    loadImages(files) {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.sprites.push({
                        id: Date.now() + Math.random(),
                        name: file.name,
                        image: img,
                        width: img.width,
                        height: img.height,
                        scale: 1
                    });
                    this.updateSpriteList();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    updateSpriteList() {
        const list = document.getElementById('atlas-sprite-list');
        const count = document.getElementById('atlas-count');
        count.textContent = this.sprites.length;

        if (this.sprites.length === 0) {
            list.innerHTML = '<div class="sprite-list-empty">No sprites added yet</div>';
            return;
        }

        list.innerHTML = this.sprites.map((sprite, index) => `
            <div class="sprite-list-item" data-id="${sprite.id}">
                <canvas width="32" height="32"></canvas>
                <span class="sprite-name" title="${sprite.name}">${sprite.name}</span>
                <span class="sprite-size">${sprite.width}×${sprite.height}</span>
                <input type="number" class="sprite-scale" value="${sprite.scale}" min="0.1" max="4" step="0.1" title="Weight (1 = normal)">
                <button class="btn-remove" title="Remove"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        // Draw thumbnails
        list.querySelectorAll('.sprite-list-item').forEach((item, index) => {
            const canvas = item.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            const sprite = this.sprites[index];
            
            // Clear and draw thumbnail
            ctx.clearRect(0, 0, 32, 32);
            const scale = Math.min(32 / sprite.width, 32 / sprite.height);
            const w = sprite.width * scale;
            const h = sprite.height * scale;
            ctx.drawImage(sprite.image, (32 - w) / 2, (32 - h) / 2, w, h);

            // Scale input
            item.querySelector('.sprite-scale').addEventListener('change', (e) => {
                sprite.scale = parseFloat(e.target.value) || 1;
            });

            // Remove button
            item.querySelector('.btn-remove').addEventListener('click', () => {
                this.sprites = this.sprites.filter(s => s.id !== sprite.id);
                this.updateSpriteList();
            });
        });
    },

    setupControls() {
        const modeSelect = document.getElementById('atlas-mode');
        const gridOptions = document.getElementById('atlas-grid-options');
        const paddingSlider = document.getElementById('atlas-padding');
        const paddingValue = document.getElementById('atlas-padding-value');

        modeSelect.addEventListener('change', () => {
            gridOptions.style.display = modeSelect.value === 'grid' ? 'block' : 'none';
        });

        paddingSlider.addEventListener('input', () => {
            paddingValue.textContent = paddingSlider.value;
        });

        document.getElementById('atlas-pack').addEventListener('click', () => this.pack());
        document.getElementById('atlas-download').addEventListener('click', () => this.downloadAtlas());
        document.getElementById('atlas-download-json').addEventListener('click', () => this.downloadJSON());
    },

    setupZoom() {
        this.zoomController = Utils.createZoomController('atlas-preview');
    },

    pack() {
        if (this.sprites.length === 0) {
            Utils.showToast('Please add some sprites first', 'error');
            return;
        }

        Utils.showLoading('Packing atlas...');

        setTimeout(() => {
            try {
                const mode = document.getElementById('atlas-mode').value;
                const maxSize = parseInt(document.getElementById('atlas-max-size').value);
                const padding = parseInt(document.getElementById('atlas-padding').value);
                const powerOfTwo = document.getElementById('atlas-power-of-two').checked;
                const trim = document.getElementById('atlas-trim').checked;
                const uniformSize = document.getElementById('atlas-uniform-size').checked;

                // First pass: get base dimensions (with trim if enabled)
                const baseSprites = this.sprites.map(sprite => {
                    let trimData = { x: 0, y: 0, width: sprite.width, height: sprite.height };
                    if (trim) {
                        trimData = this.getTrimBounds(sprite.image);
                    }
                    return {
                        ...sprite,
                        trimData,
                        baseWidth: trimData.width,
                        baseHeight: trimData.height
                    };
                });

                // Calculate weighted dimensions
                let preparedSprites;
                if (uniformSize) {
                    // All sprites get the same base size, modified by their weight
                    // Find average size as reference
                    const avgSize = baseSprites.reduce((sum, s) => sum + Math.max(s.baseWidth, s.baseHeight), 0) / baseSprites.length;
                    
                    preparedSprites = baseSprites.map(sprite => {
                        // Scale to make all sprites same size, then apply weight
                        const maxDim = Math.max(sprite.baseWidth, sprite.baseHeight);
                        const uniformScale = (avgSize / maxDim) * sprite.scale;
                        return {
                            ...sprite,
                            scaledWidth: Math.round(sprite.baseWidth * uniformScale),
                            scaledHeight: Math.round(sprite.baseHeight * uniformScale)
                        };
                    });
                } else {
                    // Preserve original size ratios, just apply weight
                    preparedSprites = baseSprites.map(sprite => ({
                        ...sprite,
                        scaledWidth: Math.round(sprite.baseWidth * sprite.scale),
                        scaledHeight: Math.round(sprite.baseHeight * sprite.scale)
                    }));
                }

                // Pack with unlimited size first to get natural dimensions
                let result;
                const unlimitedSize = 16384; // Large enough for initial packing
                switch (mode) {
                    case 'grid':
                        result = this.packGrid(preparedSprites, padding, unlimitedSize);
                        break;
                    case 'horizontal':
                        result = this.packStrip(preparedSprites, padding, unlimitedSize, 'horizontal');
                        break;
                    case 'vertical':
                        result = this.packStrip(preparedSprites, padding, unlimitedSize, 'vertical');
                        break;
                    case 'auto':
                    default:
                        result = this.packBin(preparedSprites, padding, unlimitedSize);
                        break;
                }

                let { width, height, placements } = result;

                // Calculate scale factor needed to fit within maxSize
                const scaleX = width > maxSize ? maxSize / width : 1;
                const scaleY = height > maxSize ? maxSize / height : 1;
                const fitScale = Math.min(scaleX, scaleY);

                // Apply fit scale to all placements and dimensions
                if (fitScale < 1) {
                    placements = placements.map(p => ({
                        ...p,
                        x: Math.round(p.x * fitScale),
                        y: Math.round(p.y * fitScale),
                        width: Math.round(p.width * fitScale),
                        height: Math.round(p.height * fitScale)
                    }));
                    width = Math.round(width * fitScale);
                    height = Math.round(height * fitScale);
                    
                    // Update preparedSprites for drawing
                    preparedSprites = preparedSprites.map(s => ({
                        ...s,
                        scaledWidth: Math.round(s.scaledWidth * fitScale),
                        scaledHeight: Math.round(s.scaledHeight * fitScale)
                    }));
                }

                // Adjust to power of 2 if needed
                if (powerOfTwo) {
                    width = this.nextPowerOfTwo(width);
                    height = this.nextPowerOfTwo(height);
                }

                // Create atlas canvas
                const canvas = document.getElementById('atlas-canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, width, height);

                // Draw sprites
                placements.forEach(p => {
                    const sprite = preparedSprites.find(s => s.id === p.id);
                    if (sprite) {
                        ctx.drawImage(
                            sprite.image,
                            sprite.trimData.x, sprite.trimData.y,
                            sprite.trimData.width, sprite.trimData.height,
                            p.x, p.y,
                            p.width, p.height
                        );
                    }
                });

                // Store result
                this.result = canvas;
                this.atlasData = {
                    width,
                    height,
                    sprites: placements.map(p => {
                        const sprite = preparedSprites.find(s => s.id === p.id);
                        return {
                            name: sprite.name,
                            x: p.x,
                            y: p.y,
                            width: p.width,
                            height: p.height,
                            originalWidth: sprite.width,
                            originalHeight: sprite.height
                        };
                    })
                };

                // Show result
                canvas.style.display = 'block';
                const placeholder = document.querySelector('#atlas-preview .preview-placeholder');
                if (placeholder) placeholder.style.display = 'none';

                let infoHtml = `<strong>Atlas:</strong> ${width} × ${height} px | <strong>Sprites:</strong> ${placements.length}`;
                if (fitScale < 1) {
                    infoHtml += ` | <strong>Scaled:</strong> ${Math.round(fitScale * 100)}%`;
                }
                document.getElementById('atlas-info').innerHTML = infoHtml;

                document.getElementById('atlas-download').disabled = false;
                document.getElementById('atlas-download-json').disabled = false;

                if (this.zoomController) {
                    this.zoomController.setContent(canvas);
                    this.zoomController.resetZoom();
                }
                Utils.showToast('Atlas packed successfully!', 'success');
            } catch (error) {
                console.error('Packing error:', error);
                Utils.showToast('Error packing atlas: ' + error.message, 'error');
            } finally {
                Utils.hideLoading();
            }
        }, 50);
    },

    getTrimBounds(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;

        let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
        
        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const alpha = data[(y * img.width + x) * 4 + 3];
                if (alpha > 0) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (minX > maxX || minY > maxY) {
            return { x: 0, y: 0, width: img.width, height: img.height };
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    },

    packGrid(sprites, padding, maxSize) {
        const columns = parseInt(document.getElementById('atlas-columns').value) || 4;
        const rows = Math.ceil(sprites.length / columns);

        // Find max cell size
        let maxW = 0, maxH = 0;
        sprites.forEach(s => {
            maxW = Math.max(maxW, s.scaledWidth);
            maxH = Math.max(maxH, s.scaledHeight);
        });

        const cellW = maxW + padding * 2;
        const cellH = maxH + padding * 2;
        const width = columns * cellW;
        const height = rows * cellH;

        const placements = sprites.map((sprite, i) => {
            const col = i % columns;
            const row = Math.floor(i / columns);
            return {
                id: sprite.id,
                x: col * cellW + padding + (maxW - sprite.scaledWidth) / 2,
                y: row * cellH + padding + (maxH - sprite.scaledHeight) / 2,
                width: sprite.scaledWidth,
                height: sprite.scaledHeight
            };
        });

        return { width, height, placements };
    },

    packStrip(sprites, padding, maxSize, direction) {
        let x = padding, y = padding;
        let maxCross = 0;
        const placements = [];

        sprites.forEach(sprite => {
            if (direction === 'horizontal') {
                placements.push({
                    id: sprite.id,
                    x,
                    y: padding,
                    width: sprite.scaledWidth,
                    height: sprite.scaledHeight
                });
                x += sprite.scaledWidth + padding;
                maxCross = Math.max(maxCross, sprite.scaledHeight);
            } else {
                placements.push({
                    id: sprite.id,
                    x: padding,
                    y,
                    width: sprite.scaledWidth,
                    height: sprite.scaledHeight
                });
                y += sprite.scaledHeight + padding;
                maxCross = Math.max(maxCross, sprite.scaledWidth);
            }
        });

        const width = direction === 'horizontal' ? x : maxCross + padding * 2;
        const height = direction === 'horizontal' ? maxCross + padding * 2 : y;

        return { width, height, placements };
    },

    packBin(sprites, padding, maxSize) {
        // Sort by height (tallest first for better packing)
        const sorted = [...sprites].sort((a, b) => b.scaledHeight - a.scaledHeight);

        // Simple shelf algorithm
        const placements = [];
        let shelfY = padding;
        let shelfHeight = 0;
        let x = padding;
        let maxWidth = 0;

        sorted.forEach(sprite => {
            const w = sprite.scaledWidth + padding;
            const h = sprite.scaledHeight + padding;

            // Check if sprite fits on current shelf
            if (x + w > maxSize) {
                // Move to next shelf
                shelfY += shelfHeight;
                shelfHeight = 0;
                x = padding;
            }

            placements.push({
                id: sprite.id,
                x,
                y: shelfY,
                width: sprite.scaledWidth,
                height: sprite.scaledHeight
            });

            x += w;
            maxWidth = Math.max(maxWidth, x);
            shelfHeight = Math.max(shelfHeight, h);
        });

        const width = maxWidth;
        const height = shelfY + shelfHeight;

        return { width, height, placements };
    },

    nextPowerOfTwo(n) {
        let power = 1;
        while (power < n) power *= 2;
        return power;
    },

    downloadAtlas() {
        if (!this.result) {
            Utils.showToast('No atlas to download', 'error');
            return;
        }

        const link = document.createElement('a');
        link.download = `atlas_${Date.now()}.png`;
        link.href = this.result.toDataURL('image/png');
        link.click();
        Utils.showToast('Atlas downloaded!', 'success');
    },

    downloadJSON() {
        if (!this.atlasData) {
            Utils.showToast('No atlas data to download', 'error');
            return;
        }

        const json = JSON.stringify(this.atlasData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `atlas_${Date.now()}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
        Utils.showToast('JSON data downloaded!', 'success');
    }
};

// Tool is initialized by App.loadView() when the view is loaded
