import notoOflUrl from '../assets/fonts/NotoSansThaiLooped-OFL.txt?url';
import oswaldOflUrl from '../assets/fonts/Oswald-OFL.txt?url';
import norasiCopyingUrl from '../assets/fonts/Norasi-COPYING.txt?url';
import norasiGplUrl from '../assets/fonts/Norasi-GPL-2.txt?url';
import norasiNoticeUrl from '../assets/fonts/NorasiBold-PlateSubset-NOTICE.txt?url';

export interface FontLicenseEntry {
  name: string;
  /** ใช้ที่ไหนในเว็บ */
  usage: string;
  license: string;
  copyright: string;
  source: string;
  /** ไฟล์ใบอนุญาตที่แนบมากับไฟล์ฟอนต์ (เสิร์ฟจากเว็บนี้) */
  files: { label: string; url: string }[];
  /** การแก้ไขที่ทำกับไฟล์ฟอนต์ */
  changes: string;
}

/** ฟอนต์ที่ฝังในเว็บ (ภาพจำลองป้ายทะเบียน) — ไฟล์ใบอนุญาตอยู่คู่ไฟล์ฟอนต์ใน src/assets/fonts/ */
export const FONT_LICENSES: FontLicenseEntry[] = [
  {
    name: 'Noto Sans Thai Looped',
    usage: 'ภาพป้ายทะเบียนชุดเดิม และฟอนต์สำรองเมื่อฟอนต์ชุดใหม่โหลดไม่สำเร็จ',
    license: 'SIL Open Font License 1.1',
    copyright: 'Copyright 2022 The Noto Project Authors',
    source: 'https://github.com/notofonts/thai',
    files: [{ label: 'OFL.txt', url: notoOflUrl }],
    changes: 'ตัดย่อเหลือตัวที่ใช้บนป้าย และตรึงแกน wdth/wght เป็น 2 ไฟล์',
  },
  {
    name: 'Oswald (Medium 500)',
    usage: 'ตัวเลขบนภาพป้ายทะเบียน',
    license: 'SIL Open Font License 1.1 (ไม่มี Reserved Font Name)',
    copyright: 'Copyright 2016 The Oswald Project Authors',
    source: 'https://github.com/googlefonts/OswaldFont',
    files: [{ label: 'OFL.txt', url: oswaldOflUrl }],
    changes: 'ตัดย่อเหลือเลข 0–9 และแปลงเป็น WOFF2',
  },
  {
    name: 'Norasi Bold (TLWG)',
    usage: 'ตัวอักษรไทยและชื่อจังหวัดบนภาพป้ายทะเบียน',
    license: 'GNU General Public License v2 หรือใหม่กว่า พร้อม font exception',
    copyright:
      'Copyright (C) 1999, The National Font Project; Yannis Haralambous, Virach Sornlertlamvanich, Anutara Tantraporn — modified under the GPL by Thai Linux Working Group (TLWG)',
    source: 'https://github.com/tlwg/fonts-tlwg',
    files: [
      { label: 'COPYING (รวม font exception)', url: norasiCopyingUrl },
      { label: 'GPL-2', url: norasiGplUrl },
      { label: 'NOTICE (ที่มาและการแก้ไข)', url: norasiNoticeUrl },
    ],
    changes:
      'ตัดย่อเหลือพยัญชนะ สระ วรรณยุกต์ ์ ๆ ฯ และตัวอักษรของชื่อจังหวัด 77 จังหวัด แล้วแปลงเป็น WOFF2 (ไม่แก้รูปตัวอักษร) — สคริปต์ที่ใช้: tools/plate_fonts.py',
  },
];

export function FontLicensesPage() {
  return (
    <div className="font-licenses-page">
      <div className="eyebrow">Font licenses</div>
      <h1>ใบอนุญาตฟอนต์</h1>
      <p className="font-licenses-intro">
        ฟอนต์ที่ฝังในเว็บนี้ใช้สำหรับภาพจำลองป้ายทะเบียนเท่านั้น ทุกตัวมีใบอนุญาตเปิด
      </p>
      {FONT_LICENSES.map((f) => (
        <section key={f.name} className="card font-license">
          <h2>{f.name}</h2>
          <dl>
            <dt>ใช้กับ</dt>
            <dd>{f.usage}</dd>
            <dt>ใบอนุญาต</dt>
            <dd>{f.license}</dd>
            <dt>ลิขสิทธิ์</dt>
            <dd>{f.copyright}</dd>
            <dt>ต้นฉบับ</dt>
            <dd>
              <a href={f.source} target="_blank" rel="noopener noreferrer">
                {f.source.replace('https://', '')}
              </a>
            </dd>
            <dt>การแก้ไข</dt>
            <dd>{f.changes}</dd>
            <dt>ไฟล์ใบอนุญาต</dt>
            <dd>
              {f.files.map((file, i) => (
                <span key={file.url}>
                  {i > 0 && ' · '}
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    {file.label}
                  </a>
                </span>
              ))}
            </dd>
          </dl>
        </section>
      ))}
    </div>
  );
}
