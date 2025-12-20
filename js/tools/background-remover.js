/**
 * Indie Dev Toys - Background Remover Tool
 * Remove backgrounds and export with transparency
 */

const BackgroundRemoverTool = {
    originalImage: null,
    originalImageData: null,
    resultImageData: null,
    maskImageData: null,
    currentPreview: 'original',
    isPickingColor: false,
    floodFillStart: null,

    /**
     * Initialize the tool
     */
    init() {
        this.setupEventListeners();
        this.setupSliders();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // File upload
        const uploadEl = document.getElementById('bgremove-upload');
        const fileInput = document.getElementById('bgremove-file-input');
        
        Utils.setupFileUpload(uploadEl, fileInput, (file) => this.loadImage(file));

        // Method change
        document.getElementById('bgremove-method').addEventListener('change', (e) => {
            this.onMethodChange(e.target.value);
        });

        // Color picker
        document.getElementById('bgremove-pick-color').addEventListener('click', () => {
            this.startColorPicking();
        });

        // Canvas click for color picking / flood fill
        document.getElementById('bgremove-canvas').addEventListener('click', (e) => {
            this.onCanvasClick(e);
        });

        // Chroma key color change
        document.getElementById('bgremove-chroma-color').addEventListener('change', (e) => {
            this.onChromaColorChange(e.target.value);
        });

        // Process button
        document.getElementById('bgremove-process').addEventListener('click', () => {
            this.processImage();
        });

        // Download button
        document.getElementById('bgremove-download').addEventListener('click', () => {
            this.downloadResult();
        });

        // Preview tabs
        document.querySelectorAll('#background-remover .preview-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPreview(e.target.dataset.preview);
            });
        });
    },

    /**
     * Setup range sliders
     */
    setupSliders() {
        Utils.setupRangeSlider('bgremove-tolerance', 'bgremove-tolerance-value');
        Utils.setupRangeSlider('bgremove-softness', 'bgremove-softness-value');
    },

    /**
     * Handle method change
     */
    onMethodChange(method) {
        const colorGroup = document.getElementById('bgremove-color-picker-group');
        const chromaGroup = document.getElementById('bgremove-chroma-group');
        
        colorGroup.style.display = (method === 'color' || method === 'flood') ? 'block' : 'none';
        chromaGroup.style.display = method === 'chroma' ? 'block' : 'none';
        
        // Update pick color button text for flood fill
        const pickBtn = document.getElementById('bgremove-pick-color');
        if (method === 'flood') {
            pickBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Select Start Point';
        } else {
            pickBtn.innerHTML = '<i class="fas fa-eye-dropper"></i> Pick from Image';
        }
    },

    /**
     * Handle chroma key color preset change
     */
    onChromaColorChange(value) {
        const colorInput = document.getElementById('bgremove-color');
        
        switch (value) {
            case 'green':
                colorInput.value = '#00ff00';
                break;
            case 'blue':
                colorInput.value = '#0000ff';
                break;
            // Custom - keep current value
        }
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
            
            // Reset results
            this.resultImageData = null;
            this.maskImageData = null;
            this.floodFillStart = null;
            
            // Show original in preview
            this.showOriginal();
            
            // Update info
            this.updateInfo(`${this.originalImage.width} × ${this.originalImage.height}px`);
            
            Utils.hideLoading();
            Utils.showToast('Image loaded successfully', 'success');
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast(error.message, 'error');
        }
    },

    /**
     * Start color picking mode
     */
    startColorPicking() {
        if (!this.originalImageData) {
            Utils.showToast('Please upload an image first', 'warning');
            return;
        }
        
        this.isPickingColor = true;
        document.getElementById('bgremove-canvas').style.cursor = 'crosshair';
        Utils.showToast('Click on the image to pick a color', 'success');
    },

    /**
     * Handle canvas click
     */
    onCanvasClick(e) {
        if (!this.originalImageData) return;
        
        const canvas = document.getElementById('bgremove-canvas');
        const rect = canvas.getBoundingClientRect();
        
        // Calculate actual pixel coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        if (x < 0 || x >= this.originalImageData.width || y < 0 || y >= this.originalImageData.height) {
            return;
        }
        
        const method = document.getElementById('bgremove-method').value;
        
        if (this.isPickingColor || method === 'flood') {
            const pixel = Utils.getPixel(this.originalImageData, x, y);
            const hexColor = Utils.rgbToHex(pixel.r, pixel.g, pixel.b);
            document.getElementById('bgremove-color').value = hexColor;
            
            if (method === 'flood') {
                this.floodFillStart = { x, y };
                Utils.showToast(`Start point set at (${x}, ${y})`, 'success');
            } else {
                Utils.showToast(`Color selected: ${hexColor}`, 'success');
            }
            
            this.isPickingColor = false;
            canvas.style.cursor = 'default';
        }
    },

    /**
     * Show original image in preview
     */
    showOriginal() {
        const canvas = document.getElementById('bgremove-canvas');
        const placeholder = document.querySelector('#bgremove-preview .preview-placeholder');
        
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.originalImage, 0, 0);
        
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        
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
        
        const canvas = document.getElementById('bgremove-canvas');
        
        canvas.width = this.resultImageData.width;
        canvas.height = this.resultImageData.height;
        Utils.putImageData(canvas, this.resultImageData);
        
        this.currentPreview = 'result';
        this.updatePreviewTabs();
    },

    /**
     * Show mask in preview
     */
    showMask() {
        if (!this.maskImageData) {
            Utils.showToast('Process an image first', 'warning');
            return;
        }
        
        const canvas = document.getElementById('bgremove-canvas');
        
        canvas.width = this.maskImageData.width;
        canvas.height = this.maskImageData.height;
        Utils.putImageData(canvas, this.maskImageData);
        
        this.currentPreview = 'mask';
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
            case 'mask':
                this.showMask();
                break;
        }
    },

    /**
     * Update active preview tab
     */
    updatePreviewTabs() {
        document.querySelectorAll('#background-remover .preview-tab').forEach(tab => {
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
            Utils.showLoading('Removing background...');
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const method = document.getElementById('bgremove-method').value;
            const tolerance = parseInt(document.getElementById('bgremove-tolerance').value);
            const softness = parseInt(document.getElementById('bgremove-softness').value);
            const invert = document.getElementById('bgremove-invert').checked;
            const feather = document.getElementById('bgremove-feather').checked;
            const despill = document.getElementById('bgremove-despill').checked;
            
            const targetColor = Utils.hexToRgb(document.getElementById('bgremove-color').value);
            
            const options = { invert, softness, despill };
            
            switch (method) {
                case 'color':
                case 'chroma':
                    this.resultImageData = ImageProcessor.removeBackgroundByColor(
                        this.originalImageData, targetColor, tolerance, options
                    );
                    break;
                    
                case 'luminance':
                    this.resultImageData = ImageProcessor.removeBackgroundByLuminance(
                        this.originalImageData, tolerance, options
                    );
                    break;
                    
                case 'flood':
                    if (!this.floodFillStart) {
                        Utils.hideLoading();
                        Utils.showToast('Please click on the image to set a start point', 'warning');
                        return;
                    }
                    this.resultImageData = ImageProcessor.floodFillRemove(
                        this.originalImageData,
                        this.floodFillStart.x,
                        this.floodFillStart.y,
                        tolerance,
                        options
                    );
                    break;
            }
            
            // Apply feathering
            if (feather && softness > 0) {
                this.resultImageData = ImageProcessor.featherEdges(this.resultImageData, softness);
            }
            
            // Generate mask preview
            this.generateMask();
            
            // Show result
            this.showResult();
            
            // Enable download
            document.getElementById('bgremove-download').disabled = false;
            
            // Update info
            const transparentPixels = this.countTransparentPixels();
            this.updateInfo(`Transparent: ${transparentPixels}% | Size: ${this.resultImageData.width} × ${this.resultImageData.height}px`);
            
            Utils.hideLoading();
            Utils.showToast('Background removed!', 'success');
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('Processing failed: ' + error.message, 'error');
            console.error(error);
        }
    },

    /**
     * Generate mask from result alpha
     */
    generateMask() {
        this.maskImageData = new ImageData(
            this.resultImageData.width,
            this.resultImageData.height
        );
        
        for (let i = 0; i < this.resultImageData.data.length; i += 4) {
            const alpha = this.resultImageData.data[i + 3];
            this.maskImageData.data[i] = alpha;
            this.maskImageData.data[i + 1] = alpha;
            this.maskImageData.data[i + 2] = alpha;
            this.maskImageData.data[i + 3] = 255;
        }
    },

    /**
     * Count percentage of transparent pixels
     */
    countTransparentPixels() {
        if (!this.resultImageData) return 0;
        
        let transparent = 0;
        const total = this.resultImageData.width * this.resultImageData.height;
        
        for (let i = 3; i < this.resultImageData.data.length; i += 4) {
            if (this.resultImageData.data[i] < 128) {
                transparent++;
            }
        }
        
        return Math.round((transparent / total) * 100);
    },

    /**
     * Download result
     */
    downloadResult() {
        if (!this.resultImageData) {
            Utils.showToast('No result to download', 'warning');
            return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = this.resultImageData.width;
        canvas.height = this.resultImageData.height;
        Utils.putImageData(canvas, this.resultImageData);
        
        Utils.downloadCanvas(canvas, 'background-removed', 'png');
        Utils.showToast('Download started!', 'success');
    },

    /**
     * Update info display
     */
    updateInfo(text) {
        document.getElementById('bgremove-info').textContent = text;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    BackgroundRemoverTool.init();
});
