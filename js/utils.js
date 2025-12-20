/**
 * Indie Dev Toys - Utility Functions
 * Common helper functions used across all tools
 */

const Utils = {
    /**
     * Show loading overlay
     */
    showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const spinner = overlay.querySelector('span');
        spinner.textContent = message;
        overlay.style.display = 'flex';
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Load image from file input
     */
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Please select a valid image file'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    },

    /**
     * Create canvas from image
     */
    imageToCanvas(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    },

    /**
     * Get ImageData from canvas
     */
    getImageData(canvas) {
        const ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },

    /**
     * Put ImageData to canvas
     */
    putImageData(canvas, imageData) {
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
    },

    /**
     * Clone ImageData
     */
    cloneImageData(imageData) {
        return new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
    },

    /**
     * Download canvas as image
     */
    downloadCanvas(canvas, filename, format = 'png', quality = 0.92) {
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 
                        format === 'webp' ? 'image/webp' : 'image/png';
        
        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = canvas.toDataURL(mimeType, quality);
        link.click();
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Smooth step interpolation
     */
    smoothstep(edge0, edge1, x) {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    },

    /**
     * Cosine interpolation factor
     */
    cosineInterpolation(t) {
        return (1 - Math.cos(t * Math.PI)) / 2;
    },

    /**
     * Convert RGB to HSL
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
    },

    /**
     * Convert HSL to RGB
     */
    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    },

    /**
     * Calculate luminance from RGB
     */
    getLuminance(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    },

    /**
     * Calculate color distance (Euclidean)
     */
    colorDistance(r1, g1, b1, r2, g2, b2) {
        return Math.sqrt(
            Math.pow(r1 - r2, 2) +
            Math.pow(g1 - g2, 2) +
            Math.pow(b1 - b2, 2)
        );
    },

    /**
     * Hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * RGB to Hex
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    /**
     * Get pixel index in ImageData
     */
    getPixelIndex(x, y, width) {
        return (y * width + x) * 4;
    },

    /**
     * Get pixel from ImageData
     */
    getPixel(imageData, x, y) {
        const i = this.getPixelIndex(x, y, imageData.width);
        return {
            r: imageData.data[i],
            g: imageData.data[i + 1],
            b: imageData.data[i + 2],
            a: imageData.data[i + 3]
        };
    },

    /**
     * Set pixel in ImageData
     */
    setPixel(imageData, x, y, r, g, b, a = 255) {
        const i = this.getPixelIndex(x, y, imageData.width);
        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
        imageData.data[i + 3] = a;
    },

    /**
     * Apply Gaussian blur to ImageData
     */
    gaussianBlur(imageData, radius) {
        if (radius <= 0) return imageData;
        
        const width = imageData.width;
        const height = imageData.height;
        const result = this.cloneImageData(imageData);
        
        // Create Gaussian kernel
        const kernel = [];
        const sigma = radius / 3;
        let sum = 0;
        
        for (let i = -radius; i <= radius; i++) {
            const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
            kernel.push(weight);
            sum += weight;
        }
        
        // Normalize kernel
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] /= sum;
        }
        
        // Horizontal pass
        const temp = this.cloneImageData(imageData);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                
                for (let k = -radius; k <= radius; k++) {
                    const px = this.clamp(x + k, 0, width - 1);
                    const pixel = this.getPixel(imageData, px, y);
                    const weight = kernel[k + radius];
                    
                    r += pixel.r * weight;
                    g += pixel.g * weight;
                    b += pixel.b * weight;
                    a += pixel.a * weight;
                }
                
                this.setPixel(temp, x, y, r, g, b, a);
            }
        }
        
        // Vertical pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                
                for (let k = -radius; k <= radius; k++) {
                    const py = this.clamp(y + k, 0, height - 1);
                    const pixel = this.getPixel(temp, x, py);
                    const weight = kernel[k + radius];
                    
                    r += pixel.r * weight;
                    g += pixel.g * weight;
                    b += pixel.b * weight;
                    a += pixel.a * weight;
                }
                
                this.setPixel(result, x, y, r, g, b, a);
            }
        }
        
        return result;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Setup file upload drag and drop
     */
    setupFileUpload(uploadElement, fileInput, callback) {
        uploadElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadElement.classList.add('dragover');
        });

        uploadElement.addEventListener('dragleave', () => {
            uploadElement.classList.remove('dragover');
        });

        uploadElement.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadElement.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) callback(file);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) callback(file);
        });
    },

    /**
     * Setup range slider with value display
     */
    setupRangeSlider(sliderId, valueId, callback) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        
        if (!slider || !valueDisplay) return;
        
        slider.addEventListener('input', () => {
            valueDisplay.textContent = slider.value;
            if (callback) callback(parseFloat(slider.value));
        });
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
