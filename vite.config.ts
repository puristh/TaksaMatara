import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // ไฟล์ใบอนุญาตฟอนต์ (.txt) ต้องเป็นไฟล์จริงเสมอ — ถ้า inline เป็น data: URL ลิงก์ในหน้า "ใบอนุญาตฟอนต์"
    // จะเปิดไม่ได้ (เบราว์เซอร์บล็อกการเปิด data: URL จากลิงก์) · ไฟล์อื่นใช้เกณฑ์ปกติของ Vite
    assetsInlineLimit: (filePath) => (/\.txt$/.test(filePath) ? false : undefined),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // ให้เทสต์ appToolbar.test.ts อ่าน theme.css (?raw) ได้จริง — ค่าเริ่มต้นของ vitest แทน CSS เป็นค่าว่าง
    css: { include: [/theme\.css/] },
  },
});
