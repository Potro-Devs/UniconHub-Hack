/**
 * Entrada independiente del pitch: se compila a un solo HTML que se abre con doble clic
 * (sin servidor, sin backend y sin internet). Ver scripts/build-pitch-zip.mjs.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { COLORS, KID_COLORS } from '@/config/brand';
import '@/shared/styles/global.css';
import '@/shared/styles/experience.css';
import PitchScreen from './PitchScreen';

document.documentElement.style.setProperty('--axi-focus-ring', COLORS.focusRing);
for (const [name, color] of Object.entries(COLORS)) document.documentElement.style.setProperty(`--axi-${name}`, color);
for (const [name, color] of Object.entries(KID_COLORS)) document.documentElement.style.setProperty(`--kid-${name}`, color);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MemoryRouter initialEntries={['/pitch']}>
      <PitchScreen />
    </MemoryRouter>
  </StrictMode>,
);
