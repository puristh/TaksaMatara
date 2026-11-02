/**
 * ยูทิลิตี้ทั่วไปเรื่องวันที่/ปี พ.ศ. — ไม่ผูกกับทักษาโดยตรง (แยกไฟล์จาก taksaKalakini.ts
 * เพื่อให้ reuse ได้ทั่วไปในอนาคตถ้ามี Mode อื่นที่ต้องใช้วันเกิดเจ้าของอีก)
 */

/** ตรงกับ JS Date.getDay(): 0=อาทิตย์ 1=จันทร์ 2=อังคาร 3=พุธ 4=พฤหัสบดี 5=ศุกร์ 6=เสาร์ */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** พ.ศ. -> ค.ศ. (พ.ศ. - 543 = ค.ศ.) */
export function buddhistYearToChristian(yearBE: number): number {
  return yearBE - 543;
}

/**
 * เช็คว่า day/month/yearBE ประกอบกันเป็นวันที่จริงบนปฏิทินหรือไม่ (กัน JS Date rollover
 * แบบเงียบๆ เช่น 30 กุมภาพันธ์ จะเลื่อนไปเป็น 1-2 มีนาคมโดยไม่ error ถ้าไม่เช็คตรงนี้ก่อน)
 */
export function isValidCalendarDate(day: number, month: number, yearBE: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(yearBE)) {
    return false;
  }
  const yearCE = buddhistYearToChristian(yearBE);
  const date = new Date(yearCE, month - 1, day);
  return (
    date.getFullYear() === yearCE && date.getMonth() === month - 1 && date.getDate() === day
  );
}

/**
 * วันในสัปดาห์จากวัน/เดือน (1-12)/ปี พ.ศ. — ใช้ JS Date คำนวณตรงๆ หลังแปลง พ.ศ.->ค.ศ. แล้ว
 * เรียก isValidCalendarDate() ก่อนเสมอถ้าต้องการความมั่นใจว่า day/month/yearBE ถูกต้องจริง
 * (ฟังก์ชันนี้ไม่เช็คเอง เพื่อให้ยังคำนวณได้แม้ input จะ rollover ก็ตาม — แยก concern กัน)
 */
export function getDayOfWeekFromDate(day: number, month: number, yearBE: number): WeekDay {
  const yearCE = buddhistYearToChristian(yearBE);
  const date = new Date(yearCE, month - 1, day);
  return date.getDay() as WeekDay;
}
