import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getLevelIndex } from '@/config/brand';
import {
  CURRICULUM_CONTENTS,
  FRACTION_SHEET,
  SKILLS,
  STUDENTS,
} from '@/shared/data/seedData';

const AppUiContext = createContext(null);

export const mean = (arr) =>
  arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : null;

/**
 * Estado local compartido en memoria con datos semilla para navegar entre
 * todas las ventanas modulares del sistema sin backend conectado.
 */
export function AppUiProvider({ children }) {
  const [loginEmail, setLoginEmail] = useState('elena.torres@escuela.mx');
  const [loginPass, setLoginPass] = useState('demo1234');
  const [captured, setCaptured] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [reveal, setReveal] = useState(false);

  const [axis, setAxis] = useState('hab');
  const [sort, setSort] = useState('lista');
  const [statuses, setStatuses] = useState({});
  const [selected, setSelected] = useState({ c2: true });
  const [dest, setDest] = useState('grupo');
  const [format, setFormat] = useState('papel');

  const [capIdx, setCapIdx] = useState(0);
  const [capAnswers, setCapAnswers] = useState({});
  const [absent, setAbsent] = useState({});

  const [ngGrade, setNgGrade] = useState('3.º');
  const [ngGroup, setNgGroup] = useState('C');
  const [ngList, setNgList] = useState('');

  const [code, setCode] = useState('3A-7K2');
  const [stuIdx, setStuIdx] = useState(0);
  const [exIdx, setExIdx] = useState(0);
  const [fb, setFb] = useState(null);
  const [tried, setTried] = useState([]);
  const [hint, setHint] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [overlay, setOverlay] = useState(null);
  const [skip, setSkip] = useState(false);
  const [axiColor, setAxiColor] = useState('rosa');
  const [sound, setSound] = useState(false);

  const [promoSel, setPromoSel] = useState({ g3a: true });
  const [promoted, setPromoted] = useState(false);
  const [trCode, setTrCode] = useState('');
  const [trFound, setTrFound] = useState(false);
  const [trDest, setTrDest] = useState('3.º A');

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const revealTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(toastTimerRef.current);
      clearTimeout(revealTimerRef.current);
    };
  }, []);

  const say = (message) => {
    clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  };

  const frOf = (student) => {
    const ans = capAnswers[student.i];
    if (ans && ans.some((x) => x != null)) {
      const answeredCount = ans.filter((x) => x != null).length;
      const correctCount = ans.filter((x, j) => x === FRACTION_SHEET[j].k).length;
      return Math.round((correctCount / answeredCount) * 100);
    }
    return student.sc.fr;
  };

  const scoreOf = (student, skillId) =>
    skillId === 'fr' ? (captured ? frOf(student) : null) : student.sc[skillId];

  const contentScoreOf = (student, content) => {
    const vals = content.sk.map((k) => scoreOf(student, k));
    if (vals.some((x) => x == null)) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const statusOf = (content) => statuses[content.id] || content.st;

  const isEvaluated = (content) =>
    content.sk.length > 0 && (!content.sk.includes('fr') || captured);

  const covN = CURRICULUM_CONTENTS.filter(isEvaluated).length;

  const skillAverages = SKILLS.map((k) => ({
    k,
    avg: mean(STUDENTS.map((s) => scoreOf(s, k.id)).filter((x) => x != null)),
  })).filter((x) => x.avg != null);

  const weakestSkill = skillAverages.reduce((min, item) =>
    item.avg < min.avg ? item : min,
  );

  const needSupportStudents = STUDENTS.filter(
    (s) => getLevelIndex(scoreOf(s, weakestSkill.k.id)) === 0,
  );

  const fillDemoCapture = () => {
    let sd = 5;
    const rr = () => {
      sd = (sd * 16807) % 2147483647;
      return (sd - 1) / 2147483646;
    };
    const nextAnswers = {};
    STUDENTS.forEach((st) => {
      nextAnswers[st.i] = FRACTION_SHEET.map((q) =>
        rr() < st.sc.fr / 100 - 0.07
          ? q.k
          : (q.k + 1 + Math.floor(rr() * 3)) % 4,
      );
    });
    setCapAnswers(nextAnswers);
    setAbsent({});
    say('45 hojas capturadas con datos de ejemplo.');
  };

  const saveCaptureResults = () => {
    clearTimeout(revealTimerRef.current);
    setCaptured(true);
    setAssigned(true);
    setAxis('hab');
    setSort('lista');
    setReveal(true);
    revealTimerRef.current = setTimeout(() => setReveal(false), 3200);
    const doneCount = STUDENTS.filter(
      (st) =>
        absent[st.i] ||
        (capAnswers[st.i] || []).filter((x) => x != null).length === 10,
    ).length;
    say(
      `Resultados guardados · ${doneCount || 45} hojas. El mapa ya incluye Fracciones.`,
    );
  };

  const resetStudentSession = (nextStuIdx = stuIdx) => {
    setStuIdx(nextStuIdx);
    setExIdx(0);
    setFb(null);
    setTried([]);
    setHint(0);
    setHintsUsed(0);
    setOverlay(null);
    setSkip(false);
  };

  const value = {
    loginEmail,
    setLoginEmail,
    loginPass,
    setLoginPass,
    captured,
    setCaptured,
    assigned,
    setAssigned,
    reveal,
    axis,
    setAxis,
    sort,
    setSort,
    statuses,
    setStatuses,
    selected,
    setSelected,
    dest,
    setDest,
    format,
    setFormat,
    capIdx,
    setCapIdx,
    capAnswers,
    setCapAnswers,
    absent,
    setAbsent,
    ngGrade,
    setNgGrade,
    ngGroup,
    setNgGroup,
    ngList,
    setNgList,
    code,
    setCode,
    stuIdx,
    setStuIdx,
    exIdx,
    setExIdx,
    fb,
    setFb,
    tried,
    setTried,
    hint,
    setHint,
    hintsUsed,
    setHintsUsed,
    overlay,
    setOverlay,
    skip,
    setSkip,
    axiColor,
    setAxiColor,
    sound,
    setSound,
    promoSel,
    setPromoSel,
    promoted,
    setPromoted,
    trCode,
    setTrCode,
    trFound,
    setTrFound,
    trDest,
    setTrDest,
    toast,
    say,
    scoreOf,
    contentScoreOf,
    statusOf,
    isEvaluated,
    covN,
    weakestSkill,
    needSupportStudents,
    fillDemoCapture,
    saveCaptureResults,
    resetStudentSession,
  };

  return (
    <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>
  );
}

export function useAppUi() {
  const ctx = useContext(AppUiContext);
  if (!ctx) {
    throw new Error('useAppUi debe utilizarse dentro de AppUiProvider');
  }
  return ctx;
}
