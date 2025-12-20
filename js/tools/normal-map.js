/**
 * Indie Dev Toys - Normal Map Generator Tool
 * Generate normal maps from diffuse/color textures
 */

const NormalMapTool = {
    originalImage: null,
    originalImageData: null,
    heightMapData: null,
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
        this.zoomController = Utils.createZoomController('normal-preview');
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // File upload
        const uploadEl = document.getElementById('normal-upload');
        const fileInput = document.getElementById('normal-file-input');
        
        Utils.setupFileUpload(uploadEl, fileInput, (file) => this.loadImage(file));

        // Process button
        document.getElementById('normal-process').addEventListener('click', () => {
            this.processImage();
        });

        // Download button
        document.getElementById('normal-download').addEventListener('click', () => {
            this.downloadResult();
        });

        // Preview tabs
        document.querySelectorAll('#normal-map .preview-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPreview(e.target.dataset.preview);
            });
        });

        // Real-time preview on settings change (debounced)
        const updatePreview = Utils.debounce(() => {
            if (this.originalImageData && this.resultImageData) {
                this.processImage();
            }
        }, 300);

        ['normal-method', 'normal-height-source'].forEach(id => {
            document.getElementById(id).addEventListener('change', updatePreview);
        });

        ['normal-strength', 'normal-blur', 'normal-z'].forEach(id => {
            document.getElementById(id).addEventListener('input', updatePreview);
        });

        ['normal-invert-r', 'normal-invert-g', 'normal-tileable', 'normal-normalize'].forEach(id => {
            document.getElementById(id).addEventListener('change', updatePreview);
        });
    },

    /**
     * Setup range sliders
     */
    setupSliders() {
        Utils.setupRangeSlider('normal-strength', 'normal-strength-value');
        Utils.setupRangeSlider('normal-blur', 'normal-blur-value');
        Utils.setupRangeSlider('normal-z', 'normal-z-value');
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
            this.heightMapData = null;
            this.resultImageData = null;
            this.hasProcessed = false;
            
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
     * Show original image in preview
     */
    showOriginal() {
        const canvas = document.getElementById('normal-canvas');
        const canvas3d = document.getElementById('normal-3d-canvas');
        const placeholder = document.querySelector('#normal-preview .preview-placeholder');
        
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.originalImage, 0, 0);
        
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        canvas3d.style.display = 'none';
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas);
        }
        
        this.currentPreview = 'original';
        this.updatePreviewTabs();
    },

    /**
     * Show height map in preview
     */
    showHeightMap() {
        if (!this.heightMapData) {
            // Generate height map preview
            const heightSource = document.getElementById('normal-height-source').value;
            this.heightMapData = ImageProcessor.generateHeightMap(this.originalImageData, heightSource);
        }
        
        const canvas = document.getElementById('normal-canvas');
        const canvas3d = document.getElementById('normal-3d-canvas');
        
        canvas.width = this.heightMapData.width;
        canvas.height = this.heightMapData.height;
        Utils.putImageData(canvas, this.heightMapData);
        
        canvas.style.display = 'block';
        canvas3d.style.display = 'none';
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas);
        }
        
        this.currentPreview = 'height';
        this.updatePreviewTabs();
    },

    /**
     * Show result normal map in preview
     */
    showResult() {
        if (!this.resultImageData) {
            Utils.showToast('Process an image first', 'warning');
            return;
        }
        
        const canvas = document.getElementById('normal-canvas');
        const canvas3d = document.getElementById('normal-3d-canvas');
        
        canvas.width = this.resultImageData.width;
        canvas.height = this.resultImageData.height;
        Utils.putImageData(canvas, this.resultImageData);
        
        canvas.style.display = 'block';
        canvas3d.style.display = 'none';
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas);
        }
        
        this.currentPreview = 'result';
        this.updatePreviewTabs();
    },

    /**
     * Show 3D preview with lighting
     */
    show3DPreview() {
        if (!this.resultImageData) {
            Utils.showToast('Process an image first', 'warning');
            return;
        }
        
        const canvas = document.getElementById('normal-canvas');
        const canvas3d = document.getElementById('normal-3d-canvas');
        
        canvas3d.width = this.resultImageData.width;
        canvas3d.height = this.resultImageData.height;
        
        this.render3DPreview();
        
        canvas.style.display = 'none';
        canvas3d.style.display = 'block';
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas3d);
        }
        
        this.currentPreview = '3d';
        this.updatePreviewTabs();
        
        // Setup mouse tracking for light position
        this.setup3DInteraction();
    },

    /**
     * Render 3D preview with directional lighting
     */
    render3DPreview(lightX = 0.5, lightY = 0.5) {
        const canvas3d = document.getElementById('normal-3d-canvas');
        const ctx = canvas3d.getContext('2d');
        const width = this.resultImageData.width;
        const height = this.resultImageData.height;
        
        // Create output image
        const output = ctx.createImageData(width, height);
        
        // Light direction (from mouse position)
        const lx = (lightX - 0.5) * 2;
        const ly = (lightY - 0.5) * 2;
        const lz = 0.8;
        const lightLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
        const lightDir = { x: lx / lightLen, y: ly / lightLen, z: lz / lightLen };
        
        // Use original as albedo, normal map for lighting
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                // Get normal from normal map (convert from 0-255 to -1 to 1)
                const nx = (this.resultImageData.data[idx] / 255) * 2 - 1;
                const ny = (this.resultImageData.data[idx + 1] / 255) * 2 - 1;
                const nz = (this.resultImageData.data[idx + 2] / 255) * 2 - 1;
                
                // Calculate diffuse lighting
                const dot = Math.max(0, nx * lightDir.x + ny * lightDir.y + nz * lightDir.z);
                
                // Get albedo from original
                const albedoR = this.originalImageData.data[idx];
                const albedoG = this.originalImageData.data[idx + 1];
                const albedoB = this.originalImageData.data[idx + 2];
                
                // Apply lighting
                const ambient = 0.3;
                const diffuse = 0.7;
                const light = ambient + diffuse * dot;
                
                output.data[idx] = Utils.clamp(albedoR * light, 0, 255);
                output.data[idx + 1] = Utils.clamp(albedoG * light, 0, 255);
                output.data[idx + 2] = Utils.clamp(albedoB * light, 0, 255);
                output.data[idx + 3] = 255;
            }
        }
        
        ctx.putImageData(output, 0, 0);
    },

    /**
     * Setup mouse interaction for 3D preview
     */
    setup3DInteraction() {
        const canvas3d = document.getElementById('normal-3d-canvas');
        
        const handleMove = (e) => {
            if (this.currentPreview !== '3d') return;
            
            const rect = canvas3d.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            this.render3DPreview(x, y);
        };
        
        canvas3d.addEventListener('mousemove', handleMove);
        canvas3d.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMove(touch);
        });
    },

    /**
     * Switch preview tab
     */
    switchPreview(preview) {
        switch (preview) {
            case 'original':
                this.showOriginal();
                break;
            case 'height':
                this.showHeightMap();
                break;
            case 'result':
                this.showResult();
                break;
            case '3d':
                this.show3DPreview();
                break;
        }
    },

    /**
     * Update active preview tab
     */
    updatePreviewTabs() {
        document.querySelectorAll('#normal-map .preview-tab').forEach(tab => {
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
            Utils.showLoading('Generating normal map...');
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const method = document.getElementById('normal-method').value;
            const strength = parseFloat(document.getElementById('normal-strength').value);
            const blurRadius = parseInt(document.getElementById('normal-blur').value);
            const heightSource = document.getElementById('normal-height-source').value;
            const invertR = document.getElementById('normal-invert-r').checked;
            const invertG = document.getElementById('normal-invert-g').checked;
            const tileable = document.getElementById('normal-tileable').checked;
            const normalizeVectors = document.getElementById('normal-normalize').checked;
            const zComponent = parseFloat(document.getElementById('normal-z').value);
            
            // Apply pre-blur if needed
            let sourceData = this.originalImageData;
            if (blurRadius > 0) {
                sourceData = Utils.gaussianBlur(this.originalImageData, blurRadius);
            }
            
            // Generate height map for preview
            this.heightMapData = ImageProcessor.generateHeightMap(sourceData, heightSource);
            
            // Generate normal map
            this.resultImageData = ImageProcessor.generateNormalMap(sourceData, {
                method,
                strength,
                heightSource,
                invertR,
                invertG,
                tileable,
                normalizeVectors,
                zComponent
            });
            
            // Show result only on first process, otherwise update current view
            if (!this.hasProcessed) {
                this.showResult();
                this.hasProcessed = true;
            } else {
                // Update the current preview with new data
                this.refreshCurrentPreview();
            }
            
            // Enable download
            document.getElementById('normal-download').disabled = false;
            
            // Update info
            this.updateInfo(
                `${this.resultImageData.width} × ${this.resultImageData.height}px | ` +
                `Method: ${method} | Strength: ${strength}`
            );
            
            Utils.hideLoading();
            Utils.showToast('Normal map generated!', 'success');
            
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
        
        const canvas = document.createElement('canvas');
        canvas.width = this.resultImageData.width;
        canvas.height = this.resultImageData.height;
        Utils.putImageData(canvas, this.resultImageData);
        
        Utils.downloadCanvas(canvas, 'normal-map', 'png');
        Utils.showToast('Download started!', 'success');
    },

    /**
     * Update info display
     */
    updateInfo(text) {
        document.getElementById('normal-info').textContent = text;
    },

    /**
     * Refresh current preview without switching tabs
     */
    refreshCurrentPreview() {
        const canvas = document.getElementById('normal-canvas');
        const canvas3d = document.getElementById('normal-3d-canvas');
        
        switch (this.currentPreview) {
            case 'height':
                if (this.heightMapData) {
                    canvas.width = this.heightMapData.width;
                    canvas.height = this.heightMapData.height;
                    Utils.putImageData(canvas, this.heightMapData);
                    if (this.zoomController) {
                        this.zoomController.setContent(canvas);
                    }
                }
                break;
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
            case '3d':
                if (this.resultImageData) {
                    canvas3d.width = this.resultImageData.width;
                    canvas3d.height = this.resultImageData.height;
                    this.render3DPreview();
                    if (this.zoomController) {
                        this.zoomController.setContent(canvas3d);
                    }
                }
                break;
        }
    }
};

// Tool is initialized by App.loadView() when the view is loaded
