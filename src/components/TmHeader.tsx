import { useId } from 'react';

/**
 * หัวเว็บ theme "The Living Wisdom" (เฟส 1): สัญลักษณ์ Taksa Matara + คำ "Taksa Matara" (Cormorant Garamond)
 * สัญลักษณ์ = Seed of Life ตามข้อกำหนด theme: วงกลม 7 วง r = 13 ในกล่อง 100 หน่วย, วงแหวน r = 46,
 * วงแหวนจุดประ r = 40, จุดทองเล็ก 8 จุดบนวงแหวนนอก และจุดทองตรงกลาง · เส้นใช้ไล่สีทอง
 * เป็นเครื่องหมายของเราเอง (ไม่ใช่โลโก้ InfinQura — เฟสนี้ไม่ใส่โลโก้ InfinQura)
 * class ขึ้นต้นด้วย tm- ทั้งหมด (ไม่ทับ class เดิม)
 */

const R = 13;
/** ศูนย์กลางวงรอบ 6 วง: ห่างจากกลาง r เท่ากัน ทุก 60° */
const PETALS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return [50 + R * Math.cos(a), 50 + R * Math.sin(a)] as const;
});
/** จุดทองเล็ก 8 จุดบนวงแหวนนอก (r = 46) */
const RING_DOTS = Array.from({ length: 8 }, (_, i) => {
  const a = (Math.PI / 4) * i - Math.PI / 2;
  return [50 + 46 * Math.cos(a), 50 + 46 * Math.sin(a)] as const;
});

const r2 = (n: number) => Math.round(n * 100) / 100;

export function TmSymbol({ size = 34 }: { size?: number }) {
  const gid = `tm-gold-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className="tm-symbol" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a87935" />
          <stop offset="0.5" stopColor="#f8d99a" />
          <stop offset="1" stopColor="#a87935" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gid})`} strokeWidth="1.6">
        <circle cx="50" cy="50" r="46" />
        <circle cx="50" cy="50" r="40" strokeDasharray="1.2 3" strokeLinecap="round" />
        <circle cx="50" cy="50" r={R} />
        {PETALS.map(([x, y], i) => (
          <circle key={i} cx={r2(x)} cy={r2(y)} r={R} />
        ))}
      </g>
      <g fill={`url(#${gid})`}>
        {RING_DOTS.map(([x, y], i) => (
          <circle key={i} cx={r2(x)} cy={r2(y)} r="2.2" />
        ))}
        <circle cx="50" cy="50" r="2.6" />
      </g>
    </svg>
  );
}

export function TmHeader() {
  return (
    <div className="tm-header">
      <TmSymbol />
      <span className="tm-brand">
        <span className="tm-brand__taksa">Taksa</span> <span className="tm-brand__matara">Matara</span>
      </span>
    </div>
  );
}
