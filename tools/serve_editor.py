#!/usr/bin/env python3
"""Serve the Bloodwych ZX editor locally and open it in the default browser.

Browsers block fetch() from file:// pages.  This tiny stdlib-only launcher keeps
local testing identical to GitHub/hosted operation, so the checked-in Game and
Level TZX files can be preloaded automatically without embedding duplicate tape
images in JavaScript.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Bloodwych ZX HTML5 editor locally")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=0, help="Port to use; 0 chooses a free local port")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    with socketserver.TCPServer((args.host, args.port), handler) as httpd:
        host, port = httpd.server_address[:2]
        url = f"http://{host}:{port}/index.html"
        print(f"Bloodwych ZX editor: {url}")
        print("Game + Level TZX defaults will preload from the repository. Ctrl+C stops the server.")
        threading.Timer(0.25, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
