#!/usr/bin/env python3
import sys
import os
import json
import random
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, 'assets', 'templates')
FONTS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'fonts')
RNN_DIR = os.path.join(PROJECT_ROOT, 'tools', 'rnn_handwriting')

# Add RNN model to path
if os.path.exists(RNN_DIR):
    sys.path.insert(0, RNN_DIR)

_rnn_model = None
def get_rnn_model():
    global _rnn_model
    if _rnn_model is None:
        try:
            import model
            bin_path = os.path.join(RNN_DIR, 'd.bin')
            if os.path.exists(bin_path):
                _rnn_model = model.Model(bin_path)
        except Exception:
            pass
    return _rnn_model

def load_canvas(paper_type='sidu'):
    # Default: Real photograph of Sinar Dunia notebook
    sidu_photo = os.path.join(TEMPLATES_DIR, 'sidu_hd_template.jpg')
    lines_maps_json = os.path.join(TEMPLATES_DIR, 'horizontal_line_maps.json')
    lines_json = os.path.join(TEMPLATES_DIR, 'horizontal_lines.json')

    if paper_type in ['sidu', 'folio'] and os.path.exists(sidu_photo) and os.path.exists(lines_maps_json):
        paper = Image.open(sidu_photo).convert('RGB')
        with open(lines_maps_json, 'r') as f:
            data = json.load(f)
        return paper, data['lines'], data['line_maps'], 115
    elif paper_type in ['sidu', 'folio'] and os.path.exists(sidu_photo) and os.path.exists(lines_json):
        paper = Image.open(sidu_photo).convert('RGB')
        with open(lines_json, 'r') as f:
            lines_y = json.load(f)
        return paper, lines_y, None, 115

    # Loose Leaf B5 option
    b5_path = os.path.join(TEMPLATES_DIR, 'loose_leaf_b5.jpg')
    if os.path.exists(b5_path):
        paper = Image.open(b5_path).convert('RGB')
        pw, ph = paper.size
        top_margin = 210
        lines_y = list(range(top_margin, ph - 120, 54))
        return paper, lines_y, None, 245

    # Fallback
    width, height = 1500, 2300
    paper = Image.new('RGB', (width, height), (252, 251, 246))
    lines_y = list(range(180, height - 140, 54))
    return paper, lines_y, None, 115

def get_exact_line_y(lines_y, line_maps, line_idx, x):
    if line_maps and line_idx < len(line_maps):
        m = line_maps[line_idx]
        rx = round(x / 25.0) * 25
        if str(rx) in m:
            return m[str(rx)]
        avail = sorted([int(k) for k in m.keys()])
        if x <= avail[0]: return m[str(avail[0])]
        if x >= avail[-1]: return m[str(avail[-1])]
        for i in range(len(avail)-1):
            if avail[i] <= x <= avail[i+1]:
                t = (x - avail[i]) / (avail[i+1] - avail[i])
                return (1-t) * m[str(avail[i])] + t * m[str(avail[i+1])]
    return lines_y[line_idx]

