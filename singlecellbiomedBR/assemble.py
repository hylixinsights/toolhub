#!/usr/bin/env python3
"""Assemble website/src/ into website/index.html (one self-contained page; data stay in data/).

  python3 assemble.py            # writes index.html
  python3 assemble.py --fragment # also writes app.html, the head+body fragment used for Claude artifacts
"""
import argparse
from pathlib import Path
root = Path(__file__).resolve().parent; src = root / "src"
ap = argparse.ArgumentParser(description=__doc__); ap.add_argument("--fragment", action="store_true"); a = ap.parse_args()
css = (src / "style.css").read_text()
body = (src / "body.html").read_text()
js = "\n".join((src / f).read_text() for f in ["core.js", "map.js", "about.js", "researchers.js", "clustering.js", "mesh.js", "main.js"])
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;500;600;700;800;900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">')
head = f'<title>Lattes × PubMed Atlas</title>\n{fonts}\n<link rel="icon" type="image/svg+xml" href="favicon.svg">\n<style>\n{css}\n</style>\n'
desc = "Lattes CVs of Brazilian PhD holders linked to PubMed: researcher lookup, MeSH-based clustering map and topic rankings."
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f'<meta name="description" content="{desc}">\n' + head +
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%}</style>\n'
        '</head>\n<body>\n' + body + f"\n<script>\n{js}\n</script>\n</body>\n</html>\n")
(root / "index.html").write_text(full)
if a.fragment:
    (root / "app.html").write_text(head + body + f"\n<script>\n{js}\n</script>\n")
print("wrote", root / "index.html")
