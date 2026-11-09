#!/usr/bin/env python3
import sys
import os
import random
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, 'assets', 'templates')
FONTS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'fonts')

def load_canvas_and_lines():
    flat_template = os.path.join(TEMPLATES_DIR, 'sidu_flat_hd.jpg')
    if os.path.exists(flat_template):
        paper = Image.open(flat_template).convert('RGB')
        pw, ph = paper.size
        top_margin = 180
        line_spacing = 54
        lines_y = list(range(top_margin, ph - 140, line_spacing))
        return paper, lines_y

    # Fallback clean Sinar Dunia paper
    width, height = 1600, 2400
    paper = Image.new('RGB', (width, height), (252, 251, 246))
    draw = ImageDraw.Draw(paper)
    line_color = (104, 143, 168)
    line_spacing = 54
    lines_y = list(range(180, height - 140, line_spacing))
    for idx, ly in enumerate(lines_y):
        draw.line([(70, ly), (width - 70, ly)], fill=line_color, width=2)
        if idx == 0 or idx == len(lines_y) - 2:
            for tx in range(120, width - 120, 110):
                draw.line([(tx, ly - 5), (tx, ly + 5)], fill=line_color, width=2)
    return paper, lines_y

def render_handwriting(text, output_path, font_path=None, name="", nim="", date=""):
    paper, lines_y = load_canvas_and_lines()
    pw, ph = paper.size

    # Transparent RGBA ink layer
    ink = Image.new('RGBA', (pw, ph), (255, 255, 255, 0))

    # Select font: Default to authentic casual Indonesian student handwriting
    if not font_path or not os.path.exists(font_path):
        myhand_path = os.path.join(FONTS_DIR, 'My_handwriting.ttf')
        justme_path = os.path.join(FONTS_DIR, 'JustMeAgainDownHere.ttf')
        font_path = myhand_path if os.path.exists(myhand_path) else justme_path

    font_size = 44
    font = ImageFont.truetype(font_path, font_size) if os.path.exists(font_path) else ImageFont.load_default()

    margin_left = 110
    max_width = 1360

    # Clean paragraph word-wrap
    wrapped_lines = []

    # Optional header injection if passed via CLI args
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
            try:
                w_len = font.getlength(test)
            except AttributeError:
                w_len = len(test) * 20

            if w_len <= max_width:
                cur.append(w)
            else:
                wrapped_lines.append(' '.join(cur))
                cur = [w]
        if cur:
            wrapped_lines.append(' '.join(cur))

    # Render lines onto Sinar Dunia lined paper
    start_line = 1
    for l_i, line_text in enumerate(wrapped_lines):
        line_idx = start_line + l_i
        if line_idx >= len(lines_y): break
        if not line_text.strip(): continue

        cur_x = margin_left
        if line_text.startswith('Jawab:') or line_text.startswith('   '):
            cur_x += 35

        words = line_text.strip().split(' ')
        line_y = lines_y[line_idx]

        sent_p = random.uniform(0.92, 1.05)
        line_drift = random.uniform(-0.0006, 0.0008)

        for word in words:
            try:
                w_len = int(font.getlength(word)) + 4
            except AttributeError:
                w_len = len(word) * 20
            w_h = 60
            pad = 10

            stamp = Image.new('RGBA', (w_len + pad * 2, w_h + pad * 2), (255, 255, 255, 0))
            s_draw = ImageDraw.Draw(stamp)

            # Ballpoint gel pen ink (Standard AE7 dark charcoal blue-black)
            p = sent_p * random.uniform(0.94, 1.04)
            shade = int(22 * p)
            ink_color = (shade, shade + 2, shade + 7, int(240 * min(1.0, p)))

            # In My_handwriting at 44, bbox y1 is 35
            s_draw.text((pad, pad), word, fill=ink_color, font=font)

            # Word-level natural micro-rotation (-0.8 to +0.8 deg)
            rot = random.uniform(-0.8, 0.8)
            scale = random.uniform(0.985, 1.015)
            new_sz = (int(stamp.width * scale), int(stamp.height * scale))
            stamp_rot = stamp.resize(new_sz, Image.Resampling.BILINEAR).rotate(rot, resample=Image.Resampling.BILINEAR)

            # Baseline: line_y - 35 aligns bottom of base letters touching the line!
            jitter_y = random.uniform(-0.6, 0.9)
            wave_y = math.sin((cur_x - margin_left) / 180.0) * 1.0
            dest_y = int(line_y - 35 - pad + jitter_y + wave_y + (cur_x - margin_left) * line_drift)
            dest_x = int(cur_x - pad)

            ink.paste(stamp_rot, (dest_x, dest_y), stamp_rot)

            try:
                space_len = font.getlength(' ')
            except AttributeError:
                space_len = 12

            cur_x += w_len + space_len + random.uniform(-0.8, 1.4)

    # Micro ink-bleed into paper fiber (0.28px blur)
    ink_smooth = ink.filter(ImageFilter.GaussianBlur(radius=0.28))

    # Composite onto paper
    paper.paste(ink_smooth, (0, 0), ink_smooth)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    paper.save(output_path, "JPEG", quality=95)
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 handwriting.py <text_file_or_string> <output_path> [font_path] [name] [nim] [date]")
        sys.exit(1)

    input_text = sys.argv[1]
    out_file = sys.argv[2]
    custom_font = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
    name = sys.argv[4] if len(sys.argv) > 4 else ""
    nim = sys.argv[5] if len(sys.argv) > 5 else ""
    date = sys.argv[6] if len(sys.argv) > 6 else ""

    if os.path.exists(input_text):
        with open(input_text, 'r', encoding='utf-8') as f:
            text_content = f.read()
    else:
        text_content = input_text

    res = render_handwriting(text_content, out_file, custom_font, name=name, nim=nim, date=date)
    print(f"SUCCESS:{res}")
