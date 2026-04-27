# Indie Dev Toys

A clean, web-based platform with practical tools for indie developers. All tools run entirely in the browser with no installation required.

**Live Demo:** https://mhzegit.github.io/indie-dev-toys/

![Indie Dev Toys Screenshot](screenshot.png)

## Features

- **100% Browser-Based**: No server required, no data uploads, complete privacy
- **Modular Design**: Each tool is independent and isolated
- **Fast & Minimal**: Lightweight interface with immediate visual feedback
- **Production Ready**: Deterministic, predictable utilities for real use

## Tools Included

### 🔲 Seamless Texture Generator
Convert any image into a seamless, tileable texture with multiple blending methods:
- Mirror Blend
- Linear Blend
- Cosine Blend
- Advanced Multi-Pass

Features:
- Pre-crop options
- Brightness normalization
- Edge color averaging
- Tiled preview
- Multiple output formats (PNG, JPEG, WebP)

### ✂️ Background Remover
Remove unwanted backgrounds and export with transparency:
- Color selection removal
- Chroma key (green/blue screen)
- Luminance threshold
- Magic wand (flood fill)

Features:
- Color picker from image
- Adjustable tolerance
- Edge feathering
- Color despill
- Mask preview

### 📐 Texture Dilation
Expand edge pixels to avoid seam artifacts in texture atlases:
- Standard push outward
- Average neighbor
- Nearest opaque
- Gaussian weighted

Features:
- Multiple iterations
- Adjustable radius
- Alpha threshold control
- Side-by-side comparison
- Highlight dilated areas

### 🗻 Normal Map Generator
Generate high-quality normal maps from diffuse textures:
- Sobel filter
- Scharr filter (sharper)
- Prewitt filter
- Emboss style

Features:
- Adjustable strength
- Multiple height sources (luminance, RGB, individual channels)
- Invert X/Y options
- Tileable edge support
- Interactive 3D lighting preview

## Getting Started

1. Clone or download this repository
2. Open `index.html` in a modern web browser
3. Or serve it with any static file server:

```bash
npx serve
```

## Keyboard Shortcuts

- `Alt + 0` - Dashboard
- `Alt + 1` - Seamless Texture
- `Alt + 2` - Background Remover
- `Alt + 3` - Texture Dilation
- `Alt + 4` - Normal Map
- `Escape` - Return to Dashboard

## Browser Compatibility

Works in all modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Adding New Tools

The platform is designed to be extensible. To add a new tool:

1. Add HTML for the tool view in `index.html`
2. Add navigation link in the sidebar
3. Add a dashboard card
4. Create tool JavaScript in `js/tools/your-tool.js`
5. Include the script in `index.html`

Each tool follows a consistent pattern:
- `init()` - Setup event listeners
- `loadImage(file)` - Load and prepare image
- `processImage()` - Main processing logic
- `downloadResult()` - Export functionality

## License

MIT License - Feel free to use this in your own projects!

## Contributing

Contributions welcome! Some ideas for new tools:
- Sprite sheet packer
- Color palette extractor
- Image resizer with presets
- Noise/pattern generator
- Pixel art scaler
- UV map checker

---

Made with ❤️ for indie developers