def render_handwriting(text, output_path, font_path=None, name="", nim="", date="", paper_type="sidu"):
    paper, lines_y, line_maps, content_left = load_canvas(paper_type)
    pw, ph = paper.size

    # White canvas for multiply blend
    ink_white = Image.new('RGB', (pw, ph), (255, 255, 255))
    draw_ink = ImageDraw.Draw(ink_white)

    # Choice of engine:
    # If explicitly requested 'rnn', use Alex Graves RNN stroke generator
    # Otherwise use clean, bold, non-cursive student print-script (PlaypenSans)
    use_rnn = (font_path == 'rnn' or paper_type == 'rnn')

    if use_rnn and get_rnn_model() is not None:
        rnn = get_rnn_model()
        max_width = pw - content_left - 90

        raw_lines = []
        if name or nim or date:
            header_parts = []
            if name: header_parts.append(f"Nama : {name}")
            if nim: header_parts.append(f"NIM  : {nim}")
            if date: header_parts.append(f"Tgl  : {date}")
            raw_lines.append("   |   ".join(header_parts))
            raw_lines.append("")

        for para in text.split('\n'):
            p_clean = para.strip()
            if not p_clean:
                raw_lines.append("")
                continue
            words = p_clean.split(' ')
            cur = []
            for w in words:
                test = ' '.join(cur + [w])
                if len(test) * 16 <= max_width:
                    cur.append(w)
                else:
                    raw_lines.append(' '.join(cur))
                    cur = [w]
            if cur:
                raw_lines.append(' '.join(cur))

        # Start higher up on Line 1
        start_line = 0
        scale = 1.35

        for l_i, line_text in enumerate(raw_lines):
            line_idx = start_line + l_i
            if line_idx >= len(lines_y): break
            if not line_text.strip(): continue

            ox = content_left
            if line_text.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
                ox = content_left + 15
            elif line_text.startswith(('- ', '   ', 'Jawab:')):
                ox = content_left + 35
            elif l_i == 0:
                ox = content_left + 40

            safe_text = ''.join(c for c in line_text if c in rnn.vocabulary or c == ' ')
            if not safe_text.strip(): continue

            points = None
            for seed_offset in range(8):
                seed = random.randint(100, 999999) + seed_offset * 77
                budget = len(safe_text) * 75
                pts, reason = rnn.sample(safe_text, style=3, bias=0.65, seed=seed, budget=budget)
                if reason == 'finished':
                    points = pts
                    break
            if points is None:
                points = pts

            pts_x = np.array([p[0] for p in points])
            pts_y = np.array([p[1] for p in points])

            if len(points) > 15:
                poly = np.polyfit(pts_x, pts_y, 2)
                drift = np.polyval(poly, pts_x)
            else:
                drift = np.zeros(len(points))

            prev = None
            prev_coord = None
            for idx_p, p in enumerate(points):
                d_val = float(drift[idx_p])
                corrected_y = (p[1] - d_val) * scale
                cur_x = p[0] * scale + ox
                real_line_y = get_exact_line_y(lines_y, line_maps, line_idx, cur_x)
                cur_y = corrected_y + real_line_y - 3.0
                coord = (cur_x, cur_y)

                if prev is not None and prev[2] == 0 and prev_coord is not None:
                    dx = cur_x - prev_coord[0]
                    dy = cur_y - prev_coord[1]
                    dist = math.hypot(dx, dy)

                    stroke_w = max(1.7, min(2.8, 2.65 - dist * 0.09))
                    press = random.uniform(0.95, 1.04)
                    r = int(18 * press)
                    g = int(20 * press)
                    b = int(26 * press)

                    draw_ink.line([prev_coord, coord], fill=(r, g, b), width=int(round(stroke_w)))
                    rad = stroke_w / 2.0
                    draw_ink.ellipse([coord[0] - rad, coord[1] - rad, coord[0] + rad, coord[1] + rad], fill=(r, g, b))

                    if dist < 0.6 or dist > 14:
                        pr = stroke_w * 0.6
                        draw_ink.ellipse([coord[0] - pr, coord[1] - pr, coord[0] + pr, coord[1] + pr], fill=(12, 14, 18))

                prev = p
                prev_coord = coord

    else:
        # Authentic clean, bold student print-script (NON-CURSIVE, cetak lepas, jelas dan rapi)
        # Default font: PlaypenSans
        if not font_path or not os.path.exists(font_path) or font_path == 'rnn':
            playpen = os.path.join(FONTS_DIR, 'PlaypenSans.ttf')
            font_path = playpen if os.path.exists(playpen) else os.path.join(FONTS_DIR, 'HandwritingCR-2.ttf')

        font_size = 38

        font = ImageFont.truetype(font_path, font_size) if os.path.exists(font_path) else ImageFont.load_default()
        max_width = pw - content_left - 80

        wrapped_lines = []
        if name or nim or date:
            header_parts = []
            if name: header_parts.append(f"Nama : {name}")
            if nim: header_parts.append(f"NIM  : {nim}")
            if date: header_parts.append(f"Tgl  : {date}")
            wrapped_lines.append("   |   ".join(header_parts))
            wrapped_lines.append("")

        for para in text.split('\n'):
            p_clean = para.strip()
            if not p_clean:
                wrapped_lines.append("")
                continue
            words = p_clean.split(' ')
            cur = []
            for w in words:
                test = ' '.join(cur + [w])
                if font.getlength(test) <= max_width:
                    cur.append(w)
                else:
                    wrapped_lines.append(' '.join(cur))
                    cur = [w]
            if cur:
                wrapped_lines.append(' '.join(cur))

        # START AT THE VERY TOP: Line 1 (index 0, y ~ 131)
        start_line = 0

        for l_i, line_text in enumerate(wrapped_lines):
            line_idx = start_line + l_i
            if line_idx >= len(lines_y): break
            if not line_text.strip(): continue

            cur_x = content_left
            if line_text.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
                cur_x += 15
            elif l_i == 0 or line_text.startswith(('Untuk itu', 'Adapun', 'Dengan demikian')):
                cur_x += 40

            words = line_text.split(' ')
            sent_p = random.uniform(0.95, 1.04)

            for word in words:
                w_len = int(font.getlength(word)) + 6
                w_h = font_size + 24
                pad = 12

                stamp = Image.new('RGB', (w_len + pad * 2, w_h + pad * 2), (255, 255, 255))
                s_draw = ImageDraw.Draw(stamp)

                # Real Zebra Kokoro / Joyko black gel pen color (#0a0a0e)
                ink_color = (10, 10, 14)

                s_draw.text((pad, pad), word, fill=ink_color, font=font, stroke_width=1, stroke_fill=ink_color)

                # Word-level micro-rotation (-0.5 to +0.5 deg)
                rot = random.uniform(-0.5, 0.5)
                new_sz = (int(stamp.width), int(stamp.height))
                stamp_rot = stamp.resize(new_sz, Image.Resampling.BILINEAR).rotate(rot, resample=Image.Resampling.BILINEAR, fillcolor=(255, 255, 255))

                y_bottom = get_exact_line_y(lines_y, line_maps, line_idx + 1, cur_x) if line_idx + 1 < len(lines_y) else lines_y[-1] + 50
                jitter_y = random.uniform(-0.5, 0.5)
                # Float ~8px above the bottom line so base letters sit right in the middle zone between upper line and lower line!
                dest_y = int(y_bottom - 8.0 - 43 - pad + jitter_y)
                dest_x = int(cur_x - pad)

                region = ink_white.crop((dest_x, dest_y, dest_x + stamp_rot.width, dest_y + stamp_rot.height))
                blended = ImageChops.multiply(region, stamp_rot)
                ink_white.paste(blended, (dest_x, dest_y))

                cur_x += w_len + font.getlength(' ') + random.uniform(-0.4, 1.0)

    # Micro ink-bleed into paper fiber
    ink_smooth = ink_white.filter(ImageFilter.GaussianBlur(radius=0.25))

    # Genuine Multiply blend onto real paper photograph
    final_image = ImageChops.multiply(paper, ink_smooth)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    final_image.save(output_path, "JPEG", quality=95)
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 handwriting.py <text_file_or_string> <output_path> [font_path] [name] [nim] [date] [paper_type]")
        sys.exit(1)

    input_text = sys.argv[1]
    out_file = sys.argv[2]
    custom_font = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
    name = sys.argv[4] if len(sys.argv) > 4 else ""
    nim = sys.argv[5] if len(sys.argv) > 5 else ""
    date = sys.argv[6] if len(sys.argv) > 6 else ""
    p_type = sys.argv[7] if len(sys.argv) > 7 else "sidu"

    if os.path.exists(input_text):
        with open(input_text, 'r', encoding='utf-8') as f:
            text_content = f.read()
    else:
        text_content = input_text

    res = render_handwriting(text_content, out_file, custom_font, name=name, nim=nim, date=date, paper_type=p_type)
    print(f"SUCCESS:{res}")
