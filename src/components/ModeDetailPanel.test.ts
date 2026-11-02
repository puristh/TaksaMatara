import { describe, expect, it } from 'vitest';
import { resolveAyatana6Preview } from './ModeDetailPanel';
import { analyzeAyatana6 } from '../engine/ayatana6';

/**
 * เทสต์ data contract ของส่วนแสดงผลอายตนะ6 แบบ inline ใน ModeDetailPanel.tsx — เปลี่ยนจาก
 * "ลิงก์เชิญชวนพร้อมคำอธิบายทั่วไป" เป็น "โชว์ผลลัพธ์จริงของทะเบียนใบนั้นทันที" ไม่มี jsdom
 * ให้ render+ตรวจ DOM จริงได้ จึงเทสที่ resolveAyatana6Preview() ตรงๆ (ฟังก์ชันที่ ModeDetailPanel
 * ใช้ตัดสินใจว่าจะโชว์อะไร) เทียบกับผลจาก analyzeAyatana6() ที่คำนวณมือไว้ก่อนแล้ว
 */
describe('ModeDetailPanel — resolveAyatana6Preview shows the real analyzeAyatana6() result for that exact plate, not a hardcoded string', () => {
  it('front=8, letters=[ข,ค], tail="2683" -> digitRoot=8, meaning="พลังผู้นำองค์กร..." (rawSum=98 -> 17 -> 8, verified by hand)', () => {
    const input = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683' };
    const preview = resolveAyatana6Preview(input, true);

    expect(preview).not.toBeNull();
    expect(preview?.digitRoot).toBe(8);
    expect(preview?.meaning).toBe('พลังผู้นำองค์กร — มีวาสนาด้านการเงิน เหมาะเป็นเจ้าของกิจการ');
    // must be the literal object analyzeAyatana6() itself computes — not a re-derived copy
    expect(preview).toEqual(analyzeAyatana6(input));
  });

  it('front=1, letters=[ก,ข], tail="59" -> digitRoot=1, meaning="พลังผู้นำ..." (rawSum=163 -> 10 -> 1, verified by hand)', () => {
    const input = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };
    const preview = resolveAyatana6Preview(input, true);

    expect(preview?.digitRoot).toBe(1);
    expect(preview?.meaning).toBe('พลังผู้นำ — ความรับผิดชอบสูง เป็นหลักให้ผู้อื่นได้');
    expect(preview).toEqual(analyzeAyatana6(input));
  });

  it('front=9, letters=[ฮ,ฮ], tail="9999" -> digitRoot=6, meaning="พลังเสน่ห์..." (rawSum=582 -> 15 -> 6, verified by hand)', () => {
    const input = { frontDigit: 9, thaiLetters: ['ฮ', 'ฮ'] as [string, string], tailDigits: '9999' };
    const preview = resolveAyatana6Preview(input, true);

    expect(preview?.digitRoot).toBe(6);
    expect(preview?.meaning).toBe('พลังเสน่ห์ — มีบารมี ดึงดูดผู้คนได้ง่าย');
    expect(preview).toEqual(analyzeAyatana6(input));
  });

  it('different plates yield different results — proves this is a live computation per-plate, not a hardcoded/static string reused everywhere', () => {
    const inputA = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683' };
    const inputB = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };

    const previewA = resolveAyatana6Preview(inputA, true);
    const previewB = resolveAyatana6Preview(inputB, true);

    expect(previewA?.digitRoot).not.toBe(previewB?.digitRoot);
    expect(previewA?.meaning).not.toBe(previewB?.meaning);
  });

  it('ayatana6ModeEnabled=false -> null, regardless of how "good" the plate is — this is exactly what makes the whole inline result + button disappear in the component (FEATURE_FLAGS.ayatana6Mode && onViewAyatana6 && ayatana6Result && ...)', () => {
    const input = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683' };
    expect(resolveAyatana6Preview(input, false)).toBeNull();
  });

  it('ayatana6ModeEnabled=false never throws even for a plate whose star lookup would otherwise be exercised', () => {
    const input = { frontDigit: 9, thaiLetters: ['ฮ', 'ฮ'] as [string, string], tailDigits: '9999' };
    expect(() => resolveAyatana6Preview(input, false)).not.toThrow();
  });
});
