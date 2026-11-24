import { COLORS } from '@/config/brand';
import { Link } from 'react-router-dom';
import { readableTextOn, sortStudents } from './groups.logic';

/**
 * Lista de alumnos inscritos: iniciales sobre su color y nombre completo. Nunca muestra el folio.
 * El perfil conserva el ID real del alumno y el contexto del grupo.
 */
export function StudentList({ students, groupId }) {
  const sorted = sortStudents(students);
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {sorted.map((s) => {
        const bg = s.avatarColor || COLORS.primarySoftBg;
        return (
          <li
            key={s.id}
            style={{
              minHeight: '56px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 4px',
              borderBottom: `1px solid ${COLORS.border}`,
              minWidth: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '40px',
                height: '40px',
                flex: 'none',
                borderRadius: '50%',
                background: bg,
                color: readableTextOn(bg, COLORS.ink, COLORS.onPrimary),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '15px',
              }}
            >
              {s.initials}
            </span>
            {groupId ? <Link to={`/docente/perfil/${s.id}?groupId=${groupId}`} style={{ fontSize: '16px', minWidth: 0, overflowWrap: 'anywhere', minHeight: '44px', display: 'flex', alignItems: 'center' }}>{s.firstNames} {s.lastNames}</Link> : <span style={{ fontSize: '16px', minWidth: 0, overflowWrap: 'anywhere' }}>{s.firstNames} {s.lastNames}</span>}
          </li>
        );
      })}
    </ul>
  );
}
