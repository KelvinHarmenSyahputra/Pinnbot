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

def load_canvas_and_lines(paper_type='b5'):
    # Option 1: Loose Leaf B5 (matching authentic Indonesian student lecture notes)
    if paper_type in ['b5', 'looseleaf', 'binder']:
        b5_path = os.path.join(TEMPLATES_DIR, 'loose_leaf_b5.jpg')
        if os.path.exists(b5_path):
            paper = Image.open(b5_path).convert('RGB')
            pw, ph = paper.size
            top_margin = 210
            line_spacing = 54
            lines_y = list(range(top_margin, ph - 120, line_spacing))
            margin_x = 220
            return paper, lines_y, margin_x

    # Option 2: Sinar Dunia Flat HD
    flat_template = os.path.join(TEMPLATES_DIR, 'sidu_flat_hd.jpg')
    if os.path.exists(flat_template):
        paper = Image.open(flat_template).convert('RGB')
        pw, ph = paper.size
        top_margin = 180
        line_spacing = 54
        lines_y = list(range(top_margin, ph - 140, line_spacing))
        return paper, lines_y, 110

    # Fallback
    width, height = 1600, 2400
    paper = Image.new('RGB', (width, height), (252, 251, 246))
    lines_y = list(range(180, height - 140, 54))
    return paper, lines_y, 110

def render_handwriting(text, output_path, font_path=None, name="", nim="", date="", paper_type="b5"):
    paper, lines_y, margin_left = load_canvas_and_lines(paper_type)
    pw, ph = paper.size

    ink = Image.new('RGBA', (pw, ph), (255, 255, 255, 0))

    # Default to PlaypenSans (or My_handwriting)
    if not font_path or not os.path.exists(font_path):
        playpen = os.path.join(FONTS_DIR, 'PlaypenSans.ttf')
        myhand = os.path.join(FONTS_DIR, 'My_handwriting.ttf')
        font_path = playpen if os.path.exists(playpen) else myhand

    is_playpen = 'Playpen' in str(font_path)
    font_size = 38 if is_playpen else 44
    baseline_offset = 45 if is_playpen else 35

    font = ImageFont.truetype(font_path, font_size) if os.path.exists(font_path) else ImageFont.load_default()
    title_font = ImageFont.truetype(font_path, font_size + 2) if os.path.exists(font_path) else font

    content_left = margin_left + 20
    max_width = pw - content_left - 80

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

    start_line = 0
    for l_i, line_text in enumerate(wrapped_lines):
        line_idx = start_line + l_i
        if line_idx >= len(lines_y): break
        if not line_text.strip(): continue

        line_y = lines_y[line_idx]

        # Centered & underlined title on first line if capitalized
        if l_i == 0 and line_text.isupper():
            try:
                t_len = title_font.getlength(line_text)
            except AttributeError:
                t_len = len(line_text) * 22
            t_x = int((pw - t_len) / 2)
            t_y = line_y - baseline_offset - 1
            draw_ink = ImageDraw.Draw(ink)
            draw_ink.text((t_x, t_y), line_text, fill=(20, 22, 28, 245), font=title_font)
            draw_ink.line([(t_x - 10, line_y - 2), (t_x + t_len + 10, line_y - 2)], fill=(20, 22, 28, 240), width=2)
            continue

        cur_x = content_left
        if line_text.startswith('- ') or line_text.startswith('   '):
            cur_x += 35

        words = line_text.strip().split(' ')
        sent_p = random.uniform(0.94, 1.05)
        line_drift = random.uniform(-0.0005, 0.0006)

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
            p = sent_p * random.uniform(0.96, 1.04)
            shade = int(20 * p)
            ink_color = (shade, shade + 2, shade + 7, int(240 * min(1.0, p)))

            s_draw.text((pad, pad), word, fill=ink_color, font=font)

            # Micro-rotation of the word (-0.7 to +0.7 deg)
            rot = random.uniform(-0.7, 0.7)
            scale = random.uniform(0.985, 1.015)
            new_sz = (int(stamp.width * scale), int(stamp.height * scale))
            stamp_rot = stamp.resize(new_sz, Image.Resampling.BILINEAR).rotate(rot, resample=Image.Resampling.BILINEAR)

            jitter_y = random.uniform(-0.5, 0.7)
            wave_y = math.sin((cur_x - content_left) / 180.0) * 0.8
            dest_y = int(line_y - baseline_offset - pad + jitter_y + wave_y + (cur_x - content_left) * line_drift)
            dest_x = int(cur_x - pad)

            ink.paste(stamp_rot, (dest_x, dest_y), stamp_rot)

            try:
                space_len = font.getlength(' ')
            except AttributeError:
                space_len = 12

            cur_x += w_len + space_len + random.uniform(-0.6, 1.2)

    # Micro ink-bleed into paper fiber
    ink_smooth = ink.filter(ImageFilter.GaussianBlur(radius=0.28))
    paper.paste(ink_smooth, (0, 0), ink_smooth)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    paper.save(output_path, "JPEG", quality=95)
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
    p_type = sys.argv[7] if len(sys.argv) > 7 else "b5"

    if os.path.exists(input_text):
        with open(input_text, 'r', encoding='utf-8') as f:
            text_content = f.read()
    else:
        text_content = input_text

    res = render_handwriting(text_content, out_file, custom_font, name=name, nim=nim, date=date, paper_type=p_type)
    print(f"SUCCESS:{res}")
