"""
Картинка для превью ссылки в мессенджерах и соцсетях: public/og.jpg (1200×630).

Запуск (нужен Python 3 и Pillow: pip install pillow):
    python scripts/og-image.py

Текст и телефон берутся из констант ниже — поменяйте их при необходимости.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTO = 'src/assets/objects/linii/52.jpg'
TITLE = ['Натяжные', 'потолки', 'по всему', 'Дагестану']
SUBTITLE = 'Расчёт онлайн и бесплатный замер'  # без запятых: в кириллическом наборе шрифта их нет
PHONE = '+7 928 598-34-32'
BRAND = 'SANTLADA'

W, H = 1200, 630
FONTS = 'node_modules/@fontsource-variable/'


def font(family: str, subset: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(f'{FONTS}{family}/files/{family}-{subset}-wght-normal.woff2', size)
    f.set_variation_by_axes([weight])
    return f


img = Image.new('RGB', (W, H), '#fafcff')

# Фото справа: белый «зазор», тонкая рамка и индиго-свечение снизу
photo = Image.open(PHOTO).convert('RGB')
pw, ph = 520, 550
scale = max(pw / photo.width, ph / photo.height)
photo = photo.resize((int(photo.width * scale), int(photo.height * scale)), Image.LANCZOS)
left, top = (photo.width - pw) // 2, (photo.height - ph) // 2
photo = photo.crop((left, top, left + pw, top + ph))
px, py = W - pw - 40, 40

glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).rounded_rectangle([px + 20, py + 60, px + pw - 20, py + ph + 24], radius=40, fill=(155, 188, 255, 170))
glow = glow.filter(ImageFilter.GaussianBlur(28))
img.paste(glow, (0, 0), glow)

d = ImageDraw.Draw(img)
d.rounded_rectangle([px - 7, py - 7, px + pw + 7, py + ph + 7], radius=30, fill='#ffffff', outline='#dce5f5', width=1)
mask = Image.new('L', (pw, ph), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw, ph], radius=24, fill=255)
img.paste(photo, (px, py), mask)

# Логотип
x0, y0, s = 64, 70, 52
d.rounded_rectangle([x0, y0, x0 + s, y0 + s], radius=13, fill='#0e1a3a')
d.rounded_rectangle([x0 + 7, y0 + 7, x0 + s - 7, y0 + s - 7], radius=7, fill='#fafcff')
d.line([x0 + 16, y0 + 36, x0 + 36, y0 + 16], fill='#1d4ed8', width=5)
d.text((x0 + s + 18, y0 + 2), BRAND, font=font('manrope', 'latin', 42, 560), fill='#0e1a3a')

# Заголовок и подписи
title_font = font('manrope', 'cyrillic', 78, 560)
y = 170
for line in TITLE:
    d.text((64, y), line, font=title_font, fill='#0e1a3a')
    y += 76
d.text((64, y + 36), SUBTITLE, font=font('onest', 'cyrillic', 30, 450), fill='#4e5f80')
d.text((64, y + 80), PHONE, font=font('onest', 'latin', 32, 650), fill='#0f2b6b')

img.save('public/og.jpg', quality=88)
print('OK: public/og.jpg')
