import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  OMR_COLUMNS,
  OMR_FIDUCIALS,
  OMR_LAYOUT_VERSION,
  OMR_PAGE,
  buildOmrLayout,
  decodeAssignmentCodeBits,
  encodeAssignmentCodeBits,
  formatAssignmentCode,
  toNormalized,
} from '../../src/modules/paper-mode/paper-mode.omr.domain.js';

function makeQuestions(count, optionCount = 4) {
  const labels = ['A', 'B', 'C', 'D'].slice(0, optionCount);
  return Array.from({ length: count }, (_, idx) => ({
    id: 100 + idx,
    position: idx + 1,
    options: labels.map((label, optIdx) => ({
      id: (100 + idx) * 10 + optIdx + 1,
      label,
    })),
  }));
}

describe('paper-mode.omr.domain · geometría y código OMR', () => {
  test('encode/decode de 18 bits: round-trip válido y rechazo de ceros, unos y flips', () => {
    for (const id of [1, 12, 123, 4095, 16383]) {
      const encoded = encodeAssignmentCodeBits(id);
      assert.equal(encoded.bits.length, 18);
      assert.equal(encoded.idBits, 14);
      assert.equal(encoded.checksumBits, 4);
      const decoded = decodeAssignmentCodeBits(encoded.bits);
      assert.equal(decoded.valid, true);
      assert.equal(decoded.id14, id);
      assert.equal(decoded.checksum, encoded.expectedChecksum);

      for (let bit = 0; bit < encoded.bits.length; bit += 1) {
        const corrupted = [...encoded.bits];
        corrupted[bit] = corrupted[bit] ? 0 : 1;
        assert.equal(decodeAssignmentCodeBits(corrupted).valid, false, `flip en bit ${bit} para id=${id}`);
      }
    }

    assert.equal(decodeAssignmentCodeBits(Array(18).fill(0)).valid, false);
    assert.equal(decodeAssignmentCodeBits(Array(18).fill(1)).valid, false);
    assert.equal(decodeAssignmentCodeBits([1, 0, 1]).valid, false);
  });

  test('layout de 1 columna (<= 20 reactivos) y 2 columnas (21..40 reactivos)', () => {
    const single = buildOmrLayout({
      assignmentId: 42,
      title: 'Fracciones · prueba 1',
      groupLabel: '3.º A',
      questions: makeQuestions(20, 4),
    });
    assert.equal(single.version, OMR_LAYOUT_VERSION);
    assert.equal(single.code, formatAssignmentCode(42));
    assert.deepEqual(single.page, OMR_PAGE);
    assert.deepEqual(single.columns, OMR_COLUMNS);
    assert.equal(single.gridColumns, 1);
    assert.equal(single.questions.length, 20);

    const double = buildOmrLayout({
      assignmentId: 43,
      title: 'Prueba extensa',
      questions: makeQuestions(40, 4),
    });
    assert.equal(double.gridColumns, 2);
    assert.equal(double.questions.length, 40);
    assert.ok(double.questions[0].options[0].x < double.questions[20].options[0].x);
    assert.equal(double.questions[0].options[0].y, double.questions[20].options[0].y);
  });

  test('todas las burbujas y tira de código quedan dentro del área segura sin traslapes ni zonas fiduciales', () => {
    for (const [count, optCount] of [[1, 2], [4, 4], [20, 4], [21, 2], [40, 4]]) {
      const layout = buildOmrLayout({
        assignmentId: 123,
        title: 'Prueba',
        questions: makeQuestions(count, optCount),
      });

      const allBubbles = [layout.supportBubble, ...layout.questions.flatMap((q) => q.options)];
      for (const b of allBubbles) {
        assert.ok(b.x - b.r >= 76 && b.x + b.r <= 536, `burbuja x fuera de área: ${b.x}`);
        assert.ok(b.y - b.r >= 74 && b.y + b.r <= 720, `burbuja y fuera de área: ${b.y}`);
        const expectedNorm = toNormalized(b.x, b.y, OMR_FIDUCIALS.frame);
        assert.equal(b.u, expectedNorm.u);
        assert.equal(b.v, expectedNorm.v);
      }

      for (let i = 0; i < allBubbles.length; i += 1) {
        for (let j = i + 1; j < allBubbles.length; j += 1) {
          const a = allBubbles[i];
          const b = allBubbles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          assert.ok(dist > a.r + b.r + 2, `burbujas traslapadas (${i}, ${j}): dist=${dist}`);
        }
      }

      const cells = [layout.codeStrip.blackRef, layout.codeStrip.whiteRef, ...layout.codeStrip.bits];
      const half = layout.codeStrip.cellSizePt / 2;
      for (const cell of cells) {
        assert.ok(cell.x - half >= 76 && cell.x + half <= 536, `celda código x fuera: ${cell.x}`);
        assert.ok(cell.y - half >= 74 && cell.y + half <= 720, `celda código y fuera: ${cell.y}`);
        const expectedNorm = toNormalized(cell.x, cell.y, OMR_FIDUCIALS.frame);
        assert.equal(cell.u, expectedNorm.u);
        assert.equal(cell.v, expectedNorm.v);
      }
    }
  });

  test('rechaza id o cantidad de reactivos fuera de rango', () => {
    assert.throws(() => buildOmrLayout({ assignmentId: 0, title: 'X', questions: makeQuestions(3) }));
    assert.throws(() => buildOmrLayout({ assignmentId: 1, title: 'X', questions: [] }));
    assert.throws(() => buildOmrLayout({ assignmentId: 1, title: 'X', questions: makeQuestions(41) }));
  });
});
