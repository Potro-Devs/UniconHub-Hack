/**
 * Módulo paper-mode — Capa 3 (Dominio): definición de geometría OMR (fuente única de verdad).
 * Funciones puras sin I/O compartidas por el generador de PDF y el endpoint `omr-layout`.
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { MAX_QUESTIONS_PER_ASSIGNMENT } from '../assessments/assessments.domain.js';

export const OMR_LAYOUT_VERSION = 1;

export const OMR_PAGE = Object.freeze({
  size: 'LETTER',
  widthPt: 612,
  heightPt: 792,
});

const FIDUCIAL_FRAME = Object.freeze({
  x: 48,
  y: 48,
  width: 516,
  height: 696,
});

export const OMR_FIDUCIALS = Object.freeze({
  markerSizePt: 24,
  frame: FIDUCIAL_FRAME,
  corners: Object.freeze({
    tl: Object.freeze({ x: 48, y: 48 }),
    tr: Object.freeze({ x: 564, y: 48 }),
    br: Object.freeze({ x: 564, y: 744 }),
    bl: Object.freeze({ x: 48, y: 744 }),
  }),
});

export const OMR_COLUMNS = Object.freeze(['A', 'B', 'C', 'D']);

const CODE_STRIP_Y = 157;
const CODE_CELL_SIZE_PT = 10;
const CODE_BIT_START_X = 121;
const CODE_BIT_PITCH_PT = 14;
const CODE_BLACK_REF_X = 85;
const CODE_WHITE_REF_X = 101;
const CODE_ID_BITS = 14;
const CODE_CHECKSUM_BITS = 4;

const SUPPORT_BUBBLE_POS = Object.freeze({
  label: 'Usó tarjetas de pistas',
  x: 368,
  y: 190,
  r: 8,
});

const GRID_START_Y = 246;
const GRID_ROW_PITCH_PT = 22;
const SINGLE_COL_CENTERS = Object.freeze([188, 252, 316, 380]);
const DOUBLE_COL_LEFT_CENTERS = Object.freeze([128, 168, 208, 248]);
const DOUBLE_COL_RIGHT_CENTERS = Object.freeze([370, 410, 450, 490]);

const round4 = (n) => Math.round(n * 10000) / 10000;

export function formatAssignmentCode(assignmentId) {
  return `P-${assignmentId}`;
}

/**
 * Suma de verificación de 4 bits con máscara `0xA` para rechazar cadenas todo-ceros y todo-unos.
 */
export function computeCodeChecksum(id14) {
  const v = Number(id14) & 0x3fff;
  return ((v & 0xf) ^ ((v >> 4) & 0xf) ^ ((v >> 8) & 0xf) ^ ((v >> 12) & 0x3) ^ 0xa) & 0xf;
}

/**
 * Codifica `assignmentId` (14 bits MSB-first) + checksum (4 bits MSB-first) en 18 bits.
 */
export function encodeAssignmentCodeBits(assignmentId) {
  const expectedId14 = Number(assignmentId) & 0x3fff;
  const expectedChecksum = computeCodeChecksum(expectedId14);
  const bits = [];
  for (let i = CODE_ID_BITS - 1; i >= 0; i -= 1) {
    bits.push((expectedId14 >> i) & 1);
  }
  for (let i = CODE_CHECKSUM_BITS - 1; i >= 0; i -= 1) {
    bits.push((expectedChecksum >> i) & 1);
  }
  return {
    idBits: CODE_ID_BITS,
    checksumBits: CODE_CHECKSUM_BITS,
    expectedId14,
    expectedChecksum,
    bits,
  };
}

/**
 * Decodifica una tira de 18 bits y valida su suma de verificación.
 */
export function decodeAssignmentCodeBits(bits) {
  if (!Array.isArray(bits) || bits.length !== CODE_ID_BITS + CODE_CHECKSUM_BITS) {
    return { valid: false, id14: 0, checksum: 0, expectedChecksum: computeCodeChecksum(0) };
  }
  let id14 = 0;
  for (let i = 0; i < CODE_ID_BITS; i += 1) {
    id14 = (id14 << 1) | (bits[i] ? 1 : 0);
  }
  let checksum = 0;
  for (let i = CODE_ID_BITS; i < CODE_ID_BITS + CODE_CHECKSUM_BITS; i += 1) {
    checksum = (checksum << 1) | (bits[i] ? 1 : 0);
  }
  const expectedChecksum = computeCodeChecksum(id14);
  return {
    valid: checksum === expectedChecksum && id14 > 0,
    id14,
    checksum,
    expectedChecksum,
  };
}

