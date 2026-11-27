import { createContext, useContext, useEffect, useRef, useState } from 'react';

const AppUiContext = createContext(null);

/** Preferencias de interfaz, acceso temporal y demostraciones del Roadmap; sin datos diagnósticos. */
export function AppUiProvider({ children }) {
  const [joinCode, setJoinCode] = useState('');
  const [joinRoster, setJoinRoster] = useState(null);
  const [axiColor, setAxiColor] = useState('rosa');
  const [sound, setSound] = useState(false);
  const [promoSel, setPromoSel] = useState({ g3a: true });
  const [promoted, setPromoted] = useState(false);
  const [trCode, setTrCode] = useState('');
  const [trFound, setTrFound] = useState(false);
  const [trDest, setTrDest] = useState('3.º A');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const say = (message) => {
    clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  };

  // Las tarjetas con nombres solo se conservan durante el acceso; no pasan a la próxima sesión.
  const resetStudentSession = () => {
    setJoinCode('');
    setJoinRoster(null);
    setSound(false);
    clearTimeout(toastTimerRef.current);
    setToast(null);
  };

  return <AppUiContext.Provider value={{
    joinCode, setJoinCode, joinRoster, setJoinRoster, resetStudentSession,
    axiColor, setAxiColor, sound, setSound, toast, say,
    promoSel, setPromoSel, promoted, setPromoted,
    trCode, setTrCode, trFound, setTrFound, trDest, setTrDest,
  }}>{children}</AppUiContext.Provider>;
}

export function useAppUi() {
  const context = useContext(AppUiContext);
  if (!context) throw new Error('useAppUi debe utilizarse dentro de AppUiProvider');
  return context;
}
