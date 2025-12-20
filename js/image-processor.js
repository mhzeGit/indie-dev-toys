/**
 * Indie Dev Toys - Core Image Processor
 * Low-level image processing functions
 */

const ImageProcessor = {
    /**
     * Crop image
     */
    cropImage(imageData, left, top, right, bottom) {
        const width = imageData.width;
        const height = imageData.height;
        
        const newWidth = width - left - right;
        const newHeight = height - top - bottom;
        
        if (newWidth <= 0 || newHeight <= 0) {
            return imageData;
        }
        
        const result = new ImageData(newWidth, newHeight);
        
        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                const srcX = x + left;
                const srcY = y + top;
                const srcIdx = (srcY * width + srcX) * 4;
                const dstIdx = (y * newWidth + x) * 4;
                
                result.data[dstIdx] = imageData.data[srcIdx];
                result.data[dstIdx + 1] = imageData.data[srcIdx + 1];
                result.data[dstIdx + 2] = imageData.data[srcIdx + 2];
                result.data[dstIdx + 3] = imageData.data[srcIdx + 3];
            }
        }
        
        return result;
    },

    /**
     * Normalize brightness across the image
     */
    normalizeBrightness(imageData) {
        const result = Utils.cloneImageData(imageData);
        const data = result.data;
        
        let minLum = 255, maxLum = 0;
        
        // Find min/max luminance
        for (let i = 0; i < data.length; i += 4) {
            const lum = Utils.getLuminance(data[i], data[i + 1], data[i + 2]);
            minLum = Math.min(minLum, lum);
            maxLum = Math.max(maxLum, lum);
        }
        
        if (maxLum === minLum) return result;
        
        const range = maxLum - minLum;
        
        // Normalize
        for (let i = 0; i < data.length; i += 4) {
            const factor = (Utils.getLuminance(data[i], data[i + 1], data[i + 2]) - minLum) / range;
            const targetLum = factor * 255;
            const currentLum = Utils.getLuminance(data[i], data[i + 1], data[i + 2]);
            
            if (currentLum > 0) {
                const adjustment = targetLum / currentLum;
                data[i] = Utils.clamp(data[i] * adjustment, 0, 255);
                data[i + 1] = Utils.clamp(data[i + 1] * adjustment, 0, 255);
                data[i + 2] = Utils.clamp(data[i + 2] * adjustment, 0, 255);
            }
        }
        
        return result;
    },

    /**
     * Average edge colors to reduce visible seams
     */
    averageEdgeColors(imageData, intensity, radius) {
        if (intensity <= 0) return imageData;
        
        const result = Utils.cloneImageData(imageData);
        const width = imageData.width;
        const height = imageData.height;
        const factor = intensity / 100;
        
        // Calculate average color of all edges
        let avgR = 0, avgG = 0, avgB = 0, count = 0;
        
        // Top and bottom edges
        for (let x = 0; x < width; x++) {
            for (let edge of [0, height - 1]) {
                const pixel = Utils.getPixel(imageData, x, edge);
                avgR += pixel.r;
                avgG += pixel.g;
                avgB += pixel.b;
                count++;
            }
        }
        
        // Left and right edges
        for (let y = 1; y < height - 1; y++) {
            for (let edge of [0, width - 1]) {
                const pixel = Utils.getPixel(imageData, edge, y);
                avgR += pixel.r;
                avgG += pixel.g;
                avgB += pixel.b;
                count++;
            }
        }
        
        avgR /= count;
        avgG /= count;
        avgB /= count;
        
        // Apply gradual adjustment towards edges
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate distance from nearest edge
                const distLeft = x;
                const distRight = width - 1 - x;
                const distTop = y;
                const distBottom = height - 1 - y;
                const minDist = Math.min(distLeft, distRight, distTop, distBottom);
                
                if (minDist < radius) {
                    const edgeFactor = (1 - minDist / radius) * factor;
                    const pixel = Utils.getPixel(imageData, x, y);
                    
                    Utils.setPixel(result, x, y,
                        Utils.lerp(pixel.r, avgR, edgeFactor),
                        Utils.lerp(pixel.g, avgG, edgeFactor),
                        Utils.lerp(pixel.b, avgB, edgeFactor),
                        pixel.a
                    );
                }
            }
        }
        
        return result;
    },

    /**
     * Create seamless texture using mirror blend method
     */
    seamlessMirror(imageData, blendSize) {
        const width = imageData.width;
        const height = imageData.height;
        const result = Utils.cloneImageData(imageData);
        
        const blendWidth = Math.floor(width * blendSize / 100);
        const blendHeight = Math.floor(height * blendSize / 100);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let pixel = Utils.getPixel(imageData, x, y);
                
                // Horizontal blending at edges
                if (x < blendWidth) {
                    const factor = x / blendWidth;
                    const mirrorX = width - 1 - x;
                    const mirrorPixel = Utils.getPixel(imageData, mirrorX, y);
                    
                    pixel = {
                        r: Utils.lerp(mirrorPixel.r, pixel.r, factor),
                        g: Utils.lerp(mirrorPixel.g, pixel.g, factor),
                        b: Utils.lerp(mirrorPixel.b, pixel.b, factor),
                        a: pixel.a
                    };
                } else if (x >= width - blendWidth) {
                    const factor = (width - 1 - x) / blendWidth;
                    const mirrorX = width - 1 - x;
                    const mirrorPixel = Utils.getPixel(imageData, mirrorX, y);
                    
                    pixel = {
                        r: Utils.lerp(mirrorPixel.r, pixel.r, factor),
                        g: Utils.lerp(mirrorPixel.g, pixel.g, factor),
                        b: Utils.lerp(mirrorPixel.b, pixel.b, factor),
                        a: pixel.a
                    };
                }
                
                // Vertical blending at edges
                if (y < blendHeight) {
                    const factor = y / blendHeight;
                    const mirrorY = height - 1 - y;
                    const mirrorPixel = Utils.getPixel(imageData, x, mirrorY);
                    
                    pixel = {
                        r: Utils.lerp(mirrorPixel.r, pixel.r, factor),
                        g: Utils.lerp(mirrorPixel.g, pixel.g, factor),
                        b: Utils.lerp(mirrorPixel.b, pixel.b, factor),
                        a: pixel.a
                    };
                } else if (y >= height - blendHeight) {
                    const factor = (height - 1 - y) / blendHeight;
                    const mirrorY = height - 1 - y;
                    const mirrorPixel = Utils.getPixel(imageData, x, mirrorY);
                    
                    pixel = {
                        r: Utils.lerp(mirrorPixel.r, pixel.r, factor),
                        g: Utils.lerp(mirrorPixel.g, pixel.g, factor),
                        b: Utils.lerp(mirrorPixel.b, pixel.b, factor),
                        a: pixel.a
                    };
                }
                
                Utils.setPixel(result, x, y, pixel.r, pixel.g, pixel.b, pixel.a);
            }
        }
        
        return result;
    },

    /**
     * Create seamless texture using linear blend method
     */
    seamlessLinear(imageData, blendSize) {
        const width = imageData.width;
        const height = imageData.height;
        const result = Utils.cloneImageData(imageData);
        
        const blendWidth = Math.floor(width * blendSize / 100);
        const blendHeight = Math.floor(height * blendSize / 100);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixel = Utils.getPixel(imageData, x, y);
                
                // Calculate blend factors for edges
                let hFactor = 1, vFactor = 1;
                let blendPixelH = pixel, blendPixelV = pixel;
                
                // Horizontal edge blending
                if (x < blendWidth) {
                    hFactor = x / blendWidth;
                    const wrapX = (x + Math.floor(width / 2)) % width;
                    blendPixelH = Utils.getPixel(imageData, wrapX, y);
                } else if (x >= width - blendWidth) {
                    hFactor = (width - 1 - x) / blendWidth;
                    const wrapX = (x + Math.floor(width / 2)) % width;
                    blendPixelH = Utils.getPixel(imageData, wrapX, y);
                }
                
                // Vertical edge blending
                if (y < blendHeight) {
                    vFactor = y / blendHeight;
                    const wrapY = (y + Math.floor(height / 2)) % height;
                    blendPixelV = Utils.getPixel(imageData, x, wrapY);
                } else if (y >= height - blendHeight) {
                    vFactor = (height - 1 - y) / blendHeight;
                    const wrapY = (y + Math.floor(height / 2)) % height;
                    blendPixelV = Utils.getPixel(imageData, x, wrapY);
                }
                
                // Combine horizontal and vertical blending
                const r = Utils.lerp(
                    Utils.lerp(blendPixelH.r, pixel.r, hFactor),
                    Utils.lerp(blendPixelV.r, pixel.r, vFactor),
                    0.5
                );
                const g = Utils.lerp(
                    Utils.lerp(blendPixelH.g, pixel.g, hFactor),
                    Utils.lerp(blendPixelV.g, pixel.g, vFactor),
                    0.5
                );
                const b = Utils.lerp(
                    Utils.lerp(blendPixelH.b, pixel.b, hFactor),
                    Utils.lerp(blendPixelV.b, pixel.b, vFactor),
                    0.5
                );
                
                Utils.setPixel(result, x, y, r, g, b, pixel.a);
            }
        }
        
        return result;
    },

    /**
     * Create seamless texture using cosine blend method
     */
    seamlessCosine(imageData, blendSize) {
        const width = imageData.width;
        const height = imageData.height;
        const result = Utils.cloneImageData(imageData);
        
        const blendWidth = Math.floor(width * blendSize / 100);
        const blendHeight = Math.floor(height * blendSize / 100);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixel = Utils.getPixel(imageData, x, y);
                
                let hFactor = 1, vFactor = 1;
                let blendPixelH = pixel, blendPixelV = pixel;
                
                // Horizontal edge with cosine interpolation
                if (x < blendWidth) {
                    hFactor = Utils.cosineInterpolation(x / blendWidth);
                    const wrapX = (x + Math.floor(width / 2)) % width;
                    blendPixelH = Utils.getPixel(imageData, wrapX, y);
                } else if (x >= width - blendWidth) {
                    hFactor = Utils.cosineInterpolation((width - 1 - x) / blendWidth);
                    const wrapX = (x + Math.floor(width / 2)) % width;
                    blendPixelH = Utils.getPixel(imageData, wrapX, y);
                }
                
                // Vertical edge with cosine interpolation
                if (y < blendHeight) {
                    vFactor = Utils.cosineInterpolation(y / blendHeight);
                    const wrapY = (y + Math.floor(height / 2)) % height;
                    blendPixelV = Utils.getPixel(imageData, x, wrapY);
                } else if (y >= height - blendHeight) {
                    vFactor = Utils.cosineInterpolation((height - 1 - y) / blendHeight);
                    const wrapY = (y + Math.floor(height / 2)) % height;
                    blendPixelV = Utils.getPixel(imageData, x, wrapY);
                }
                
                // Combine with weighted blending
                const combinedFactor = hFactor * vFactor;
                const edgeFactor = 1 - combinedFactor;
                
                const avgBlendR = (blendPixelH.r + blendPixelV.r) / 2;
                const avgBlendG = (blendPixelH.g + blendPixelV.g) / 2;
                const avgBlendB = (blendPixelH.b + blendPixelV.b) / 2;
                
                const r = pixel.r * combinedFactor + avgBlendR * edgeFactor;
                const g = pixel.g * combinedFactor + avgBlendG * edgeFactor;
                const b = pixel.b * combinedFactor + avgBlendB * edgeFactor;
                
                Utils.setPixel(result, x, y, r, g, b, pixel.a);
            }
        }
        
        return result;
    },

    /**
     * Create seamless texture using advanced multi-pass method
     */
    seamlessAdvanced(imageData, blendSize) {
        const width = imageData.width;
        const height = imageData.height;
        
        // Create offset version (shifted by half)
        const halfWidth = Math.floor(width / 2);
        const halfHeight = Math.floor(height / 2);
        
        const shifted = new ImageData(width, height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcX = (x + halfWidth) % width;
                const srcY = (y + halfHeight) % height;
                const pixel = Utils.getPixel(imageData, srcX, srcY);
                Utils.setPixel(shifted, x, y, pixel.r, pixel.g, pixel.b, pixel.a);
            }
        }
        
        // Create blend mask
        const result = new ImageData(width, height);
        const blendWidth = Math.floor(width * blendSize / 100);
        const blendHeight = Math.floor(height * blendSize / 100);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Diamond-shaped blend factor
                const distX = Math.abs(x - halfWidth) / halfWidth;
                const distY = Math.abs(y - halfHeight) / halfHeight;
                const dist = Math.sqrt(distX * distX + distY * distY);
                
                // Smooth transition
                let factor = Utils.smoothstep(0.3, 0.7, dist);
                
                const orig = Utils.getPixel(imageData, x, y);
                const shift = Utils.getPixel(shifted, x, y);
                
                const r = Utils.lerp(shift.r, orig.r, factor);
                const g = Utils.lerp(shift.g, orig.g, factor);
                const b = Utils.lerp(shift.b, orig.b, factor);
                
                Utils.setPixel(result, x, y, r, g, b, orig.a);
            }
        }
        
        // Additional edge smoothing pass
        return this.seamlessCosine(result, blendSize / 2);
    },

    /**
     * Remove background by color selection
     */
    removeBackgroundByColor(imageData, targetColor, tolerance, options = {}) {
        const result = Utils.cloneImageData(imageData);
        const { invert = false, softness = 2, despill = false } = options;
        
        const tR = targetColor.r;
        const tG = targetColor.g;
        const tB = targetColor.b;
        
        const maxDist = Math.sqrt(255 * 255 * 3);
        const toleranceDist = (tolerance / 100) * maxDist;
        
        for (let i = 0; i < result.data.length; i += 4) {
            const r = result.data[i];
            const g = result.data[i + 1];
            const b = result.data[i + 2];
            
            const dist = Utils.colorDistance(r, g, b, tR, tG, tB);
            
            let alpha;
            if (dist <= toleranceDist) {
                const edgeDist = toleranceDist - dist;
                const edgeFactor = Math.min(edgeDist / (softness * 10), 1);
                alpha = edgeFactor * 255;
            } else {
                alpha = 255;
            }
            
            if (invert) {
                alpha = 255 - alpha;
            }
            
            result.data[i + 3] = alpha;
            
            // Color despill
            if (despill && alpha < 255) {
                const spillFactor = 1 - alpha / 255;
                const avgOther = (r + g + b - Math.max(tR, tG, tB)) / 2;
                
                if (tG > tR && tG > tB) {
                    result.data[i + 1] = Utils.lerp(g, Math.min(r, b), spillFactor);
                } else if (tB > tR && tB > tG) {
                    result.data[i + 2] = Utils.lerp(b, Math.min(r, g), spillFactor);
                }
            }
        }
        
        return result;
    },

    /**
     * Remove background by luminance threshold
     */
    removeBackgroundByLuminance(imageData, threshold, options = {}) {
        const result = Utils.cloneImageData(imageData);
        const { invert = false, softness = 2 } = options;
        
        const thresholdValue = (threshold / 100) * 255;
        
        for (let i = 0; i < result.data.length; i += 4) {
            const lum = Utils.getLuminance(
                result.data[i],
                result.data[i + 1],
                result.data[i + 2]
            );
            
            let alpha;
            const diff = Math.abs(lum - thresholdValue);
            
            if (lum > thresholdValue) {
                alpha = Math.min(255, (diff / softness) * 10);
            } else {
                alpha = Math.max(0, 255 - (diff / softness) * 10);
            }
            
            if (invert) {
                alpha = 255 - alpha;
            }
            
            result.data[i + 3] = alpha;
        }
        
        return result;
    },

    /**
     * Flood fill (magic wand) background removal
     */
    floodFillRemove(imageData, startX, startY, tolerance, options = {}) {
        const result = Utils.cloneImageData(imageData);
        const width = imageData.width;
        const height = imageData.height;
        const { invert = false } = options;
        
        const startPixel = Utils.getPixel(imageData, startX, startY);
        const maxDist = Math.sqrt(255 * 255 * 3);
        const toleranceDist = (tolerance / 100) * maxDist;
        
        const visited = new Set();
        const stack = [[startX, startY]];
        const selected = new Set();
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            visited.add(key);
            
            const pixel = Utils.getPixel(imageData, x, y);
            const dist = Utils.colorDistance(
                pixel.r, pixel.g, pixel.b,
                startPixel.r, startPixel.g, startPixel.b
            );
            
            if (dist <= toleranceDist) {
                selected.add(key);
                stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
        }
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const key = `${x},${y}`;
                const isSelected = selected.has(key);
                const idx = (y * width + x) * 4;
                
                if (invert) {
                    result.data[idx + 3] = isSelected ? 255 : 0;
                } else {
                    result.data[idx + 3] = isSelected ? 0 : 255;
                }
            }
        }
        
        return result;
    },

    /**
     * Feather edges of transparency
     */
    featherEdges(imageData, radius) {
        if (radius <= 0) return imageData;
        
        // Use Gaussian blur on alpha channel only
        const result = Utils.cloneImageData(imageData);
        const width = imageData.width;
        const height = imageData.height;
        
        // Create alpha-only buffer
        const alphaBuffer = new Float32Array(width * height);
        for (let i = 0; i < width * height; i++) {
            alphaBuffer[i] = imageData.data[i * 4 + 3];
        }
        
        // Apply Gaussian blur to alpha
        const kernel = [];
        const sigma = radius / 2;
        let sum = 0;
        
        for (let i = -radius; i <= radius; i++) {
            const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
            kernel.push(weight);
            sum += weight;
        }
        
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] /= sum;
        }
        
        // Horizontal pass
        const temp = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let val = 0;
                for (let k = -radius; k <= radius; k++) {
                    const px = Utils.clamp(x + k, 0, width - 1);
                    val += alphaBuffer[y * width + px] * kernel[k + radius];
                }
                temp[y * width + x] = val;
            }
        }
        
        // Vertical pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let val = 0;
                for (let k = -radius; k <= radius; k++) {
                    const py = Utils.clamp(y + k, 0, height - 1);
                    val += temp[py * width + x] * kernel[k + radius];
                }
                result.data[(y * width + x) * 4 + 3] = Utils.clamp(val, 0, 255);
            }
        }
        
        return result;
    },

    /**
     * Dilate texture to fill transparent edges
     */
    dilateTexture(imageData, radius, method = 'standard', options = {}) {
        const { threshold = 128, preserveAlpha = true } = options;
        const width = imageData.width;
        const height = imageData.height;
        const result = Utils.cloneImageData(imageData);
        
        // Find edge pixels (opaque pixels adjacent to transparent)
        const isOpaque = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            return imageData.data[(y * width + x) * 4 + 3] >= threshold;
        };
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                // Only process transparent pixels
                if (imageData.data[idx + 3] >= threshold) continue;
                
                // Find nearest opaque pixels within radius
                let nearestDist = Infinity;
                let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;
                
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        
                        if (!isOpaque(nx, ny)) continue;
                        
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > radius) continue;
                        
                        const srcIdx = (ny * width + nx) * 4;
                        
                        if (method === 'nearest') {
                            if (dist < nearestDist) {
                                nearestDist = dist;
                                totalR = imageData.data[srcIdx];
                                totalG = imageData.data[srcIdx + 1];
                                totalB = imageData.data[srcIdx + 2];
                            }
                        } else if (method === 'gaussian') {
                            const weight = Math.exp(-(dist * dist) / (2 * (radius / 2) * (radius / 2)));
                            totalR += imageData.data[srcIdx] * weight;
                            totalG += imageData.data[srcIdx + 1] * weight;
                            totalB += imageData.data[srcIdx + 2] * weight;
                            totalWeight += weight;
                        } else {
                            // Standard and average methods
                            const weight = 1 / (dist + 1);
                            totalR += imageData.data[srcIdx] * weight;
                            totalG += imageData.data[srcIdx + 1] * weight;
                            totalB += imageData.data[srcIdx + 2] * weight;
                            totalWeight += weight;
                        }
                    }
                }
                
                if (method === 'nearest' && nearestDist < Infinity) {
                    result.data[idx] = totalR;
                    result.data[idx + 1] = totalG;
                    result.data[idx + 2] = totalB;
                    if (!preserveAlpha) result.data[idx + 3] = 255;
                } else if (totalWeight > 0) {
                    result.data[idx] = totalR / totalWeight;
                    result.data[idx + 1] = totalG / totalWeight;
                    result.data[idx + 2] = totalB / totalWeight;
                    if (!preserveAlpha) result.data[idx + 3] = 255;
                }
            }
        }
        
        return result;
    },

    /**
     * Generate normal map from height/color data
     */
    generateNormalMap(imageData, options = {}) {
        const {
            method = 'sobel',
            strength = 1.0,
            heightSource = 'luminance',
            invertR = false,
            invertG = false,
            tileable = true,
            normalizeVectors = true,
            zComponent = 1.0
        } = options;
        
        const width = imageData.width;
        const height = imageData.height;
        const result = new ImageData(width, height);
        
        // Create height map
        const heightMap = new Float32Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = imageData.data[idx];
                const g = imageData.data[idx + 1];
                const b = imageData.data[idx + 2];
                
                let h;
                switch (heightSource) {
                    case 'average':
                        h = (r + g + b) / 3;
                        break;
                    case 'max':
                        h = Math.max(r, g, b);
                        break;
                    case 'red':
                        h = r;
                        break;
                    case 'green':
                        h = g;
                        break;
                    case 'blue':
                        h = b;
                        break;
                    default: // luminance
                        h = Utils.getLuminance(r, g, b);
                }
                
                heightMap[y * width + x] = h / 255;
            }
        }
        
        // Get height with wrapping for tileable
        const getHeight = (x, y) => {
            if (tileable) {
                x = ((x % width) + width) % width;
                y = ((y % height) + height) % height;
            } else {
                x = Utils.clamp(x, 0, width - 1);
                y = Utils.clamp(y, 0, height - 1);
            }
            return heightMap[y * width + x];
        };
        
        // Convolution kernels
        const kernels = {
            sobel: {
                x: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
                y: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
            },
            scharr: {
                x: [[-3, 0, 3], [-10, 0, 10], [-3, 0, 3]],
                y: [[-3, -10, -3], [0, 0, 0], [3, 10, 3]]
            },
            prewitt: {
                x: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
                y: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]]
            },
            emboss: {
                x: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
                y: [[0, -1, -2], [1, 1, -1], [2, 1, 0]]
            }
        };
        
        const kernel = kernels[method] || kernels.sobel;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Apply convolution
                let dx = 0, dy = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const h = getHeight(x + kx, y + ky);
                        dx += h * kernel.x[ky + 1][kx + 1];
                        dy += h * kernel.y[ky + 1][kx + 1];
                    }
                }
                
                // Apply strength
                dx *= strength;
                dy *= strength;
                
                // Invert if needed
                if (invertR) dx = -dx;
                if (invertG) dy = -dy;
                
                // Create normal vector
                let nx = -dx;
                let ny = -dy;
                let nz = zComponent;
                
                // Normalize if needed
                if (normalizeVectors) {
                    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                    if (len > 0) {
                        nx /= len;
                        ny /= len;
                        nz /= len;
                    }
                }
                
                // Convert to RGB (0-255 range)
                const idx = (y * width + x) * 4;
                result.data[idx] = Utils.clamp((nx * 0.5 + 0.5) * 255, 0, 255);
                result.data[idx + 1] = Utils.clamp((ny * 0.5 + 0.5) * 255, 0, 255);
                result.data[idx + 2] = Utils.clamp((nz * 0.5 + 0.5) * 255, 0, 255);
                result.data[idx + 3] = 255;
            }
        }
        
        return result;
    },

    /**
     * Generate height map preview
     */
    generateHeightMap(imageData, heightSource = 'luminance') {
        const result = new ImageData(imageData.width, imageData.height);
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            
            let h;
            switch (heightSource) {
                case 'average':
                    h = (r + g + b) / 3;
                    break;
                case 'max':
                    h = Math.max(r, g, b);
                    break;
                case 'red':
                    h = r;
                    break;
                case 'green':
                    h = g;
                    break;
                case 'blue':
                    h = b;
                    break;
                default:
                    h = Utils.getLuminance(r, g, b);
            }
            
            result.data[i] = h;
            result.data[i + 1] = h;
            result.data[i + 2] = h;
            result.data[i + 3] = 255;
        }
        
        return result;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageProcessor;
}
