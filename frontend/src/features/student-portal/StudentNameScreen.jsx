import { useNavigate } from 'react-router-dom';
import { STUDENT_AVATAR_HUES } from '@/config/brand';
import { STUDENTS } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 09b: Selección visual del alumno dentro de su grupo sin contraseña.
 */
export function StudentNameScreen() {
  const navigate = useNavigate();
  const { resetStudentSession } = useAppUi();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '32px', lineHeight: 1.1 }}>
          ¿Cuál es tu nombre?
        </h1>
        <div style={{ fontSize: '17px', marginTop: '4px' }}>Grupo 3.º A · toca tu nombre</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
        }}
      >
        {STUDENTS.map((st, idx) => (
          <button
            key={st.i}
            type="button"
            className="axi-student-card"
            onClick={() => {
              resetStudentSession(st.i);
              navigate('/alumno/ejercicio');
            }}
            style={{
              minHeight: '64px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '18px',
              border: 0,
              background: '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '17px',
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: '38px',
                height: '38px',
                flex: 'none',
                borderRadius: '50%',
                background: STUDENT_AVATAR_HUES[idx % STUDENT_AVATAR_HUES.length],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
            >
              {st.ini}
            </span>
            {st.short}
          </button>
        ))}
      </div>
    </div>
  );
}
