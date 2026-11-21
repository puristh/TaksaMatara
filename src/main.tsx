import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RankingStrategyContext } from './components/RankingStrategyContext';
import { resolveRankingStrategyFromWindow } from './config/rankingStrategy';
import './styles/theme.css';

// โหมดคัดเข้ม (ซ่อน): ?strict=1 เปิด / ?strict=0 ปิด — อ่านครั้งเดียวก่อน render (ดู config/rankingStrategy.ts)
const rankingStrategy = resolveRankingStrategyFromWindow();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RankingStrategyContext.Provider value={rankingStrategy}>
      <App />
    </RankingStrategyContext.Provider>
  </StrictMode>,
);
