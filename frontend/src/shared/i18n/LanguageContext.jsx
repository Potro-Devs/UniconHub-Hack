import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGES, isLanguage, translate } from './languages';
import './language.css';

const STORAGE_KEY = 'axi-language';
const LanguageContext = createContext({ lang: DEFAULT_LANGUAGE, setLang: () => {}, t: (key, fallback) => translate(DEFAULT_LANGUAGE, key, fallback) });

function readStored() {
  try { const value = localStorage.getItem(STORAGE_KEY); return isLanguage(value) ? value : DEFAULT_LANGUAGE; } catch { return DEFAULT_LANGUAGE; }
}

/**
 * Idioma de la interfaz para todos los usuarios (docente, dirección y alumno). Se guarda en el
 * dispositivo: no se envía al servidor ni depende de la sesión.
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStored);
  const setLang = useCallback((code) => {
    if (!isLanguage(code)) return;
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* almacenamiento opcional */ }
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (key, fallback) => translate(lang, key, fallback) }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

/**
 * Texto bilingüe. En español se ve igual que antes. En náhuatl o maya muestra la traducción y
 * debajo el español; `compact` (barras estrechas) deja el español para lectores de pantalla.
 */
export function BiText({ k, children, compact = false }) {
  const { lang, t } = useLanguage();
  const { text, es, translated } = t(k, children);
  if (!translated) return es;
  if (compact) return <span className="bi-text-compact" title={es}><span lang={lang}>{text}</span><span className="axi-sr-only" lang="es-MX"> ({es})</span></span>;
  return <span className="bi-text"><span lang={lang}>{text}</span><small lang="es-MX">{es}</small></span>;
}

/** Botón de idioma (Español, Náhuatl, Maya): muestra el actual; un select nativo invisible abre el menú, también en celular. */
export function LanguageSwitch() {
  const { lang, setLang } = useLanguage();
  const current = LANGUAGES.find((language) => language.code === lang) ?? LANGUAGES[0];
  const note = lang !== DEFAULT_LANGUAGE ? ' · Traducción parcial en revisión' : '';
  return <label className="lang-switch" title={`Idioma: ${current.name}${note}`}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3" /></svg>
    <span className="lang-switch__name" aria-hidden="true">{current.name}</span>
    <span className="lang-switch__short" aria-hidden="true">{current.short}</span>
    <span className="lang-switch__caret" aria-hidden="true">▾</span>
    <select aria-label={`Idioma${note}`} value={lang} onChange={(event) => setLang(event.target.value)}>
      {LANGUAGES.map((language) => <option key={language.code} value={language.code} lang={language.code === 'es' ? 'es-MX' : language.code}>{language.name} ({language.native})</option>)}
    </select>
  </label>;
}
