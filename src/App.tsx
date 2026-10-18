import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { Enter } from './screens/Enter';
import { Leaderboard } from './screens/Leaderboard';
import { RoundDetail } from './screens/RoundDetail';
import { Stats } from './screens/Stats';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/rounds" element={<RoundDetail />} />
        <Route path="/enter" element={<Enter />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
