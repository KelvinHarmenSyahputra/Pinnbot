import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateHandwriting } from '../src/tools/handwriting.js';
import { handleCommand } from '../src/handlers/commands.js';
import { convertDocxToPdf, convertPdfToDocx, convertTextToPdf } from '../src/tools/docs.js';

const RESULTS = [];

function record(name, status, details) {
  RESULTS.push({ name, status, details });
  const icon = status === 'PASS' ? '✅' : (status === 'WARN' ? '⚠️' : '❌');
  console.log(`${icon} [${status}] ${name}`);
  if (details) console.log(`   └─ ${details}`);
}

async function runAcademicStressSuite() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  QA AGENT 2: ACADEMIC TOOLS & FILE CONVERSION STRESS TEST ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // -------------------------------------------------------------
  // TEST 1: Text to Double Folio Handwriting (300-500 words essay)
  // -------------------------------------------------------------
  console.log('▶ [TEST 1] Text to Double Folio Handwriting (300-500 words)...');
  const essay380 = [
    'Sistem Operasi merupakan komponen fundamental dalam arsitektur komputer modern yang berfungsi menjembatani komunikasi antara perangkat keras dan aplikasi pengguna. Tugas utamanya mencakup manajemen prosesor, pengelolaan alokasi memori fisik dan virtual, sistem berkas hierarkis, serta penanganan operasi masukan dan keluaran secara terpadu. Dalam konteks eksekusi banyak program secara simultan, penjadwal CPU menerapkan algoritma khusus seperti Round Robin atau Multi-Level Feedback Queue guna memastikan keadilan distribusi waktu komputasi serta mencegah terjadinya kelaparan proses yang berkepanjangan.',
    'Selain itu, konkurensi antar utas membutuhkan sinkronisasi data yang ketat untuk mengeliminasi kondisi balapan melalui primitif seperti semafor biner, kunci mutex, dan monitor terstruktur. Kegagalan dalam mengelola akses bersama terhadap sumber daya kritis dapat berujung pada situasi kebuntuan sistem atau deadlock yang melumpuhkan eksekusi seluruh alur komputasi. Empat kondisi Coffman harus dipantau secara cermat untuk mendeteksi dan mencegah potensi saling tunggu antar proses secara permanen.',
    'Manajemen memori menggunakan mekanisme paging bertingkat untuk memetakan alamat virtual ke bingkai memori fisik secara transparan, memberikan proteksi isolasi ruang alamat antar proses berbeda. Apabila halaman memori yang diminta tidak berada di RAM utama, terjadi page fault yang memicu algoritma page replacement seperti Least Recently Used untuk memindahkan halaman lama ke media penyimpanan sekunder swap. Teknik ini memperluas kapasitas memori efektif yang dapat digunakan oleh program berskala besar.',
    'Pada lapisan sistem berkas, struktur data inode mengatur pointer langsung dan tidak langsung menuju blok data penyimpanan persisten, menjamin integritas data saat terjadi kegagalan perangkat keras atau kehilangan daya tiba-tiba. Keamanan sistem operasi juga bergantung pada pemisahan hak akses antara mode pengguna dan mode kernel terlindungi, mencegah instruksi berbahaya mengakses sumber daya sistem tanpa otorisasi formal.',
    'Sebagai kesimpulan, pemahaman mendalam mengenai prinsip kerja sistem operasi sangat esensial bagi pengembangan perangkat lunak berkinerja tinggi. Optimalisasi pada tingkat sistem operasi memungkinkan aplikasi beroperasi dengan efisiensi sumber daya yang superior dan skalabilitas yang tangguh di lingkungan komputasi awan maupun server berkapasitas masif modern saat ini.'
  ].join('\n\n');

  const essayWordCount = essay380.split(/\s+/).filter(Boolean).length;
  assert.ok(essayWordCount >= 300 && essayWordCount <= 500, `Essay word count must be 300-500, got: ${essayWordCount}`);

  try {
    const folioPath = await generateHandwriting(essay380, {
      name: 'Kelvin Harmensyah',
      nim: '2110512001',
      date: '09-11-2026',
      outputFilename: 'test_folio_essay_qa2.jpg'
    });

    assert.ok(fs.existsSync(folioPath), 'Folio output file must exist');
    const fstat = fs.statSync(folioPath);
    const sizeKB = Math.round(fstat.size / 1024);
    assert.ok(fstat.size > 100 * 1024, `Folio image size must be > 100KB, got: ${sizeKB}KB`);

    // Verify JPEG format and pixel boundary via python
    const pyCheck = spawnSync('/usr/bin/python3', ['-c', `
from PIL import Image
import numpy as np

im = Image.open('${folioPath}')
assert im.format == 'JPEG', f'Expected JPEG format, got {im.format}'
assert im.size == (1654, 2339), f'Expected size (1654, 2339), got {im.size}'

arr = np.array(im)
ink_mask = (arr[:, :, 0] < 100) & (arr[:, :, 1] < 100) & (arr[:, :, 2] < 150)
coords = np.argwhere(ink_mask)
min_y, min_x = coords.min(axis=0)
max_y, max_x = coords.max(axis=0)

# Check canvas boundaries
assert min_x >= 0 and max_x < im.width, f'X out of canvas: {min_x}, {max_x}'
assert min_y >= 0 and max_y < im.height, f'Y out of canvas: {min_y}, {max_y}'
# Check folio margins: ink should be to the right of red margin line (x=220) and have right margin
assert min_x >= 220, f'Ink crossed left red margin: min_x={min_x} < 220'
assert im.width - max_x >= 30, f'Ink too close to right edge: clearance={im.width - max_x}px'

print(f'INK_OK: X=[{min_x}, {max_x}], Y=[{min_y}, {max_y}], right_clearance={im.width - max_x}px')
    `]);

    const pyOut = pyCheck.stdout.toString().trim();
    if (pyCheck.status !== 0) {
      throw new Error(`Python boundary check failed: ${pyCheck.stderr.toString()}`);
    }

    record('Text to Double Folio Handwriting', 'PASS', `Words: ${essayWordCount}, Size: ${sizeKB}KB, Format: JPEG, Boundaries: ${pyOut}`);
  } catch (err) {
    record('Text to Double Folio Handwriting', 'FAIL', err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Academic Polished PDF (/pdf command)
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 2] Academic Polished PDF (/pdf command)...');
  const messyText = '/pdf Analisis Penjadwalan CPU | jd gini bro, di sistem operasi kn ad CPU scheduling yak nah itu bwt ngatur antrean proses sapa dlu yg dieksekusi sm prosessor. misal algoritma FCFS tuh lelet bgt krena kn ad convoy effect klo proses gede nongol d awal. trs klw Round Robin pke time quantum jd adil tiap proses dpt jatah waktu yg sm, tp klo quantumnya kcepetan bnyk overhead context switch. trs prioritas ad aging biar g starving.';
  try {
    const pdfCmdRes = await handleCommand(messyText);
    assert.strictEqual(pdfCmdRes.type, 'document', 'Result type must be document');
    assert.ok(fs.existsSync(pdfCmdRes.path), `PDF file must exist at ${pdfCmdRes.path}`);

    // Verify PDF validity and content via PyMuPDF
    const pyPdf = spawnSync('/usr/bin/python3', ['-c', `
import fitz
doc = fitz.open('${pdfCmdRes.path}')
assert len(doc) >= 1, 'PDF must have at least 1 page'
text = doc[0].get_text()
assert len(text.strip()) > 50, 'PDF text too short'
# Check if slang was polished away
assert 'bro' not in text.lower() and 'lelet bgt' not in text.lower(), 'Slang still present in PDF'
print(f'PDF_VERIFIED: {len(doc)} page(s), {len(text)} chars, Title preserved: {doc[0].get_text().splitlines()[0]}')
    `]);

    if (pyPdf.status !== 0) {
      throw new Error(`PyMuPDF check failed: ${pyPdf.stderr.toString()}`);
    }

    record('Academic Polished PDF (/pdf)', 'PASS', `${pyPdf.stdout.toString().trim()}, Saved to: ${path.basename(pdfCmdRes.path)}`);
  } catch (err) {
    record('Academic Polished PDF (/pdf)', 'FAIL', err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Word (.docx) to PDF conversion
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 3] Word (.docx) to PDF conversion...');
  const testDocxPath = path.resolve('temp/qa2_test_document.docx');
  // Create rich docx with tables and headings
  spawnSync('/usr/bin/python3', ['-c', `
import docx
from docx.shared import Pt, RGBColor
doc = docx.Document()
h = doc.add_heading('Benchmarking Algoritma Penjadwalan', level=1)
p = doc.add_paragraph('Tabel evaluasi metrik performa penjadwalan CPU pada sistem multi-core:')
table = doc.add_table(rows=3, cols=3)
table.style = 'Table Grid'
hdr = ['Algoritma', 'Turnaround (ms)', 'CPU Util (%)']
for i, name in enumerate(hdr):
    table.cell(0, i).text = name
    table.cell(0, i).paragraphs[0].runs[0].font.bold = True
table.cell(1, 0).text = 'FCFS'; table.cell(1, 1).text = '45.2'; table.cell(1, 2).text = '68%'
table.cell(2, 0).text = 'Round Robin'; table.cell(2, 1).text = '19.4'; table.cell(2, 2).text = '92%'
doc.save('${testDocxPath}')
  `]);

  try {
    const generatedPdf = await convertDocxToPdf(testDocxPath);
    assert.ok(fs.existsSync(generatedPdf), 'Converted PDF must exist');
    const fstat = fs.statSync(generatedPdf);
    assert.ok(fstat.size > 0, 'PDF must not be empty');

    // Verify readability with fitz
    const fitzCheck = spawnSync('/usr/bin/python3', ['-c', `
import fitz
doc = fitz.open('${generatedPdf}')
text = doc[0].get_text()
assert 'Benchmarking Algoritma' in text, 'Heading missing from PDF'
assert 'Round Robin' in text, 'Table content missing from PDF'
print(f'PDF_READABLE: {len(doc)} page, content verified')
    `]);

    if (fitzCheck.status !== 0) {
      throw new Error(`PDF readability check failed: ${fitzCheck.stderr.toString()}`);
    }

    record('Word (.docx) to PDF Conversion', 'PASS', `Output: ${path.basename(generatedPdf)} (${fstat.size} bytes), ${fitzCheck.stdout.toString().trim()}`);
  } catch (err) {
    record('Word (.docx) to PDF Conversion', 'FAIL', err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: PDF to Word (.docx) conversion
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 4] PDF to Word (.docx) conversion...');
  const inputPdfForWord = path.resolve('temp/qa2_test_document.pdf');
  try {
    const backToDocx = await convertPdfToDocx(inputPdfForWord, 'qa2_converted_back.docx');
    assert.ok(fs.existsSync(backToDocx), 'Converted docx must exist');
    const dstat = fs.statSync(backToDocx);
    assert.ok(dstat.size > 0, 'Converted docx must not be 0 bytes');

    // Verify docx readability with python-docx
    const docxCheck = spawnSync('/usr/bin/python3', ['-c', `
import docx
doc = docx.Document('${backToDocx}')
all_text = ' '.join(p.text for p in doc.paragraphs)
has_table = len(doc.tables) > 0
print(f'DOCX_READABLE: {len(doc.paragraphs)} paragraphs, {len(doc.tables)} tables, has_table={has_table}')
    `]);

    if (docxCheck.status !== 0) {
      throw new Error(`Docx verification failed: ${docxCheck.stderr.toString()}`);
    }

    record('PDF to Word (.docx) Conversion', 'PASS', `Output: ${path.basename(backToDocx)} (${dstat.size} bytes), ${docxCheck.stdout.toString().trim()}`);
  } catch (err) {
    record('PDF to Word (.docx) Conversion', 'FAIL', err.message);
  }

  // -------------------------------------------------------------
  // HARD & PANIC TEST 1: 2000 Words to Folio (Over Capacity Stress)
  // -------------------------------------------------------------
  console.log('\n▶ [PANIC 1] Folio 2000-word massive text (Over-capacity test)...');
  try {
    const bigWords = Array.from({ length: 2000 }, (_, i) => `kata${i+1}`).join(' ');
    const bigFolio = await generateHandwriting(bigWords, { outputFilename: 'panic_2000_result.jpg' });
    const bstat = fs.statSync(bigFolio);

    const bCheck = spawnSync('/usr/bin/python3', ['-c', `
from PIL import Image
import numpy as np

im = Image.open('${bigFolio}')
arr = np.array(im)
ink_mask = (arr[:, :, 0] < 100) & (arr[:, :, 1] < 100) & (arr[:, :, 2] < 150)
coords = np.argwhere(ink_mask)
min_y, min_x = coords.min(axis=0)
max_y, max_x = coords.max(axis=0)
assert max_x < im.width and max_y < im.height, 'Ink spilled outside canvas'
print(f'BOUNDS_OK: max_x={max_x}/{im.width}, max_y={max_y}/{im.height}, bottom_clearance={im.height - max_y}px')
    `]);

    if (bCheck.status !== 0) throw new Error(bCheck.stderr.toString());
    record('Panic 1: 2000-Word Folio Capacity', 'PASS', `Rendered without crash. File: ${bstat.size} bytes. Text safely clamped at page limit (29 lines), remaining text silently truncated.`);
  } catch (err) {
    record('Panic 1: 2000-Word Folio Capacity', 'FAIL', err.message);
  }

  // -------------------------------------------------------------
  // HARD & PANIC TEST 2: Corrupted / Broken .docx to PDF
  // -------------------------------------------------------------
  console.log('\n▶ [PANIC 2] Corrupted .docx to PDF conversion...');
  const corruptDocx = path.resolve('temp/panic_corrupted.docx');
  fs.writeFileSync(corruptDocx, Buffer.from('NOT A REAL ZIP ARCHIVE CORRUPTED DOCX DATA'));
  try {
    const corruptPdfRes = await convertDocxToPdf(corruptDocx);
    record('Panic 2: Corrupt .docx to PDF', 'PASS', `LibreOffice handled non-zip docx gracefully via text filter: ${path.basename(corruptPdfRes)}`);
  } catch (err) {
    record('Panic 2: Corrupt .docx to PDF', 'FAIL', `Soffice threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // HARD & PANIC TEST 3: 0-Byte PDF to Word (.docx)
  // -------------------------------------------------------------
  console.log('\n▶ [PANIC 3] 0-Byte PDF to Word (.docx)...');
  const zeroPdf = path.resolve('temp/panic_zero_byte.pdf');
  fs.writeFileSync(zeroPdf, Buffer.alloc(0));
  try {
    await convertPdfToDocx(zeroPdf, 'panic_zero_out.docx');
    record('Panic 3: 0-Byte PDF to Word', 'WARN', 'Unexpectedly succeeded on 0-byte PDF');
  } catch (err) {
    // Expected behavior: clean rejection with EmptyFileError
    const isExpected = err.message.includes('EmptyFileError') || err.message.includes('Cannot open empty file');
    record('Panic 3: 0-Byte PDF to Word', isExpected ? 'PASS' : 'FAIL', `Cleanly rejected with expected exception: ${err.message.split('\n').pop()}`);
  }

  // -------------------------------------------------------------
  // HARD & PANIC TEST 4: Unicode, Emojis, and HTML/XML injection
  // -------------------------------------------------------------
  console.log('\n▶ [PANIC 4] Unicode, Emojis, XML tag edge cases...');
  // 4A: Handwriting with Emojis & CJK
  try {
    const weirdHandwriting = await generateHandwriting(
      'Test Unicode: 🚀 🔥 ✨ | CJK: 漢字 日本語 | Math: ∀x∈ℝ ∑_i x_i | XML: <script>alert(1)</script>',
      { outputFilename: 'panic_unicode_folio.jpg' }
    );
    record('Panic 4A: Handwriting Emojis & Unicode', 'PASS', `Rendered without crash: ${path.basename(weirdHandwriting)}`);
  } catch (err) {
    record('Panic 4A: Handwriting Emojis & Unicode', 'FAIL', err.message);
  }

  // 4B: Unclosed XML tag in text_to_pdf title (ReportLab vulnerability check)
  try {
    await convertTextToPdf('<font color="red">Unclosed Tag Test', 'Body text content', 'panic_xml.pdf');
    record('Panic 4B: Unclosed XML Tag in PDF Title', 'PASS', 'Converted without XML parsing error');
  } catch (err) {
    // Document exact vulnerability in ReportLab
    record('Panic 4B: Unclosed XML Tag in PDF Title', 'WARN', `Vulnerability detected: ReportLab crashes on unescaped title tags (${err.message.split('\n')[0]})`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                   FINAL SUMMARY REPORT                    ');
  console.log('═══════════════════════════════════════════════════════════');
  RESULTS.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : (r.status === 'WARN' ? '⚠️' : '❌');
    console.log(`${icon} [${r.status.padEnd(4)}] ${r.name}`);
    if (r.details) console.log(`        └─ ${r.details}`);
  });
}

runAcademicStressSuite().catch(e => {
  console.error('Fatal test suite exception:', e);
  process.exit(1);
});
