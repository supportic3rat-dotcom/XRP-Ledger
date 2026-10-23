"""Compare an app screenshot with a reference PNG.

Writes a side-by-side image (reference | app | diff) and prints the share of pixels that differ
by more than a small tolerance, plus the bounding box of the differences.
Usage: python compare.py reference.png app.png out.png
"""
import sys
from PIL import Image, ImageChops

ref_path, app_path, out_path = sys.argv[1:4]
ref = Image.open(ref_path).convert('RGB')
app = Image.open(app_path).convert('RGB').resize(ref.size)
diff = ImageChops.difference(ref, app).convert('L').point(lambda v: 255 if v > 24 else 0)
changed = sum(1 for v in diff.getdata() if v)
total = ref.size[0] * ref.size[1]
w, h = ref.size
out = Image.new('RGB', (w * 3, h), 'white')
out.paste(ref, (0, 0))
out.paste(app, (w, 0))
out.paste(Image.merge('RGB', (diff, Image.new('L', diff.size, 0), Image.new('L', diff.size, 0))), (w * 2, 0))
out.save(out_path)
print(f'{changed / total * 100:.2f}% pixels differ; bbox={diff.getbbox()}')
