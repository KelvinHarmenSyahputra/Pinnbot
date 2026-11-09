#!/usr/bin/env python3
import sys
import os
import random
from PIL import Image, ImageDraw, ImageFont

def create_folio_paper(width=1654, height=2339):
    # Standard A4-ish high-res folio ratio (1654 x 2339)
    # Warm cream paper tone
    img = Image.new('RGB', (width, height), (252, 251, 248))
    draw = ImageDraw.Draw(img)

    margin_left = 220
    margin_top = 280
    line_spacing = 68

    # Blue horizontal lines
    line_color = (195, 215, 235)
    for y in range(margin_top, height - 100, line_spacing):
        draw.line([(60, y), (width - 60, y)], fill=line_color, width=2)

    # Red vertical margin line
    red_margin_color = (235, 110, 110)
    draw.line([(margin_left, 60), (margin_left, height - 60)], fill=red_margin_color, width=3)

    return img, margin_left, margin_top, line_spacing

def render_handwriting(text, output_path, font_path=None, name="", nim="", date=""):
    img, margin_left, margin_top, line_spacing = create_folio_paper()
    draw = ImageDraw.Draw(img)

    # Select font
    font_size = 46
    if font_path and os.path.exists(font_path):
        font = ImageFont.truetype(font_path, font_size)
        header_font = ImageFont.truetype(font_path, 40)
    else:
        font = ImageFont.load_default()
        header_font = font

    # Ballpoint pen ink color (natural dark blue)
    ink_color = (24, 45, 85)

    # Optional Header
    if name or nim or date:
        header_y = margin_top - (line_spacing * 2)
        if name:
            draw.text((margin_left + 20, header_y), f"Nama  : {name}", fill=ink_color, font=header_font)
        if nim:
            draw.text((margin_left + 20, header_y + 45), f"NIM     : {nim}", fill=ink_color, font=header_font)
        if date:
            draw.text((img.width - 450, header_y), f"Tanggal : {date}", fill=ink_color, font=header_font)

    # Safe text boundaries
    start_x = margin_left + 25
    max_x = img.width - 90
    max_width = max_x - start_x

    lines = []
    for raw_para in text.split('\n'):
        if not raw_para.strip():
            lines.append("")
            continue

        words = raw_para.split(' ')
        cur_line = []
        for word in words:
            test_line = " ".join(cur_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            line_w = bbox[2] - bbox[0]
            if line_w <= max_width:
                cur_line.append(word)
            else:
                lines.append(" ".join(cur_line))
                cur_line = [word]
        if cur_line:
            lines.append(" ".join(cur_line))

    # Draw lines snapping to folio paper lines
    cur_y = margin_top - 12  # Sit right above the horizontal line
    for line in lines:
        if cur_y > img.height - 150:
            break # Page capacity limit

        if line:
            # Subtle random baseline jitter (+/- 1-2px) for organic human feel
            jitter_y = cur_y + random.randint(-1, 2)
            jitter_x = start_x + random.randint(0, 3)
            draw.text((jitter_x, jitter_y), line, fill=ink_color, font=font)

        cur_y += line_spacing

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, "JPEG", quality=92)
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 handwriting.py <text_file_or_string> <output_path> [font_path]")
        sys.exit(1)

    input_text = sys.argv[1]
    out_file = sys.argv[2]
    custom_font = sys.argv[3] if len(sys.argv) > 3 else None

    if os.path.exists(input_text):
        with open(input_text, 'r', encoding='utf-8') as f:
            text_content = f.read()
    else:
        text_content = input_text

    res = render_handwriting(text_content, out_file, custom_font)
    print(f"SUCCESS:{res}")
