/**
 * Escáner OMR puro en JavaScript (sin DOM, sin dependencias externas).
 * Procesa imágenes RGBA de `<canvas>` usando la geometría de `GET /paper/assignments/:id/omr-layout`.
 */

const DEFAULT_ASPECT = 516 / 696;
const FILLED_THRESHOLD = 0.34;
const DOUBTFUL_THRESHOLD = 0.20;
const CLEAR_MARGIN = 0.14;
const MAX_ROTATION_DEG = 12;
const MAX_PERSPECTIVE_SKEW = 1.28;
const MAX_ASPECT_DRIFT = 0.24;
const MIN_FIDUCIAL_CONTRAST = 45;
const MIN_REF_CONTRAST = 45;
const MAX_SHADOW_DELTA = 125;
const MIN_QUADRANT_RANGE = 38;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function computeCodeChecksum(id14) {
  const v = Number(id14) & 0x3fff;
  return ((v & 0xf) ^ ((v >> 4) & 0xf) ^ ((v >> 8) & 0xf) ^ ((v >> 12) & 0x3) ^ 0xa) & 0xf;
}

function decodeAssignmentCodeBits(bits) {
  if (!Array.isArray(bits) || bits.length !== 18) {
    return { valid: false, id14: 0, checksum: 0, expectedChecksum: computeCodeChecksum(0) };
  }
  let id14 = 0;
  for (let i = 0; i < 14; i += 1) id14 = (id14 << 1) | (bits[i] ? 1 : 0);
  let checksum = 0;
  for (let i = 14; i < 18; i += 1) checksum = (checksum << 1) | (bits[i] ? 1 : 0);
  const expectedChecksum = computeCodeChecksum(id14);
  return { valid: checksum === expectedChecksum && id14 > 0, id14, checksum, expectedChecksum };
}

/**
 * Calcula el rectángulo del marco guía en coordenadas de la imagen cruda de video,
 * compensando el recorte de `object-fit: cover` en el visor.
 */
export function computeCoverGuideRect(
  imageWidth,
  imageHeight,
  viewportWidth,
  viewportHeight,
  aspectRatio = DEFAULT_ASPECT,
  guideScale = 0.84,
) {
  if (!(imageWidth > 0 && imageHeight > 0 && viewportWidth > 0 && viewportHeight > 0)) return null;
  const scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);
  const dispW = imageWidth * scale;
  const dispH = imageHeight * scale;
  const cropX = (dispW - viewportWidth) / 2;
  const cropY = (dispH - viewportHeight) / 2;

  const maxW = viewportWidth * guideScale;
  const maxH = viewportHeight * guideScale;
  const guideW = maxW / maxH > aspectRatio ? maxH * aspectRatio : maxW;
  const guideH = maxW / maxH > aspectRatio ? maxH : maxW / aspectRatio;
  const gx = (viewportWidth - guideW) / 2;
  const gy = (viewportHeight - guideH) / 2;

  const x = clamp((gx + cropX) / scale, 0, imageWidth);
  const y = clamp((gy + cropY) / scale, 0, imageHeight);
  const right = clamp((gx + guideW + cropX) / scale, 0, imageWidth);
  const bottom = clamp((gy + guideH + cropY) / scale, 0, imageHeight);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Calcula la homografía proyectiva H que mapea `(0,0),(1,0),(1,1),(0,1)` hacia `[tl, tr, br, bl]`.
 */
export function computeHomography(dstCorners) {
  const src = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const [u, v] = src[i];
    const { x, y } = dstCorners[i];
    A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
    b.push(y);
  }

  // Eliminación gaussiana con pivoteo parcial
  for (let col = 0; col < 8; col += 1) {
    let pivotRow = col;
    let best = Math.abs(A[col][col]);
    for (let r = col + 1; r < 8; r += 1) {
      const val = Math.abs(A[r][col]);
      if (val > best) {
        best = val;
        pivotRow = r;
      }
    }
    if (best < 1e-9) return null;
    if (pivotRow !== col) {
      [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }
    const diag = A[col][col];
    for (let r = col + 1; r < 8; r += 1) {
      const factor = A[r][col] / diag;
      if (factor === 0) continue;
      for (let c = col; c < 8; c += 1) A[r][c] -= factor * A[col][c];
      b[r] -= factor * b[col];
    }
  }

  const h = new Float64Array(9);
  h[8] = 1;
  for (let r = 7; r >= 0; r -= 1) {
    let sum = b[r];
    for (let c = r + 1; c < 8; c += 1) sum -= A[r][c] * h[c];
    h[r] = sum / A[r][r];
  }
  return h;
}

