#!/usr/bin/env python3
"""
Dev server for Indie Dev Toys
──────────────────────────────
Plain static file server that mirrors GitHub Pages: no custom headers and
no proxies.  Every tool loads its own assets from this same origin, so
whatever works here works when deployed.  FFmpeg.wasm is self-hosted under
js/vendor/ffmpeg/ and loaded on demand by js/tools/file-converter.js.
"""

import http.server
import sys
import os


class DevHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Cleaner console output
        print(f'  {self.command:6s} {self.path}', flush=True)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

    # Always serve from the directory this file lives in
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print(f'Indie Dev Toys  ->  http://localhost:{port}')
    print(f'Press Ctrl+C to stop.\n')

    with http.server.HTTPServer(('', port), DevHandler) as httpd:
        httpd.serve_forever()
