import sys
from PIL import Image
out = sys.argv[1]; cols = int(sys.argv[2]); files = sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
m = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(ims): m.paste(im, ((i % cols) * w, (i // cols) * h))
m.save(out); print(m.size)
