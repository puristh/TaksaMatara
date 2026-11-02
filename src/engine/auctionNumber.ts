import type { AuctionNumberInfo } from './types';

function allDigitsSame(digits: string): boolean {
  return digits.split('').every((d) => d === digits[0]);
}

/** เรียงขึ้นต่อเนื่องเท่านั้น (ไม่รวมเรียงลง) เช่น 123, 6789 */
function isAscendingRun(digits: string): boolean {
  for (let i = 1; i < digits.length; i++) {
    if (Number(digits[i]) !== Number(digits[i - 1]) + 1) return false;
  }
  return true;
}

/**
 * ระบบที่ 1: เลขประมูล — ตรวจแบบ exact whole-tail pattern match เท่านั้น (ไม่ใช่ substring
 * scan แบบระบบเดิม) เพื่อไม่ให้ "1989" ติดเพราะมี "89" แทรกอยู่ตรงกลาง — เกณฑ์นี้ตายตัว
 * ไม่กำกวม แยกจาก detectPopularNumber (เลขสวย) โดยสิ้นเชิง
 */
export function detectAuctionNumber(tailDigits: string): AuctionNumberInfo {
  const categories: string[] = [];
  const d = tailDigits;

  if (d.length === 2) {
    if (allDigitsSame(d)) categories.push('เลขคู่/เลขเบิ้ล');
  } else if (d.length === 3) {
    if (allDigitsSame(d)) categories.push('เลขตอง');
    if (isAscendingRun(d)) categories.push('เลขเรียง');
  } else if (d.length === 4) {
    if (allDigitsSame(d)) categories.push('เลข4ตัวเหมือน');
    if (/^[1-9]000$/.test(d)) categories.push('เลขหลักพัน');
    if (isAscendingRun(d)) categories.push('เลขเรียง');
    if (d[0] === d[1] && d[2] === d[3] && d[0] !== d[2]) categories.push('เลขคู่เหมือน (XXYY)');
    if (d[0] === d[2] && d[1] === d[3] && d[0] !== d[1]) categories.push('เลขสลับ (XYXY)');
    if (d[0] === d[3] && d[1] === d[2] && d[0] !== d[1]) categories.push('เลขหาม/เลขหาบ (XYYX)');
  }

  return { isAuction: categories.length > 0, categories };
}
