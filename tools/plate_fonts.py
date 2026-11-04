#!/usr/bin/env python3
"""
ตัดย่อฟอนต์ของภาพจำลองป้ายทะเบียน (PlateImage) และสร้างตาราง metric ที่ plateLayout.ts ใช้

ฟอนต์ชุด "custom" (featureFlags.ts → PLATE_FONT_STYLE):
  - ตัวเลขบรรทัดหลัก: Oswald Medium (500) — OFL 1.1 ไม่มี Reserved Font Name
      ต้นทาง https://github.com/googlefonts/OswaldFont (fonts/ttf/Oswald-Medium.ttf)
      ตัดย่อเหลือ 0–9
  - อักษรไทยบรรทัดหลัก + ชื่อจังหวัด: Norasi Bold — GPL-2+ with font exception
      ต้นทาง https://github.com/tlwg/fonts-tlwg (release ttf-tlwg-<ver>.tar.xz → Norasi-Bold.ttf)
      ตัดย่อเหลือพยัญชนะ สระ วรรณยุกต์ ์ ๆ ฯ และทุกตัวที่ชื่อจังหวัด 77 จังหวัดใช้ (src/data/thaiProvinces.ts)
  การตัดย่อไม่แก้รูปร่าง glyph ใดๆ (ตัด glyph ที่ไม่ใช้ออก + แปลงเป็น woff2 เท่านั้น)
  ตาราง GSUB/GPOS (การวางสระ/วรรณยุกต์) เก็บไว้ทั้งหมด

ตาราง metric วัดจากไฟล์ที่ตัดย่อแล้ว (ไฟล์เดียวกับที่แอปโหลด) ด้วย HarfBuzz — ตัวเดียวกับที่ Chromium ใช้จัดข้อความ
ค่าทั้งหมดเป็นหน่วย em (1 = font-size)

ต้องมี (เครื่องมือสำหรับนักพัฒนาเท่านั้น ไม่ใช่ dependency ของแอป):
  Python 3.10+, pip install fonttools brotli uharfbuzz

ใช้:
  python tools/plate_fonts.py \\
    --oswald   <OswaldFont>/fonts/ttf/Oswald-Medium.ttf  --oswald-ofl <OswaldFont>/OFL.txt \\
    --norasi   <ttf-tlwg-0.7.4>/Norasi-Bold.ttf          --tlwg-src   <fonts-tlwg-0.7.4> \\
    --oswald-ref "googlefonts/OswaldFont@<commit>"       --tlwg-ref   "tlwg/fonts-tlwg v0.7.4"
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
from pathlib import Path

import uharfbuzz as hb
from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / 'src/assets/fonts'
METRICS_TS = ROOT / 'src/components/plateFontMetrics.generated.ts'
PROVINCES_TS = ROOT / 'src/data/thaiProvinces.ts'

OSWALD_OUT = 'Oswald500-PlateDigits.woff2'
NORASI_OUT = 'NorasiBold-PlateSubset.woff2'

DIGITS = '0123456789'
CONSONANTS = ''.join(chr(c) for c in range(0x0E01, 0x0E2F))  # ก–ฮ (รวม ฤ ฦ)
VOWELS = ''.join(chr(c) for c in [*range(0x0E30, 0x0E3B), *range(0x0E40, 0x0E46)])  # ะ–ฺ, เ–ๅ
TONES = '่้๊๋'
OTHER_MARKS = '็์ํ'  # ็ ์ ํ
EXTRA = 'ๆฯ '  # ๆ ฯ และช่องว่าง (ชื่อจังหวัดที่ผู้ใช้พิมพ์เองอาจมี)
UPPER_VOWELS = 'ัิีึื'
UPPER_MARKS = UPPER_VOWELS + TONES + OTHER_MARKS
LOWER_MARKS = 'ฺุู'
TALL = 'ปฝฟฬ'
LEADING = 'โใไ'


def provinces() -> list[str]:
    names = re.findall(r"'([฀-๿]+)'", PROVINCES_TS.read_text(encoding='utf-8'))
    assert len(names) == 77, f'expected 77 provinces, got {len(names)}'
    return names


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def make_subset(src: Path, text: str, out: Path) -> bytes:
    """ตัดย่อ → เขียน woff2 และคืนค่า TTF (ไม่บีบอัด) ของ subset เดียวกันไว้วัด metric"""
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.drop_tables += ['FFTM', 'DSIG']
    font = TTFont(src)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    buf = io.BytesIO()
    font.flavor = None
    font.save(buf)
    font.flavor = 'woff2'
    font.save(out)
    missing = [c for c in set(text) if ord(c) not in TTFont(out).getBestCmap()]
    assert not missing, f'{out.name} missing {missing}'
    return buf.getvalue()


class Shaper:
    def __init__(self, ttf: bytes):
        self.font = TTFont(io.BytesIO(ttf))
        self.upm = self.font['head'].unitsPerEm
        self.hb = hb.Font(hb.Face(hb.Blob(ttf)))
        gs = self.font.getGlyphSet()
        order = self.font.getGlyphOrder()
        self.bounds = []
        for name in order:
            bp = BoundsPen(gs)
            gs[name].draw(bp)
            self.bounds.append(bp.bounds)

    def shape(self, text: str):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb, buf, {})
        glyphs, x = [], 0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            glyphs.append((info.codepoint, x + pos.x_offset, pos.y_offset))
            x += pos.x_advance
        return glyphs, x

    def ink(self, text: str):
        """[advance, inkLeft, inkRight, yMin, yMax] (em) ของข้อความที่จัดแล้ว"""
        glyphs, adv = self.shape(text)
        xs0, xs1, ys0, ys1 = [], [], [], []
        for gid, gx, gy in glyphs:
            b = self.bounds[gid]
            if b is None:
                continue
            xs0.append(gx + b[0]); xs1.append(gx + b[2]); ys0.append(gy + b[1]); ys1.append(gy + b[3])
        u = self.upm
        if not xs0:
            return [adv / u, 0, 0, 0, 0]
        return [adv / u, min(xs0) / u, max(xs1) / u, min(ys0) / u, max(ys1) / u]

    def metric(self, ch: str):
        """[advance, left bearing, right bearing, yMin, yMax] (em) แบบเดียวกับตาราง Noto เดิม"""
        adv, x0, x1, y0, y1 = self.ink(ch)
        return [r4(adv), r4(x0), r4(adv - x1), r4(y0), r4(y1)]


def r4(v: float) -> float:
    return round(v + 0.0, 4)


def ts_obj(d: dict, per_line: int = 1) -> str:
    items = [f'{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in d.items()]
    lines = [', '.join(items[i:i + per_line]) for i in range(0, len(items), per_line)]
    return '{\n' + ''.join(f'  {l},\n' for l in lines) + '}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--oswald', required=True, type=Path)
    ap.add_argument('--oswald-ofl', required=True, type=Path)
    ap.add_argument('--oswald-ref', required=True)
    ap.add_argument('--norasi', required=True, type=Path)
    ap.add_argument('--tlwg-src', required=True, type=Path, help='โฟลเดอร์ซอร์ส fonts-tlwg (มี COPYING และ GPL)')
    ap.add_argument('--tlwg-ref', required=True)
    a = ap.parse_args()

    provs = provinces()
    norasi_text = ''.join(sorted(set(CONSONANTS + VOWELS + TONES + OTHER_MARKS + EXTRA + ''.join(provs))))
    osw = Shaper(make_subset(a.oswald, DIGITS, FONT_DIR / OSWALD_OUT))
    nor = Shaper(make_subset(a.norasi, norasi_text, FONT_DIR / NORASI_OUT))

    # ใบอนุญาตคู่ไฟล์ฟอนต์
    shutil.copyfile(a.oswald_ofl, FONT_DIR / 'Oswald-OFL.txt')
    shutil.copyfile(a.tlwg_src / 'COPYING', FONT_DIR / 'Norasi-COPYING.txt')
    shutil.copyfile(a.tlwg_src / 'GPL', FONT_DIR / 'Norasi-GPL-2.txt')
    version = TTFont(a.norasi)['name'].getDebugName(5)
    (FONT_DIR / 'NorasiBold-PlateSubset-NOTICE.txt').write_text(
        f'''NorasiBold-PlateSubset.woff2 — modified version of Norasi Bold

Source:   {a.tlwg_ref} (https://github.com/tlwg/fonts-tlwg), file Norasi-Bold.ttf
          font version: {version}
          sha256 of the original file: {sha256(a.norasi)}
License:  GNU General Public License version 2 or later, with the font exception
          (see Norasi-COPYING.txt for copyright and the exception, Norasi-GPL-2.txt for the GPL text)
Changes:  subset to Thai consonants, vowels, tone marks, ็ ์ ํ ๆ ฯ, space and every character used by
          the 77 Thai province names; converted to WOFF2. No glyph outline was changed.
          GSUB/GPOS tables kept. Produced by tools/plate_fonts.py in this repository
          (the corresponding source is the upstream source above plus that script).
Exception: the font exception of the original is extended to this modified version:
          if you create a document which uses this font, and embed this font or unaltered portions
          of this font into the document, this font does not by itself cause the resulting document
          to be covered by the GNU General Public License.
''',
        encoding='utf-8',
    )

    # ---- ตัวเลข Oswald ----
    digit = {d: osw.metric(d) for d in DIGITS}
    pair_gap = {}
    for p in DIGITS:
        for q in DIGITS:
            glyphs, _ = osw.shape(p + q)
            (g1, x1, _), (g2, x2, _) = glyphs
            right = x1 + osw.bounds[g1][2]
            left = x2 + osw.bounds[g2][0]
            pair_gap[p + q] = r4((left - right) / osw.upm)
    flat = [digit[d][4] for d in '147']

    # ---- อักษรไทยบรรทัดหลัก Norasi ----
    letters = {c: nor.metric(c) for c in CONSONANTS}

    # ---- ชื่อจังหวัด Norasi ----
    spacing = [c for c in norasi_text if c not in UPPER_MARKS + LOWER_MARKS]
    prov_adv = {c: r4(nor.ink(c)[0]) for c in spacing}
    normal = [c for c in CONSONANTS if c not in TALL]
    upper = max(nor.ink(c + m)[4] for c in normal for m in UPPER_MARKS)
    stacked = max(
        [nor.ink(c + v + t)[4] for c in CONSONANTS for v in UPPER_VOWELS for t in TONES + '์']
        + [nor.ink(c + m)[4] for c in TALL for m in UPPER_MARKS]
    )
    # สระล่างใต้พยัญชนะไม่มีหาง + หางพยัญชนะเอง (แบบเดียวกับค่า Noto เดิม) — พยัญชนะมีหาง + สระล่าง (เช่น ฎุ)
    # ลึกกว่านี้มากแต่ไม่มีในชื่อจังหวัดใดเลย จึงไม่นับ (เทสต์ตรวจกับชื่อจังหวัดทั้ง 77 ชื่อที่จัดจริง)
    tailed = [c for c in CONSONANTS if nor.ink(c)[3] < -0.05]
    lower = max(-nor.ink(c + m)[3] for c in CONSONANTS if c not in tailed for m in LOWER_MARKS)
    consonant_desc = max(-nor.ink(c)[3] for c in CONSONANTS)
    print('tailed consonants', ''.join(tailed), 'tailed + lower mark (excluded)', r4(max(-nor.ink(c + m)[3] for c in tailed for m in LOWER_MARKS)))
    vertical = {
        'consonantEm': r4(nor.ink('ก')[4]),
        'lowerMarkEm': r4(max(lower, consonant_desc)),
        'upperMarkEm': r4(upper),
        'stackedMarkEm': r4(stacked),
        'leadingVowelEm': r4(max(nor.ink(c)[4] for c in LEADING)),
        'tallConsonantEm': r4(max(nor.ink(c)[4] for c in TALL)),
        # ำ มีนิคหิตอยู่บน (วรรณยุกต์ + ำ เช่น น้ำ ใช้ stackedMarkEm)
        'saraAmEm': r4(max(nor.ink(c + '\u0E33')[4] for c in CONSONANTS)),
        # พยัญชนะที่หัวสูงกว่า ก เล็กน้อย (ช ซ ศ ส ฮ) — ไม่รวมอักษรหัวสูง ป ฝ ฟ ฬ
        'consonantTopEm': r4(max(nor.ink(c)[4] for c in normal)),
    }
    shaped = {}
    for p in provs:
        adv, x0, x1, y0, y1 = nor.ink(p)
        shaped[p] = [r4(adv), r4(x1 - x0), r4(y1), r4(-y0)]

    out = f'''/* eslint-disable */
// สร้างโดย tools/plate_fonts.py — ห้ามแก้ด้วยมือ (รันสคริปต์ใหม่เมื่อเปลี่ยนไฟล์ฟอนต์)
// วัดจากไฟล์ที่ตัดย่อแล้ว (src/assets/fonts/{OSWALD_OUT}, {NORASI_OUT}) ด้วย HarfBuzz · หน่วย em
// GlyphMetric = [advance, left bearing, right bearing, yMin, yMax]

export const CUSTOM_FONT_SOURCES = {json.dumps({
        'oswald': {'ref': a.oswald_ref, 'file': a.oswald.name, 'sha256': sha256(a.oswald)},
        'norasi': {'ref': a.tlwg_ref, 'file': a.norasi.name, 'version': version, 'sha256': sha256(a.norasi)},
    }, ensure_ascii=False, indent=2)} as const;

/** Oswald 500: metric ของเลข 0–9 */
export const OSWALD_DIGIT_METRICS: Record<string, readonly [number, number, number, number, number]> = {ts_obj(digit)};

/** Oswald 500: ช่องว่างหมึกตามธรรมชาติของเลขสองตัวที่อยู่ติดกัน (รวม kerning ของฟอนต์) — คีย์ = "ซ้ายขวา" */
export const OSWALD_DIGIT_PAIR_GAP_EM: Record<string, number> = {ts_obj(pair_gap, 10)};

/** Oswald 500: ยอดหมึกของเลขหัวแบน (1 4 7) — ใช้เทียบความสูงพยัญชนะ */
export const OSWALD_DIGIT_FLAT_EM = {r4(max(flat))};

/** Norasi Bold: metric ของพยัญชนะ ก–ฮ (ก่อนบีบแนวนอน) */
export const NORASI_LETTER_METRICS: Record<string, readonly [number, number, number, number, number]> = {ts_obj(letters)};

/** Norasi Bold: advance ของตัวที่กินที่ (ไม่รวมสระบน/ล่าง วรรณยุกต์) — ใช้คำนวณความกว้างชื่อจังหวัด */
export const NORASI_PROVINCE_ADVANCE_EM: Record<string, number> = {ts_obj(prov_adv, 8)};

/**
 * Norasi Bold: ความสูง/ลึกของหมึกบรรทัดจังหวัด (หลังจัดวางด้วย GPOS)
 * - lowerMarkEm: ลึกสุดของพยัญชนะทุกตัว + สระล่างทุกตัว (รวมหางพยัญชนะ)
 * - upperMarkEm: สูงสุดของพยัญชนะทั่วไป + สระบน/วรรณยุกต์ 1 ชั้น
 * - stackedMarkEm: สูงสุดของ สระบน + วรรณยุกต์ซ้อน หรือเครื่องหมายบนอักษรหัวสูง (ป ฝ ฟ ฬ)
 * - saraAmEm: สูงสุดของ พยัญชนะ + ำ (นิคหิตบน) · consonantTopEm: ยอดพยัญชนะทั่วไปที่สูงสุด (ช ซ ศ ส ฮ)
 */
export const NORASI_PROVINCE_VERTICAL = {json.dumps(vertical, indent=2)} as const;

/** ชื่อจังหวัด 77 จังหวัดที่จัดด้วย HarfBuzz: [advance, ความกว้างหมึก, ยอดหมึก, ความลึกหมึก] — ใช้ในเทสต์ */
export const NORASI_PROVINCES_SHAPED: Record<string, readonly [number, number, number, number]> = {ts_obj(shaped)};
'''
    METRICS_TS.write_text(out, encoding='utf-8')
    print('wrote', METRICS_TS.relative_to(ROOT))
    for f in [OSWALD_OUT, NORASI_OUT]:
        print(f, (FONT_DIR / f).stat().st_size, 'bytes')
    mean_gap = sum(pair_gap.values()) / len(pair_gap)
    print('digit natural gap mean', round(mean_gap, 4), 'min', min(pair_gap.values()), 'max', max(pair_gap.values()))
    print('vertical', vertical, 'consonant descender', consonant_desc, 'lower marks only', lower)


if __name__ == '__main__':
    main()