/**
 * Convierte coordenadas PDF `(x, y)` al sistema normalizado `[0..1]` del marco de fiduciales.
 */
export function toNormalized(x, y, frame = FIDUCIAL_FRAME) {
  return {
    u: round4((x - frame.x) / frame.width),
    v: round4((y - frame.y) / frame.height),
  };
}

function buildCell(x, y, sizePt) {
  return {
    x,
    y,
    ...toNormalized(x, y),
    sizeU: round4(sizePt / FIDUCIAL_FRAME.width),
    sizeV: round4(sizePt / FIDUCIAL_FRAME.height),
  };
}

function buildBubble(x, y, r) {
  return {
    x,
    y,
    r,
    ...toNormalized(x, y),
    ru: round4(r / FIDUCIAL_FRAME.width),
    rv: round4(r / FIDUCIAL_FRAME.height),
  };
}

/**
 * Construye el contrato completo de coordenadas OMR para una asignación en papel.
 * Nunca incluye `isCorrect`, `errorTag`, nombres ni folios internos.
 *
 * @param {{
 *   assignmentId: number,
 *   title: string,
 *   groupLabel?: string | null,
 *   questions: Array<{ id: number, position: number, options: Array<{ id: number, label: string }> }>
 * }} params
 */
export function buildOmrLayout({ assignmentId, title, groupLabel = null, questions }) {
  if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0) {
    throw new DomainError('VALIDATION_ERROR', 'El identificador de la prueba no es válido.');
  }
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > MAX_QUESTIONS_PER_ASSIGNMENT) {
    throw new DomainError('VALIDATION_ERROR', `La hoja admite entre 1 y ${MAX_QUESTIONS_PER_ASSIGNMENT} reactivos.`);
  }

  const encoded = encodeAssignmentCodeBits(assignmentId);
  const codeStrip = {
    idBits: encoded.idBits,
    checksumBits: encoded.checksumBits,
    expectedId14: encoded.expectedId14,
    expectedChecksum: encoded.expectedChecksum,
    cellSizePt: CODE_CELL_SIZE_PT,
    blackRef: buildCell(CODE_BLACK_REF_X, CODE_STRIP_Y, CODE_CELL_SIZE_PT),
    whiteRef: buildCell(CODE_WHITE_REF_X, CODE_STRIP_Y, CODE_CELL_SIZE_PT),
    bits: encoded.bits.map((value, index) => ({
      index,
      value,
      ...buildCell(CODE_BIT_START_X + index * CODE_BIT_PITCH_PT, CODE_STRIP_Y, CODE_CELL_SIZE_PT),
    })),
  };

  const supportBubble = {
    label: SUPPORT_BUBBLE_POS.label,
    ...buildBubble(SUPPORT_BUBBLE_POS.x, SUPPORT_BUBBLE_POS.y, SUPPORT_BUBBLE_POS.r),
  };

  const gridColumns = questions.length <= 20 ? 1 : 2;
  const bubbleRadius = gridColumns === 1 ? 8 : 7.5;

  const layoutQuestions = questions.map((question, idx) => {
    const position = question.position ?? idx + 1;
    const isRightCol = gridColumns === 2 && idx >= 20;
    const rowIdx = isRightCol ? idx - 20 : idx;
    const colCenters =
      gridColumns === 1
        ? SINGLE_COL_CENTERS
        : isRightCol
          ? DOUBLE_COL_RIGHT_CENTERS
          : DOUBLE_COL_LEFT_CENTERS;
    const cy = GRID_START_Y + rowIdx * GRID_ROW_PITCH_PT;

    const usedCols = new Set();
    const options = (question.options ?? []).map((opt, optIdx) => {
      const label = String(opt.label ?? '').trim().toUpperCase();
      let colIdx = OMR_COLUMNS.indexOf(label);
      if (colIdx === -1 || usedCols.has(colIdx)) {
        colIdx = Math.min(OMR_COLUMNS.length - 1, optIdx);
      }
      usedCols.add(colIdx);
      const cx = colCenters[colIdx];
      return {
        optionId: opt.id,
        label: opt.label,
        ...buildBubble(cx, cy, bubbleRadius),
      };
    });

    return {
      questionId: question.id,
      position,
      options,
    };
  });

  return {
    version: OMR_LAYOUT_VERSION,
    assignmentId,
    code: formatAssignmentCode(assignmentId),
    title,
    groupLabel,
    page: OMR_PAGE,
    fiducials: OMR_FIDUCIALS,
    codeStrip,
    supportBubble,
    columns: [...OMR_COLUMNS],
    gridColumns,
    questions: layoutQuestions,
  };
}
