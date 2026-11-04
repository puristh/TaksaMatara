import { useCallback, useEffect, useState } from 'react';
import { analyzePlate } from './engine';
import type { PlateInput, PlateVerdict } from './engine';
import { useTheme } from './hooks/useTheme';
import { ThemeToggle } from './components/ThemeToggle';
import { FontScaleControl } from './components/FontScaleControl';
import { PlateForm } from './components/PlateForm';
import { ResultCard } from './components/ResultCard';
import { RankingPanel } from './components/RankingPanel';
import type { BatchReturnState, ReturnContext } from './components/RankingPanel';
import { LandingPage } from './components/LandingPage';
import { FiveElementPage } from './components/FiveElementPage';
import { Ayatana6Page } from './components/Ayatana6Page';
import { BirthdayCompatPage } from './components/BirthdayCompatPage';
import { ComparePage } from './components/ComparePage';
import { FontLicensesPage } from './components/FontLicensesPage';
import { FEATURE_FLAGS } from './config/featureFlags';

type View =
  | 'landing'
  | 'single'
  | 'batch'
  | 'five-element'
  | 'ayatana6'
  | 'birthday-compat'
  | 'compare'
  | 'font-licenses';

type DetailModeInput = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>;

/**
 * ค่าเริ่มต้นของ returnContext — ใช้ทุกครั้งที่ไม่มี context มากับลิงก์ (เช่นมาจาก ResultCard.tsx
 * ในหน้า "วิเคราะห์เลขเดี่ยว" ที่เรียก onViewFiveElement/onViewAyatana6 ด้วย 1 argument เดิม,
 * หรือเข้าหน้าธาตุจีน/อายตนะ6/เช็ควันเกิดตรงๆ โดยไม่ผ่านลิงก์เลย) — export ไว้เทสได้ตรงๆ ว่า
 * fallback เป็น 'single' เสมอ ไม่ error แม้ไม่มี context จริง
 */
export const DEFAULT_RETURN_CONTEXT: ReturnContext = { returnTo: 'single' };

/** ข้อความปุ่ม "กลับ" ของหน้าธาตุจีน/อายตนะ6/เช็ควันเกิด เปลี่ยนตาม returnContext ปัจจุบัน */
export const BACK_LABEL: Record<ReturnContext['returnTo'], string> = {
  single: '← กลับไปวิเคราะห์เลขเดี่ยว',
  batch: '← กลับไปหน้า Batch ranking',
};

/** true ถ้าอย่างน้อยหนึ่งใน Mode 6/7 เปิดอยู่ — แท็บ/หน้านี้ยังมีประโยชน์แม้เปิดแค่โหมดเดียว
 * (แยกเป็น pure function เพื่อเทสได้ว่าปิดทั้งสอง flag แล้วทุกทางเข้า Tab 3 หายไปจริง) */
export function isBirthdayCompatEnabled(
  flags: Pick<typeof FEATURE_FLAGS, 'taksaKalakiniMode' | 'shadowPowerMode'>,
): boolean {
  return flags.taksaKalakiniMode || flags.shadowPowerMode;
}

const BIRTHDAY_COMPAT_ENABLED = isBirthdayCompatEnabled(FEATURE_FLAGS);

const VALID_VIEWS: View[] = [
  'landing',
  'single',
  'batch',
  'five-element',
  'ayatana6',
  'birthday-compat',
  'compare',
  'font-licenses',
];

function isView(value: string): value is View {
  return (VALID_VIEWS as string[]).includes(value);
}

/**
 * ชั้นที่ 2 ของการแก้ปัญหาปุ่ม back ของเบราว์เซอร์หลุดออกจากแอป: อ่าน view จาก
 * location.hash (เช่น "#five-element") แทนที่จะ default เป็น 'landing' เสมอ — ทำให้
 * navigate() ด้านล่างสามารถ push hash ใหม่เข้า browser history ได้จริง และปุ่ม back/forward
 * ไล่ดูประวัติ view ในแอปทีละสเต็ปแทนที่จะกระโดดออกจากแอปไปเลย (ไม่กระทบ URL path จริง
 * จึงไม่มีความเสี่ยงเรื่อง 404 ตอน reload บน static hosting ที่ไม่มี SPA fallback)
 */
