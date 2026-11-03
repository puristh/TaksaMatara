import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // ให้เทสต์ appToolbar.test.ts อ่าน theme.css (?raw) ได้จริง — ค่าเริ่มต้นของ vitest แทน CSS เป็นค่าว่าง
    css: { include: [/theme\.css/] },
  },
});
