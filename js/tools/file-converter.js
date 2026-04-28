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

    // ─── State ─────────────────────────────────────────────────────────────────

    let fileEntries   = [];   // { id, file, category, targetFmt, status, resultBlob }
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
            const { FFmpeg }      = FFmpegWASM;
            const { toBlobURL, fetchFile: _ff } = FFmpegUtil;

            ffmpeg = new FFmpeg();

            ffmpeg.on('log', ({ message }) => {
                console.debug('[FFmpeg]', message);
            });

            ffmpeg.on('progress', ({ progress }) => {
                // progress is 0-1 during encode; used per-file via convertMedia
                const pct = Math.min(100, Math.round(progress * 100));
                setCodecProgress(pct);
            });

            const BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

            // Track download progress for the wasm file via XHR
            const wasmURL = await loadWasmWithProgress(
                `${BASE}/ffmpeg-core.wasm`,
                'application/wasm'
            );

            await ffmpeg.load({
                coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL,
            });

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
            throw new Error('Failed to load FFmpeg: ' + err.message);
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

    function showCodecBar(visible) {
        dom.codecBar.style.display = visible ? 'flex' : 'none';
    }

    function setCodecProgress(pct) {
        dom.codecProgress.style.width = pct + '%';
    }

    // ─── Image conversion (Canvas) ─────────────────────────────────────────────

    async function convertImage(file, targetFmt, q) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');

                // JPEG / BMP have no transparency – fill white background
                if (targetFmt === 'jpeg' || targetFmt === 'bmp') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0);

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

    function audioFFmpegArgs(targetFmt, q) {
        // q = 1-100
        const mp3q   = Math.round(9 - (q / 100) * 9);          // 0 best
        const vorbq  = Math.round((q / 100) * 10);             // 10 best
        const bitrate = Math.max(48, Math.round(32 + (q / 100) * 288)) + 'k';  // 48k-320k

        switch (targetFmt) {
            case 'mp3':  return ['-vn', '-c:a', 'libmp3lame',  '-q:a', String(mp3q)];
            case 'wav':  return ['-vn', '-c:a', 'pcm_s16le'];
            case 'ogg':  return ['-vn', '-c:a', 'libvorbis',   '-q:a', String(vorbq)];
            case 'flac': return ['-vn', '-c:a', 'flac'];
            case 'aac':  return ['-vn', '-c:a', 'aac',         '-b:a', bitrate];
            case 'opus': return ['-vn', '-c:a', 'libopus',     '-b:a', bitrate];
            default:     return ['-vn', '-c:a', 'aac'];
        }
    }

    function videoFFmpegArgs(targetFmt, q) {
        // Map quality 1-100 → CRF scale (0=lossless, higher=worse)
        const crf264  = Math.round(51 - (q / 100) * 46);       // 5-51
        const crfVP9  = Math.round(63 - (q / 100) * 58);       // 5-63
        const bitrate = Math.max(48, Math.round(32 + (q / 100) * 288)) + 'k';

        switch (targetFmt) {
            case 'mp4':
                return ['-c:v', 'libx264',    '-crf', String(crf264),  '-preset', 'fast',
                        '-c:a', 'aac',        '-b:a', '192k',          '-movflags', '+faststart'];
            case 'webm':
                return ['-c:v', 'libvpx-vp9', '-crf', String(crfVP9),  '-b:v', '0',
                        '-c:a', 'libopus',    '-b:a', '128k'];
            case 'mov':
                return ['-c:v', 'libx264',    '-crf', String(crf264),  '-preset', 'fast',
                        '-c:a', 'aac',        '-b:a', '192k'];
            case 'avi':
                return ['-c:v', 'libx264',    '-crf', String(crf264),
                        '-c:a', 'aac',        '-b:a', '192k'];
            case 'mkv':
                return ['-c:v', 'libx264',    '-crf', String(crf264),  '-preset', 'fast',
                        '-c:a', 'aac'];
            case 'gif':
                // Two-pass palette GIF for high quality
                return ['-vf',
                    'fps=10,scale=min(480\\,iw):-1:flags=lanczos,split[s0][s1];' +
                    '[s0]palettegen=max_colors=256:stats_mode=diff[p];' +
                    '[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
                    '-loop', '0'];
            default:
                return ['-c:v', 'libx264', '-c:a', 'aac'];
        }
    }

    async function convertMedia(entry) {
        const { file, category, targetFmt } = entry;
        const { fetchFile } = FFmpegUtil;

        await ensureFFmpeg();

        const inExt   = ext(file.name);
        const inName  = `in_${entry.id}.${inExt}`;
        const outName = `out_${entry.id}.${targetFmt}`;

        // Write input file
        const fileData = await fetchFile(file);
        await ffmpeg.writeFile(inName, fileData);

        // Build args
        const specificArgs = category === 'audio'
            ? audioFFmpegArgs(targetFmt, quality())
            : videoFFmpegArgs(targetFmt, quality());

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
        const row = document.querySelector(`[data-fc-id="${id}"]`);
        if (row) row.remove();
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
                <button class="fc-btn-dl" id="fc-dl-${id}" title="Download" style="display:none;">
                    <i class="fas fa-download"></i>
                </button>
                <button class="fc-btn-rm" data-id="${id}" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </td>`;

        dom.fileList.appendChild(tr);

        // Format selector change
        tr.querySelector('.fc-format-select').addEventListener('change', e => {
            const entry = fileEntries.find(x => x.id === parseInt(e.target.dataset.id, 10));
            if (entry) {
                entry.targetFmt  = e.target.value;
                entry.status     = 'idle';
                entry.resultBlob = null;
                setEntryStatus(entry.id, 'idle');
                document.getElementById(`fc-dl-${entry.id}`).style.display = 'none';
            }
        });

        // Remove button
        tr.querySelector('.fc-btn-rm').addEventListener('click', e => {
            removeEntry(parseInt(e.currentTarget.dataset.id, 10));
        });
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
        entry.status     = 'converting';
        entry.resultBlob = null;
        setEntryStatus(entry.id, 'converting');

        try {
            let blob;
            if (entry.category === 'image') {
                setEntryStatus(entry.id, 'converting', null);
                blob = await convertImage(entry.file, entry.targetFmt, quality());
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

        dz.addEventListener('click', () => dom.fileInput.click());
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

    // ─── Public init ───────────────────────────────────────────────────────────

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
        }
    };

})();
