/**
 * เลขที่ชอบ — ผู้ใช้ระบุได้สูงสุด 4 ตัว เรียงลำดับความชอบ (ตัวแรก = ชอบมากที่สุด) ใช้ดันเลขท้าย
 * ที่มีเลขโปรดปนอยู่ขึ้นไปอยู่บนสุดของผลลัพธ์ Batch ranking — เป็นแค่ "จัดลำดับใหม่ภายในกลุ่ม
 * ที่ผ่านเกณฑ์ความหมายดีอยู่แล้ว" ไม่ยกเว้นเลขเสีย (ดู generateTopCandidates ใน ranking.ts
 * ที่กรอง mode1=bad ออกจาก pool ก่อนเสมอ ไม่ว่าจะมีเลขโปรดหรือไม่)
 */

/** น้ำหนักตามลำดับตำแหน่ง 1-4 (ดัชนี 0-3) — ยิ่งอยู่ตำแหน่งแรกยิ่งได้น้ำหนักเยอะ */
const WEIGHTS = [4, 3, 2, 1];

/**
 * นับทุกครั้งที่ตัวเลขโปรดปรากฏซ้ำในเลขท้าย (ไม่ใช่แค่นับว่ามี/ไม่มี) คูณด้วยน้ำหนักตาม
 * ตำแหน่งความชอบ — favoriteDigits ที่ยาวเกิน 4 ตัวจะถูกตัดเหลือแค่ 4 ตัวแรก (กันดัชนีเกิน
 * ขอบเขต WEIGHTS แม้ในทางปฏิบัติ UI จะส่งมาแค่ 4 ตัวเสมอก็ตาม)
 */
export function calculateFavoriteMatchScore(
  tailDigits: string,
  favoriteDigits: (string | null)[],
): number {
  const favs = favoriteDigits.slice(0, WEIGHTS.length);
  let score = 0;
  for (const digit of tailDigits) {
    favs.forEach((fav, index) => {
      if (fav !== null && fav === digit) {
        score += WEIGHTS[index];
      }
    });
  }
  return score;
}

/**
 * รายการเลขโปรดที่ปรากฏจริงในเลขท้าย (unique, เรียงตามลำดับความชอบ) — ใช้แสดง badge
 * "♥ เลขโปรด: 8, 5" ใน UI
 */
export function getMatchedFavoriteDigits(
  tailDigits: string,
  favoriteDigits: (string | null)[],
): string[] {
  const digitSet = new Set(tailDigits.split(''));
  const matched: string[] = [];
  for (const fav of favoriteDigits.slice(0, WEIGHTS.length)) {
    if (fav !== null && digitSet.has(fav) && !matched.includes(fav)) {
      matched.push(fav);
    }
  }
  return matched;
}

/** true ถ้ามีเลขโปรดระบุไว้อย่างน้อย 1 ตัว — ใช้ตัดสินว่าจะเปิด favorite-sort เป็น primary key หรือไม่ */
export function hasAnyFavoriteDigit(favoriteDigits: (string | null)[] | undefined): boolean {
  return !!favoriteDigits && favoriteDigits.some((f) => f !== null);
}
