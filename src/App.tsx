import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { Enter } from './screens/Enter';
import { Leaderboard } from './screens/Leaderboard';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/enter" element={<Enter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
