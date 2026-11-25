import { LEVELS } from '../../config/brand.js';

export const SKILL_OPTIONS = [
  { code: 'fractions', name: 'Fracciones' },
  { code: 'multiplication', name: 'Multiplicación' },
  { code: 'place_value', name: 'Valor posicional' },
  { code: 'problem_solving', name: 'Resolución de problemas' },
  { code: 'reading_comprehension', name: 'Comprensión lectora' },
];

export const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6];

export const QUESTION_TYPE_META = {
  multiple_choice: { code: 'multiple_choice', label: 'Opción múltiple', short: 'Opción múltiple' },
  true_false: { code: 'true_false', label: 'Verdadero o falso', short: 'V / F' },
  fill_blank: { code: 'fill_blank', label: 'Completar la frase', short: 'Completar' },
};

export const ORIGIN_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'recommended', label: 'Mejores para tu grupo' },
  { id: 'own', label: 'Mis cuestionarios' },
  { id: 'other_teachers', label: 'De otros docentes' },
  { id: 'preloaded', label: 'Precargados' },
];

export const ORIGIN_LABELS = {
  own: 'Tu cuestionario',
  other_teacher: 'De otro docente',
  preloaded: 'Precargado por Axi',
};

let uidCounter = 1;
const nextUid = () => `q-${Date.now()}-${uidCounter++}`;

export function createEmptyQuestion(questionType = 'multiple_choice') {
  const base = {
    uid: nextUid(),
    questionType,
    prompt: '',
    hint: '',
  };

  if (questionType === 'true_false') {
    return {
      ...base,
      options: [
        { label: 'A', text: 'Verdadero', isCorrect: true },
        { label: 'B', text: 'Falso', isCorrect: false },
      ],
      correctAnswer: 'Verdadero',
    };
  }

  if (questionType === 'fill_blank') {
    return {
      ...base,
      options: [],
      correctAnswer: '',
    };
  }

  return {
    ...base,
    options: [
      { label: 'A', text: '', isCorrect: true },
      { label: 'B', text: '', isCorrect: false },
      { label: 'C', text: '', isCorrect: false },
      { label: 'D', text: '', isCorrect: false },
    ],
    correctAnswer: '',
  };
}

export function createEmptyQuizDraft(defaultGrade = 3) {
  return {
    id: null,
    title: '',
    description: '',
    skillCode: 'fractions',
    grade: defaultGrade >= 1 && defaultGrade <= 6 ? defaultGrade : 3,
    questions: [createEmptyQuestion('multiple_choice')],
  };
}

export function quizDetailToDraft(quiz) {
  return {
    id: quiz.id,
    title: quiz.title ?? '',
    description: quiz.description ?? '',
    skillCode: quiz.skill?.code ?? 'fractions',
    grade: quiz.grade ?? 3,
    questions: (quiz.questions ?? []).map((q) => {
      if (q.questionType === 'multiple_choice') {
        const padded = ['A', 'B', 'C', 'D'].map((label, idx) => {
          const existing = q.options?.[idx];
          return existing
            ? { label, text: existing.text ?? '', isCorrect: Boolean(existing.isCorrect) }
            : { label, text: '', isCorrect: false };
        });
        if (!padded.some((o) => o.isCorrect)) padded[0].isCorrect = true;
        return {
          uid: nextUid(),
          questionType: 'multiple_choice',
          prompt: q.prompt ?? '',
          options: padded,
          correctAnswer: padded.find((o) => o.isCorrect)?.text ?? '',
          hint: q.hint ?? '',
        };
      }
      if (q.questionType === 'true_false') {
        const answer = q.correctAnswer === 'Falso' ? 'Falso' : 'Verdadero';
        return {
          uid: nextUid(),
          questionType: 'true_false',
          prompt: q.prompt ?? '',
          options: [
            { label: 'A', text: 'Verdadero', isCorrect: answer === 'Verdadero' },
            { label: 'B', text: 'Falso', isCorrect: answer === 'Falso' },
          ],
          correctAnswer: answer,
          hint: q.hint ?? '',
        };
      }
      return {
        uid: nextUid(),
        questionType: 'fill_blank',
        prompt: q.prompt ?? '',
        options: [],
        correctAnswer: q.correctAnswer ?? '',
        hint: q.hint ?? '',
      };
    }),
  };
}

/**
 * Cambia el tipo de pregunta conservando el enunciado y la pista.
 */
export function switchQuestionType(question, nextType) {
  if (question.questionType === nextType) return question;
  const fresh = createEmptyQuestion(nextType);
  return {
    ...fresh,
    uid: question.uid,
    prompt: question.prompt,
    hint: question.hint,
  };
}

