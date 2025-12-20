/**
 * Indie Dev Toys - Seamless Texture Generator Tool
 * Creates tileable textures from regular images
 */

const SeamlessTextureTool = {
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
        this.zoomController = Utils.createZoomController('seamless-preview');
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // File upload
        const uploadEl = document.getElementById('seamless-upload');
        const fileInput = document.getElementById('seamless-file-input');
        
        Utils.setupFileUpload(uploadEl, fileInput, (file) => this.loadImage(file));

        // Process button
        document.getElementById('seamless-process').addEventListener('click', () => {
            this.processImage();
        });

        // Download button
        document.getElementById('seamless-download').addEventListener('click', () => {
            this.downloadResult();
        });

        // Preview tabs
        document.querySelectorAll('#seamless-texture .preview-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPreview(e.target.dataset.preview);
            });
        });

        // Format change (show/hide quality slider)
        document.getElementById('seamless-format').addEventListener('change', (e) => {
            const qualityGroup = document.getElementById('seamless-quality-group');
            qualityGroup.style.display = e.target.value === 'png' ? 'none' : 'block';
        });
    },

    /**
     * Setup range sliders
     */
    setupSliders() {
        Utils.setupRangeSlider('seamless-blend', 'seamless-blend-value');
        Utils.setupRangeSlider('seamless-avg-intensity', 'seamless-avg-value');
        Utils.setupRangeSlider('seamless-quality', 'seamless-quality-value');
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
            
            // Show original in preview
            this.showOriginal();
            
            // Update info
            this.updateInfo(`Original: ${this.originalImage.width} × ${this.originalImage.height}px`);
            
            Utils.hideLoading();
            Utils.showToast('Image loaded successfully', 'success');
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast(error.message, 'error');
        }
    },

    /**
     * Show original image in preview
     */
    showOriginal() {
        const canvas = document.getElementById('seamless-canvas');
        const placeholder = document.querySelector('#seamless-preview .preview-placeholder');
        const tiledPreview = document.getElementById('seamless-tiled-preview');
        
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.originalImage, 0, 0);
        
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        tiledPreview.style.display = 'none';
        
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
        
        const canvas = document.getElementById('seamless-canvas');
        const tiledPreview = document.getElementById('seamless-tiled-preview');
        
        canvas.width = this.resultImageData.width;
        canvas.height = this.resultImageData.height;
        Utils.putImageData(canvas, this.resultImageData);
        
        canvas.style.display = 'block';
        tiledPreview.style.display = 'none';
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas);
        }
        
        this.currentPreview = 'result';
        this.updatePreviewTabs();
    },

    /**
     * Show tiled preview
     */
    showTiled() {
        if (!this.resultImageData) {
            Utils.showToast('Process an image first', 'warning');
            return;
        }
        
        const canvas = document.getElementById('seamless-canvas');
        const tiledPreview = document.getElementById('seamless-tiled-preview');
        
        // Create temporary canvas for result
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.resultImageData.width;
        tempCanvas.height = this.resultImageData.height;
        Utils.putImageData(tempCanvas, this.resultImageData);
        
        // Set as background
        tiledPreview.style.backgroundImage = `url(${tempCanvas.toDataURL()})`;
        tiledPreview.style.backgroundSize = `${Math.min(256, this.resultImageData.width)}px`;
        
        canvas.style.display = 'none';
        tiledPreview.style.display = 'block';
        
        this.currentPreview = 'tiled';
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
            case 'tiled':
                this.showTiled();
                break;
        }
    },

    /**
     * Update active preview tab
     */
    updatePreviewTabs() {
        document.querySelectorAll('#seamless-texture .preview-tab').forEach(tab => {
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
            Utils.showLoading('Processing...');
            
            // Use setTimeout to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50));
            
            let imageData = Utils.cloneImageData(this.originalImageData);
            
            // Get settings
            const method = document.getElementById('seamless-method').value;
            const blendSize = parseInt(document.getElementById('seamless-blend').value);
            const normalize = document.getElementById('seamless-normalize').checked;
            const averageEdges = document.getElementById('seamless-average-edges').checked;
            const avgIntensity = parseInt(document.getElementById('seamless-avg-intensity').value);
            
            // Pre-crop
            const cropLeft = parseInt(document.getElementById('crop-left').value) || 0;
            const cropTop = parseInt(document.getElementById('crop-top').value) || 0;
            const cropRight = parseInt(document.getElementById('crop-right').value) || 0;
            const cropBottom = parseInt(document.getElementById('crop-bottom').value) || 0;
            
            if (cropLeft > 0 || cropTop > 0 || cropRight > 0 || cropBottom > 0) {
                imageData = ImageProcessor.cropImage(imageData, cropLeft, cropTop, cropRight, cropBottom);
            }
            
            // Pre-processing
            if (normalize) {
                imageData = ImageProcessor.normalizeBrightness(imageData);
            }
            
            if (averageEdges && avgIntensity > 0) {
                const radius = Math.floor(Math.min(imageData.width, imageData.height) * 0.1);
                imageData = ImageProcessor.averageEdgeColors(imageData, avgIntensity, radius);
            }
            
            // Apply seamless method
            switch (method) {
                case 'mirror':
                    this.resultImageData = ImageProcessor.seamlessMirror(imageData, blendSize);
                    break;
                case 'linear':
                    this.resultImageData = ImageProcessor.seamlessLinear(imageData, blendSize);
                    break;
                case 'cosine':
                    this.resultImageData = ImageProcessor.seamlessCosine(imageData, blendSize);
                    break;
                case 'advanced':
                    this.resultImageData = ImageProcessor.seamlessAdvanced(imageData, blendSize);
                    break;
                default:
                    this.resultImageData = ImageProcessor.seamlessLinear(imageData, blendSize);
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
            document.getElementById('seamless-download').disabled = false;
            
            // Update info
            this.updateInfo(`Result: ${this.resultImageData.width} × ${this.resultImageData.height}px | Method: ${method}`);
            
            Utils.hideLoading();
            Utils.showToast('Seamless texture generated!', 'success');
            
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('Processing failed: ' + error.message, 'error');
            console.error(error);
        }
    },

    /**
     * Download result
     */
    downloadResult() {
        if (!this.resultImageData) {
            Utils.showToast('No result to download', 'warning');
            return;
        }
        
        const format = document.getElementById('seamless-format').value;
        const quality = parseInt(document.getElementById('seamless-quality').value) / 100;
        
        const canvas = document.createElement('canvas');
        canvas.width = this.resultImageData.width;
        canvas.height = this.resultImageData.height;
        Utils.putImageData(canvas, this.resultImageData);
        
        Utils.downloadCanvas(canvas, 'seamless-texture', format, quality);
        Utils.showToast('Download started!', 'success');
    },

    /**
     * Update info display
     */
    updateInfo(text) {
        document.getElementById('seamless-info').textContent = text;
    },

    /**
     * Refresh current preview without switching tabs
     */
    refreshCurrentPreview() {
        switch (this.currentPreview) {
            case 'result':
                if (this.resultImageData) {
                    const canvas = document.getElementById('seamless-canvas');
                    canvas.width = this.resultImageData.width;
                    canvas.height = this.resultImageData.height;
                    Utils.putImageData(canvas, this.resultImageData);
                    if (this.zoomController) {
                        this.zoomController.setContent(canvas);
                    }
                }
                break;
            case 'tiled':
                this.showTiled();
                break;
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    SeamlessTextureTool.init();
});
