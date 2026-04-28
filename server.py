#!/usr/bin/env python3
"""
Dev server for Indie Dev Toys
──────────────────────────────
• Adds COOP + COEP headers on every response so SharedArrayBuffer is
  available (required by FFmpeg.wasm).
• Proxies /_cdn/* requests to the real CDN and serves them from
  localhost, making every FFmpeg script (including worker chunks) appear
  same-origin – fixing the "cannot be accessed from origin" worker error.
"""

import http.server
import urllib.request
import urllib.error
import sys
import os

# Map local proxy prefix → CDN base URL
# Only ffmpeg.js itself is proxied – this gives it a same-origin URL so that
# webpack's auto public-path resolves worker chunks (e.g. 814.ffmpeg.js) as
# /_cdn/ffmpeg/ paths, avoiding the cross-origin Worker restriction.
# The core WASM files are fetched directly from CDN (COEP credentialless allows it).
CDN_MAP = {
    '/_cdn/ffmpeg/':      'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/umd/',
    '/_cdn/ffmpeg-util/': 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/',
}


class DevHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        # Check if this request should be proxied to a CDN
        for prefix, base in CDN_MAP.items():
            if self.path.startswith(prefix):
                remote_url = base + self.path[len(prefix):]
                self._proxy_get(remote_url)
                return
        # Otherwise serve local files normally
        super().do_GET()

    def _proxy_get(self, url):
        """Fetch url from CDN and stream it back to the browser."""
        try:
            req = urllib.request.Request(url, headers={
                'Accept': '*/*',
                'User-Agent': 'indie-dev-toys-devserver/1.0',
            })
            with urllib.request.urlopen(req, timeout=300) as r:
                ct     = r.headers.get('Content-Type', 'application/octet-stream')
                length = r.headers.get('Content-Length')

                self.send_response(200)
                self.send_header('Content-Type', ct)
                # Forward Content-Length so XHR progress events fire
                if length:
                    self.send_header('Content-Length', length)
                self.end_headers()

                # Stream in 64 KB chunks (avoids buffering 31 MB WASM in memory)
                while True:
                    chunk = r.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)

        except urllib.error.HTTPError as e:
            self.send_error(e.code, f'CDN error: {e.reason}')
        except urllib.error.URLError as e:
            self.send_error(502, f'CDN unreachable: {e.reason}')
        except Exception as e:
            self.send_error(500, str(e))

    def end_headers(self):
        # Required for SharedArrayBuffer (FFmpeg.wasm depends on it)
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        # credentialless: enables cross-origin isolation without blocking CDN
        # fonts/images that lack an explicit CORP header
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Cleaner console output
        print(f'  {self.command:6s} {self.path}', flush=True)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

    # Always serve from the directory this file lives in
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print(f'Indie Dev Toys  →  http://localhost:{port}')
    print(f'COOP/COEP enabled  |  CDN proxy active for FFmpeg.wasm')
    print(f'Press Ctrl+C to stop.\n')

    with http.server.HTTPServer(('', port), DevHandler) as httpd:
        httpd.serve_forever()
