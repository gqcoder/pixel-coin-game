#!/usr/bin/env python3
"""生成 PWA 图标 (icon-192.png / icon-512.png)。
纯 Python 标准库实现 (zlib + struct)，不依赖 Pillow。
在一张小的像素网格上手绘"草地 + 金币"图案，再放大到目标分辨率，保持像素风。
"""
import struct
import zlib
import os

BASE = 32  # 基础网格尺寸 (32x32 像素画布)

# 调色板
GRASS_A = (74, 156, 63, 255)
GRASS_B = (69, 143, 58, 255)
COIN_FILL = (255, 207, 63, 255)
COIN_LIGHT = (255, 243, 192, 255)
COIN_DARK = (201, 134, 26, 255)
COIN_EDGE = (107, 74, 31, 255)
TRANSPARENT = (0, 0, 0, 0)


def build_pixels():
    """返回 BASE x BASE 的 (r,g,b,a) 像素网格。"""
    px = [[GRASS_A if (r + c) % 2 == 0 else GRASS_B for c in range(BASE)] for r in range(BASE)]

    cx, cy, radius = BASE / 2, BASE / 2, BASE * 0.34

    for r in range(BASE):
        for c in range(BASE):
            dx = c + 0.5 - cx
            dy = r + 0.5 - cy
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= radius:
                # 边框
                if dist >= radius - 1.6:
                    px[r][c] = COIN_EDGE
                else:
                    # 左上高光，右下阴影，模拟球体光照
                    light_dist = ((dx + radius * 0.35) ** 2 + (dy + radius * 0.35) ** 2) ** 0.5
                    if light_dist < radius * 0.45:
                        px[r][c] = COIN_LIGHT
                    elif dist >= radius - 4:
                        px[r][c] = COIN_DARK
                    else:
                        px[r][c] = COIN_FILL

    # "$" 符号 (简单像素字形，居中)
    dollar = [
        "..XXX..",
        ".X...X.",
        ".X.....",
        "..XXX..",
        ".....X.",
        ".X...X.",
        "..XXX..",
        "...X...",
    ]
    start_r = int(cy - len(dollar) / 2)
    start_c = int(cx - len(dollar[0]) / 2)
    for i, row in enumerate(dollar):
        for j, ch in enumerate(row):
            if ch == "X":
                rr, cc = start_r + i, start_c + j
                if 0 <= rr < BASE and 0 <= cc < BASE:
                    px[rr][cc] = COIN_EDGE

    return px


def scale_pixels(px, size):
    """最近邻缩放到任意目标尺寸 (不要求整除 BASE)。"""
    out = [[None] * size for _ in range(size)]
    for r in range(size):
        src_r = min(BASE - 1, r * BASE // size)
        for c in range(size):
            src_c = min(BASE - 1, c * BASE // size)
            out[r][c] = px[src_r][src_c]
    return out


def write_png(path, pixels):
    size = len(pixels)
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # 无过滤器
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8bit RGBA, no interlace
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(png)


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "icons")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)

    base_px = build_pixels()

    targets = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "apple-touch-icon.png": 180,
    }

    for name, size in targets.items():
        scaled = scale_pixels(base_px, size)
        path = os.path.join(out_dir, name)
        write_png(path, scaled)
        print(f"生成 {path} ({len(scaled)}x{len(scaled)})")


if __name__ == "__main__":
    main()
