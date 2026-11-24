import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { COLORS, KID_COLORS } from '@/config/brand';
import '@/shared/styles/global.css';
import '@/shared/styles/experience.css';
import '@/features/student-portal/student-experience.css';

// Tokens que necesita el CSS global (una sola fuente: config/brand.js).
document.documentElement.style.setProperty('--axi-focus-ring', COLORS.focusRing);
for (const [name, color] of Object.entries(COLORS)) {
  document.documentElement.style.setProperty(`--axi-${name}`, color);
}
for (const [name, color] of Object.entries(KID_COLORS)) {
  document.documentElement.style.setProperty(`--kid-${name}`, color);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
