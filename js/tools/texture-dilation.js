/**
 * Indie Dev Toys - Texture Dilation Tool
 * Expand edge pixels to avoid seam artifacts
 */

const TextureDilationTool = {
    originalImage: null,
    originalImageData: null,
    resultImageData: null,
    currentPreview: 'original',
    hasProcessed: false,
    zoomController: null,

    /**
     * Initialize the tool
     */
    init() {
        this.setupEventListeners();
        this.setupSliders();
        this.setupZoom();
    },

    /**
     * Setup zoom controller
     */
    setupZoom() {
        this.zoomController = Utils.createZoomController('dilation-preview');
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // File upload
        const uploadEl = document.getElementById('dilation-upload');
        const fileInput = document.getElementById('dilation-file-input');
        
        Utils.setupFileUpload(uploadEl, fileInput, (file) => this.loadImage(file));

        // Process button
        document.getElementById('dilation-process').addEventListener('click', () => {
            this.processImage();
        });

        // Download button
        document.getElementById('dilation-download').addEventListener('click', () => {
            this.downloadResult();
        });

        // Preview tabs
        document.querySelectorAll('#texture-dilation .preview-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPreview(e.target.dataset.preview);
            });
        });
    },

    /**
     * Setup range sliders
     */
    setupSliders() {
        Utils.setupRangeSlider('dilation-radius', 'dilation-radius-value');
        Utils.setupRangeSlider('dilation-iterations', 'dilation-iterations-value');
        Utils.setupRangeSlider('dilation-threshold', 'dilation-threshold-value');
    },

    /**
     * Load image from file
     */
    async loadImage(file) {
        try {
            Utils.showLoading('Loading image...');
            
            this.originalImage = await Utils.loadImageFromFile(file);
            
            // Create canvas and get image data
            const canvas = Utils.imageToCanvas(this.originalImage);
            this.originalImageData = Utils.getImageData(canvas);
            
            // Reset result
            this.resultImageData = null;
            this.hasProcessed = false;
            
            // Show original in preview
            this.showOriginal();
            
            // Check for transparency
            const hasTransparency = this.checkTransparency();
            
            // Update info
            this.updateInfo(
                `${this.originalImage.width} × ${this.originalImage.height}px | ` +
                `Transparency: ${hasTransparency ? 'Yes' : 'No'}`
            );
            
            if (!hasTransparency) {
                Utils.showToast('Warning: Image has no transparent pixels', 'warning');
            }
            
            Utils.hideLoading();
            Utils.showToast('Image loaded successfully', 'success');
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast(error.message, 'error');
        }
    },

    /**
     * Check if image has transparency
     */
    checkTransparency() {
        for (let i = 3; i < this.originalImageData.data.length; i += 4) {
            if (this.originalImageData.data[i] < 255) {
                return true;
            }
        }
        return false;
    },

    /**
     * Show original image in preview
     */
    showOriginal() {
        const canvas = document.getElementById('dilation-canvas');
        const placeholder = document.querySelector('#dilation-preview .preview-placeholder');
        const comparison = document.getElementById('dilation-comparison');
        
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.originalImage, 0, 0);
        
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        comparison.style.display = 'none';
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas);
        }
        
        this.currentPreview = 'original';
        this.updatePreviewTabs();
    },

    /**
     * Show result image in preview
     */
    showResult() {
        if (!this.resultImageData) {
            Utils.showToast('Process an image first', 'warning');
            return;
        }
        
        const canvas = document.getElementById('dilation-canvas');
        const comparison = document.getElementById('dilation-comparison');
        
        canvas.width = this.resultImageData.width;
        canvas.height = this.resultImageData.height;
        Utils.putImageData(canvas, this.resultImageData);
        
        canvas.style.display = 'block';
        comparison.style.display = 'none';
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas);
        }
        
        this.currentPreview = 'result';
        this.updatePreviewTabs();
    },

    /**
     * Show side by side comparison
     */
    showComparison() {
        if (!this.resultImageData) {
            Utils.showToast('Process an image first', 'warning');
            return;
        }
        
        const canvas = document.getElementById('dilation-canvas');
        const comparison = document.getElementById('dilation-comparison');
        
        // Create comparison view
        comparison.innerHTML = '';
        
        // Original canvas
        const origCanvas = document.createElement('canvas');
        origCanvas.width = this.originalImageData.width;
        origCanvas.height = this.originalImageData.height;
        Utils.putImageData(origCanvas, this.originalImageData);
        
        const origContainer = document.createElement('div');
        origContainer.innerHTML = '<div style="text-align: center; margin-bottom: 8px; color: var(--text-secondary);">Original</div>';
        origContainer.appendChild(origCanvas);
        
        // Result canvas
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = this.resultImageData.width;
        resultCanvas.height = this.resultImageData.height;
        Utils.putImageData(resultCanvas, this.resultImageData);
        
        const resultContainer = document.createElement('div');
        resultContainer.innerHTML = '<div style="text-align: center; margin-bottom: 8px; color: var(--text-secondary);">Dilated</div>';
        resultContainer.appendChild(resultCanvas);
        
        comparison.appendChild(origContainer);
        comparison.appendChild(resultContainer);
        
        canvas.style.display = 'none';
        comparison.style.display = 'grid';
        
        this.currentPreview = 'comparison';
        this.updatePreviewTabs();
    },

    /**
     * Switch preview tab
     */
    switchPreview(preview) {
        switch (preview) {
            case 'original':
                this.showOriginal();
                break;
            case 'result':
                this.showResult();
                break;
            case 'comparison':
                this.showComparison();
                break;
        }
    },

    /**
     * Update active preview tab
     */
    updatePreviewTabs() {
        document.querySelectorAll('#texture-dilation .preview-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.preview === this.currentPreview);
        });
    },

    /**
     * Process the image
     */
    async processImage() {
        if (!this.originalImageData) {
            Utils.showToast('Please upload an image first', 'warning');
            return;
        }
        
        try {
            Utils.showLoading('Dilating texture...');
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const method = document.getElementById('dilation-method').value;
            const radius = parseInt(document.getElementById('dilation-radius').value);
            const iterations = parseInt(document.getElementById('dilation-iterations').value);
            const threshold = parseInt(document.getElementById('dilation-threshold').value);
            const preserveAlpha = document.getElementById('dilation-preserve-alpha').checked;
            const showDilated = document.getElementById('dilation-show-dilated').checked;
            
            const options = { threshold, preserveAlpha };
            
            // Apply dilation with multiple iterations if needed
            let imageData = Utils.cloneImageData(this.originalImageData);
            
            for (let i = 0; i < iterations; i++) {
                Utils.showLoading(`Dilating... (Pass ${i + 1}/${iterations})`);
                await new Promise(resolve => setTimeout(resolve, 10));
                imageData = ImageProcessor.dilateTexture(imageData, radius, method, options);
            }
            
            this.resultImageData = imageData;
            
            // Highlight dilated areas if requested
            if (showDilated) {
                this.highlightDilatedAreas();
            }
            
            // Show result only on first process, otherwise update current view
            if (!this.hasProcessed) {
                this.showResult();
                this.hasProcessed = true;
            } else {
                // Update the current preview with new data
                this.refreshCurrentPreview();
            }
            
            // Enable download
            document.getElementById('dilation-download').disabled = false;
            
            // Calculate dilated pixel count
            const dilatedCount = this.countDilatedPixels();
            this.updateInfo(
                `${this.resultImageData.width} × ${this.resultImageData.height}px | ` +
                `Dilated pixels: ${dilatedCount}`
            );
            
            Utils.hideLoading();
            Utils.showToast('Texture dilated!', 'success');
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('Processing failed: ' + error.message, 'error');
            console.error(error);
        }
    },

    /**
     * Highlight dilated areas with a tint
     */
    highlightDilatedAreas() {
        const threshold = parseInt(document.getElementById('dilation-threshold').value);
        
        for (let i = 0; i < this.resultImageData.data.length; i += 4) {
            const origAlpha = this.originalImageData.data[i + 3];
            const newAlpha = this.resultImageData.data[i + 3];
            
            // If originally transparent but now has color data
            if (origAlpha < threshold) {
                // Tint with magenta to show dilated areas
                const r = this.resultImageData.data[i];
                const g = this.resultImageData.data[i + 1];
                const b = this.resultImageData.data[i + 2];
                
                this.resultImageData.data[i] = Math.min(255, r + 50);
                this.resultImageData.data[i + 1] = g;
                this.resultImageData.data[i + 2] = Math.min(255, b + 50);
            }
        }
    },

    /**
     * Count dilated pixels
     */
    countDilatedPixels() {
        if (!this.resultImageData || !this.originalImageData) return 0;
        
        const threshold = parseInt(document.getElementById('dilation-threshold').value);
        let count = 0;
        
        for (let i = 0; i < this.resultImageData.data.length; i += 4) {
            const origAlpha = this.originalImageData.data[i + 3];
            
            // Count pixels that were transparent but now have RGB data
            if (origAlpha < threshold) {
                const hasData = this.resultImageData.data[i] !== 0 ||
                               this.resultImageData.data[i + 1] !== 0 ||
                               this.resultImageData.data[i + 2] !== 0;
                if (hasData) count++;
            }
        }
        
        return count;
    },

    /**
     * Download result
     */
    downloadResult() {
        if (!this.resultImageData) {
            Utils.showToast('No result to download', 'warning');
            return;
        }
        
        // If highlighting was on, recreate without highlights for download
        const showDilated = document.getElementById('dilation-show-dilated').checked;
        let downloadData = this.resultImageData;
        
        if (showDilated) {
            // Re-process without highlights
            const method = document.getElementById('dilation-method').value;
            const radius = parseInt(document.getElementById('dilation-radius').value);
            const iterations = parseInt(document.getElementById('dilation-iterations').value);
            const threshold = parseInt(document.getElementById('dilation-threshold').value);
            const preserveAlpha = document.getElementById('dilation-preserve-alpha').checked;
            
            downloadData = Utils.cloneImageData(this.originalImageData);
            for (let i = 0; i < iterations; i++) {
                downloadData = ImageProcessor.dilateTexture(downloadData, radius, method, { threshold, preserveAlpha });
            }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = downloadData.width;
        canvas.height = downloadData.height;
        Utils.putImageData(canvas, downloadData);
        
        Utils.downloadCanvas(canvas, 'dilated-texture', 'png');
        Utils.showToast('Download started!', 'success');
    },

    /**
     * Update info display
     */
    updateInfo(text) {
        document.getElementById('dilation-info').textContent = text;
    },

    /**
     * Refresh current preview without switching tabs
     */
    refreshCurrentPreview() {
        const canvas = document.getElementById('dilation-canvas');
        
        switch (this.currentPreview) {
            case 'result':
                if (this.resultImageData) {
                    canvas.width = this.resultImageData.width;
                    canvas.height = this.resultImageData.height;
                    Utils.putImageData(canvas, this.resultImageData);
                    if (this.zoomController) {
                        this.zoomController.setContent(canvas);
                    }
                }
                break;
            case 'comparison':
                this.showComparison();
                break;
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    TextureDilationTool.init();
});
