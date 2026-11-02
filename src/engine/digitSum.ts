/**
 * ฟังก์ชันช่วยที่ใช้ร่วมกันระหว่าง Mode 1 และ Mode 3 (ตามคำแนะนำใน system_requirements_v6.docx
 * หมวด "หมายเหตุทางเทคนิค": ทั้งสองโหมดใช้สูตรบวกเลขฐานเดียวกัน ต่างกันแค่จุดหยุด reduce)
 */

/** ผลรวมของแต่ละหลักใน string ตัวเลข เช่น "059" -> 0+5+9 = 14 */
export function sumDigitsOfString(digits: string): number {
  let sum = 0;
  for (const ch of digits) {
    sum += Number(ch);
  }
  return sum;
}

/**
 * ลำดับค่าระหว่างการบวกเลขซ้ำจนเหลือหลักเดียว (0-9) เช่น 163 -> [163, 10, 1]
 * ใช้แสดงขั้นตอนใน UI (เช่น Ayatana6Page) — digitRoot() derive จากค่าตัวสุดท้ายของ
 * array นี้ตรงๆ เพื่อให้ทั้งสองฟังก์ชันคำนวณด้วย logic เดียวกันเสมอ ไม่มีทางไม่ตรงกัน
 */
export function digitRootSteps(n: number): number[] {
  const steps = [n];
  let value = n;
  while (value > 9) {
    value = sumDigitsOfString(String(value));
    steps.push(value);
  }
  return steps;
}

/** digit root: บวกซ้ำจนเหลือเลขหลักเดียว (0-9) */
export function digitRoot(n: number): number {
  const steps = digitRootSteps(n);
  return steps[steps.length - 1];
}
