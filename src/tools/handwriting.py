#!/usr/bin/env python3
import sys
import os
import json
import random
import math
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, 'assets', 'templates')
FONTS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'fonts')

def load_template_and_lines():
    template_path = os.path.join(TEMPLATES_DIR, 'sidu_hd_template.jpg')
    lines_path = os.path.join(TEMPLATES_DIR, 'horizontal_lines.json')

    if os.path.exists(template_path) and os.path.exists(lines_path):
        paper = Image.open(template_path).convert('RGB')
        with open(lines_path, 'r') as f:
            lines_y = json.load(f)
        return paper, lines_y

    # Fallback clean Sinar Dunia paper
    width, height = 1500, 2300
    paper = Image.new('RGB', (width, height), (252, 251, 247))
    draw = ImageDraw.Draw(paper)
    lines_y = []
    y = 176
    while y < height - 100:
        lines_y.append(y)
        draw.line([(60, y), (width - 60, y)], fill=(88, 128, 168), width=2)
        y += 50
    return paper, lines_y

def render_handwriting(text, output_path, font_path=None, name="", nim="", date=""):
    paper, lines_y = load_template_and_lines()
    pw, ph = paper.size

    # White canvas for multiply blend
    ink_white = Image.new('RGB', (pw, ph), (255, 255, 255))

    # Select font: Default to authentic Indonesian student handwriting
    if not font_path or not os.path.exists(font_path):
        cr2_path = os.path.join(FONTS_DIR, 'HandwritingCR-2.ttf')
        font_path = cr2_path if os.path.exists(cr2_path) else os.path.join(FONTS_DIR, 'PatrickHand.ttf')

    font_size = 42
    font = ImageFont.truetype(font_path, font_size) if os.path.exists(font_path) else ImageFont.load_default()

    margin_left = 115
    max_width = 1260

    # Clean paragraph word-wrap
    wrapped_lines = []

    # Optional header injection
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
        line_drift = random.uniform(-0.0008, 0.001)

        for word in words:
            try:
                w_len = int(font.getlength(word)) + 4
            except AttributeError:
                w_len = len(word) * 20
            w_h = 65
            pad = 12

            stamp = Image.new('RGB', (w_len + pad * 2, w_h + pad * 2), (255, 255, 255))
            s_draw = ImageDraw.Draw(stamp)

            # Ballpoint gel pen ink (Standard AE7 dark charcoal blue-black)
            p = sent_p * random.uniform(0.94, 1.04)
            shade = int(22 * p)
            ink_color = (shade, shade + 2, shade + 7)

            s_draw.text((pad, pad), word, fill=ink_color, font=font)

            # Micro-rotation of the word (-0.9 to +0.9 deg)
            rot = random.uniform(-0.9, 0.9)
            scale = random.uniform(0.985, 1.015)
            new_sz = (int(stamp.width * scale), int(stamp.height * scale))
            stamp_rot = stamp.resize(new_sz, Image.Resampling.BILINEAR).rotate(rot, resample=Image.Resampling.BILINEAR, fillcolor=(255, 255, 255))

            # Human baseline wave across the line
            human_wave = math.sin((cur_x - margin_left) / 160.0) * 1.2
            jitter_y = random.uniform(-0.7, 0.7)
            dest_y = int(line_y - 38 - pad + human_wave + jitter_y + (cur_x - margin_left) * line_drift)
            dest_x = int(cur_x - pad)

            region = ink_white.crop((dest_x, dest_y, dest_x + stamp_rot.width, dest_y + stamp_rot.height))
            blended = ImageChops.multiply(region, stamp_rot)
            ink_white.paste(blended, (dest_x, dest_y))

            try:
                space_len = font.getlength(' ')
            except AttributeError:
                space_len = 12

            cur_x += w_len + space_len + random.uniform(-0.8, 1.6)

    # Micro ink-bleed into paper fiber
    ink_white = ink_white.filter(ImageFilter.GaussianBlur(radius=0.35))

    # Genuine Multiply blend onto real Sinar Dunia paper
    final_image = ImageChops.multiply(paper, ink_white)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    final_image.save(output_path, "JPEG", quality=95)
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
