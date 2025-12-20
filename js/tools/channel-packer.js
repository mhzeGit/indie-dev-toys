/**
 * Channel Packer Tool
 * Combines multiple grayscale textures into RGBA channels
 */

const ChannelPacker = {
    images: {
        r: null,
        g: null,
        b: null,
        a: null
    },
    result: null,
    channelResults: {
        r: null,
        g: null,
        b: null,
        a: null
    },
    currentPreview: 'combined',
    zoomController: null,
    hasProcessed: false,

    // Preset configurations
    presets: {
        'unity-mask': {
            name: 'Unity Mask Map (HDRP/URP)',
            labels: {
                r: 'R: Metallic',
                g: 'G: Ambient Occlusion',
                b: 'B: Detail Mask',
                a: 'A: Smoothness'
            },
            defaults: {
                r: 0,
                g: 255,
                b: 0,
                a: 128
            }
        },
        'unity-metallic': {
            name: 'Unity Metallic (Standard)',
            labels: {
                r: 'R: Metallic',
                g: 'G: (Unused)',
                b: 'B: (Unused)',
                a: 'A: Smoothness'
            },
            defaults: {
                r: 0,
                g: 0,
                b: 0,
                a: 128
            }
        },
        'unreal-orm': {
            name: 'Unreal ORM Map',
            labels: {
                r: 'R: Ambient Occlusion',
                g: 'G: Roughness',
                b: 'B: Metallic',
                a: 'A: (Unused)'
            },
            defaults: {
                r: 255,
                g: 128,
                b: 0,
                a: 255
            }
        },
        'custom': {
            name: 'Custom',
            labels: {
                r: 'R: Red Channel',
                g: 'G: Green Channel',
                b: 'B: Blue Channel',
                a: 'A: Alpha Channel'
            },
            defaults: {
                r: 0,
                g: 0,
                b: 0,
                a: 255
            }
        }
    },

    init() {
        this.setupChannelInputs();
        this.setupPresetSelector();
        this.setupControls();
        this.setupPreviewTabs();
        this.setupZoom();
        this.updateLabels();
    },

    setupChannelInputs() {
        const channels = ['r', 'g', 'b', 'a'];
        
        channels.forEach(channel => {
            const dropzone = document.getElementById(`dropzone-${channel}`);
            const input = document.getElementById(`input-${channel}`);
            const preview = document.getElementById(`preview-${channel}`);
            
            // Click to upload
            dropzone.addEventListener('click', () => input.click());
            
            // File input change
            input.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.loadChannelImage(channel, e.target.files[0]);
                }
            });
            
            // Drag and drop
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragover');
            });
            
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.loadChannelImage(channel, e.dataTransfer.files[0]);
                }
            });
            
            // Remove button
            const removeBtn = preview.querySelector('.btn-remove');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeChannelImage(channel);
            });
        });
    },

    loadChannelImage(channel, file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.images[channel] = img;
                this.updateChannelPreview(channel);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    updateChannelPreview(channel) {
        const dropzone = document.getElementById(`dropzone-${channel}`);
        const preview = document.getElementById(`preview-${channel}`);
        const canvas = preview.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const img = this.images[channel];
        
        if (img) {
            // Set canvas size maintaining aspect ratio
            const maxHeight = 80;
            const scale = maxHeight / img.height;
            canvas.width = img.width * scale;
            canvas.height = maxHeight;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            dropzone.style.display = 'none';
            preview.style.display = 'block';
        }
    },

    removeChannelImage(channel) {
        this.images[channel] = null;
        
        const dropzone = document.getElementById(`dropzone-${channel}`);
        const preview = document.getElementById(`preview-${channel}`);
        const input = document.getElementById(`input-${channel}`);
        
        dropzone.style.display = 'flex';
        preview.style.display = 'none';
        input.value = '';
    },

    setupPresetSelector() {
        const presetSelect = document.getElementById('packer-preset');
        presetSelect.addEventListener('change', () => this.updateLabels());
    },

    updateLabels() {
        const preset = document.getElementById('packer-preset').value;
        const config = this.presets[preset];
        
        if (config) {
            document.getElementById('label-r').textContent = config.labels.r;
            document.getElementById('label-g').textContent = config.labels.g;
            document.getElementById('label-b').textContent = config.labels.b;
            document.getElementById('label-a').textContent = config.labels.a;
        }
    },

    setupControls() {
        // Fill value slider
        const fillSlider = document.getElementById('packer-fill');
        const fillValue = document.getElementById('packer-fill-value');
        fillSlider.addEventListener('input', () => {
            fillValue.textContent = fillSlider.value;
        });

        // Process button
        document.getElementById('packer-process').addEventListener('click', () => this.process());
        
        // Download button
        document.getElementById('packer-download').addEventListener('click', () => this.downloadResult());
    },

    setupPreviewTabs() {
        const tabs = document.querySelectorAll('#channel-packer .preview-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentPreview = tab.dataset.preview;
                this.refreshCurrentPreview();
            });
        });
    },

    setupZoom() {
        this.zoomController = Utils.createZoomController('packer-preview');
    },

    getOutputSize() {
        const sizeSelect = document.getElementById('packer-size').value;
        
        if (sizeSelect === 'source') {
            // Find first loaded image and use its size
            for (const channel of ['r', 'g', 'b', 'a']) {
                if (this.images[channel]) {
                    return {
                        width: this.images[channel].width,
                        height: this.images[channel].height
                    };
                }
            }
            return { width: 1024, height: 1024 };
        }
        
        const size = parseInt(sizeSelect);
        return { width: size, height: size };
    },

    getChannelValue(imageData, index, sourceChannel, invert) {
        let value;
        
        switch (sourceChannel) {
            case 'r':
                value = imageData.data[index];
                break;
            case 'g':
                value = imageData.data[index + 1];
                break;
            case 'b':
                value = imageData.data[index + 2];
                break;
            case 'a':
                value = imageData.data[index + 3];
                break;
            case 'avg':
            default:
                value = Math.round(
                    (imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3
                );
                break;
        }
        
        return invert ? 255 - value : value;
    },

    process() {
        // Check if at least one image is loaded
        const hasAnyImage = Object.values(this.images).some(img => img !== null);
        if (!hasAnyImage) {
            Utils.showToast('Please add at least one texture', 'error');
            return;
        }

        Utils.showLoading('Packing channels...');

        setTimeout(() => {
            try {
                const { width, height } = this.getOutputSize();
                const fillValue = parseInt(document.getElementById('packer-fill').value);
                const preset = document.getElementById('packer-preset').value;
                const presetConfig = this.presets[preset];
                
                // Create output canvas
                const canvas = document.getElementById('packer-canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Create result image data
                const resultData = ctx.createImageData(width, height);
                
                // Process each channel
                const channels = ['r', 'g', 'b', 'a'];
                const channelIndex = { r: 0, g: 1, b: 2, a: 3 };
                
                // Create temporary canvases for each channel visualization
                this.channelResults = { r: null, g: null, b: null, a: null };
                
                channels.forEach(channel => {
                    const img = this.images[channel];
                    const invert = document.getElementById(`invert-${channel}`).checked;
                    const sourceChannel = document.getElementById(`source-${channel}`).value;
                    const defaultValue = fillValue !== undefined ? fillValue : (presetConfig.defaults[channel] || 0);
                    const targetIndex = channelIndex[channel];
                    
                    // Create channel visualization canvas
                    const channelCanvas = document.createElement('canvas');
                    channelCanvas.width = width;
                    channelCanvas.height = height;
                    const channelCtx = channelCanvas.getContext('2d');
                    const channelData = channelCtx.createImageData(width, height);
                    
                    if (img) {
                        // Create temp canvas to get image data at output size
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.drawImage(img, 0, 0, width, height);
                        const imgData = tempCtx.getImageData(0, 0, width, height);
                        
                        // Copy channel data
                        for (let i = 0; i < resultData.data.length; i += 4) {
                            const value = this.getChannelValue(imgData, i, sourceChannel, invert);
                            resultData.data[i + targetIndex] = value;
                            
                            // For visualization, show as grayscale
                            channelData.data[i] = value;
                            channelData.data[i + 1] = value;
                            channelData.data[i + 2] = value;
                            channelData.data[i + 3] = 255;
                        }
                    } else {
                        // Fill with default value
                        for (let i = 0; i < resultData.data.length; i += 4) {
                            resultData.data[i + targetIndex] = defaultValue;
                            
                            // For visualization
                            channelData.data[i] = defaultValue;
                            channelData.data[i + 1] = defaultValue;
                            channelData.data[i + 2] = defaultValue;
                            channelData.data[i + 3] = 255;
                        }
                    }
                    
                    channelCtx.putImageData(channelData, 0, 0);
                    this.channelResults[channel] = channelCanvas;
                });
                
                // Put result on main canvas
                ctx.putImageData(resultData, 0, 0);
                this.result = canvas;
                
                // Show result
                canvas.style.display = 'block';
                const placeholder = document.querySelector('#packer-preview .preview-placeholder');
                if (placeholder) placeholder.style.display = 'none';
                
                // Update info
                document.getElementById('packer-info').innerHTML = `
                    <strong>Output:</strong> ${width} × ${height} px | 
                    <strong>Channels:</strong> ${Object.values(this.images).filter(i => i).length} loaded
                `;
                
                // Enable download
                document.getElementById('packer-download').disabled = false;
                
                // Switch to combined view on first process
                if (!this.hasProcessed) {
                    const tabs = document.querySelectorAll('#channel-packer .preview-tab');
                    tabs.forEach(t => t.classList.remove('active'));
                    tabs[0].classList.add('active');
                    this.currentPreview = 'combined';
                    this.hasProcessed = true;
                }
                
                this.refreshCurrentPreview();
                if (this.zoomController) {
                    this.zoomController.setContent(canvas);
                    this.zoomController.resetZoom();
                }
                
                Utils.showToast('Channels packed successfully!', 'success');
            } catch (error) {
                console.error('Processing error:', error);
                Utils.showToast('Error processing images: ' + error.message, 'error');
            } finally {
                Utils.hideLoading();
            }
        }, 50);
    },

    refreshCurrentPreview() {
        if (!this.result) return;
        
        const canvas = document.getElementById('packer-canvas');
        const ctx = canvas.getContext('2d');
        
        if (this.currentPreview === 'combined') {
            // Show the packed result
            // Result is already on the canvas, just need to redraw if switching back
            if (this.result && this.result !== canvas) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(this.result, 0, 0);
            }
        } else {
            // Show individual channel
            const channelCanvas = this.channelResults[this.currentPreview];
            if (channelCanvas) {
                canvas.width = channelCanvas.width;
                canvas.height = channelCanvas.height;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(channelCanvas, 0, 0);
            }
        }
    },

    downloadResult() {
        if (!this.result) {
            Utils.showToast('No result to download', 'error');
            return;
        }
        
        const preset = document.getElementById('packer-preset').value;
        const presetName = this.presets[preset].name.replace(/[^a-zA-Z0-9]/g, '_');
        
        const link = document.createElement('a');
        link.download = `packed_${presetName}_${Date.now()}.png`;
        link.href = this.result.toDataURL('image/png');
        link.click();
        
        Utils.showToast('Image downloaded!', 'success');
    }
};

// Tool is initialized by App.loadView() when the view is loaded
