#!/usr/bin/env python3
import sys
import os
import json
import random
import math
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
        except Exception as e:
            print(f"Warning: could not load RNN model ({e}), falling back to font rendering.")
    return _rnn_model

def load_canvas(paper_type='sidu'):
    # Default: Real photograph of Sinar Dunia notebook (with authentic camera lighting & texture)
    sidu_photo = os.path.join(TEMPLATES_DIR, 'sidu_hd_template.jpg')
    lines_json = os.path.join(TEMPLATES_DIR, 'horizontal_lines.json')

    if paper_type in ['sidu', 'folio'] and os.path.exists(sidu_photo) and os.path.exists(lines_json):
        paper = Image.open(sidu_photo).convert('RGB')
        with open(lines_json, 'r') as f:
            lines_y = json.load(f)
        return paper, lines_y, 115

    # Loose Leaf B5 option
    b5_path = os.path.join(TEMPLATES_DIR, 'loose_leaf_b5.jpg')
    if os.path.exists(b5_path):
        paper = Image.open(b5_path).convert('RGB')
        pw, ph = paper.size
        top_margin = 210
        lines_y = list(range(top_margin, ph - 120, 54))
        return paper, lines_y, 245

    # Fallback
    width, height = 1500, 2300
    paper = Image.new('RGB', (width, height), (252, 251, 246))
    lines_y = list(range(180, height - 140, 54))
    return paper, lines_y, 115

def render_handwriting(text, output_path, font_path=None, name="", nim="", date="", paper_type="sidu"):
    paper, lines_y, content_left = load_canvas(paper_type)
    pw, ph = paper.size

    rnn = get_rnn_model()

    # White canvas for multiply blend
    ink_canvas = Image.new('RGB', (pw, ph), (255, 255, 255))
    draw_ink = ImageDraw.Draw(ink_canvas)

    max_width = pw - content_left - 90

    # Build lines with smart paragraph splitting
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

    start_line = 1
    for l_i, line_text in enumerate(raw_lines):
        line_idx = start_line + l_i
        if line_idx >= len(lines_y): break
        if not line_text.strip(): continue

        line_y = lines_y[line_idx]

        ox = content_left
        if line_text.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
            ox = content_left + 15
        elif line_text.startswith(('- ', '   ', 'Jawab:')):
            ox = content_left + 35

        # Render using Alex Graves Neural Network (Style 3) if available
        if rnn is not None:
            # Clean text to model vocabulary
            safe_text = ''.join(c for c in line_text if c in rnn.vocabulary or c == ' ')
            if not safe_text.strip(): continue

            # Try up to 5 seeds to avoid stall/glitch
            points = None
            pts = []
            for seed_offset in range(5):
                seed = random.randint(10, 999999) + seed_offset
                budget = len(safe_text) * 75
                pts, reason = rnn.sample(safe_text, style=3, bias=0.58, seed=seed, budget=budget)
                if reason == 'finished':
                    points = pts
                    break
            if points is None:
                points = pts

            scale = 1.35
            base_target_y = line_y - 5.0 # Base letters sit directly on the line without floating

            prev = None
            for p in points:
                x, y, pen_up = p[0] * scale, p[1] * scale, p[2]
                coord = (x + ox, y + base_target_y)

                if prev is not None and prev[2] == 0:
                    dx = x - prev[0] * scale
                    dy = y - prev[1] * scale
                    dist = math.hypot(dx, dy)

                    # Dynamic ballpoint pen pressure
                    stroke_w = max(1.8, min(2.5, 2.4 - dist * 0.08))
                    # Authentic Zebra Kokoro / Joyko black gel pen color
                    ink_color = (20, 22, 28)

                    draw_ink.line([(prev[0] * scale + ox, prev[1] * scale + base_target_y), coord], fill=ink_color, width=int(round(stroke_w)))
                    r = stroke_w / 2.0
                    draw_ink.ellipse([coord[0] - r, coord[1] - r, coord[0] + r, coord[1] + r], fill=ink_color)

                prev = p
        else:
            # Fallback to TTF font if RNN not available
            font_file = os.path.join(FONTS_DIR, 'My_handwriting.ttf')
            font = ImageFont.truetype(font_file, 44) if os.path.exists(font_file) else ImageFont.load_default()
            draw_ink.text((ox, line_y - 35), line_text, fill=(22, 24, 30), font=font)

    # Micro ink-bleed into paper fiber
    ink_canvas = ink_canvas.filter(ImageFilter.GaussianBlur(radius=0.28))

    # Genuine Multiply blend onto real paper photograph
    final_image = ImageChops.multiply(paper, ink_canvas)

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
