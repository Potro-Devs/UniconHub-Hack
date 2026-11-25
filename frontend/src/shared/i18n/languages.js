/**
 * Idiomas de la interfaz para todos los usuarios: español, náhuatl y maya (las dos lenguas
 * indígenas con más hablantes en México). Funciones puras, sin dependencias de React.
 *
 * TRADUCCIÓN PRELIMINAR — por validar con hablantes de la comunidad, la DGEI y el INALI.
 * Náhuatl: variante central. Maya: maya yucateco. Cada lengua tiene variantes regionales: la
 * escuela puede corregir este archivo sin tocar componentes. Si falta una clave, se usa el texto
 * en español del componente. En náhuatl y maya la interfaz muestra también el español.
 */
export const LANGUAGES = Object.freeze([
  { code: 'es', name: 'Español', native: 'Español', short: 'Esp' },
  { code: 'nah', name: 'Náhuatl', native: 'Nāhuatlahtōlli', short: 'Náh' },
  { code: 'yua', name: 'Maya', native: "Maaya t'aan", short: 'Maya' },
]);

export const DEFAULT_LANGUAGE = 'es';
export const isLanguage = (code) => LANGUAGES.some((language) => language.code === code);

/** Solo las traducciones. El español vive en cada componente (es el texto de respaldo). */
export const TRANSLATIONS = Object.freeze({
  nah: {
    'common.language': 'Tlahtolli', 'common.exit': 'Xiquiza', 'common.signOut': 'Xiquiza', 'common.hello': 'Niltze',
    'nav.inicio': 'Pehualiztli', 'nav.clases': 'Tlamachtiliztli', 'nav.juegos': 'Ahuiltiliztli', 'nav.tutores': 'Tlamachtianimeh',
  },
  yua: {
    'common.language': "T'aan", 'common.exit': "Jóok'en", 'common.signOut': "Jóok'en", 'common.hello': "Ba'ax ka wa'alik",
    'nav.inicio': 'Káajbal', 'nav.clases': 'Xook', 'nav.juegos': 'Báaxal', 'nav.tutores': "Aj ka'ansajo'ob", 'nav.grupos': "Múuch'il",
  },
});

/**
 * Texto para `key` en `lang`. `fallback` es el español que ya muestra el componente: así una
 * clave sin traducir nunca rompe ni cambia la pantalla de nadie.
 */
export function translate(lang, key, fallback) {
  const own = lang !== DEFAULT_LANGUAGE ? TRANSLATIONS[lang]?.[key] : undefined;
  return { text: own ?? fallback, es: fallback, translated: Boolean(own) };
}
