/**
 * File Converter Tool
 * Converts images (Canvas API), audio and video (FFmpeg.wasm) entirely in the browser.
 */

const FileConverter = (() => {

    // ─── Format definitions ────────────────────────────────────────────────────

    const FORMATS = {
        image: {
            input:  ['jpg','jpeg','png','webp','gif','bmp','tiff','tif','ico','svg','avif'],
            output: ['png','jpeg','webp','bmp'],
            label:  'Image'
        },
        audio: {
            input:  ['mp3','wav','ogg','flac','aac','m4a','opus','aiff','wma'],
            output: ['mp3','wav','ogg','flac','aac','opus'],
            label:  'Audio'
        },
        video: {
            input:  ['mp4','webm','mov','avi','mkv','flv','wmv','mpeg','mpg','3gp','m4v'],
            output: ['mp4','webm','mov','avi','mkv','gif'],
            label:  'Video'
        }
    };

    const MIME = {
        png:  'image/png',
        jpeg: 'image/jpeg',
        jpg:  'image/jpeg',
        webp: 'image/webp',
        bmp:  'image/bmp',
        gif:  'image/gif',
        mp3:  'audio/mpeg',
        wav:  'audio/wav',
        ogg:  'audio/ogg',
        flac: 'audio/flac',
        aac:  'audio/aac',
        opus: 'audio/opus',
        m4a:  'audio/mp4',
        mp4:  'video/mp4',
        webm: 'video/webm',
        mov:  'video/quicktime',
        avi:  'video/x-msvideo',
        mkv:  'video/x-matroska',
        flv:  'video/x-flv',
        wmv:  'video/x-ms-wmv',
    };

    // Icon classes per category
    const ICONS = {
        image: 'fas fa-image',
        audio: 'fas fa-music',
        video: 'fas fa-film'
    };

    // ─── Per-format default settings ───────────────────────────────────────────

    const DEFAULT_SETTINGS = {
        image: { quality: 85, maxWidth: '', maxHeight: '' },
        audio: { startTime: '', endTime: '', sampleRate: 'original', channels: 'original' },
        gif:   { startTime: '', endTime: '', fps: 10, width: 480 },
        video: { startTime: '', endTime: '', resolution: 'original', fps: 'original', muteAudio: false },
    };

    function getSettingsKey(category, targetFmt) {
        if (category === 'image') return 'image';
        if (category === 'audio') return 'audio';
        if (category === 'video' && targetFmt === 'gif') return 'gif';
        return 'video';
    }

    function getDefaultSettings(category, targetFmt) {
        return { ...DEFAULT_SETTINGS[getSettingsKey(category, targetFmt)] };
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    let fileEntries   = [];   // { id, file, category, targetFmt, settings, status, resultBlob }
    let nextId        = 0;
    let ffmpeg        = null;
    let ffmpegLoaded  = false;
    let ffmpegLoading = false;
    let ffmpegLoadResolvers = [];

    // ─── DOM refs (populated in init) ─────────────────────────────────────────

    let dom = {};

    // ─── Helpers ───────────────────────────────────────────────────────────────

    function ext(filename) {
        return filename.split('.').pop().toLowerCase().replace(/\?.*$/, '');
    }

    function categoryOf(filename) {
        const e = ext(filename);
        for (const [cat, def] of Object.entries(FORMATS)) {
            if (def.input.includes(e)) return cat;
        }
        return null;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024)        return bytes + ' B';
        if (bytes < 1048576)     return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function quality() {
        return parseInt(dom.quality.value, 10);
    }

    // ─── FFmpeg loading ────────────────────────────────────────────────────────

    async function ensureFFmpeg() {
        if (ffmpegLoaded) return;

        if (ffmpegLoading) {
            // Wait for the current load to finish
            await new Promise(resolve => ffmpegLoadResolvers.push(resolve));
            return;
        }

        ffmpegLoading = true;
        showCodecBar(true);

        try {
            // Use the ESM build via dynamic import (proxied same-origin).
            // The ESM worker uses import(/* webpackIgnore: true */ coreURL) which
            // bypasses webpack's __webpack_require__, so blob: URLs work correctly.
            // The UMD build's webpack-bundled worker was intercepting importScripts/
            // require and failing with "Cannot find module 'blob:...'".
            const { FFmpeg } = await import('/_cdn/ffmpeg-esm/index.js');

            ffmpeg = new FFmpeg();

            ffmpeg.on('log', ({ message }) => {
                console.debug('[FFmpeg]', message);
            });

            ffmpeg.on('progress', ({ progress }) => {
                const pct = Math.min(100, Math.round(progress * 100));
                setCodecProgress(pct);
            });

            const CORE_PATH = '/_cdn/ffmpeg-core';

            // Download WASM via XHR so we can report real progress.
            const wasmURL = await loadWasmWithProgress(
                `${CORE_PATH}/ffmpeg-core.wasm`,
                'application/wasm'
            );

            // Wrap the core JS in a blob: URL so the ESM worker's
            // import(/* webpackIgnore: true */ coreURL) can load it
            // without any CORP/COEP restriction.
            const coreURL = await fetchAsBlobURL(
                `${CORE_PATH}/ffmpeg-core.js`,
                'text/javascript'
            );

            await ffmpeg.load({ coreURL, wasmURL });

            ffmpegLoaded  = true;
            ffmpegLoading = false;
            showCodecBar(false);

            ffmpegLoadResolvers.forEach(r => r());
            ffmpegLoadResolvers = [];

        } catch (err) {
            ffmpegLoading = false;
            showCodecBar(false);
            ffmpegLoadResolvers.forEach(r => r());
            ffmpegLoadResolvers = [];
            const msg = err?.message || err?.toString() || JSON.stringify(err) || 'unknown error';
            console.error('[FFmpeg load error]', err);
            throw new Error('Failed to load FFmpeg: ' + msg);
        }
    }

    // Fetches a URL as a blob, tracking download progress, returns a blob: URL
    async function loadWasmWithProgress(url, mimeType) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';

            xhr.onprogress = (e) => {
                if (e.lengthComputable) {
                    setCodecProgress(Math.round((e.loaded / e.total) * 90));
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const blob    = new Blob([xhr.response], { type: mimeType });
                    const blobUrl = URL.createObjectURL(blob);
                    setCodecProgress(100);
                    resolve(blobUrl);
                } else {
                    reject(new Error(`HTTP ${xhr.status}`));
                }
            };

            xhr.onerror  = () => reject(new Error('Network error loading WASM'));
            xhr.send();
        });
    }

    // Fetches a URL via fetch() and returns a blob: URL with the given MIME type.
    // Used for the core JS so the ESM worker's dynamic import() can load it.
    async function fetchAsBlobURL(url, mimeType) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
        const buf  = await response.arrayBuffer();
        return URL.createObjectURL(new Blob([buf], { type: mimeType }));
    }

    function showCodecBar(visible) {
        dom.codecBar.style.display = visible ? 'flex' : 'none';
    }

    function setCodecProgress(pct) {
        dom.codecProgress.style.width = pct + '%';
    }

    // ─── Image conversion (Canvas) ─────────────────────────────────────────────

    async function convertImage(file, targetFmt, settings) {
        const q = settings.quality ?? 85;
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                let w = img.naturalWidth;
                let h = img.naturalHeight;

                // Apply max-dimension constraints (preserving aspect ratio)
                const maxW = parseInt(settings.maxWidth)  || 0;
                const maxH = parseInt(settings.maxHeight) || 0;
                if (maxW > 0 || maxH > 0) {
                    let scale = 1;
                    if (maxW > 0 && w > maxW) scale = Math.min(scale, maxW / w);
                    if (maxH > 0 && h > maxH) scale = Math.min(scale, maxH / h);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                }

                const canvas = document.createElement('canvas');
                canvas.width  = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                // JPEG / BMP have no transparency – fill white background
                if (targetFmt === 'jpeg' || targetFmt === 'bmp') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                }
                ctx.drawImage(img, 0, 0, w, h);

                if (targetFmt === 'bmp') {
                    resolve(canvasToBMP(canvas));
                } else {
                    const mime = MIME[targetFmt] || 'image/png';
                    canvas.toBlob(
                        blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
                        mime,
                        targetFmt === 'png' ? undefined : q / 100
                    );
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not decode image'));
            };

            img.src = url;
        });
    }

    /**
     * Encodes a canvas as a 24-bit BMP (no alpha, bottom-up row order).
     */
    function canvasToBMP(canvas) {
        const w   = canvas.width;
        const h   = canvas.height;
        const ctx = canvas.getContext('2d');
        const img = ctx.getImageData(0, 0, w, h);
        const src = img.data;

        // Row stride must be padded to a multiple of 4 bytes (24-bit = 3 bytes/px)
        const rowStride   = Math.ceil(w * 3 / 4) * 4;
        const pixelBytes  = rowStride * h;
        const fileSize    = 54 + pixelBytes;

        const buf  = new ArrayBuffer(fileSize);
        const view = new DataView(buf);
        const u8   = new Uint8Array(buf);

        // File header (14 bytes)
        u8[0] = 0x42; u8[1] = 0x4D;              // 'BM'
        view.setUint32( 2, fileSize,    true);    // file size
        view.setUint32( 6, 0,           true);    // reserved
        view.setUint32(10, 54,          true);    // pixel data offset

        // DIB header – BITMAPINFOHEADER (40 bytes)
        view.setUint32(14, 40,          true);    // header size
        view.setInt32 (18, w,           true);    // width
        view.setInt32 (22, h,           true);    // height (positive = bottom-up)
        view.setUint16(26, 1,           true);    // colour planes
        view.setUint16(28, 24,          true);    // bits per pixel
        view.setUint32(30, 0,           true);    // compression = BI_RGB
        view.setUint32(34, pixelBytes,  true);    // pixel data size
        view.setInt32 (38, 2835,        true);    // X pixels/metre (~72 DPI)
        view.setInt32 (42, 2835,        true);    // Y pixels/metre
        view.setUint32(46, 0,           true);    // colours in table
        view.setUint32(50, 0,           true);    // important colours

        // Pixel data – BGR, rows bottom-to-top
        for (let y = 0; y < h; y++) {
            const bmpRow = h - 1 - y;
            const dstBase = 54 + bmpRow * rowStride;
            for (let x = 0; x < w; x++) {
                const si = (y * w + x) * 4;
                const di = dstBase + x * 3;
                u8[di    ] = src[si + 2]; // B
                u8[di + 1] = src[si + 1]; // G
                u8[di + 2] = src[si    ]; // R
            }
        }

        return new Blob([buf], { type: 'image/bmp' });
    }

    // ─── Audio / Video conversion (FFmpeg.wasm) ────────────────────────────────

    function audioFFmpegArgs(targetFmt, q, settings) {
        const mp3q    = Math.round(9 - (q / 100) * 9);
        const vorbq   = Math.round((q / 100) * 10);
        const bitrate = Math.max(48, Math.round(32 + (q / 100) * 288)) + 'k';

        const trimArgs = [];
        if (settings.startTime) trimArgs.push('-ss', String(settings.startTime));
        if (settings.endTime)   trimArgs.push('-to', String(settings.endTime));

        const srArgs = settings.sampleRate && settings.sampleRate !== 'original'
            ? ['-ar', settings.sampleRate] : [];
        const chArgs = settings.channels && settings.channels !== 'original'
            ? ['-ac', settings.channels] : [];

        let codecArgs;
        switch (targetFmt) {
            case 'mp3':  codecArgs = ['-c:a', 'libmp3lame', '-q:a', String(mp3q)]; break;
            case 'wav':  codecArgs = ['-c:a', 'pcm_s16le']; break;
            case 'ogg':  codecArgs = ['-c:a', 'libvorbis',  '-q:a', String(vorbq)]; break;
            case 'flac': codecArgs = ['-c:a', 'flac']; break;
            case 'aac':  codecArgs = ['-c:a', 'aac',        '-b:a', bitrate]; break;
            case 'opus': codecArgs = ['-c:a', 'libopus',    '-b:a', bitrate]; break;
            default:     codecArgs = ['-c:a', 'aac'];
        }

        return [...trimArgs, '-vn', ...codecArgs, ...srArgs, ...chArgs];
    }

    function videoFFmpegArgs(targetFmt, q, settings) {
        const crf264 = Math.round(51 - (q / 100) * 46);
        const crfVP9 = Math.round(63 - (q / 100) * 58);

        const trimArgs = [];
        if (settings.startTime) trimArgs.push('-ss', String(settings.startTime));
        if (settings.endTime)   trimArgs.push('-to', String(settings.endTime));

        // GIF branch with per-file fps and width
        if (targetFmt === 'gif') {
            const fps   = settings.fps ?? 10;
            const width = (!settings.width || settings.width === 'original') ? 'iw' : String(settings.width);
            const scale = `scale=${width}:-1:flags=lanczos`;
            return [
                ...trimArgs,
                '-vf',
                `fps=${fps},${scale},split[s0][s1];` +
                `[s0]palettegen=max_colors=256:stats_mode=diff[p];` +
                `[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
                '-loop', '0'
            ];
        }

        // Resolution / FPS filters
        const resMap = { '1080p': '-2:1080', '720p': '-2:720', '480p': '-2:480', '360p': '-2:360' };
        const vfParts = [];
        if (settings.resolution && settings.resolution !== 'original') {
            vfParts.push(`scale=${resMap[settings.resolution]}`);
        }
        if (settings.fps && settings.fps !== 'original') {
            vfParts.push(`fps=${settings.fps}`);
        }
        const vfArgs    = vfParts.length ? ['-vf', vfParts.join(',')] : [];
        const audioArgs = settings.muteAudio ? ['-an'] : ['-c:a', 'aac', '-b:a', '192k'];
        const webmAudio = settings.muteAudio ? ['-an'] : ['-c:a', 'libopus', '-b:a', '128k'];

        switch (targetFmt) {
            case 'mp4':
                return [...trimArgs, '-c:v', 'libx264',    '-crf', String(crf264), '-preset', 'fast',
                        ...vfArgs, ...audioArgs, '-movflags', '+faststart'];
            case 'webm':
                return [...trimArgs, '-c:v', 'libvpx-vp9', '-crf', String(crfVP9), '-b:v', '0',
                        ...vfArgs, ...webmAudio];
            case 'mov':
                return [...trimArgs, '-c:v', 'libx264',    '-crf', String(crf264), '-preset', 'fast',
                        ...vfArgs, ...audioArgs];
            case 'avi':
                return [...trimArgs, '-c:v', 'libx264',    '-crf', String(crf264),
                        ...vfArgs, ...audioArgs];
            case 'mkv':
                return [...trimArgs, '-c:v', 'libx264',    '-crf', String(crf264), '-preset', 'fast',
                        ...vfArgs, ...(settings.muteAudio ? ['-an'] : ['-c:a', 'aac'])];
            default:
                return [...trimArgs, '-c:v', 'libx264', ...vfArgs, ...audioArgs];
        }
    }

    async function convertMedia(entry) {
        const { file, category, targetFmt } = entry;

        await ensureFFmpeg();

        const inExt   = ext(file.name);
        const inName  = `in_${entry.id}.${inExt}`;
        const outName = `out_${entry.id}.${targetFmt}`;

        // Write input file
        const fileData = new Uint8Array(await file.arrayBuffer());
        await ffmpeg.writeFile(inName, fileData);

        // Build args
        const specificArgs = category === 'audio'
            ? audioFFmpegArgs(targetFmt, quality(), entry.settings)
            : videoFFmpegArgs(targetFmt, quality(), entry.settings);

        const args = ['-i', inName, ...specificArgs, '-y', outName];

        // Hook progress for this entry
        const progressHandler = ({ progress }) => {
            const pct = Math.min(100, Math.round(progress * 100));
            setEntryStatus(entry.id, 'converting', pct);
        };
        ffmpeg.on('progress', progressHandler);

        try {
            await ffmpeg.exec(args);
        } finally {
            ffmpeg.off('progress', progressHandler);
            // Cleanup FS
            try { await ffmpeg.deleteFile(inName); } catch (_) {}
        }

        const outData = await ffmpeg.readFile(outName);
        try { await ffmpeg.deleteFile(outName); } catch (_) {}

        const mime = MIME[targetFmt] || 'application/octet-stream';
        return new Blob([outData instanceof Uint8Array ? outData : new Uint8Array(outData)], { type: mime });
    }

    // ─── File entry management ─────────────────────────────────────────────────

    function addFiles(files) {
        let added = 0;
        for (const file of files) {
            const cat = categoryOf(file.name);
            if (!cat) continue;  // unsupported type
            const defaultFmt = FORMATS[cat].output[0];
            const entry = {
                id:         nextId++,
                file,
                category:   cat,
                targetFmt:  defaultFmt,
                settings:   getDefaultSettings(cat, defaultFmt),
                status:     'idle',    // idle | converting | done | error
                resultBlob: null,
                errorMsg:   ''
            };
            fileEntries.push(entry);
            renderFileRow(entry);
            added++;
        }
        if (added > 0) {
            updateUI();
        }
        return added;
    }

    function removeEntry(id) {
        fileEntries = fileEntries.filter(e => e.id !== id);
        document.querySelector(`[data-fc-id="${id}"]`)?.remove();
        document.getElementById(`fc-settings-row-${id}`)?.remove();
        updateUI();
    }

    function clearAll() {
        fileEntries = [];
        dom.fileList.innerHTML = '';
        updateUI();
    }

    // ─── Rendering ─────────────────────────────────────────────────────────────

    function renderFileRow(entry) {
        const { id, file, category, targetFmt } = entry;
        const options = FORMATS[category].output
            .map(f => `<option value="${f}"${f === targetFmt ? ' selected' : ''}>${f.toUpperCase()}</option>`)
            .join('');

        const fragment = document.createDocumentFragment();

        // Main file row
        const tr = document.createElement('tr');
        tr.dataset.fcId = id;
        tr.innerHTML = `
            <td class="fc-col-icon"><i class="${ICONS[category]} fc-type-icon fc-type-${category}"></i></td>
            <td class="fc-col-name" title="${escapeHtml(file.name)}">
                <span class="fc-filename">${escapeHtml(file.name)}</span>
            </td>
            <td class="fc-col-size">${formatFileSize(file.size)}</td>
            <td class="fc-col-type"><span class="fc-badge fc-badge-${category}">${FORMATS[category].label}</span></td>
            <td class="fc-col-arrow"><i class="fas fa-arrow-right fc-arrow"></i></td>
            <td class="fc-col-format">
                <select class="fc-format-select" data-id="${id}">${options}</select>
            </td>
            <td class="fc-col-status">
                <span class="fc-status fc-status-idle" id="fc-status-${id}">—</span>
            </td>
            <td class="fc-col-actions">
                <button class="fc-btn-settings" id="fc-settings-btn-${id}" title="Conversion settings"
                    onclick="FileConverter.toggleSettings(${id})">
                    <i class="fas fa-sliders-h"></i>
                </button>
                <button class="fc-btn-dl" id="fc-dl-${id}" title="Download" style="display:none;">
                    <i class="fas fa-download"></i>
                </button>
                <button class="fc-btn-rm" data-id="${id}" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </td>`;

        fragment.appendChild(tr);

        // Hidden settings row – content rendered on first open
        const settingsTr = document.createElement('tr');
        settingsTr.id = `fc-settings-row-${id}`;
        settingsTr.style.display = 'none';
        settingsTr.innerHTML = `<td class="fc-settings-cell" colspan="8"></td>`;
        fragment.appendChild(settingsTr);

        dom.fileList.appendChild(fragment);

        // Format selector change
        tr.querySelector('.fc-format-select').addEventListener('change', e => {
            const entry = fileEntries.find(x => x.id === parseInt(e.target.dataset.id, 10));
            if (!entry) return;
            entry.targetFmt  = e.target.value;
            entry.settings   = getDefaultSettings(entry.category, entry.targetFmt);
            entry.status     = 'idle';
            entry.resultBlob = null;
            setEntryStatus(entry.id, 'idle');
            document.getElementById(`fc-dl-${entry.id}`).style.display = 'none';
            // If settings panel is open, re-render it for the new format
            const sr = document.getElementById(`fc-settings-row-${entry.id}`);
            if (sr && sr.style.display !== 'none') {
                sr.querySelector('.fc-settings-cell').innerHTML = renderSettingsPanel(entry);
            }
        });

        // Remove button
        tr.querySelector('.fc-btn-rm').addEventListener('click', e => {
            removeEntry(parseInt(e.currentTarget.dataset.id, 10));
        });
    }

    // ─── Settings panel ────────────────────────────────────────────────────────

    function renderSettingsPanel(entry) {
        const { id, settings } = entry;
        const key = getSettingsKey(entry.category, entry.targetFmt);

        const numInput = (sid, val, placeholder, step = '1', min = '0') =>
            `<input type="number" class="fc-setting-input" id="fc-s-${id}-${sid}"
                value="${escapeHtml(String(val ?? ''))}" placeholder="${placeholder}"
                min="${min}" step="${step}">`;

        const selInput = (sid, pairs, current) =>
            `<select class="fc-setting-select" id="fc-s-${id}-${sid}">` +
            pairs.map(([v, l]) =>
                `<option value="${v}"${String(current) === String(v) ? ' selected' : ''}>${l}</option>`
            ).join('') + `</select>`;

        let fields = '';

        if (key === 'image') {
            fields = `
                <div class="fc-setting">
                    <label>Quality <span class="fc-setting-val" id="fc-s-${id}-qlabel">${settings.quality}%</span></label>
                    <input type="range" class="fc-setting-range" id="fc-s-${id}-quality"
                        min="1" max="100" value="${settings.quality}"
                        oninput="document.getElementById('fc-s-${id}-qlabel').textContent=this.value+'%'">
                    <small>Applies to JPEG &amp; WebP only</small>
                </div>
                <div class="fc-setting">
                    <label>Max Width (px)</label>
                    ${numInput('maxwidth', settings.maxWidth, 'Original', '1', '1')}
                </div>
                <div class="fc-setting">
                    <label>Max Height (px)</label>
                    ${numInput('maxheight', settings.maxHeight, 'Original', '1', '1')}
                </div>`;
        } else if (key === 'audio') {
            fields = `
                <div class="fc-setting">
                    <label>Start Time (s)</label>
                    ${numInput('start', settings.startTime, '0', '0.1')}
                </div>
                <div class="fc-setting">
                    <label>End Time (s)</label>
                    ${numInput('end', settings.endTime, 'Full length', '0.1')}
                </div>
                <div class="fc-setting">
                    <label>Sample Rate</label>
                    ${selInput('sr', [
                        ['original','Original'],['48000','48 000 Hz'],['44100','44 100 Hz'],
                        ['22050','22 050 Hz'],['16000','16 000 Hz'],['8000','8 000 Hz'],
                    ], settings.sampleRate)}
                </div>
                <div class="fc-setting">
                    <label>Channels</label>
                    ${selInput('ch', [
                        ['original','Original'],['2','Stereo'],['1','Mono'],
                    ], settings.channels)}
                </div>`;
        } else if (key === 'gif') {
            fields = `
                <div class="fc-setting">
                    <label>Start Time (s)</label>
                    ${numInput('start', settings.startTime, '0', '0.1')}
                </div>
                <div class="fc-setting">
                    <label>End Time (s)</label>
                    ${numInput('end', settings.endTime, 'Full length', '0.1')}
                </div>
                <div class="fc-setting">
                    <label>Frame Rate</label>
                    ${selInput('fps', [5,8,10,12,15,20,24].map(v => [String(v), v + ' fps']), settings.fps)}
                </div>
                <div class="fc-setting">
                    <label>Output Width</label>
                    ${selInput('width', [
                        ['original','Original (no resize)'],
                        ...['1280','960','720','640','480','360','240'].map(v => [v, v + 'px']),
                    ], settings.width)}
                </div>`;
        } else {
            // video → video
            fields = `
                <div class="fc-setting">
                    <label>Start Time (s)</label>
                    ${numInput('start', settings.startTime, '0', '0.1')}
                </div>
                <div class="fc-setting">
                    <label>End Time (s)</label>
                    ${numInput('end', settings.endTime, 'Full length', '0.1')}
                </div>
                <div class="fc-setting">
                    <label>Resolution</label>
                    ${selInput('res', [
                        ['original','Original'],['1080p','1080p'],
                        ['720p','720p'],['480p','480p'],['360p','360p'],
                    ], settings.resolution)}
                </div>
                <div class="fc-setting">
                    <label>Frame Rate</label>
                    ${selInput('fps', [
                        ['original','Original'],
                        ...['60','30','24','15'].map(v => [v, v + ' fps']),
                    ], settings.fps)}
                </div>
                <div class="fc-setting fc-setting-check">
                    <label class="fc-check-label">
                        <input type="checkbox" id="fc-s-${id}-mute"${settings.muteAudio ? ' checked' : ''}>
                        Remove audio track
                    </label>
                </div>`;
        }

        return `<div class="fc-settings-panel">
            <div class="fc-settings-grid">${fields}</div>
            <div class="fc-settings-footer">
                <button class="fc-btn-apply-all" onclick="FileConverter.applySettingsToAll(${id})">
                    <i class="fas fa-copy"></i> Apply to all matching files
                </button>
            </div>
        </div>`;
    }

    function readSettings(id) {
        const entry = fileEntries.find(e => e.id === id);
        if (!entry) return {};
        const key = getSettingsKey(entry.category, entry.targetFmt);
        const g   = sid => document.getElementById(`fc-s-${id}-${sid}`);

        if (key === 'image') return {
            quality:   parseInt(g('quality')?.value   ?? entry.settings.quality, 10),
            maxWidth:  g('maxwidth')?.value  ?? '',
            maxHeight: g('maxheight')?.value ?? '',
        };
        if (key === 'audio') return {
            startTime:  g('start')?.value ?? '',
            endTime:    g('end')?.value   ?? '',
            sampleRate: g('sr')?.value    ?? 'original',
            channels:   g('ch')?.value    ?? 'original',
        };
        if (key === 'gif') return {
            startTime: g('start')?.value ?? '',
            endTime:   g('end')?.value   ?? '',
            fps:       parseInt(g('fps')?.value ?? 10, 10),
            width:     g('width')?.value === 'original' ? 'original' : parseInt(g('width')?.value ?? 480, 10),
        };
        // video
        return {
            startTime:  g('start')?.value ?? '',
            endTime:    g('end')?.value   ?? '',
            resolution: g('res')?.value   ?? 'original',
            fps:        g('fps')?.value   ?? 'original',
            muteAudio:  g('mute')?.checked ?? false,
        };
    }

    function toggleSettings(id) {
        const entry       = fileEntries.find(e => e.id === id);
        const settingsRow = document.getElementById(`fc-settings-row-${id}`);
        const toggleBtn   = document.getElementById(`fc-settings-btn-${id}`);
        if (!entry || !settingsRow) return;

        const isOpen = settingsRow.style.display !== 'none';
        if (isOpen) {
            entry.settings = readSettings(id);
            settingsRow.style.display = 'none';
            toggleBtn.classList.remove('active');
        } else {
            settingsRow.querySelector('.fc-settings-cell').innerHTML = renderSettingsPanel(entry);
            settingsRow.style.display = '';
            toggleBtn.classList.add('active');
        }
    }

    function applySettingsToAll(id) {
        const source = fileEntries.find(e => e.id === id);
        if (!source) return;

        source.settings = readSettings(id);
        const sourceKey = getSettingsKey(source.category, source.targetFmt);

        let count = 0;
        fileEntries.forEach(entry => {
            if (entry.id === id) return;
            if (getSettingsKey(entry.category, entry.targetFmt) !== sourceKey) return;
            entry.settings = { ...source.settings };
            count++;
            // Refresh if panel is currently open
            const row = document.getElementById(`fc-settings-row-${entry.id}`);
            if (row && row.style.display !== 'none') {
                row.querySelector('.fc-settings-cell').innerHTML = renderSettingsPanel(entry);
            }
        });

        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast(
                count > 0
                    ? `Settings applied to ${count} other file${count !== 1 ? 's' : ''}`
                    : 'No other matching files to apply to',
                count > 0 ? 'success' : 'warning'
            );
        }
    }

    function setEntryStatus(id, status, progress) {
        const el = document.getElementById(`fc-status-${id}`);
        if (!el) return;

        el.className = `fc-status fc-status-${status}`;

        switch (status) {
            case 'idle':
                el.innerHTML = '—';
                break;
            case 'converting':
                el.innerHTML = progress != null
                    ? `<i class="fas fa-spinner fa-spin"></i> ${progress}%`
                    : `<i class="fas fa-spinner fa-spin"></i>`;
                break;
            case 'done':
                el.innerHTML = '<i class="fas fa-check"></i> Done';
                break;
            case 'error':
                el.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
                break;
        }
    }

    function updateUI() {
        const count = fileEntries.length;
        const hasFiles = count > 0;

        dom.filesSection.style.display = hasFiles ? 'block' : 'none';
        dom.filesCount.textContent = `${count} file${count !== 1 ? 's' : ''}`;

        // Show Download All only when at least one done result exists
        const doneCount = fileEntries.filter(e => e.status === 'done').length;
        dom.downloadAllBtn.style.display = doneCount > 1 ? 'inline-flex' : 'none';

        // Result info
        if (doneCount > 0) {
            dom.resultInfo.textContent = `${doneCount} / ${count} converted`;
        } else {
            dom.resultInfo.textContent = '';
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ─── Conversion orchestration ──────────────────────────────────────────────

    async function convertEntry(entry) {
        // Save settings from any open panel before converting
        const settingsRow = document.getElementById(`fc-settings-row-${entry.id}`);
        if (settingsRow && settingsRow.style.display !== 'none') {
            entry.settings = readSettings(entry.id);
        }

        entry.status     = 'converting';
        entry.resultBlob = null;
        setEntryStatus(entry.id, 'converting');

        try {
            let blob;
            if (entry.category === 'image') {
                setEntryStatus(entry.id, 'converting', null);
                blob = await convertImage(entry.file, entry.targetFmt, entry.settings);
            } else {
                blob = await convertMedia(entry);
            }

            entry.resultBlob = blob;
            entry.status     = 'done';
            setEntryStatus(entry.id, 'done');

            // Wire up per-file download button
            const dlBtn = document.getElementById(`fc-dl-${entry.id}`);
            if (dlBtn) {
                dlBtn.style.display = 'inline-flex';
                dlBtn.onclick = () => downloadBlob(blob, outputFilename(entry));
            }

        } catch (err) {
            entry.status   = 'error';
            entry.errorMsg = err.message || String(err);
            setEntryStatus(entry.id, 'error');
            console.error(`Conversion failed [${entry.file.name}]:`, err);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(`Error converting ${entry.file.name}: ${entry.errorMsg}`, 'error');
            }
        }

        updateUI();
    }

    async function convertAll() {
        const pending = fileEntries.filter(e => e.status !== 'done');
        if (pending.length === 0) return;

        dom.convertBtn.disabled = true;

        // Separate images (parallel-safe) from media (sequential to avoid FS conflicts)
        const images = pending.filter(e => e.category === 'image');
        const media  = pending.filter(e => e.category !== 'image');

        // Images: run in parallel
        await Promise.all(images.map(convertEntry));

        // Audio/video: run sequentially to keep FFmpeg FS clean
        for (const entry of media) {
            await convertEntry(entry);
        }

        dom.convertBtn.disabled = false;
        updateUI();
    }

    // ─── Download helpers ──────────────────────────────────────────────────────

    function outputFilename(entry) {
        const base = entry.file.name.replace(/\.[^.]+$/, '');
        return `${base}.${entry.targetFmt}`;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    async function downloadAll() {
        const done = fileEntries.filter(e => e.status === 'done' && e.resultBlob);
        if (done.length === 0) return;

        // JSZip is already included in the page
        const zip = new JSZip();
        for (const entry of done) {
            zip.file(outputFilename(entry), entry.resultBlob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'converted-files.zip');
    }

    // ─── Drag-and-drop / file input ────────────────────────────────────────────

    function setupDropZone() {
        const dz = dom.dropzone;

        dom.fileInput.addEventListener('change', e => {
            addFiles(Array.from(e.target.files));
            dom.fileInput.value = '';
        });

        dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('fc-dz-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('fc-dz-over'));
        dz.addEventListener('drop', e => {
            e.preventDefault();
            dz.classList.remove('fc-dz-over');
            addFiles(Array.from(e.dataTransfer.files));
        });
    }

    // ─── Public init & exposed functions ──────────────────────────────────────

    return {
        init() {
            // Resolve DOM refs
            dom = {
                dropzone:      document.getElementById('fc-dropzone'),
                fileInput:     document.getElementById('fc-file-input'),
                codecBar:      document.getElementById('fc-codec-bar'),
                codecProgress: document.getElementById('fc-codec-progress'),
                filesSection:  document.getElementById('fc-files-section'),
                filesCount:    document.getElementById('fc-files-count'),
                fileList:      document.getElementById('fc-file-list'),
                quality:       document.getElementById('fc-quality'),
                qualityValue:  document.getElementById('fc-quality-value'),
                convertBtn:    document.getElementById('fc-convert-btn'),
                downloadAllBtn:document.getElementById('fc-download-all-btn'),
                clearBtn:      document.getElementById('fc-clear-btn'),
                resultInfo:    document.getElementById('fc-result-info'),
            };

            setupDropZone();

            dom.quality.addEventListener('input', () => {
                dom.qualityValue.textContent = dom.quality.value;
            });

            dom.convertBtn.addEventListener('click', convertAll);
            dom.downloadAllBtn.addEventListener('click', downloadAll);
            dom.clearBtn.addEventListener('click', clearAll);
        },

        toggleSettings(id)      { toggleSettings(id); },
        applySettingsToAll(id)  { applySettingsToAll(id); }
    };

})();
