"""Create a self-contained static site. No package installation required."""
from pathlib import Path
import json, shutil
root = Path(__file__).resolve().parents[1]
out = root / 'dist'
for filename in ['config', 'content', 'specialist', 'reviews']:
    json.loads((root / 'data' / f'{filename}.json').read_text())
if out.exists():
    shutil.rmtree(out)
out.mkdir()
for name in ['index.html', 'style.css', 'app.js', 'assets', 'data']:
    src = root / name
    if src.is_dir():
        shutil.copytree(src, out / name)
    else:
        shutil.copy2(src, out / name)
print('Static site built in dist/')
