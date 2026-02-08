/**
 * Indie Dev Toys - Texture Library Tool
 * Upload, catalog, and manage textures with resolution and aspect ratio metadata
 */

const TextureLibrary = {
    textures: [],          // { id, name, originalImage, processedCanvas, width, height, ratio }
    selectedId: null,
    currentPreview: 'library',
    zoomController: null,
    nextId: 1,

    /**
     * Initialize the tool
     */
    init() {
        this.setupEventListeners();
        this.setupSliders();
        this.setupZoom();
    },

    /**
     * Setup zoom controller for detail view
     */
    setupZoom() {
        this.zoomController = Utils.createZoomController('texlib-preview');
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // File upload (supports multiple)
        const uploadEl = document.getElementById('texlib-upload');
        const fileInput = document.getElementById('texlib-file-input');

        Utils.setupFileUpload(uploadEl, fileInput, (file) => this.loadImage(file));

        // Also handle multiple files via the native input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 1) {
                // First file handled by setupFileUpload, load the rest
                files.slice(1).forEach(f => this.loadImage(f));
            }
        });

        // Drop multiple files
        uploadEl.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 1) {
                files.slice(1).forEach(f => this.loadImage(f));
            }
        });

        // Resolution selector
        document.getElementById('texlib-resolution').addEventListener('change', (e) => {
            const customGroup = document.getElementById('texlib-custom-res-group');
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // Ratio selector
        document.getElementById('texlib-ratio').addEventListener('change', (e) => {
            const customGroup = document.getElementById('texlib-custom-ratio-group');
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // Format change (show/hide quality slider)
        document.getElementById('texlib-format').addEventListener('change', (e) => {
            const qualityGroup = document.getElementById('texlib-quality-group');
            qualityGroup.style.display = e.target.value === 'png' ? 'none' : 'block';
        });

        // Process button
        document.getElementById('texlib-process').addEventListener('click', () => this.processAll());

        // Download all button
        document.getElementById('texlib-download-all').addEventListener('click', () => this.downloadAll());

        // Clear all
        document.getElementById('texlib-clear-all').addEventListener('click', () => this.clearAll());

        // Preview tabs
        document.querySelectorAll('#texture-library .preview-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPreview(e.target.dataset.preview);
            });
        });
    },

    /**
     * Setup range sliders
     */
    setupSliders() {
        Utils.setupRangeSlider('texlib-quality', 'texlib-quality-value');
    },

    // ─── Image Loading ─────────────────────────────────────────

    /**
     * Load a single image file into the library
     */
    async loadImage(file) {
        try {
            const img = await Utils.loadImageFromFile(file);

            const entry = {
                id: this.nextId++,
                name: file.name.replace(/\.[^/.]+$/, ''),
                originalImage: img,
                processedCanvas: null,
                width: img.width,
                height: img.height,
                ratio: this.computeRatio(img.width, img.height)
            };

            this.textures.push(entry);
            this.updateUI();
            Utils.showToast(`Added "${entry.name}"`, 'success');
        } catch (err) {
            Utils.showToast(err.message, 'error');
        }
    },

    // ─── Processing ────────────────────────────────────────────

    /**
     * Process all textures with the current resolution / ratio settings
     */
    async processAll() {
        if (this.textures.length === 0) {
            Utils.showToast('Upload textures first', 'warning');
            return;
        }

        Utils.showLoading('Processing textures...');

        const { width: targetW, height: targetH } = this.getTargetSize();
        const method = document.getElementById('texlib-resize-method').value;

        try {
            for (const tex of this.textures) {
                tex.processedCanvas = this.resizeImage(tex.originalImage, targetW, targetH, method, tex);
                tex.width = tex.processedCanvas.width;
                tex.height = tex.processedCanvas.height;
                tex.ratio = this.computeRatio(tex.width, tex.height);
            }

            this.updateUI();
            document.getElementById('texlib-download-all').disabled = false;
            Utils.hideLoading();
            Utils.showToast(`Processed ${this.textures.length} texture(s)`, 'success');
        } catch (err) {
            Utils.hideLoading();
            Utils.showToast(err.message, 'error');
        }
    },

    /**
     * Resize an image to the target dimensions with the chosen method
     */
    resizeImage(img, targetW, targetH, method, tex) {
        // If "Keep Original" for resolution, use the image's own dimensions
        if (targetW === 0 || targetH === 0) {
            targetW = img.width;
            targetH = img.height;

            // Still apply aspect ratio if not "free"
            const ratio = this.getTargetRatio();
            if (ratio) {
                const adjusted = this.applyRatio(targetW, targetH, ratio, method);
                targetW = adjusted.w;
                targetH = adjusted.h;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        if (method === 'stretch') {
            ctx.drawImage(img, 0, 0, targetW, targetH);
        } else if (method === 'contain') {
            // Letterbox – fill background with transparent
            ctx.clearRect(0, 0, targetW, targetH);
            const scale = Math.min(targetW / img.width, targetH / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const offX = (targetW - drawW) / 2;
            const offY = (targetH - drawH) / 2;
            ctx.drawImage(img, offX, offY, drawW, drawH);
        } else {
            // Cover – crop to fit
            const scale = Math.max(targetW / img.width, targetH / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const offX = (targetW - drawW) / 2;
            const offY = (targetH - drawH) / 2;
            ctx.drawImage(img, offX, offY, drawW, drawH);
        }

        return canvas;
    },

    // ─── Size & Ratio helpers ──────────────────────────────────

    /**
     * Determine the target pixel size from the UI selectors
     */
    getTargetSize() {
        const sel = document.getElementById('texlib-resolution').value;

        if (sel === 'original') return { width: 0, height: 0 };

        if (sel === 'custom') {
            const w = parseInt(document.getElementById('texlib-custom-width').value, 10) || 1024;
            const h = parseInt(document.getElementById('texlib-custom-height').value, 10) || 1024;
            return { width: w, height: h };
        }

        const size = parseInt(sel, 10);

        // Apply aspect ratio to square base
        const ratio = this.getTargetRatio();
        if (ratio) {
            if (ratio.w >= ratio.h) {
                return { width: size, height: Math.round(size * ratio.h / ratio.w) };
            } else {
                return { width: Math.round(size * ratio.w / ratio.h), height: size };
            }
        }
        return { width: size, height: size };
    },

    /**
     * Parse the chosen aspect ratio (or null for free)
     */
    getTargetRatio() {
        const sel = document.getElementById('texlib-ratio').value;
        if (sel === 'free') return null;
        if (sel === 'custom') {
            const w = parseInt(document.getElementById('texlib-ratio-w').value, 10) || 1;
            const h = parseInt(document.getElementById('texlib-ratio-h').value, 10) || 1;
            return { w, h };
        }
        const [w, h] = sel.split(':').map(Number);
        return { w, h };
    },

    /**
     * Adjust width/height to match a given ratio while staying within bounds
     */
    applyRatio(w, h, ratio, method) {
        const targetAspect = ratio.w / ratio.h;
        if (method === 'contain') {
            if (w / h > targetAspect) {
                return { w: Math.round(h * targetAspect), h };
            } else {
                return { w, h: Math.round(w / targetAspect) };
            }
        }
        // cover / stretch
        if (w / h > targetAspect) {
            return { w, h: Math.round(w / targetAspect) };
        } else {
            return { w: Math.round(h * targetAspect), h };
        }
    },

    /**
     * Compute a simplified ratio string like "1 : 1" or "16 : 9"
     */
    computeRatio(w, h) {
        const gcd = this.gcd(w, h);
        const rw = w / gcd;
        const rh = h / gcd;
        // If the numbers are very large, just show w × h 
        if (rw > 64 || rh > 64) return `${w} × ${h}`;
        return `${rw} : ${rh}`;
    },

    gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b) { [a, b] = [b, a % b]; }
        return a;
    },

    // ─── Download ──────────────────────────────────────────────

    /**
     * Download all processed textures as a ZIP (uses JSZip already loaded)
     */
    async downloadAll() {
        if (this.textures.length === 0) return;

        Utils.showLoading('Packing ZIP...');
        const format = document.getElementById('texlib-format').value;
        const quality = parseInt(document.getElementById('texlib-quality').value, 10) / 100;
        const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';

        try {
            const zip = new JSZip();

            for (const tex of this.textures) {
                const canvas = tex.processedCanvas || Utils.imageToCanvas(tex.originalImage);
                const dataUrl = canvas.toDataURL(mimeType, quality);
                const base64 = dataUrl.split(',')[1];
                zip.file(`${tex.name}.${format}`, base64, { base64: true });
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'textures.zip';
            link.click();
            URL.revokeObjectURL(link.href);

            Utils.hideLoading();
            Utils.showToast('ZIP downloaded', 'success');
        } catch (err) {
            Utils.hideLoading();
            Utils.showToast('Failed to create ZIP', 'error');
        }
    },

    /**
     * Download a single texture
     */
    downloadSingle(id) {
        const tex = this.textures.find(t => t.id === id);
        if (!tex) return;

        const format = document.getElementById('texlib-format').value;
        const quality = parseInt(document.getElementById('texlib-quality').value, 10) / 100;
        const canvas = tex.processedCanvas || Utils.imageToCanvas(tex.originalImage);

        Utils.downloadCanvas(canvas, tex.name, format, quality);
        Utils.showToast(`Downloaded "${tex.name}"`, 'success');
    },

    // ─── Library Management ────────────────────────────────────

    /**
     * Remove a single texture
     */
    removeTexture(id) {
        this.textures = this.textures.filter(t => t.id !== id);
        if (this.selectedId === id) this.selectedId = null;
        this.updateUI();
    },

    /**
     * Clear entire library
     */
    clearAll() {
        this.textures = [];
        this.selectedId = null;
        this.nextId = 1;
        document.getElementById('texlib-download-all').disabled = true;
        document.getElementById('texlib-clear-all').disabled = true;
        this.updateUI();
        Utils.showToast('Library cleared', 'success');
    },

    // ─── UI / Rendering ────────────────────────────────────────

    /**
     * Full UI refresh
     */
    updateUI() {
        this.renderGrid();
        this.updateInfo();
        this.updateButtons();

        if (this.currentPreview === 'selected' && this.selectedId) {
            this.showDetail(this.selectedId);
        }
    },

    /**
     * Render the texture grid
     */
    renderGrid() {
        const grid = document.getElementById('texlib-grid');
        const placeholder = document.getElementById('texlib-placeholder');

        if (this.textures.length === 0) {
            grid.style.display = 'none';
            placeholder.style.display = '';
            return;
        }

        placeholder.style.display = 'none';
        grid.style.display = 'grid';
        grid.innerHTML = '';

        for (const tex of this.textures) {
            const card = document.createElement('div');
            card.className = 'texlib-card' + (tex.id === this.selectedId ? ' selected' : '');
            card.dataset.id = tex.id;

            // Thumbnail canvas
            const thumb = document.createElement('canvas');
            thumb.className = 'texlib-thumb';
            const src = tex.processedCanvas || Utils.imageToCanvas(tex.originalImage);
            thumb.width = 128;
            thumb.height = 128;
            const tctx = thumb.getContext('2d');
            const scale = Math.min(128 / src.width, 128 / src.height);
            const dw = src.width * scale;
            const dh = src.height * scale;
            tctx.drawImage(src, (128 - dw) / 2, (128 - dh) / 2, dw, dh);

            const info = document.createElement('div');
            info.className = 'texlib-card-info';
            info.innerHTML = `
                <span class="texlib-card-name" title="${tex.name}">${tex.name}</span>
                <span class="texlib-card-meta">${tex.width} × ${tex.height}  ·  ${tex.ratio}</span>
            `;

            const actions = document.createElement('div');
            actions.className = 'texlib-card-actions';

            const dlBtn = document.createElement('button');
            dlBtn.className = 'btn btn-small btn-secondary';
            dlBtn.innerHTML = '<i class="fas fa-download"></i>';
            dlBtn.title = 'Download';
            dlBtn.addEventListener('click', (e) => { e.stopPropagation(); this.downloadSingle(tex.id); });

            const rmBtn = document.createElement('button');
            rmBtn.className = 'btn btn-small btn-secondary';
            rmBtn.innerHTML = '<i class="fas fa-times"></i>';
            rmBtn.title = 'Remove';
            rmBtn.addEventListener('click', (e) => { e.stopPropagation(); this.removeTexture(tex.id); });

            actions.appendChild(dlBtn);
            actions.appendChild(rmBtn);

            card.appendChild(thumb);
            card.appendChild(info);
            card.appendChild(actions);

            card.addEventListener('click', () => {
                this.selectedId = tex.id;
                this.switchPreview('selected');
            });

            grid.appendChild(card);
        }
    },

    /**
     * Show a single texture in the detail pane
     */
    showDetail(id) {
        const tex = this.textures.find(t => t.id === id);
        if (!tex) return;

        const detail = document.getElementById('texlib-detail');
        const grid = document.getElementById('texlib-grid');
        const placeholder = document.getElementById('texlib-placeholder');
        const canvas = document.getElementById('texlib-canvas');

        const src = tex.processedCanvas || Utils.imageToCanvas(tex.originalImage);
        canvas.width = src.width;
        canvas.height = src.height;
        canvas.getContext('2d').drawImage(src, 0, 0);

        placeholder.style.display = 'none';
        grid.style.display = 'none';
        detail.style.display = 'flex';

        if (this.zoomController) {
            this.zoomController.setContent(canvas);
        }

        this.updateInfo(tex);
    },

    /**
     * Switch preview tab
     */
    switchPreview(preview) {
        this.currentPreview = preview;

        // Update tabs
        document.querySelectorAll('#texture-library .preview-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.preview === preview);
        });

        const detail = document.getElementById('texlib-detail');
        const grid = document.getElementById('texlib-grid');
        const placeholder = document.getElementById('texlib-placeholder');

        if (preview === 'library') {
            detail.style.display = 'none';
            if (this.textures.length > 0) {
                grid.style.display = 'grid';
                placeholder.style.display = 'none';
            } else {
                grid.style.display = 'none';
                placeholder.style.display = '';
            }
            this.updateInfo();
        } else if (preview === 'selected') {
            if (this.selectedId) {
                this.showDetail(this.selectedId);
            } else {
                Utils.showToast('Select a texture first', 'warning');
                this.switchPreview('library');
            }
        }
    },

    /**
     * Update the bottom info bar
     */
    updateInfo(tex) {
        const el = document.getElementById('texlib-info');
        if (tex) {
            el.textContent = `${tex.name}  —  ${tex.width} × ${tex.height}px  ·  Ratio ${tex.ratio}` +
                (tex.processedCanvas ? '  ·  Processed' : '  ·  Original');
        } else {
            el.textContent = `${this.textures.length} texture(s) in library`;
        }
    },

    /**
     * Enable / disable action buttons
     */
    updateButtons() {
        const hasTextures = this.textures.length > 0;
        document.getElementById('texlib-clear-all').disabled = !hasTextures;

        const anyProcessed = this.textures.some(t => t.processedCanvas);
        document.getElementById('texlib-download-all').disabled = !hasTextures;
    }
};
