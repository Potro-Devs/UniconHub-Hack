import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { pickSpanishVoice, speakableText } from '../src/shared/hooks/useSpeech.js';

describe('bocina (lectura en voz alta)', () => {
  test('elige voz de español de México, luego español latino y luego cualquier español', () => {
    const voices = [{ lang: 'en-US', name: 'en' }, { lang: 'es-ES', name: 'es' }, { lang: 'es-US', name: 'us' }, { lang: 'es-MX', name: 'mx' }];
    assert.equal(pickSpanishVoice(voices).name, 'mx');
    assert.equal(pickSpanishVoice(voices.slice(0, 3)).name, 'us');
    assert.equal(pickSpanishVoice(voices.slice(0, 2)).name, 'es');
    assert.equal(pickSpanishVoice([{ lang: 'en-US' }]), null);
    assert.equal(pickSpanishVoice(undefined), null);
  });

  test('vuelve legibles fracciones y signos', () => {
    assert.equal(speakableText('¿Cuánto es 296 × 18?'), '¿Cuánto es 296 por 18?');
    assert.equal(speakableText('Calcula 2/3 + 3/4.'), 'Calcula 2 de 3 + 3 de 4.');
    assert.equal(speakableText('  12 ÷ 3 '), '12 entre 3');
  });
});
