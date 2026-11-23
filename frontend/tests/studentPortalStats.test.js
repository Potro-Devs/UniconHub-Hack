import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getLevelIndex } from '../src/config/brand.js';
import {
  classifyQuizAnswer,
  summarizeQuizAnswers,
  weightedEvolution,
} from '../src/features/student-portal/studentPortalStats.js';
import { STUDENT_CLASSES, STUDENT_QUIZZES } from '../src/shared/data/seedData.js';

describe('studentPortalStats', () => {
  test('weightedEvolution y getLevelIndex redondean a 2 decimales como el backend', () => {
    assert.equal(weightedEvolution([33.33, 66.67]), 55.56);
    assert.equal(weightedEvolution([25, 24.99]), 24.99);
    assert.equal(getLevelIndex(24.99), 0);
    assert.equal(getLevelIndex(24.996), 1);
  });

  test('classifyQuizAnswer y summarizeQuizAnswers registran fallo con error_tag sin contar autónomo', () => {
    const firstWrong = classifyQuizAnswer({
      isCorrect: false,
      maxHintUsed: 0,
      errorTag: 'Invierte arriba y abajo',
    });
    const autonomous = classifyQuizAnswer({ isCorrect: true, maxHintUsed: 0 });
    const withSupport = classifyQuizAnswer({ isCorrect: true, maxHintUsed: 2 });

    const summary = summarizeQuizAnswers(
      { 0: firstWrong, 1: autonomous, 2: withSupport },
      3,
    );

    assert.equal(summary.autonomousCount, 1);
    assert.equal(summary.withSupportCount, 1);
    assert.equal(summary.incorrectCount, 1);
    assert.equal(summary.autonomousPct, 33.33);
    assert.equal(summary.supportedPct, 33.33);
    assert.deepEqual(summary.errorTags, ['Invierte arriba y abajo']);
  });

  test('seedData usa códigos de 6 caracteres y distractores con error_tag', () => {
    for (const cls of STUDENT_CLASSES) {
      assert.match(cls.code, /^[A-Z0-9]{6}$/);
    }
    for (const quiz of STUDENT_QUIZZES) {
      if (!quiz.exercises) continue;
      for (const ex of quiz.exercises) {
        const q = quiz.sheet[ex.s];
        q.o.forEach((_, idx) => {
          if (idx !== q.k) {
            assert.ok(quiz.distractorErrors?.[ex.s]?.[idx]);
          }
        });
      }
    }
  });
});
