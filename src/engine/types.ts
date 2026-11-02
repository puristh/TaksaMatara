export interface PlateInput {
  /** 0-9 หรือ null = ทะเบียนหมวดเก่าที่ไม่มีเลขหน้า (เช่น "ศร 91") — null ไม่ใช่ 0 ดู plateText.ts */
  frontDigit: number | null;
  thaiLetters: [string, string]; // อักษรไทย 2 ตัว เช่น ['ก','ข']
  tailDigits: string; // 2-4 หลัก เก็บเป็น string เพื่อรักษาเลข 0 นำหน้า เช่น "059"
  province?: string; // optional, สำหรับแสดงผลเท่านั้น ไม่มีผลต่อการคำนวณ
}

export type Mode1Tier = 'excellent' | 'good' | 'bad';

export interface Mode1Result {
  total: number;
  tier: Mode1Tier;
  verdict: boolean; // true = ใช้ได้, false = ไม่ควรใช้
  /** true เมื่อ total อยู่นอกช่วง Consensus table (1-65) และต้อง fallback ไปตาราง tier 10-99 */
  usedFallback: boolean;
}

export type TierKey = 'tier1' | 'tier2' | 'tier2_5' | 'tier3' | 'tier4';

export interface PairDetail {
  pair: string;
  tier: TierKey;
  /** ความหมายเต็มของคู่นี้ จาก PAIR_MEANING_TEXT — มีครบทุกคู่ 10-99 ไม่ใช่แค่ tier2_5 */
  meaning: string;
  /** true เฉพาะคู่ตำแหน่งท้ายสุดของ tailDigits (ตัวเดียวกับ dominantPair) */
  isDominant: boolean;
}

export interface Mode2Result {
  pairsFound: string[];
  pairDetails: PairDetail[];
  /** tier ที่ตัดสินผลลัพธ์สุดท้าย: 'bad' ถ้ามี tier4 ปนอยู่แม้แต่คู่เดียว, ไม่งั้นคือ tier ที่ดีที่สุดที่เจอ */
  tier: TierKey;
  dominantPair: string;
}

export type Mode3Tier = 'good' | 'neutral';

export interface Mode3Result {
  digitRoot: number;
  meaning: DigitRootMeaning;
  tier: Mode3Tier;
}

export interface DigitRootMeaning {
  label: string;
  star: string;
  person: string;
}

export interface Badge {
  type: 'positive' | 'warning' | 'neutral';
  text: string;
}

/**
 * ระบบที่ 1: เลขประมูล — เกณฑ์ทางการ แน่นอน ไม่กำกวม ตรวจแบบ exact whole-tail pattern
 * match เท่านั้น (ไม่ใช่ substring scan) เพื่อลด false positive เช่น "1989" ไม่ควรติด
 * เพราะ "89" เป็นแค่ substring ตรงกลาง ไม่ใช่ pattern ที่ตรงเกณฑ์จริง
 */
export interface AuctionNumberInfo {
  isAuction: boolean;
  categories: string[]; // เช่น ['เลขตอง'], ['เลขคู่เหมือน (XXYY)']
}

/**
 * ระบบที่ 2: เลขสวย — เกณฑ์แบบถ่วงน้ำหนัก (best-effort, ปรับ seed list ได้ในอนาคต)
 * แยกอิสระจากเลขประมูลโดยสิ้นเชิง เลขหนึ่งอาจเป็นทั้งเลขประมูลและเลขสวยพร้อมกัน หรือไม่เป็นทั้งคู่ก็ได้
 */
export interface PopularNumberInfo {
  isPopular: boolean;
  weight: number; // ใช้แสดงผล/filter เท่านั้น ห้ามรวมกับ finalScore ของ ranking engine
  matchedPairs: string[];
}

/**
 * ทักษา 8 วันเกิด — วันพุธแยกกลางวัน/กลางคืนเป็นคนละหน่วยกัน (Mode 6/7)
 */
export type TaksaDay =
  | 'วันอาทิตย์'
  | 'วันจันทร์'
  | 'วันอังคาร'
  | 'วันพุธกลางวัน'
  | 'วันพฤหัสบดี'
  | 'วันศุกร์'
  | 'วันเสาร์'
  | 'วันพุธกลางคืน';

/** 8 บทบาททักษาปกรณ์ */
export type TaksaRole =
  | 'บริวาร'
  | 'อายุ'
  | 'เดช'
  | 'ศรี'
  | 'มูละ'
  | 'อุตสาหะ'
  | 'มนตรี'
  | 'กาลกิณี';

export interface PlateVerdict {
  input: PlateInput;
  mode1: Mode1Result;
  mode2: Mode2Result;
  mode3: Mode3Result;
  auction: AuctionNumberInfo;
  popular: PopularNumberInfo;
  verdict: boolean; // มาจาก mode1.verdict เสมอ
  badges: Badge[];
  /** true เมื่อเลขประมูลชนกับ Mode2 tier4 และควรถูกซ่อนจากรายการหลักตาม default filter */
  hiddenByDefault: boolean;
}
