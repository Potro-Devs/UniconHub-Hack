import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LANGUAGE, LANGUAGES, TRANSLATIONS, isLanguage, translate } from '../src/shared/i18n/languages.js';

test('tres idiomas: español, náhuatl y maya', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code), ['es', 'nah', 'yua']);
  assert.equal(DEFAULT_LANGUAGE, 'es');
  assert.equal(isLanguage('yua'), true);
  assert.equal(isLanguage('fr'), false);
});

test('en español o sin traducción se conserva el texto del componente', () => {
  assert.deepEqual(translate('es', 'nav.juegos', 'Juegos'), { text: 'Juegos', es: 'Juegos', translated: false });
  assert.deepEqual(translate('nah', 'nav.no-existe', 'Captura'), { text: 'Captura', es: 'Captura', translated: false });
  assert.deepEqual(translate('yua', 'nav.juegos', 'Juegos'), { text: 'Báaxal', es: 'Juegos', translated: true });
});

test('las traducciones no tienen lenguaje punitivo y usan claves con espacio de nombres', () => {
  const forbidden = /reprobad|malo|deficiente|\bbajo\b|fallaste/i;
  for (const lang of Object.keys(TRANSLATIONS)) {
    for (const [key, text] of Object.entries(TRANSLATIONS[lang])) {
      assert.match(key, /^[a-z]+\.[a-z-]+$/i);
      assert.doesNotMatch(text, forbidden);
      assert.ok(text.trim().length > 0);
    }
  }
});