/**
 * Valida y normaliza un borrador de cuestionario antes de enviarlo al backend.
 * Devuelve `{ valid: true, payload }` o `{ valid: false, error, focusIndex }`.
 */
export function validateQuizDraft(draft) {
  const title = (draft.title ?? '').trim().replace(/\s+/g, ' ');
  if (!title) {
    return { valid: false, error: 'Escribe un título para tu cuestionario.', focusIndex: null };
  }
  const description = (draft.description ?? '').trim().replace(/\s+/g, ' ');

  if (!Array.isArray(draft.questions) || draft.questions.length === 0) {
    return { valid: false, error: 'Agrega al menos una pregunta al cuestionario.', focusIndex: 0 };
  }

  const normalizedQuestions = [];
  for (let i = 0; i < draft.questions.length; i += 1) {
    const q = draft.questions[i];
    const prompt = (q.prompt ?? '').trim().replace(/\s+/g, ' ');
    if (!prompt) {
      return {
        valid: false,
        error: `Escribe el enunciado de la pregunta ${i + 1}.`,
        focusIndex: i,
      };
    }

    const hint = (q.hint ?? '').trim().replace(/\s+/g, ' ');

    if (q.questionType === 'multiple_choice') {
      const filledOptions = (q.options ?? [])
        .map((opt) => ({ ...opt, text: (opt.text ?? '').trim().replace(/\s+/g, ' ') }))
        .filter((opt) => opt.text.length > 0);

      if (filledOptions.length < 2) {
        return {
          valid: false,
          error: `Escribe al menos 2 opciones de respuesta en la pregunta ${i + 1}.`,
          focusIndex: i,
        };
      }

      const relabeled = filledOptions.slice(0, 4).map((opt, idx) => ({
        label: 'ABCD'[idx],
        text: opt.text,
        isCorrect: Boolean(opt.isCorrect),
      }));

      const correctCount = relabeled.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        return {
          valid: false,
          error: `Selecciona la respuesta correcta en la pregunta ${i + 1} (asegúrate de que esa opción tenga texto).`,
          focusIndex: i,
        };
      }

      normalizedQuestions.push({
        questionType: 'multiple_choice',
        prompt,
        options: relabeled,
        correctAnswer: relabeled.find((o) => o.isCorrect).text,
        hint,
      });
    } else if (q.questionType === 'true_false') {
      const answer = q.correctAnswer === 'Falso' ? 'Falso' : 'Verdadero';
      normalizedQuestions.push({
        questionType: 'true_false',
        prompt,
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: answer === 'Verdadero' },
          { label: 'B', text: 'Falso', isCorrect: answer === 'Falso' },
        ],
        correctAnswer: answer,
        hint,
      });
    } else {
      const correctAnswer = (q.correctAnswer ?? '').trim().replace(/\s+/g, ' ');
      if (!correctAnswer) {
        return {
          valid: false,
          error: `Escribe la respuesta exacta para completar la frase en la pregunta ${i + 1}.`,
          focusIndex: i,
        };
      }
      normalizedQuestions.push({
        questionType: 'fill_blank',
        prompt,
        options: [],
        correctAnswer,
        hint,
      });
    }
  }

  return {
    valid: true,
    payload: {
      title,
      description,
      skillCode: draft.skillCode,
      grade: Number(draft.grade),
      questions: normalizedQuestions,
    },
  };
}

/**
 * Desglose de los cuestionarios creados por el docente actual.
 */
export function summarizeOwnQuizzes(quizzes = []) {
  const own = quizzes.filter((q) => q.origin === 'own');
  const totalQuestions = own.reduce((sum, q) => sum + (q.questionCount ?? 0), 0);
  const bySkillMap = new Map();
  for (const q of own) {
    const code = q.skill?.code ?? 'other';
    const current = bySkillMap.get(code) ?? { code, name: q.skill?.name ?? 'General', count: 0, questions: 0 };
    current.count += 1;
    current.questions += q.questionCount ?? 0;
    bySkillMap.set(code, current);
  }
  return {
    ownQuizzes: own,
    totalQuizzes: own.length,
    totalQuestions,
    bySkill: Array.from(bySkillMap.values()),
  };
}

export function getLevelStyle(levelCode) {
  return LEVELS.find((l) => l.code === levelCode) ?? {
    code: 'not_evaluated',
    label: 'Sin evaluar',
    bg: '#EEF2F9',
    fg: '#4A5573',
    solid: '#8A93AB',
  };
}
