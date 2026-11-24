import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { FRACTION_SHEET, STUDENTS } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 05: Captura rápida móvil alumno por alumno del modo papel.
 */
export function QuickCaptureScreen() {
  const navigate = useNavigate();
  const {
    capIdx,
    setCapIdx,
    capAnswers,
    setCapAnswers,
    absent,
    setAbsent,
    fillDemoCapture,
    saveCaptureResults,
  } = useAppUi();

  const cur = STUDENTS[capIdx];
  const ans = capAnswers[cur.i] || Array(10).fill(null);

  const setAns = (qIdx, optIdx) => {
    setCapAnswers((prev) => {
      const nextArr = [...(prev[cur.i] || Array(10).fill(null))];
      nextArr[qIdx] = nextArr[qIdx] === optIdx ? null : optIdx;
      return { ...prev, [cur.i]: nextArr };
    });
  };

  const isDone = (st) =>
    Boolean(absent[st.i]) || (capAnswers[st.i] || []).filter((x) => x != null).length === 10;

  const capDone = STUDENTS.filter(isDone).length;

  const handleSave = () => {
    saveCaptureResults();
    navigate('/docente/mapa');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '28px', lineHeight: 1.1 }}>
          Captura de hojas
        </h1>
        <div style={{ fontSize: '14px', color: COLORS.muted, marginTop: '4px' }}>
          Fracciones · prueba 1 · toca la opción que marcó cada alumno
        </div>
      </div>

      {/* Progreso y tira de alumnos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', gap: '8px', flexWrap: 'wrap' }}>
          <b>{capDone} de 45 capturadas</b>
          <button
            type="button"
            onClick={fillDemoCapture}
            style={{
              border: 0,
              background: 'none',
              padding: 0,
              fontSize: '13px',
              fontWeight: 700,
              color: COLORS.primaryText,
              cursor: 'pointer',
            }}
          >
            Completar con datos de ejemplo
          </button>
        </div>

        <div style={{ height: '8px', borderRadius: '999px', background: '#E6EBF3', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round((capDone / 45) * 100)}%`,
              background: COLORS.primaryAccent,
              borderRadius: '999px',
            }}
          />
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '16px', fontWeight: 700 }}>
          Alumno a capturar
          <select value={capIdx} onChange={(event) => setCapIdx(Number(event.target.value))} style={{ width: '100%', minHeight: '52px', padding: '10px 14px', borderRadius: '14px', border: `1px solid ${COLORS.borderInput}`, background: '#fff', fontSize: '16px' }}>
            {STUDENTS.map((student) => <option key={student.i} value={student.i}>{student.i + 1}. {student.name} · {isDone(student) ? 'Captura completa' : 'Pendiente'}</option>)}
          </select>
        </label>
      </div>
      {/* Tarjeta de captura alumno actual */}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '22px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 16px',
            borderBottom: `1px solid ${COLORS.border}`,
            background: '#F8FAFD',
          }}
        >
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => setCapIdx((prev) => (prev + 44) % 45)}
            style={{
              width: '44px',
              height: '44px',
              flex: 'none',
              borderRadius: '12px',
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            ←
          </button>

          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: COLORS.muted }}>Alumno {capIdx + 1} de 45</div>
            <div
              className="font-display"
              style={{
                fontWeight: 700,
                fontSize: '20px',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cur.name}
            </div>
          </div>

          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => setCapIdx((prev) => (prev + 1) % 45)}
            style={{
              width: '44px',
              height: '44px',
              flex: 'none',
              borderRadius: '12px',
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            →
          </button>
        </div>

        {absent[cur.i] ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '15px', color: COLORS.muted }}>
            Marcado como “Faltó hoy”. Podrá presentar la prueba después.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FRACTION_SHEET.map((_, qIdx) => (
              <div
                key={qIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderBottom: '1px solid #EEF1F6',
                }}
              >
                <div style={{ width: '30px', fontSize: '15px', fontWeight: 700, color: COLORS.muted, textAlign: 'center' }}>
                  {qIdx + 1}
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(44px, 1fr))', gap: '6px' }}>
                  {[0, 1, 2, 3].map((optIdx) => {
                    const selected = ans[qIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => setAns(qIdx, optIdx)}
                        style={{
                          height: '44px',
                          borderRadius: '12px',
                          border: `2px solid ${selected ? COLORS.ink : COLORS.border}`,
                          background: selected ? COLORS.ink : '#fff',
                          color: selected ? '#fff' : COLORS.ink,
                          fontSize: '16px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {'ABCD'[optIdx]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', padding: '12px' }}>
          <button
            type="button"
            onClick={() => setAbsent((prev) => ({ ...prev, [cur.i]: !prev[cur.i] }))}
            style={{
              flex: 1,
              height: '48px',
              borderRadius: '14px',
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {absent[cur.i] ? 'Sí vino' : 'Faltó hoy'}
          </button>

          <button
            type="button"
            onClick={() => setCapIdx((prev) => (prev + 1) % 45)}
            style={{
              flex: 1.4,
              height: '48px',
              borderRadius: '14px',
              border: 0,
              background: COLORS.ink,
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Siguiente alumno
          </button>
        </div>
      </div>

      <button
        type="button"
        className="axi-btn-primary"
        onClick={handleSave}
        style={{
          height: '54px',
          borderRadius: '16px',
          border: 0,
          background: COLORS.primary,
          color: '#fff',
          fontSize: '17px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Guardar y ver mapa del grupo
      </button>
    </div>
  );
}
