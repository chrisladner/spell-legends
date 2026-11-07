"""Lokaler Test-Server ohne Browser-Cache (nur zum Entwickeln).
Start im Projektordner (über apps/): python3 apps/deutsch-legends/tools/devserver.py 8770"""
import functools
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
handler = functools.partial(NoCache, directory=root)
http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
