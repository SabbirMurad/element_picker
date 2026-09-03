"""Generates the extension icons from one geometry definition.

Run:  python tools/make_icons.py        (needs Pillow)

The mark is the inspect-element metaphor: a selection frame drawn as four
corner brackets with a pointer inside it.

At 16px that mark stops working — the brackets and the pointer blur into each
other — so sizes at or below SMALL_MAX drop the brackets and show a larger
pointer alone. Same tile, same pointer shape, so the set still reads as one
family.
"""

import os
from PIL import Image, ImageDraw

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 8
SMALL_MAX = 16
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')

TOP = (38, 38, 40)        # #262628
BOTTOM = (12, 12, 13)     # #0C0C0D
MARK = (255, 255, 255)

CORNER_RADIUS = 0.22

# Pointer outline, as fractions of its own box, tip at the origin.
POINTER = [
    (0.00, 0.00), (0.00, 0.76), (0.20, 0.58), (0.32, 0.86),
    (0.47, 0.79), (0.35, 0.52), (0.58, 0.51)
]

DETAIL = {
    'brackets': True,
    'frame': (0.19, 0.81),
    'arm': 0.17,
    'stroke': 0.075,
    'pointer_scale': 0.36,
    'pointer_at': (0.35, 0.30),
}
SMALL = {
    'brackets': False,
    'pointer_scale': 0.62,
    'pointer_at': (0.24, 0.16),
}

profile_for = lambda size: SMALL if size <= SMALL_MAX else DETAIL


def gradient_tile(px):
    tile = Image.new('RGBA', (px, px))
    draw = ImageDraw.Draw(tile)
    for y in range(px):
        t = y / max(px - 1, 1)
        draw.line(
            [(0, y), (px, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,)
        )

    mask = Image.new('L', (px, px), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, px - 1, px - 1], radius=CORNER_RADIUS * px, fill=255
    )
    tile.putalpha(mask)
    return tile


def bracket(draw, x, y, dx, dy, arm, width):
    """One corner of the selection frame, with rounded ends."""
    draw.line([(x, y), (x + dx * arm, y)], fill=MARK, width=width)
    draw.line([(x, y), (x, y + dy * arm)], fill=MARK, width=width)
    r = width / 2
    for cx, cy in ((x, y), (x + dx * arm, y), (x, y + dy * arm)):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=MARK)


def render(px, profile):
    tile = gradient_tile(px)
    draw = ImageDraw.Draw(tile)

    if profile['brackets']:
        lo, hi = profile['frame'][0] * px, profile['frame'][1] * px
        arm = profile['arm'] * px
        width = max(round(profile['stroke'] * px), 1)
        for x, y, dx, dy in ((lo, lo, 1, 1), (hi, lo, -1, 1), (lo, hi, 1, -1), (hi, hi, -1, -1)):
            bracket(draw, x, y, dx, dy, arm, width)

    ox, oy = profile['pointer_at'][0] * px, profile['pointer_at'][1] * px
    k = profile['pointer_scale'] * px
    draw.polygon([(ox + a * k, oy + b * k) for a, b in POINTER], fill=MARK)
    return tile


def svg():
    """The 128px form, for the store listing and any promo art."""
    lo, hi = DETAIL['frame'][0] * 128, DETAIL['frame'][1] * 128
    arm, width = DETAIL['arm'] * 128, DETAIL['stroke'] * 128
    paths = [
        'M%.1f %.1f H%.1f M%.1f %.1f V%.1f' % (x, y, x + dx * arm, x, y, y + dy * arm)
        for x, y, dx, dy in ((lo, lo, 1, 1), (hi, lo, -1, 1), (lo, hi, 1, -1), (hi, hi, -1, -1))
    ]
    ox, oy = DETAIL['pointer_at'][0] * 128, DETAIL['pointer_at'][1] * 128
    k = DETAIL['pointer_scale'] * 128
    pointer = ' '.join('%.1f,%.1f' % (ox + a * k, oy + b * k) for a, b in POINTER)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n'
        '  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">\n'
        '    <stop offset="0" stop-color="#%02X%02X%02X"/><stop offset="1" stop-color="#%02X%02X%02X"/>\n'
        '  </linearGradient></defs>\n'
        '  <rect width="128" height="128" rx="%.1f" fill="url(#g)"/>\n'
        '  <path d="%s" stroke="#fff" stroke-width="%.1f" stroke-linecap="round" fill="none"/>\n'
        '  <polygon points="%s" fill="#fff"/>\n'
        '</svg>\n'
    ) % (TOP + BOTTOM + (CORNER_RADIUS * 128, ' '.join(paths), width, pointer))


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in SIZES:
        big = render(size * SUPERSAMPLE, profile_for(size))
        big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, 'icon%d.png' % size))
        print('icons/icon%d.png' % size)
    with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg())
    print('icons/icon.svg')


if __name__ == '__main__':
    main()
