"""生成 AO3 标签管家扩展图标（无外部依赖，仅用 Pillow 绘制）。"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

ACCENT = (153, 0, 0, 255)
DARK = (60, 40, 40, 255)


def rounded(size, radius, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=color)
    return img


def draw_icon(size):
    scale = 8
    big = size * scale
    img = rounded(big, int(big * 0.22), ACCENT)
    draw = ImageDraw.Draw(img)

    # 书签形（AO3 风格的标签牌）
    pad = big * 0.22
    w = big - pad * 2
    h = big * 0.52
    x0, y0 = pad, big * 0.18
    draw.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=big * 0.07, fill=(255, 255, 255, 235))

    # 标签上的两个小圆孔
    r = big * 0.045
    for cx in (x0 + w * 0.26, x0 + w * 0.5):
        draw.ellipse([cx - r, y0 + h * 0.42 - r, cx + r, y0 + h * 0.42 + r], fill=ACCENT)

    # 底部斜切的挂绳
    draw.polygon(
        [
            (big * 0.5 - big * 0.16, big * 0.66),
            (big * 0.5 + big * 0.16, big * 0.66),
            (big * 0.5, big * 0.9),
        ],
        fill=(255, 255, 255, 235),
    )

    # 一条斜杠：禁
    stroke = max(2, int(big * 0.075))
    draw.line([(big * 0.2, big * 0.86), (big * 0.8, big * 0.2)], fill=DARK, width=stroke)

    return img.resize((size, size), Image.LANCZOS)


for s in (16, 32, 48, 128):
    icon = draw_icon(s)
    icon.save(os.path.join(OUT, "icon%d.png" % s))
    print("wrote icon%d.png" % s)
