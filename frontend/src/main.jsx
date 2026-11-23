import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { COLORS } from '@/config/brand';
import '@/shared/styles/global.css';

// Tokens que necesita el CSS global (una sola fuente: config/brand.js).
document.documentElement.style.setProperty('--axi-focus-ring', COLORS.focusRing);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
