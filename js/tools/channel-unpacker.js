/**
 * Channel Unpacker Tool
 * Extracts RGBA channels into separate grayscale textures
 */

const ChannelUnpacker = {
    sourceImage: null,
    sourceCanvas: null,
    channelResults: {
        r: null,
        g: null,
        b: null,
        a: null
    },
    currentPreview: 'original',
    zoomController: null,
    hasProcessed: false,

    init() {
        this.setupInput();
        this.setupControls();
        this.setupPreviewTabs();
        this.setupZoom();
    },

    setupInput() {
        const dropzone = document.getElementById('dropzone-unpacker');
        const input = document.getElementById('input-unpacker');
        
        dropzone.addEventListener('click', () => input.click());
        
        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.loadImage(e.target.files[0]);
            }
        });
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary-color)';
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--border-color)';
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                this.loadImage(e.dataTransfer.files[0]);
            }
        });
    },

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.sourceImage = img;
                this.displayOriginal();
                document.getElementById('unpacker-process').disabled = false;
                
                // Show original image name in dropzone
                const dropzone = document.getElementById('dropzone-unpacker');
                dropzone.innerHTML = `<i class="fas fa-check-circle fa-2x" style="margin-bottom: 10px; color: var(--success-color);"></i><span>${file.name}</span><input type="file" accept="image/*" id="input-unpacker" hidden>`;
                // Re-attach input event
                document.getElementById('input-unpacker').addEventListener('change', (e2) => {
                    if (e2.target.files && e2.target.files[0]) this.loadImage(e2.target.files[0]);
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    displayOriginal() {
        const canvas = document.getElementById('unpacker-canvas');
        canvas.width = this.sourceImage.width;
        canvas.height = this.sourceImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.sourceImage, 0, 0);
        
        this.sourceCanvas = canvas;
        
        canvas.style.display = 'block';
        const placeholder = document.querySelector('#unpacker-preview .preview-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        
        document.getElementById('unpacker-info').innerHTML = `
            <strong>Size:</strong> ${this.sourceImage.width} × ${this.sourceImage.height} px
        `;

        // Reset state
        this.hasProcessed = false;
        document.getElementById('unpacker-tabs').style.display = 'none';
        document.getElementById('unpacker-download-all').disabled = true;
        
        if (this.zoomController) {
            this.zoomController.setContent(canvas);
            this.zoomController.resetZoom();
        }
    },

    setupControls() {
        document.getElementById('unpacker-process').addEventListener('click', () => this.process());
        document.getElementById('unpacker-download-all').addEventListener('click', () => this.downloadZip());
    },

    setupPreviewTabs() {
        const tabs = document.querySelectorAll('#unpacker-tabs .preview-tab');
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
        this.zoomController = Utils.createZoomController('unpacker-preview');
    },

    process() {
        if (!this.sourceImage) return;

        Utils.showLoading('Extracting channels...');

        setTimeout(() => {
            try {
                const width = this.sourceImage.width;
                const height = this.sourceImage.height;
                
                // Get source image data
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(this.sourceImage, 0, 0);
                const sourceData = tempCtx.getImageData(0, 0, width, height);
                
                const channels = ['r', 'g', 'b', 'a'];
                const channelIndex = { r: 0, g: 1, b: 2, a: 3 };
                
                channels.forEach(channel => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    const imgData = ctx.createImageData(width, height);
                    
                    const srcIndex = channelIndex[channel];
                    
                    for (let i = 0; i < sourceData.data.length; i += 4) {
                        const val = sourceData.data[i + srcIndex];
                        imgData.data[i] = val;
                        imgData.data[i + 1] = val;
                        imgData.data[i + 2] = val;
                        imgData.data[i + 3] = 255; // Alpha is always solid in extracted map
                    }
                    
                    ctx.putImageData(imgData, 0, 0);
                    this.channelResults[channel] = canvas;
                });
                
                this.hasProcessed = true;
                document.getElementById('unpacker-tabs').style.display = 'flex';
                document.getElementById('unpacker-download-all').disabled = false;
                
                // Activate first extracted channel tab if original is active
                if (this.currentPreview === 'original') {
                    document.querySelector('.preview-tab[data-preview="original"]').classList.remove('active');
                    document.querySelector('.preview-tab[data-preview="r"]').classList.add('active');
                    this.currentPreview = 'r';
                }
                
                this.refreshCurrentPreview();
                Utils.showToast('Channels extracted successfully!', 'success');
            } catch (error) {
                console.error('Processing error:', error);
                Utils.showToast('Error extracting channels: ' + error.message, 'error');
            } finally {
                Utils.hideLoading();
            }
        }, 50);
    },

    refreshCurrentPreview() {
        if (!this.sourceImage) return;
        
        const canvas = document.getElementById('unpacker-canvas');
        const ctx = canvas.getContext('2d');
        
        if (this.currentPreview === 'original') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(this.sourceImage, 0, 0);
        } else {
            const channelCanvas = this.channelResults[this.currentPreview];
            if (channelCanvas) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(channelCanvas, 0, 0);
            }
        }
    },

    async downloadZip() {
        if (!this.hasProcessed) return;
        
        const zip = new JSZip();
        let added = 0;
        
        const processChannel = (channel, name) => {
            return new Promise(resolve => {
                if (document.getElementById(`extract-${channel}`).checked && this.channelResults[channel]) {
                    this.channelResults[channel].toBlob(blob => {
                        zip.file(`extracted_${name}.png`, blob);
                        added++;
                        resolve();
                    }, 'image/png');
                } else {
                    resolve();
                }
            });
        };
        
        Utils.showLoading('Generating ZIP...');
        
        await processChannel('r', 'r');
        await processChannel('g', 'g');
        await processChannel('b', 'b');
        await processChannel('a', 'a');
        
        if (added === 0) {
            Utils.hideLoading();
            Utils.showToast('Select at least one channel to download', 'error');
            return;
        }
        
        zip.generateAsync({ type: 'blob' }).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `extracted_channels_${Date.now()}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
            Utils.hideLoading();
            Utils.showToast('ZIP downloaded!', 'success');
        });
    }
};

