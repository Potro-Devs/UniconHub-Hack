import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { STUDENTS } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';

const GRADES = ['1.º', '2.º', '3.º', '4.º', '5.º', '6.º'];
const SECTIONS = ['A', 'B', 'C', 'D'];

/**
 * Pantalla 10: Alta de grupo y pegado masivo de lista de alumnos.
 */
export function CreateGroupScreen() {
  const navigate = useNavigate();
  const { ngGrade, setNgGrade, ngGroup, setNgGroup, ngList, setNgList, say } = useAppUi();

  const pickStyle = (active) =>
    active
      ? { background: COLORS.ink, color: '#fff', borderColor: COLORS.ink }
      : { background: '#fff', color: COLORS.ink, borderColor: COLORS.border };

  const parsed = ngList
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);

  const ngTemario =
    ngGrade === '3.º'
      ? 'Fase 4 · Saberes y pensamiento científico'
      : 'Disponible en roadmap (MVP: solo 3.º)';

  const handleCreate = () => {
    say(`Grupo ${ngGrade} ${ngGroup} creado con ${parsed.length} alumnos. Ahora marca en qué van.`);
    navigate('/docente/temario');
  };

  return (
    <div style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <button
        type="button"
        onClick={() => navigate('/docente/grupos')}
        style={{
          alignSelf: 'flex-start',
          border: 0,
          background: 'none',
          padding: 0,
          fontSize: '14px',
          fontWeight: 700,
          color: COLORS.primaryText,
          cursor: 'pointer',
        }}
      >
        ← Grupos
      </button>

      <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '30px', lineHeight: 1.1 }}>
        Crear grupo
      </h1>

      <div
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '22px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Grado</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setNgGrade(g)}
                style={{
                  minWidth: '56px',
                  height: '44px',
                  borderRadius: '12px',
                  border: '2px solid',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...pickStyle(ngGrade === g),
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Grupo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SECTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setNgGroup(g)}
                style={{
                  minWidth: '56px',
                  height: '44px',
                  borderRadius: '12px',
                  border: '2px solid',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...pickStyle(ngGroup === g),
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 32px', fontSize: '14px' }}>
          <div>
            <div style={{ color: COLORS.muted }}>Ciclo escolar</div>
            <div style={{ fontWeight: 700, marginTop: '2px' }}>2026–2027</div>
          </div>
          <div>
            <div style={{ color: COLORS.muted }}>Temario que se carga</div>
            <div style={{ fontWeight: 700, marginTop: '2px' }}>{ngTemario}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '22px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Alumnos</div>
          <button
            type="button"
            onClick={() => setNgList(STUDENTS.slice(0, 38).map((s) => s.name).join('\n'))}
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
            Pegar lista de ejemplo
          </button>
        </div>

        <div style={{ fontSize: '14px', color: COLORS.muted }}>
          Pega la lista de tu control escolar, un nombre por renglón.
        </div>

        <textarea
          value={ngList}
          onChange={(e) => setNgList(e.target.value)}
          placeholder={'Sofía Ramírez\nMateo Hernández\n…'}
          style={{
            minHeight: '150px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.borderInput}`,
            padding: '12px 14px',
            fontSize: '15px',
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <b style={{ fontSize: '14px', marginRight: '4px' }}>{parsed.length} alumnos</b>
          {parsed.slice(0, 10).map((name, idx) => (
            <span
              key={`${name}-${idx}`}
              style={{
                padding: '5px 10px',
                borderRadius: '999px',
                background: COLORS.bg,
                fontSize: '13px',
              }}
            >
              {name}
            </span>
          ))}
          {parsed.length > 10 && (
            <span style={{ fontSize: '13px', color: COLORS.muted }}>
              y {parsed.length - 10} más
            </span>
          )}
        </div>

        <div style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.4 }}>
          Solo el nombre. No pidas CURP: el sistema crea un folio interno para unir su historial.
        </div>
      </div>

      <button
        type="button"
        onClick={handleCreate}
        style={{
          alignSelf: 'flex-start',
          height: '54px',
          padding: '0 24px',
          borderRadius: '16px',
          border: 0,
          background: COLORS.primary,
          color: '#fff',
          fontSize: '17px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Crear {ngGrade} {ngGroup} y ver su temario
      </button>
    </div>
  );
}
