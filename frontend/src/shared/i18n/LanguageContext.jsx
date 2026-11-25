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

/** Selector de idioma: Español, Náhuatl, Maya. */
export function LanguageSwitch({ note = true }) {
  const { lang, setLang } = useLanguage();
  const current = LANGUAGES.find((language) => language.code === lang);
  return <span className="lang-switch-wrap">
    <span className="lang-switch" role="group" aria-label={`Idioma: ${current?.name ?? 'Español'}`}>
      {LANGUAGES.map((language) => <button key={language.code} type="button" lang={language.code === 'es' ? 'es-MX' : language.code}
        aria-label={language.name} aria-pressed={lang === language.code} title={`${language.name} (${language.native})`} onClick={() => setLang(language.code)}>{language.short}</button>)}
    </span>
    {note && lang !== DEFAULT_LANGUAGE && <span className="lang-note">Traducción parcial en revisión</span>}
  </span>;
}
