import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * แสดง children เมื่อใกล้เข้าจอเท่านั้น (ใช้กับภาพป้ายในตาราง/การ์ด Batch ที่มีได้ถึง 30 แถว):
 * - อยู่ในจอตอน mount → แสดงทันทีก่อน paint (useLayoutEffect) ไม่มีภาพกระพริบ
 * - นอกจอ → แสดง placeholder ขนาดเท่ากันก่อน แล้วแสดงจริงเมื่อห่างจอไม่เกิน MARGIN_PX (IntersectionObserver ตัวเดียวร่วมกัน
 *   — แถวที่อยู่ใต้จอไม่ไกลจะถูกวาดต่อทันทีหลัง paint แรก ก่อนผู้ใช้เลื่อนถึง)
 * - แสดงแล้วไม่ซ่อนกลับ · ไม่มี IntersectionObserver (SSR/เทสต์/เบราว์เซอร์เก่า) → แสดงทันที
 */
const MARGIN_PX = 400;

type Callback = () => void;
let sharedObserver: IntersectionObserver | null = null;
const callbacks = new Map<Element, Callback>();

function observe(el: Element, cb: Callback): () => void {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const fn = callbacks.get(e.target);
          if (fn) {
            callbacks.delete(e.target);
            sharedObserver?.unobserve(e.target);
            fn();
          }
        }
      },
      { rootMargin: `${MARGIN_PX}px 0px` },
    );
  }
  callbacks.set(el, cb);
  sharedObserver.observe(el);
  return () => {
    callbacks.delete(el);
    sharedObserver?.unobserve(el);
  };
}

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom >= 0 && r.top <= window.innerHeight;
}

export function LazyMount({ placeholder, children }: { placeholder: ReactNode; children: ReactNode }) {
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    if (inViewport(el)) {
      setShown(true);
      return;
    }
    return observe(el, () => setShown(true));
  }, [shown]);
  if (shown) return <>{children}</>;
  return (
    <div ref={ref} className="lazy-mount-placeholder">
      {placeholder}
    </div>
  );
}
