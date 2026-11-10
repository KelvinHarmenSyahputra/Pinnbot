#!/usr/bin/env python3
import sys
import os
import subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import inch
from pdf2docx import Converter

def text_to_pdf(title, text_content, output_pdf_path):
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        spaceAfter=12
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        spaceAfter=8
    )

    story = []
    if title:
        t_safe = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        story.append(Paragraph(t_safe, title_style))
        story.append(Spacer(1, 0.2 * inch))

    for para in text_content.split('\n'):
        p_clean = para.strip()
        if p_clean:
            # Escape basic XML chars for reportlab Paragraph
            p_safe = p_clean.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(p_safe, body_style))
        else:
            story.append(Spacer(1, 0.1 * inch))

    doc.build(story)
    return output_pdf_path

def docx_to_pdf(input_docx, output_dir):
    cmd = ['soffice', '--headless', '--convert-to', 'pdf', input_docx, '--outdir', output_dir]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"soffice conversion error: {res.stderr}")
    base_name = os.path.splitext(os.path.basename(input_docx))[0]
    return os.path.join(output_dir, f"{base_name}.pdf")

def pdf_to_docx(input_pdf, output_docx_path):
    cv = Converter(input_pdf)
    cv.convert(output_docx_path, start=0, end=None)
    cv.close()
    return output_docx_path

def extract_pdf_text(input_pdf, max_pages=15, max_chars=12000):
    try:
        import pymupdf  # type: ignore
    except ImportError:
        import fitz as pymupdf  # type: ignore

    doc = pymupdf.open(input_pdf)
    text = ""
    total_pages = len(doc)
    for i in range(min(total_pages, max_pages)):
        page_txt = doc[i].get_text()
        if page_txt.strip():
            text += f"[Halaman {i+1}]\n{page_txt.strip()}\n\n"
        if len(text) > max_chars:
            text = text[:max_chars] + "\n... (dipotong karena terlalu panjang)"
            break
    doc.close()
    return total_pages, text.strip()

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'text_to_pdf':
        title = sys.argv[2]
        content_file = sys.argv[3]
        out_path = sys.argv[4]
        with open(content_file, 'r', encoding='utf-8') as f:
            content = f.read()
        res = text_to_pdf(title, content, out_path)
        print(f"SUCCESS:{res}")
    elif mode == 'docx_to_pdf':
        in_docx = sys.argv[2]
        out_dir = sys.argv[3]
        res = docx_to_pdf(in_docx, out_dir)
        print(f"SUCCESS:{res}")
    elif mode == 'pdf_to_docx':
        in_pdf = sys.argv[2]
        out_docx = sys.argv[3]
        res = pdf_to_docx(in_pdf, out_docx)
        print(f"SUCCESS:{res}")
    elif mode == 'extract_pdf':
        in_pdf = sys.argv[2]
        out_json = sys.argv[3]
        import json
        pages, text = extract_pdf_text(in_pdf)
        with open(out_json, 'w', encoding='utf-8') as f:
            json.dump({'totalPages': pages, 'text': text}, f, ensure_ascii=False)
        print(f"SUCCESS:{out_json}")