export function applyHomography(H, u, v) {
  const w = H[6] * u + H[7] * v + H[8];
  if (Math.abs(w) < 1e-9) return { x: 0, y: 0 };
  return {
    x: (H[0] * u + H[1] * v + H[2]) / w,
    y: (H[3] * u + H[4] * v + H[5]) / w,
  };
}

export function toGrayscale(rgba, width, height) {
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
  }
  return gray;
}

function sampleGrayBilinear(gray, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    const ix = clamp(Math.round(x), 0, width - 1);
    const iy = clamp(Math.round(y), 0, height - 1);
    return gray[iy * width + ix];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const idx = y0 * width + x0;
  const a = gray[idx];
  const b = gray[idx + 1];
  const c = gray[idx + width];
  const d = gray[idx + width + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function findCornerMarkerInRoi(gray, imgW, imgH, roi, expectedSide) {
  const x0 = clamp(Math.floor(roi.x), 0, imgW - 1);
  const y0 = clamp(Math.floor(roi.y), 0, imgH - 1);
  const x1 = clamp(Math.ceil(roi.x + roi.width), x0 + 1, imgW);
  const y1 = clamp(Math.ceil(roi.y + roi.height), y0 + 1, imgH);
  const rw = x1 - x0;
  const rh = y1 - y0;

  const hist = new Int32Array(256);
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    const rowOff = y * imgW;
    for (let x = x0; x < x1; x += 1) {
      hist[gray[rowOff + x]] += 1;
      total += 1;
    }
  }
  if (total === 0) return { marker: null, lowContrast: true };

  let acc = 0;
  let p02 = 0;
  let p90 = 255;
  const target02 = total * 0.02;
  const target90 = total * 0.90;
  let found02 = false;
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i];
    if (!found02 && acc >= target02) {
      p02 = i;
      found02 = true;
    }
    if (acc >= target90) {
      p90 = i;
      break;
    }
  }

  const contrast = p90 - p02;
  if (contrast < MIN_FIDUCIAL_CONTRAST) {
    return { marker: null, lowContrast: true };
  }

  const thr = p02 + contrast * 0.42;
  const visited = new Uint8Array(rw * rh);
  const queue = new Int32Array(rw * rh);
  const minSide = Math.max(5, expectedSide * 0.4);
  const maxSide = Math.max(minSide + 4, expectedSide * 2.1);

  let bestCandidate = null;

  for (let ly = 0; ly < rh; ly += 1) {
    const imgY = y0 + ly;
    const imgRow = imgY * imgW;
    for (let lx = 0; lx < rw; lx += 1) {
      const lIdx = ly * rw + lx;
      if (visited[lIdx] || gray[imgRow + x0 + lx] > thr) continue;

      let head = 0;
      let tail = 0;
      queue[tail++] = lIdx;
      visited[lIdx] = 1;

      let minX = x0 + lx;
      let maxX = minX;
      let minY = imgY;
      let maxY = imgY;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let sumW = 0;

      while (head < tail) {
        const cur = queue[head++];
        const cyLocal = Math.floor(cur / rw);
        const cxLocal = cur - cyLocal * rw;
        const cx = x0 + cxLocal;
        const cy = y0 + cyLocal;
        const lum = gray[cy * imgW + cx];
        const w = Math.max(1, thr - lum + 4);

        area += 1;
        sumX += cx * w;
        sumY += cy * w;
        sumW += w;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        if (cxLocal > 0) {
          const n = cur - 1;
          if (!visited[n] && gray[cy * imgW + (cx - 1)] <= thr) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        if (cxLocal + 1 < rw) {
          const n = cur + 1;
          if (!visited[n] && gray[cy * imgW + (cx + 1)] <= thr) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        if (cyLocal > 0) {
          const n = cur - rw;
          if (!visited[n] && gray[(cy - 1) * imgW + cx] <= thr) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        if (cyLocal + 1 < rh) {
          const n = cur + rw;
          if (!visited[n] && gray[(cy + 1) * imgW + cx] <= thr) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (minX <= 1 || minY <= 1 || maxX >= imgW - 2 || maxY >= imgH - 2) continue;
      if (bw < minSide || bw > maxSide || bh < minSide || bh > maxSide) continue;
      if (Math.max(bw / bh, bh / bw) > 1.65) continue;

      const fillRatio = area / (bw * bh);
      if (fillRatio < 0.55) continue;

      // Verifica anillo blanco alrededor del cuadro (quiet zone)
      const pad = Math.max(3, Math.round(Math.max(bw, bh) * 0.35));
      const rx0 = Math.max(0, minX - pad);
      const ry0 = Math.max(0, minY - pad);
      const rx1 = Math.min(imgW - 1, maxX + pad);
      const ry1 = Math.min(imgH - 1, maxY + pad);
      let ringTotal = 0;
      let ringLight = 0;
      for (let ry = ry0; ry <= ry1; ry += 2) {
        for (let rx = rx0; rx <= rx1; rx += 2) {
          if (rx >= minX - 1 && rx <= maxX + 1 && ry >= minY - 1 && ry <= maxY + 1) continue;
          ringTotal += 1;
          if (gray[ry * imgW + rx] > thr + 12) ringLight += 1;
        }
      }
      if (ringTotal === 0 || ringLight / ringTotal < 0.65) continue;

      const cx = sumX / sumW;
      const cy = sumY / sumW;
      const sizeDiff = Math.abs((bw + bh) / 2 - expectedSide) / expectedSide;
      const distNorm = Math.hypot(cx - roi.targetX, cy - roi.targetY) / Math.max(1, Math.hypot(rw, rh));
      const score = fillRatio * 2 + (ringLight / ringTotal) * 1.5 - sizeDiff * 1.2 - distNorm * 0.8;

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { x: cx, y: cy, bw, bh, score };
      }
    }
  }

  return { marker: bestCandidate, lowContrast: false };
}

export function detectFiducials(gray, width, height, guideRect = null) {
  let rois;
  let expectedSide;

  if (guideRect && guideRect.width > 40 && guideRect.height > 40) {
    const padX = Math.max(36, guideRect.width * 0.25);
    const padY = Math.max(36, guideRect.height * 0.2);
    expectedSide = (24 / 516) * guideRect.width;
    const gx = guideRect.x;
    const gy = guideRect.y;
    const gw = guideRect.width;
    const gh = guideRect.height;
    rois = {
      tl: { x: gx - padX, y: gy - padY, width: padX * 2, height: padY * 2, targetX: gx, targetY: gy },
      tr: { x: gx + gw - padX, y: gy - padY, width: padX * 2, height: padY * 2, targetX: gx + gw, targetY: gy },
      br: { x: gx + gw - padX, y: gy + gh - padY, width: padX * 2, height: padY * 2, targetX: gx + gw, targetY: gy + gh },
      bl: { x: gx - padX, y: gy + gh - padY, width: padX * 2, height: padY * 2, targetX: gx, targetY: gy + gh },
    };
  } else {
    expectedSide = Math.max(10, (24 / 612) * Math.min(width, height * DEFAULT_ASPECT));
    const qw = width * 0.46;
    const qh = height * 0.42;
    rois = {
      tl: { x: 0, y: 0, width: qw, height: qh, targetX: width * 0.08, targetY: height * 0.06 },
      tr: { x: width - qw, y: 0, width: qw, height: qh, targetX: width * 0.92, targetY: height * 0.06 },
      br: { x: width - qw, y: height - qh, width: qw, height: qh, targetX: width * 0.92, targetY: height * 0.94 },
      bl: { x: 0, y: height - qh, width: qw, height: qh, targetX: width * 0.08, targetY: height * 0.94 },
    };
  }

  const results = {};
  let lowContrastCount = 0;
  for (const key of ['tl', 'tr', 'br', 'bl']) {
    const found = findCornerMarkerInRoi(gray, width, height, rois[key], expectedSide);
    if (found.lowContrast) lowContrastCount += 1;
    results[key] = found.marker;
  }

  if (lowContrastCount >= 2 && (!results.tl || !results.tr || !results.br || !results.bl)) {
    return {
      ok: false,
      reason: 'LOW_LIGHT',
      message: 'Hay muy poca luz o contraste. Busca un lugar más iluminado y vuelve a escanear.',
    };
  }

  if (!results.tl || !results.tr || !results.br || !results.bl) {
    return {
      ok: false,
      reason: 'FIDUCIALS_NOT_FOUND',
      message: 'No encontramos los 4 cuadros negros de las esquinas. Acerca la hoja al marco y evita tapar las esquinas.',
    };
  }

  return { ok: true, corners: results };
}

export function validateSheetGeometry(corners, layout) {
  const { tl, tr, br, bl } = corners;
  const pts = [tl, tr, br, bl];
  for (let i = 0; i < 4; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross <= 0) {
      return {
        ok: false,
        reason: 'SHEET_TILTED',
        message: 'La hoja está muy inclinada o fuera del marco. Acerca la hoja al marco y alinea los 4 cuadros negros.',
      };
    }
  }

  const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
  const topLen = dist(tl, tr);
  const bottomLen = dist(bl, br);
  const leftLen = dist(tl, bl);
  const rightLen = dist(tr, br);

  if (Math.min(topLen, bottomLen, leftLen, rightLen) < 120) {
    return {
      ok: false,
      reason: 'SHEET_TILTED',
      message: 'La hoja se ve muy lejos o pequeña. Acerca la hoja al marco.',
    };
  }

  const deg = (rad) => Math.abs((rad * 180) / Math.PI);
  const topAngle = deg(Math.atan2(tr.y - tl.y, tr.x - tl.x));
  const bottomAngle = deg(Math.atan2(br.y - bl.y, br.x - bl.x));
  const leftAngle = deg(Math.atan2(bl.x - tl.x, bl.y - tl.y));
  const rightAngle = deg(Math.atan2(br.x - tr.x, br.y - tr.y));

  if (Math.max(topAngle, bottomAngle, leftAngle, rightAngle) > MAX_ROTATION_DEG) {
    return {
      ok: false,
      reason: 'SHEET_TILTED',
      message: 'La hoja está muy inclinada. Acerca la hoja al marco y endereza la cámara.',
    };
  }

  const horizSkew = Math.max(topLen / bottomLen, bottomLen / topLen);
  const vertSkew = Math.max(leftLen / rightLen, rightLen / leftLen);
  if (horizSkew > MAX_PERSPECTIVE_SKEW || vertSkew > MAX_PERSPECTIVE_SKEW) {
    return {
      ok: false,
      reason: 'SHEET_TILTED',
      message: 'La cámara está muy de lado. Coloca el celular paralelo sobre la hoja y acércala al marco.',
    };
  }

  const frame = layout?.fiducials?.frame ?? { width: 516, height: 696 };
  const expectedAspect = frame.width / frame.height;
  const measuredAspect = ((topLen + bottomLen) / 2) / ((leftLen + rightLen) / 2);
  if (Math.abs(measuredAspect - expectedAspect) / expectedAspect > MAX_ASPECT_DRIFT) {
    return {
      ok: false,
      reason: 'SHEET_TILTED',
      message: 'No pudimos cuadrar la proporción de la hoja. Acerca la hoja al marco.',
    };
  }

  return { ok: true };
}

function sampleRectMean(gray, width, height, H, cell) {
  let sum = 0;
  let count = 0;
  const halfU = cell.sizeU * 0.34;
  const halfV = cell.sizeV * 0.34;
  for (let iy = -2; iy <= 2; iy += 1) {
    const v = cell.v + (iy / 2) * halfV;
    for (let ix = -2; ix <= 2; ix += 1) {
      const u = cell.u + (ix / 2) * halfU;
      const pt = applyHomography(H, u, v);
      sum += sampleGrayBilinear(gray, width, height, pt.x, pt.y);
      count += 1;
    }
  }
  return sum / count;
}

function scoreBubble(gray, width, height, H, bubble, lumBlack) {
  let innerSum = 0;
  let innerCount = 0;
  for (let iy = -2; iy <= 2; iy += 1) {
    for (let ix = -2; ix <= 2; ix += 1) {
      const du = ix / 2;
      const dv = iy / 2;
      if (du * du + dv * dv > 1.05) continue;
      const pt = applyHomography(H, bubble.u + du * bubble.ru * 0.65, bubble.v + dv * bubble.rv * 0.65);
      innerSum += sampleGrayBilinear(gray, width, height, pt.x, pt.y);
      innerCount += 1;
    }
  }
  const innerMean = innerSum / innerCount;

  const ringSamples = [];
  for (let k = 0; k < 16; k += 1) {
    const angle = (k / 16) * Math.PI * 2;
    const rad = k % 2 === 0 ? 1.42 : 1.56;
    const pt = applyHomography(
      H,
      bubble.u + Math.cos(angle) * bubble.ru * rad,
      bubble.v + Math.sin(angle) * bubble.rv * rad,
    );
    ringSamples.push(sampleGrayBilinear(gray, width, height, pt.x, pt.y));
  }
  ringSamples.sort((a, b) => a - b);
  const localWhite = ringSamples[Math.floor(ringSamples.length * 0.75)];
  const denom = Math.max(40, localWhite - lumBlack);
  const score = clamp((localWhite - innerMean) / denom, 0, 1);
  return { score, localWhite, innerMean };
}

const PAPER_CORNER_PROBES = [
  { u: 0.12, v: 0.1724 },
  { u: 0.88, v: 0.1724 },
  { u: 0.12, v: 0.9296 },
  { u: 0.88, v: 0.9296 },
];

function checkPaperProbesUniformity(gray, width, height, H, lumBlack) {
  const samples = PAPER_CORNER_PROBES.map(({ u, v }) => {
    const pt = applyHomography(H, u, v);
    return sampleGrayBilinear(gray, width, height, pt.x, pt.y);
  });
  const minP = Math.min(...samples);
  const maxP = Math.max(...samples);
  if (minP - lumBlack < MIN_QUADRANT_RANGE || maxP - minP > MAX_SHADOW_DELTA) {
    return {
      ok: false,
      reason: 'SHADOW_DETECTED',
      message: 'Detectamos sombra fuerte sobre una parte de la hoja. Ilumina de forma pareja y vuelve a escanear.',
    };
  }
  return { ok: true };
}

function checkShadowUniformity(bubbleMeasurements, lumBlack) {
  if (bubbleMeasurements.length < 4) return { ok: true };
  const quadrants = [[], [], [], []];
  for (const m of bubbleMeasurements) {
    const qx = m.u < 0.5 ? 0 : 1;
    const qy = m.v < 0.56 ? 0 : 1;
    quadrants[qy * 2 + qx].push(m.localWhite);
  }
  const medians = quadrants
    .filter((arr) => arr.length > 0)
    .map((arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    });
  if (medians.length === 0) return { ok: true };

  const minQ = Math.min(...medians);
  const maxQ = Math.max(...medians);
  if (minQ - lumBlack < MIN_QUADRANT_RANGE || maxQ - minQ > MAX_SHADOW_DELTA) {
    return {
      ok: false,
      reason: 'SHADOW_DETECTED',
      message: 'Detectamos sombra fuerte sobre una parte de la hoja. Ilumina de forma pareja y vuelve a escanear.',
    };
  }
  return { ok: true };
}

function classifyQuestionBubbles(scoredOptions) {
  const sorted = [...scoredOptions].sort((a, b) => b.score - a.score);
  const top1 = sorted[0];
  const top2 = sorted[1] ?? { score: 0 };

  const doubtfulMarks = sorted.filter((o) => o.score >= DOUBTFUL_THRESHOLD);
  if (top1.score < DOUBTFUL_THRESHOLD) {
    return { selectedOptionId: null, status: 'blank', uncertain: false, reason: '' };
  }

  if (doubtfulMarks.length >= 2 && (top2.score >= FILLED_THRESHOLD * 0.82 || top1.score - top2.score < CLEAR_MARGIN)) {
    const labels = doubtfulMarks.map((o) => o.label).join(', ');
    return {
      selectedOptionId: null,
      status: 'multiple',
      uncertain: true,
      reason: `Varias marcas (${labels})`,
    };
  }

  if (top1.score < FILLED_THRESHOLD) {
    return {
      selectedOptionId: top1.optionId,
      status: 'faint',
      uncertain: true,
      reason: `Marca tenue en ${top1.label}`,
    };
  }

  return { selectedOptionId: top1.optionId, status: 'selected', uncertain: false, reason: '' };
}

/**
 * Escanea un cuadro RGBA (`ImageData` o `{ data, width, height }`) contra un `OmrLayout`.
 * No realiza llamadas de red ni guarda imágenes.
 */
export function scanOmrImage(imageData, layout, { guideRect = null } = {}) {
  if (!imageData?.data || !(imageData.width > 0 && imageData.height > 0) || !layout?.questions) {
    return {
      ok: false,
      reason: 'INVALID_INPUT',
      message: 'No pudimos leer la imagen de la cámara. Intenta de nuevo.',
    };
  }

  const { width, height, data } = imageData;
  const gray = toGrayscale(data, width, height);

  const fiducials = detectFiducials(gray, width, height, guideRect);
  if (!fiducials.ok) return fiducials;

  const geometry = validateSheetGeometry(fiducials.corners, layout);
  if (!geometry.ok) return geometry;

  const { tl, tr, br, bl } = fiducials.corners;
  const H = computeHomography([tl, tr, br, bl]);
  if (!H) {
    return {
      ok: false,
      reason: 'SHEET_TILTED',
      message: 'La hoja está muy inclinada o fuera del marco. Acerca la hoja al marco.',
    };
  }

  const lumBlack = sampleRectMean(gray, width, height, H, layout.codeStrip.blackRef);
  const lumWhite = sampleRectMean(gray, width, height, H, layout.codeStrip.whiteRef);
  if (lumWhite - lumBlack < MIN_REF_CONTRAST) {
    return {
      ok: false,
      reason: 'LOW_CONTRAST',
      message: 'La imagen tiene muy poco contraste. Mejora la iluminación e intenta de nuevo.',
    };
  }

  const probeShadow = checkPaperProbesUniformity(gray, width, height, H, lumBlack);
  if (!probeShadow.ok) return probeShadow;

  const stripMid = (lumBlack + lumWhite) / 2;
  const bits = layout.codeStrip.bits.map((cell) => (sampleRectMean(gray, width, height, H, cell) < stripMid ? 1 : 0));
  const decoded = decodeAssignmentCodeBits(bits);

  if (decoded.valid && decoded.id14 !== layout.codeStrip.expectedId14) {
    const detectedCode = `P-${decoded.id14}`;
    return {
      ok: false,
      reason: 'WRONG_ASSIGNMENT',
      detectedCode,
      expectedCode: layout.code,
      message: `Esta hoja es de otra prueba (${detectedCode}). Se esperaba ${layout.code}.`,
    };
  }
  if (!decoded.valid) {
    return {
      ok: false,
      reason: 'ALIGNMENT_UNCERTAIN',
      message: 'No pudimos confirmar el código de la prueba. Acerca la hoja al marco con buena luz e intenta de nuevo.',
    };
  }

  const bubbleMeasurements = [];
  const questionScores = layout.questions.map((question) => {
    const options = question.options.map((opt) => {
      const measured = scoreBubble(gray, width, height, H, opt, lumBlack);
      bubbleMeasurements.push({ u: opt.u, v: opt.v, localWhite: measured.localWhite });
      return { optionId: opt.optionId, label: opt.label, score: measured.score };
    });
    return { questionId: question.questionId, position: question.position, options };
  });

  const supportMeasured = scoreBubble(gray, width, height, H, layout.supportBubble, lumBlack);
  bubbleMeasurements.push({
    u: layout.supportBubble.u,
    v: layout.supportBubble.v,
    localWhite: supportMeasured.localWhite,
  });

  const shadowCheck = checkShadowUniformity(bubbleMeasurements, lumBlack);
  if (!shadowCheck.ok) return shadowCheck;

  const answers = {};
  const uncertainQuestions = {};
  const questionDetails = {};
  let answeredCount = 0;

  for (const q of questionScores) {
    const classified = classifyQuestionBubbles(q.options);
    answers[q.questionId] = classified.selectedOptionId;
    if (classified.selectedOptionId != null) answeredCount += 1;
    if (classified.uncertain) {
      uncertainQuestions[q.questionId] = { status: classified.status, reason: classified.reason };
    }
    questionDetails[q.questionId] = {
      position: q.position,
      ...classified,
      options: q.options,
    };
  }

  const supportUsed = supportMeasured.score >= DOUBTFUL_THRESHOLD;
  const supportUncertain = supportMeasured.score >= DOUBTFUL_THRESHOLD && supportMeasured.score < FILLED_THRESHOLD;

  return {
    ok: true,
    code: layout.code,
    answers,
    supportUsed,
    supportUncertain,
    uncertainQuestions,
    questionDetails,
    answeredCount,
    uncertainCount: Object.keys(uncertainQuestions).length + (supportUncertain ? 1 : 0),
  };
}
