import { FONT_SCALE_LEVELS, useFontScale } from '../hooks/useFontScale';

/**
 * ปุ่มปรับขนาดตัวอักษรทั้งเว็บ — fixed position ลอยอิสระ (ไม่ผูกกับ .nav-bar) เพื่อให้
 * แสดงทุกหน้ารวมหน้า landing ด้วย เพราะเป็น accessibility control ที่ควรเข้าถึงได้จากทุกจุด
 */
export function FontScaleControl() {
  const [fontScale, setFontScale] = useFontScale();
  const index = FONT_SCALE_LEVELS.findIndex((level) => level.key === fontScale);
  const current = FONT_SCALE_LEVELS[index];
  const canDecrease = index > 0;
  const canIncrease = index < FONT_SCALE_LEVELS.length - 1;

  return (
    <div className="font-scale-control" role="group" aria-label="ปรับขนาดตัวอักษรทั้งเว็บ">
      <span className="font-scale-icon" aria-hidden="true">
        Aa
      </span>
      <button
        type="button"
        className="font-scale-btn"
        disabled={!canDecrease}
        onClick={() => canDecrease && setFontScale(FONT_SCALE_LEVELS[index - 1].key)}
        aria-label={`ลดขนาดตัวอักษร (ปัจจุบัน ${current.label} ${current.percent}%)`}
      >
        −
      </button>
      <span className="font-scale-percent">{current.percent}%</span>
      <button
        type="button"
        className="font-scale-btn"
        disabled={!canIncrease}
        onClick={() => canIncrease && setFontScale(FONT_SCALE_LEVELS[index + 1].key)}
        aria-label={`เพิ่มขนาดตัวอักษร (ปัจจุบัน ${current.label} ${current.percent}%)`}
      >
        +
      </button>
    </div>
  );
}
