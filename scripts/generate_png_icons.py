import zlib
import struct
import math

def create_png(width, height, get_pixel):
    # Generates 32-bit RGBA PNG
    raw_rows = bytearray()
    for y in range(height):
        raw_rows.append(0) # filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel(x, y, width, height)
            raw_rows.extend((int(r), int(g), int(b), int(a)))

    compressed = zlib.compress(bytes(raw_rows), 9)

    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)

    png_header = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = chunk(b'IHDR', ihdr_data)
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')

    return png_header + ihdr + idat + iend

def round_rect_dist(x, y, rx0, ry0, rx1, ry1, r):
    # Distance to rounded rectangle (negative inside)
    # Clamp x and y to inner box
    cx = max(rx0 + r, min(rx1 - r, x))
    cy = max(ry0 + r, min(ry1 - r, y))
    dx = x - cx
    dy = y - cy
    dist = math.sqrt(dx * dx + dy * dy) - r
    return dist

def get_logo_color(orig_x, orig_y):
    # Coordinates in 512x512
    x = orig_x
    y = orig_y

    # Colors
    NAVY = (28, 41, 56, 255)
    CREAM = (244, 243, 237, 255)
    AMBER = (229, 163, 58, 255)
    TRANS = (0, 0, 0, 0)

    # 1. Check squircle container: 0..512 with radius 128
    d_squircle = round_rect_dist(x, y, 0, 0, 512, 512, 128)
    if d_squircle > 1.0:
        return TRANS
    squircle_alpha = max(0.0, min(1.0, 0.5 - d_squircle))
    if squircle_alpha <= 0:
        return TRANS

    pixel_color = NAVY

    # 2. Arch (white/cream contour):
    # Left leg: center x=112, y from 250 to 372
    # Right leg: center x=400, y from 250 to 372
    # Top arc: center cx=256, cy=250, radius=144, thickness=26 (half-thickness=13)
    d_arch = 999.0
    if y >= 250 and y <= 372:
        d_left = abs(x - 112) - 13
        d_right = abs(x - 400) - 13
        d_arch = min(d_left, d_right)
    elif y < 250:
        dist_center = math.sqrt((x - 256)**2 + (y - 250)**2)
        d_arch = abs(dist_center - 144) - 13

    # Round caps at bottom of arch
    if y > 372:
        d_cap_l = math.sqrt((x - 112)**2 + (y - 372)**2) - 13
        d_cap_r = math.sqrt((x - 400)**2 + (y - 372)**2) - 13
        d_arch = min(d_arch, min(d_cap_l, d_cap_r))

    # 3. Shelf (amber pill):
    # x in [76, 436], y in [370, 400], r=15
    d_shelf = round_rect_dist(x, y, 76, 370, 436, 400, 15)

    # 4. Left book (cream solid):
    # x in [160, 204], y in [218, 370], r=12
    d_b1 = round_rect_dist(x, y, 160, 218, 204, 370, 12)

    # 5. Middle book (cream dashed outline):
    # Outer rect: [218, 272], [242, 370], r=12, stroke 15 (inner cutout)
    d_b2_outer = round_rect_dist(x, y, 218, 242, 272, 370, 12)
    d_b2_inner = round_rect_dist(x, y, 218 + 14, 242 + 14, 272 - 14, 370 - 14, 4)
    # Dash pattern in y (approx 13 on, 9 off)
    dash_cycle = (y - 242) % 22
    is_dashed_gap = (dash_cycle > 13) and (y > 248) and (y < 364)
    if is_dashed_gap:
        d_b2 = 999.0
    else:
        d_b2 = max(d_b2_outer, -d_b2_inner)

    # 6. Right book (amber tilted):
    # Tilted 14 deg around center (328, 304)
    ang = -math.radians(14)
    tx = x - 328
    ty = y - 304
    rx = tx * math.cos(ang) - ty * math.sin(ang) + 328
    ry = tx * math.sin(ang) + ty * math.cos(ang) + 304
    d_b3 = round_rect_dist(rx, ry, 306, 232, 350, 374, 12)

    # Composite layers:
    # Foreground items on navy squircle:
    if d_shelf <= 0:
        pixel_color = AMBER
    elif d_b1 <= 0:
        pixel_color = CREAM
    elif d_b2 <= 0:
        pixel_color = CREAM
    elif d_b3 <= 0:
        pixel_color = AMBER
    elif d_arch <= 0:
        pixel_color = CREAM

    # Apply squircle alpha antialiasing
    r, g, b, a = pixel_color
    return (r, g, b, int(a * squircle_alpha))

def make_icon(size):
    def sampler(x, y, w, h):
        sx = (x + 0.5) * (512.0 / w)
        sy = (y + 0.5) * (512.0 / h)
        return get_logo_color(sx, sy)
    return create_png(size, size, sampler)

if __name__ == '__main__':
    print("Generating 512x512...")
    with open('public/pwa-512x512.png', 'wb') as f:
        f.write(make_icon(512))

    print("Generating 192x192...")
    with open('public/pwa-192x192.png', 'wb') as f:
        f.write(make_icon(192))

    print("Generating apple-touch-icon.png...")
    with open('public/apple-touch-icon.png', 'wb') as f:
        f.write(make_icon(180))

    print("Generating favicon.png...")
    with open('public/favicon.png', 'wb') as f:
        f.write(make_icon(64))

    print("Done generating pristine PNGs!")
