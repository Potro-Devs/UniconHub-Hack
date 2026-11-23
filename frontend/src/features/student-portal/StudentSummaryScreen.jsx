import { useNavigate } from 'react-router-dom';
import { COLORS, LEVELS, getLevelIndex } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { SKILLS, STUDENTS } from '@/shared/data/seedData';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { getStudentSkillSummaries, pickFirstName } from './studentPortalStats';

/**
 * Pantalla 11: Resumen final del alumno comparado consigo mismo.
 */
export function StudentSummaryScreen() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { axiColor, stuIdx, hintsUsed, activeQuizId, completedQuizzes } = useAppUi();
  const { session } = useSession();

  const stu = STUDENTS[stuIdx ?? 0];
  const firstName = pickFirstName(session?.student?.displayName, stu.first);
  const latestQuizResult = completedQuizzes[activeQuizId] ?? null;

  const effortMsg = hintsUsed
    ? `Pediste ${hintsUsed} ${hintsUsed > 1 ? 'pistas' : 'pista'} y seguiste intentando.`
    : 'Lo pensaste con calma, paso a paso.';

  const makeProgRow = (name, a, b, note) => {
    const f = LEVELS[getLevelIndex(a)];
    const t = LEVELS[getLevelIndex(b)];
    return {
      name,
      from: f.label,
      fromBg: f.bg,
      fromFg: f.fg,
      to: t.label,
      toBg: t.bg,
      toFg: t.fg,
      note,
    };
  };

  const skillSummaries = getStudentSkillSummaries(stuIdx, completedQuizzes);
  const focusSkillIds = [
    latestQuizResult?.skillId ?? 'fractions',
    'problem_solving',
    'place_value',
  ].filter((id, idx, arr) => arr.indexOf(id) === idx);

  const stuProg = focusSkillIds.map((id) => {
    const summary = skillSummaries.find((s) => s.id === id);
    const skillName = SKILLS.find((x) => x.id === id)?.name ?? summary?.name ?? id;
    const a = summary?.initialPct ?? stu.prev?.[id] ?? 36;
    const b = summary?.currentPct ?? stu.sc?.[id] ?? 44;
    const note =
      getLevelIndex(b) > getLevelIndex(a)
        ? 'Subiste respecto a tu nivel anterior.'
        : b > a
          ? `Mejoraste respecto a tu inicio: +${b - a} puntos.`
          : 'Esta habilidad todavía se está formando. Probemos con una pista la próxima vez.';
    return makeProgRow(skillName, a, b, note);
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '18px',
        textAlign: 'center',
        padding: '10px 0',
      }}
    >
      <Mascot size={150} color={axiColor} animate={!reducedMotion} />

      <h1 className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '34px', lineHeight: 1.1 }}>
        ¡Listo por hoy, {firstName}!
      </h1>

      <div style={{ fontSize: '18px' }}>{effortMsg}</div>

      {latestQuizResult && (
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            background: '#fff',
            borderRadius: '22px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            textAlign: 'left',
          }}
        >
          <div className="font-display" style={{ fontWeight: 700, fontSize: '18px' }}>
            {latestQuizResult.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                background: COLORS.primarySoftBg,
                color: COLORS.primarySoftFg,
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              {latestQuizResult.autonomousCount} de {latestQuizResult.totalCount} autónomos ({latestQuizResult.autonomousPct}%)
            </span>
            {latestQuizResult.withSupportCount > 0 && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: LEVELS[1].bg,
                  color: LEVELS[1].fg,
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {latestQuizResult.withSupportCount}{' '}
                {latestQuizResult.withSupportCount === 1 ? 'logrado con apoyo' : 'logrados con apoyo'}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#fff',
          borderRadius: '26px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          textAlign: 'left',
        }}
      >
        <div className="font-display" style={{ fontWeight: 700, fontSize: '20px', lineHeight: 1.2, marginBottom: '6px' }}>
          Tu avance (comparado contigo)
        </div>

        {stuProg.map((p) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 0',
              borderTop: '1px solid #EEF1F6',
            }}
          >
            <div style={{ flex: '1 1 150px', fontSize: '17px', fontWeight: 700 }}>{p.name}</div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 700,
                background: p.fromBg,
                color: p.fromFg,
              }}
            >
              {p.from}
            </span>
            <span>→</span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 700,
                background: p.toBg,
                color: p.toFg,
              }}
            >
              {p.to}
            </span>
            <div style={{ flexBasis: '100%', fontSize: '14px', color: '#3A4565' }}>{p.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => navigate('/alumno/logros')}
          style={{
            height: '60px',
            padding: '0 28px',
            borderRadius: '20px',
            border: `3px solid ${COLORS.ink}`,
            background: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          Ver mis logros
        </button>

        <button
          type="button"
          onClick={() => navigate('/alumno/inicio')}
          style={{
            height: '60px',
            padding: '0 32px',
            borderRadius: '20px',
            border: 0,
            background: COLORS.ink,
            color: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 5px 0 oklch(0.4 0.05 260)',
          }}
        >
          Volver a inicio
        </button>
      </div>
    </div>
  );
}
