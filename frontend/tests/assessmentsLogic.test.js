import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createEmptyQuestion,
  createEmptyQuizDraft,
  quizDetailToDraft,
  summarizeOwnQuizzes,
  switchQuestionType,
  validateQuizDraft,
} from '../src/features/assessments/assessments.logic.js';

describe('assessments.logic · constructor de cuestionarios', () => {
  test('switchQuestionType conserva enunciado y pista al cambiar entre Kahoot types', () => {
    const mc = createEmptyQuestion('multiple_choice');
    mc.prompt = '¿La mitad de 10 es 5?';
    mc.hint = 'Divide entre dos.';

    const tf = switchQuestionType(mc, 'true_false');
    assert.equal(tf.questionType, 'true_false');
    assert.equal(tf.prompt, '¿La mitad de 10 es 5?');
    assert.equal(tf.hint, 'Divide entre dos.');
    assert.equal(tf.correctAnswer, 'Verdadero');
    assert.equal(tf.options.length, 2);

    const fill = switchQuestionType(tf, 'fill_blank');
    assert.equal(fill.questionType, 'fill_blank');
    assert.equal(fill.prompt, '¿La mitad de 10 es 5?');
    assert.equal(fill.options.length, 0);
  });

  test('validateQuizDraft valida título, enunciados y normaliza los 3 tipos', () => {
    const draft = createEmptyQuizDraft(3);
    assert.equal(validateQuizDraft(draft).valid, false);

    draft.title = '  Repaso   de fracciones  ';
    draft.questions = [
      {
        uid: '1',
        questionType: 'multiple_choice',
        prompt: '¿Qué fracción es un medio?',
        hint: 'Dos partes iguales.',
        options: [
          { label: 'A', text: '1/2', isCorrect: true },
          { label: 'B', text: '1/4', isCorrect: false },
          { label: 'C', text: '', isCorrect: false },
          { label: 'D', text: '', isCorrect: false },
        ],
        correctAnswer: '1/2',
      },
      {
        uid: '2',
        questionType: 'true_false',
        prompt: '1/2 es igual a 2/4.',
        hint: '',
        options: [],
        correctAnswer: 'Verdadero',
      },
      {
        uid: '3',
        questionType: 'fill_blank',
        prompt: 'La mitad de 8 es ___ .',
        hint: '',
        options: [],
        correctAnswer: ' 4 ',
      },
    ];

    const res = validateQuizDraft(draft);
    assert.equal(res.valid, true);
    assert.equal(res.payload.title, 'Repaso de fracciones');
    assert.equal(res.payload.questions[0].options.length, 2);
    assert.equal(res.payload.questions[1].correctAnswer, 'Verdadero');
    assert.equal(res.payload.questions[2].correctAnswer, '4');
  });

  test('validateQuizDraft rechaza cuestionarios con menos de 3 preguntas', () => {
    const draft = createEmptyQuizDraft(3);
    draft.title = 'Cuestionario corto';
    draft.questions = [
      {
        uid: '1',
        questionType: 'true_false',
        prompt: 'Pregunta 1',
        hint: '',
        options: [],
        correctAnswer: 'Verdadero',
      },
      {
        uid: '2',
        questionType: 'fill_blank',
        prompt: 'Pregunta 2 ___',
        hint: '',
        options: [],
        correctAnswer: 'dos',
      },
    ];
    const res = validateQuizDraft(draft);
    assert.equal(res.valid, false);
    assert.match(res.error, /3 preguntas/);
  });

  test('quizDetailToDraft rellena a 4 opciones en opción múltiple para editar sin pérdida', () => {
    const draft = quizDetailToDraft({
      id: 99,
      title: 'Prueba propia',
      description: 'Desc',
      skill: { code: 'fractions', name: 'Fracciones' },
      grade: 4,
      questions: [
        {
          questionType: 'multiple_choice',
          prompt: 'Pregunta 1',
          options: [
            { label: 'A', text: 'Uno', isCorrect: false },
            { label: 'B', text: 'Dos', isCorrect: true },
          ],
          correctAnswer: 'Dos',
          hint: 'Pista',
        },
      ],
    });
    assert.equal(draft.id, 99);
    assert.equal(draft.questions[0].options.length, 4);
    assert.equal(draft.questions[0].options[1].isCorrect, true);
  });

  test('summarizeOwnQuizzes calcula desglose de cuestionarios propios por habilidad', () => {
    const summary = summarizeOwnQuizzes([
      { id: 1, origin: 'own', skill: { code: 'fractions', name: 'Fracciones' }, questionCount: 4 },
      { id: 2, origin: 'other_teacher', skill: { code: 'fractions', name: 'Fracciones' }, questionCount: 5 },
      { id: 3, origin: 'own', skill: { code: 'multiplication', name: 'Multiplicación' }, questionCount: 3 },
      { id: 4, origin: 'preloaded', skill: { code: 'place_value', name: 'Valor posicional' }, questionCount: 6 },
    ]);
    assert.equal(summary.totalQuizzes, 2);
    assert.equal(summary.totalQuestions, 7);
    assert.equal(summary.bySkill.length, 2);
  });
});