function viewFromHash(hash: string): View {
  const key = hash.replace(/^#\/?/, '');
  return isView(key) ? key : 'landing';
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [view, setView] = useState<View>(() =>
    typeof window === 'undefined' ? 'landing' : viewFromHash(window.location.hash),
  );
  const [plates, setPlates] = useState<PlateInput[]>([]);
  const [showAllAuction, setShowAllAuction] = useState(false);
  const [fiveElementInput, setFiveElementInput] = useState<DetailModeInput | null>(null);
  const [ayatana6Input, setAyatana6Input] = useState<DetailModeInput | null>(null);
  const [birthdayCompatInput, setBirthdayCompatInput] = useState<DetailModeInput | null>(null);
  // prefill เฉพาะ slot แรก (ทะเบียน A) ของหน้าเปรียบเทียบทะเบียน — ตั้งค่าเฉพาะตอนกดลิงก์
  // "เปรียบเทียบกับทะเบียนอื่น →" จากหน้าวิเคราะห์เลขเดี่ยว (ResultCard.tsx) เท่านั้น ทุกทางเข้า
  // แท็บ "เปรียบเทียบทะเบียน" แบบอื่น (nav-bar ปกติ) ต้องเคลียร์ค่านี้ทิ้งก่อนเสมอ (ดู
  // handleNavigateTab) ไม่งั้นทะเบียนเก่าจะโผล่มาอีกทั้งที่ผู้ใช้แค่กดแท็บปกติ
  const [compareInitialInput, setCompareInitialInput] = useState<DetailModeInput | null>(null);
  // ต้นทางของลิงก์ที่พาเข้าหน้าธาตุจีน/อายตนะ6/เช็ควันเกิดล่าสุด — ปุ่ม "กลับ" ของหน้าเหล่านั้น
  // อ่านค่านี้เพื่อตัดสินใจว่าจะกลับไปหน้าเดี่ยวหรือ Batch ranking (พร้อม restore ฟอร์ม)
  const [returnContext, setReturnContext] = useState<ReturnContext>(DEFAULT_RETURN_CONTEXT);
  // ฟอร์ม Batch ranking ที่ต้อง restore ตอนกลับมา — มีค่าเฉพาะตอนกลับจากหน้าธาตุจีน/อายตนะ6/
  // เช็ควันเกิดที่มาจาก Batch ranking เดิมเท่านั้น ทุกทางเข้า batch อื่น (nav-bar, landing) ต้อง
  // เคลียร์ค่านี้ทิ้งก่อนเสมอ ไม่งั้นฟอร์มเก่าจะโผล่มาอีกทั้งที่ผู้ใช้แค่กดแท็บปกติ
  const [batchRestoreState, setBatchRestoreState] = useState<BatchReturnState | null>(null);

  // sync กลับมาที่ setView เมื่อผู้ใช้กดปุ่ม back/forward ของเบราว์เซอร์จริง (ไม่เรียก
  // navigate() ในนี้ เพราะ browser push/pop history entry ให้เองแล้ว เรียกซ้ำจะยิ่งพัง)
  useEffect(() => {
    const onPopState = () => setView(viewFromHash(window.location.hash));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: View) => {
    setView(next);
    if (typeof window !== 'undefined' && viewFromHash(window.location.hash) !== next) {
      window.history.pushState({ view: next }, '', `#${next}`);
    }
  }, []);

  const handleSubmit = (input: PlateInput) => {
    setPlates((prev) => [input, ...prev]);
  };

  const handleViewFiveElement = (input: DetailModeInput, ctx?: ReturnContext) => {
    setFiveElementInput(input);
    setReturnContext(ctx ?? DEFAULT_RETURN_CONTEXT);
    navigate('five-element');
  };

  const handleViewAyatana6 = (input: DetailModeInput, ctx?: ReturnContext) => {
    setAyatana6Input(input);
    setReturnContext(ctx ?? DEFAULT_RETURN_CONTEXT);
    navigate('ayatana6');
  };

  const handleViewBirthdayCompat = (input: DetailModeInput, ctx?: ReturnContext) => {
    setBirthdayCompatInput(input);
    setReturnContext(ctx ?? DEFAULT_RETURN_CONTEXT);
    navigate('birthday-compat');
  };

  // "เปรียบเทียบทะเบียน" เป็นแท็บหลักอยู่แล้ว (ไม่ใช่หน้ารายละเอียดที่ต้องมีปุ่ม "กลับ" แบบ
  // ธาตุจีน/อายตนะ6/เช็ควันเกิด) จึงไม่ต้องใช้ returnContext เลย แค่พก plate ปัจจุบันไปเป็น
  // prefill ของ slot แรกเท่านั้น
  const handleViewCompare = (input: DetailModeInput) => {
    setCompareInitialInput(input);
    navigate('compare');
  };

  // ปุ่ม "กลับ" ของหน้าธาตุจีน/อายตนะ6/เช็ควันเกิด — ปลายทางขึ้นกับ returnContext ที่บันทึกไว้
  // ตอนเข้ามาหน้านั้น ถ้ามาจาก Batch ranking ต้อง restore ฟอร์มทั้งหมดกลับไปด้วย
  const handleBackFromDetail = useCallback(() => {
    if (returnContext.returnTo === 'batch') {
      setBatchRestoreState(returnContext.batchState);
      navigate('batch');
    } else {
      navigate('single');
    }
  }, [returnContext, navigate]);

  // จุดเข้า Batch ranking แบบ "ปกติ" ทั้งหมด (nav-bar, landing) ต้องเคลียร์ทั้ง restore state
  // และ returnContext ทิ้งก่อนเสมอ ต่างจาก handleBackFromDetail ที่ตั้งใจ restore — มีจุดเดียวที่
  // ควร "จำ" ฟอร์มเก่าคือตอนกลับจากลิงก์ธาตุจีน/อายตนะ6/เช็ควันเกิดที่มาจาก batch เท่านั้น
  const handleNavigateBatch = useCallback(() => {
    setBatchRestoreState(null);
    setReturnContext(DEFAULT_RETURN_CONTEXT);
    navigate('batch');
  }, [navigate]);

  // จุดเข้าอื่นๆ (nav-brand กลับ landing, แท็บ single/birthday-compat) ก็ควรเคลียร์ returnContext
  // เหมือนกัน กันไม่ให้ปุ่ม "กลับ" ของหน้าธาตุจีน/อายตนะ6/เช็ควันเกิดที่ยังไม่ได้เปิดพก context
  // เก่าจากการเข้าชมครั้งก่อนติดค้างมาโดยไม่ตั้งใจ — รวมถึง prefill ของแท็บเช็ควันเกิดด้วย (เข้า
  // จากแท็บตรงๆ ต้องได้ฟอร์มว่างเสมอ ไม่ใช่ทะเบียนจากลิงก์ "เช็คกับวันเกิด →" ครั้งก่อน)
  const handleNavigateTab = useCallback(
    (next: View) => {
      setReturnContext(DEFAULT_RETURN_CONTEXT);
      setCompareInitialInput(null);
      setBirthdayCompatInput(null);
      navigate(next);
    },
    [navigate],
  );

  const results: PlateVerdict[] = plates.map((p) => analyzePlate(p, { showAllAuction }));
  const visibleResults = results.filter((r) => !r.hiddenByDefault);
  const hiddenCount = results.length - visibleResults.length;

  return (
    <div className="app">
      {/* แถบเครื่องมืออยู่ในลำดับปกติของหน้า (ไม่ลอย) — ดู .app-toolbar ใน theme.css */}
      <div className="app-toolbar">
        <FontScaleControl />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {view !== 'landing' && (
        <div className="nav-bar">
          <button type="button" className="nav-brand" onClick={() => handleNavigateTab('landing')}>
            เลือกเลขทะเบียนที่ใช่
          </button>
          <div className="nav-tabs">
            <button
              type="button"
              className={view === 'single' ? 'active' : ''}
              onClick={() => handleNavigateTab('single')}
            >
              วิเคราะห์เลขเดี่ยว
            </button>
            <button
              type="button"
              className={view === 'batch' ? 'active' : ''}
              onClick={handleNavigateBatch}
            >
              แนะนำเลขทะเบียน (Batch)
            </button>
            {BIRTHDAY_COMPAT_ENABLED && (
              <button
                type="button"
                className={view === 'birthday-compat' ? 'active' : ''}
                onClick={() => handleNavigateTab('birthday-compat')}
              >
                เช็คความสอดคล้องกับวันเกิด
              </button>
            )}
            <button
              type="button"
              className={view === 'compare' ? 'active' : ''}
              onClick={() => handleNavigateTab('compare')}
            >
              เปรียบเทียบทะเบียน
            </button>
          </div>
        </div>
      )}

      {view === 'landing' ? (
        <LandingPage
          onNavigateBatch={handleNavigateBatch}
          onNavigateSingle={() => handleNavigateTab('single')}
        />
      ) : view === 'single' ? (
        <>
          <div className="eyebrow">Output Table</div>
          <h1>ผลการวิเคราะห์เลขทะเบียน</h1>
          <div className="sub">
            Verdict หลักมาจากบทสรุปพลังเลขศาสตร์ทะเบียนรถ (ผลรวมอักษร+ตัวเลข) พร้อม Badge เสริมจาก
            วิเคราะห์คู่เลขที่ปรากฏ (Pattern คู่เลขท้าย) และสรุปพลังผลรวมเฉพาะชุดตัวเลข (ผลรวมตัวเลข
            reduce) — กด &quot;ดูรายละเอียดการคำนวณ&quot; ในแต่ละใบเพื่อดูผลแยกตามโหมด
          </div>

          <div className="legend">
            <div className="legend-item">
              <span className="dot" style={{ background: 'var(--good-strong)' }} /> Verdict: ใช้ได้
            </div>
            <div className="legend-item">
              <span className="dot" style={{ background: 'var(--bad)' }} /> Verdict: ไม่ควรใช้
            </div>
            <div className="legend-item">
              <span className="dot" style={{ background: 'var(--good)' }} /> Badge เสริมด้านดี
            </div>
            <div className="legend-item">
              <span className="dot" style={{ background: 'var(--bad)' }} /> Badge คำเตือน
            </div>
            <div className="legend-item">
              <span className="dot" style={{ background: 'var(--navy)' }} /> เลขประมูล / เลขแย่งชิงสูง
            </div>
            <div className="legend-item">
              <span className="dot" style={{ background: 'var(--popular)' }} /> เลขสวย
            </div>
          </div>

          <PlateForm onSubmit={handleSubmit} />

          <div className="toggle-row">
            <input
              type="checkbox"
              id="showAllAuction"
              checked={showAllAuction}
              onChange={(e) => setShowAllAuction(e.target.checked)}
            />
            <label htmlFor="showAllAuction">
              แสดงเลขประมูลทั้งหมด (รวมที่ติดกลุ่มเลขเสียจากคู่เลขที่ปรากฏ — ปกติจะถูกซ่อนจากรายการหลัก)
            </label>
          </div>

          {visibleResults.map((result, i) => (
            <ResultCard
              key={i}
              result={result}
              onViewFiveElement={FEATURE_FLAGS.fiveElementMode ? handleViewFiveElement : undefined}
              onViewAyatana6={FEATURE_FLAGS.ayatana6Mode ? handleViewAyatana6 : undefined}
              onViewCompare={handleViewCompare}
              onViewBirthdayCompat={BIRTHDAY_COMPAT_ENABLED ? handleViewBirthdayCompat : undefined}
            />
          ))}

          {!showAllAuction && hiddenCount > 0 && (
            <div className="hidden-summary">
              ซ่อนอยู่ {hiddenCount} รายการ (เลขประมูลที่ติดกลุ่มเลขเสียจากคู่เลขที่ปรากฏ) — เปิด
              &quot;แสดงเลขประมูลทั้งหมด&quot; ด้านบนเพื่อดู
            </div>
          )}

          <div className="section-note">
            <strong>หมายเหตุ:</strong> ผลลัพธ์ทั้งหมดอ้างอิงจากความเชื่อเลขศาสตร์ไทยที่รวบรวมจากหลายแหล่ง
            ไม่ใช่ข้อเท็จจริงทางวิทยาศาสตร์หรือมาตรฐานสากล ใช้เป็นข้อมูลประกอบการตัดสินใจเท่านั้น · Verdict
            (สีพื้นหลังปุ่ม) มาจากบทสรุปพลังเลขศาสตร์ทะเบียนรถเท่านั้น · Badge แถวล่างมาจากคู่เลขที่ปรากฏ
            และผลรวมตัวเลข โดยไม่เปลี่ยน Verdict
          </div>
        </>
      ) : view === 'batch' ? (
        <>
          <div className="eyebrow">Batch Ranking</div>
          <h1>แนะนำเลขทะเบียน (Batch)</h1>
          <div className="sub">
            จัดอันดับเลขท้ายที่ดีที่สุด 10 อันดับ แยกตามความยาว 2/3/4 หลัก จากเลขหน้าและหมวดอักษรที่กำหนดตายตัว
            — คะแนนรวมคำนวณจากบทสรุปพลังเลขศาสตร์ทะเบียนรถ (น้ำหนักสูงสุด) + วิเคราะห์คู่เลขที่ปรากฏ +
            สรุปพลังผลรวมเฉพาะชุดตัวเลข เรียงจากคะแนนสูงไปต่ำ
          </div>
          <RankingPanel
            onViewFiveElement={FEATURE_FLAGS.fiveElementMode ? handleViewFiveElement : undefined}
            onViewAyatana6={FEATURE_FLAGS.ayatana6Mode ? handleViewAyatana6 : undefined}
            onViewBirthdayCompat={BIRTHDAY_COMPAT_ENABLED ? handleViewBirthdayCompat : undefined}
            restoreState={batchRestoreState ?? undefined}
          />
        </>
      ) : view === 'five-element' ? (
        FEATURE_FLAGS.fiveElementMode ? (
          <FiveElementPage
            input={fiveElementInput}
            onBack={handleBackFromDetail}
            backLabel={BACK_LABEL[returnContext.returnTo]}
          />
        ) : null
      ) : view === 'ayatana6' ? (
        FEATURE_FLAGS.ayatana6Mode ? (
          <Ayatana6Page
            input={ayatana6Input}
            onBack={handleBackFromDetail}
            backLabel={BACK_LABEL[returnContext.returnTo]}
          />
        ) : null
      ) : view === 'birthday-compat' ? (
        BIRTHDAY_COMPAT_ENABLED ? (
          <BirthdayCompatPage
            initialInput={birthdayCompatInput}
            onBack={handleBackFromDetail}
            backLabel={BACK_LABEL[returnContext.returnTo]}
          />
        ) : null
      ) : view === 'compare' ? (
        <ComparePage initialFirstSlot={compareInitialInput} />
      ) : view === 'font-licenses' ? (
        <FontLicensesPage />
      ) : null}

      {/* ลิงก์เล็กท้ายทุกหน้า — ใบอนุญาตของฟอนต์ที่ฝังในภาพป้าย (OFL / GPL + font exception) */}
      <footer className="app-footer">
        <a
          href="#font-licenses"
          onClick={(e) => {
            e.preventDefault();
            handleNavigateTab('font-licenses');
          }}
        >
          ใบอนุญาตฟอนต์
        </a>
      </footer>
    </div>
  );
}
