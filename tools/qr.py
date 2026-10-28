"""Gera um QR (PNG) de uma URL sem dependências além do Pillow + reportlab.
Uso: python3 tools/qr.py https://... saida.png
"""
import sys, base64, io
from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel
from PIL import Image
url, out = sys.argv[1], sys.argv[2]
q = QRCode(None, QRErrorCorrectLevel.M); q.addData(url); q.make(); n = q.getModuleCount(); quiet = 2
img = Image.new("1", (n + 2*quiet,)*2, 1)
for r in range(n):
    for c in range(n):
        if q.isDark(r, c): img.putpixel((c + quiet, r + quiet), 0)
img.resize(((n + 2*quiet) * 12,)*2, Image.NEAREST).save(out)
b = io.BytesIO(); img.resize(((n + 2*quiet) * 4,)*2, Image.NEAREST).save(b, "PNG", optimize=True)
print("data:image/png;base64," + base64.b64encode(b.getvalue()).decode())
