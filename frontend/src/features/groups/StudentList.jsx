import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import { buttonStyle, inputStyle, mutedText } from '@/shared/styles/ui';
import { groupsApi } from './groups.api';
import { readableTextOn, sortStudents } from './groups.logic';

/**
 * Lista de alumnos inscritos: iniciales sobre su color y nombre completo. Nunca muestra el folio.
 * El perfil conserva el ID real del alumno y el contexto del grupo.
 *
 * Con `canEdit`, cada alumno tiene "Opciones": corregir nombre, dar de baja (conserva el historial)
 * o eliminar un registro hecho por error (solo si no tiene datos; el servidor lo valida).
 */
export function StudentList({ students, groupId, canEdit = false, onUpdated, onRemoved }) {
  const sorted = sortStudents(students);
  const [openId, setOpenId] = useState(null);
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {sorted.map((s) => (
        <StudentRow
          key={s.id}
          student={s}
          groupId={groupId}
          canEdit={canEdit && Boolean(groupId)}
          open={openId === s.id}
          onToggle={() => setOpenId((current) => (current === s.id ? null : s.id))}
          onUpdated={(updated, message) => { setOpenId(null); onUpdated?.(updated, message); }}
          onRemoved={(id, message) => { setOpenId(null); onRemoved?.(id, message); }}
        />
      ))}
    </ul>
  );
}

function StudentRow({ student: s, groupId, canEdit, open, onToggle, onUpdated, onRemoved }) {
  const bg = s.avatarColor || COLORS.primarySoftBg;
  const fullName = `${s.firstNames} ${s.lastNames}`;
  const panelId = `student-options-${s.id}`;
  return (
    <li style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '8px 4px', minWidth: 0 }}>
      <div style={{ minHeight: '56px', display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
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
        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
          {groupId ? (
            <Link to={`/docente/perfil/${s.id}?groupId=${groupId}`} style={{ fontSize: '16px', overflowWrap: 'anywhere', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
              {fullName}
            </Link>
          ) : (
            <span style={{ fontSize: '16px', overflowWrap: 'anywhere' }}>{fullName}</span>
          )}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`Opciones de ${fullName}`}
            style={{ ...buttonStyle('ghost'), flex: 'none', minWidth: '44px' }}
          >
            {open ? 'Cerrar' : 'Opciones'}
          </button>
        )}
      </div>
      {canEdit && open && (
        <StudentOptions id={panelId} student={s} groupId={groupId} fullName={fullName} onUpdated={onUpdated} onRemoved={onRemoved} onClose={onToggle} />
      )}
    </li>
  );
}

/** Panel de acciones de un alumno: menú → corregir nombre | confirmar baja | confirmar eliminación. */
function StudentOptions({ id, student, groupId, fullName, onUpdated, onRemoved, onClose }) {
  const [mode, setMode] = useState('menu'); // 'menu' | 'edit' | 'withdraw' | 'delete' | 'secret'
  const [firstNames, setFirstNames] = useState(student.firstNames);
  const [lastNames, setLastNames] = useState(student.lastNames);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const firstInput = useRef(null);
  const confirmButton = useRef(null);

  useEffect(() => {
    if (mode === 'edit') firstInput.current?.focus();
    if (mode === 'withdraw' || mode === 'delete' || mode === 'secret') confirmButton.current?.focus();
  }, [mode]);

  const run = async (action) => {
    setBusy(true);
    setError(null);
    setErrorCode(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessageOf(e));
      setErrorCode(e?.code ?? null);
      setBusy(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    run(async () => onUpdated(await groupsApi.updateStudent(groupId, student.id, { firstNames, lastNames }), 'Nombre corregido.'));
  };
  const withdraw = () => run(async () => {
    await groupsApi.withdrawStudent(groupId, student.id);
    onRemoved(student.id, `${fullName} se dio de baja del grupo. Su historial se conserva.`);
  });
  const resetSecret = () => run(async () => onUpdated(
    await groupsApi.resetStudentSecret(groupId, student.id),
    `Se restableció la imagen secreta de ${fullName}. La elegirá de nuevo cuando abras la configuración.`,
  ));
  const remove = () => run(async () => {
    await groupsApi.deleteStudent(groupId, student.id);
    onRemoved(student.id, `Se eliminó el registro de ${fullName}.`);
  });

  const panel = { marginTop: '8px', padding: '12px', borderRadius: '14px', background: COLORS.surfaceSubtle, border: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: '10px' };
  const row = { display: 'flex', flexWrap: 'wrap', gap: '8px' };

  if (mode === 'edit') {
    return (
      <form id={id} onSubmit={save} noValidate style={panel} aria-label={`Corregir el nombre de ${fullName}`}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700 }}>
          Nombre(s)
          <input ref={firstInput} value={firstNames} onChange={(e) => setFirstNames(e.target.value)} autoComplete="off" maxLength={80} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700 }}>
          Apellido(s)
          <input value={lastNames} onChange={(e) => setLastNames(e.target.value)} autoComplete="off" maxLength={80} style={inputStyle} />
        </label>
        <FormMessage message={error} />
        <div style={row}>
          <button type="submit" disabled={busy} style={buttonStyle('primary', { disabled: busy })}>{busy ? 'Guardando…' : 'Guardar'}</button>
          <button type="button" onClick={() => setMode('menu')} disabled={busy} style={buttonStyle('secondary')}>Cancelar</button>
        </div>
      </form>
    );
  }

  if (mode === 'secret') {
    return (
      <div id={id} role="group" aria-label="Confirmar restablecer imagen secreta" style={panel}>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>¿Restablecer la imagen secreta de {fullName}?</p>
        <p style={{ ...mutedText, margin: 0 }}>Úsalo si la olvidó o la eligió por error. La volverá a elegir cuando abras la configuración de imágenes.</p>
        <FormMessage message={error} />
        <div style={row}>
          <button ref={confirmButton} type="button" onClick={resetSecret} disabled={busy} style={buttonStyle('primary', { disabled: busy })}>
            {busy ? 'Un momento…' : 'Sí, restablecer'}
          </button>
          <button type="button" onClick={() => { setError(null); setMode('menu'); }} disabled={busy} style={buttonStyle('secondary')}>Cancelar</button>
        </div>
      </div>
    );
  }

  if (mode === 'withdraw' || mode === 'delete') {
    const withdrawing = mode === 'withdraw';
    // Si no se puede eliminar porque ya tiene historial, ofrecer directamente la baja.
    const offerWithdraw = !withdrawing && errorCode === 'STUDENT_HAS_HISTORY';
    return (
      <div id={id} role="group" aria-label={withdrawing ? 'Confirmar baja' : 'Confirmar eliminación'} style={panel}>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          {withdrawing ? `¿Dar de baja a ${fullName}?` : `¿Eliminar el registro de ${fullName}?`}
        </p>
        <p style={{ ...mutedText, margin: 0 }}>
          {withdrawing
            ? 'Ya no aparecerá en el grupo ni podrá entrar con el código. Su historial de aprendizaje se conserva.'
            : 'Úsalo solo si lo agregaste por error. Si ya tiene respuestas o historial, no se podrá eliminar y conviene darlo de baja.'}
        </p>
        <FormMessage message={error} />
        <div style={row}>
          {offerWithdraw ? (
            <button type="button" onClick={() => { setError(null); setErrorCode(null); setMode('withdraw'); }} style={buttonStyle('primary')}>
              Dar de baja en su lugar
            </button>
          ) : (
            <button ref={confirmButton} type="button" onClick={withdrawing ? withdraw : remove} disabled={busy} style={buttonStyle('primary', { disabled: busy })}>
              {busy ? 'Un momento…' : withdrawing ? 'Sí, dar de baja' : 'Sí, eliminar'}
            </button>
          )}
          <button type="button" onClick={() => { setError(null); setErrorCode(null); setMode('menu'); }} disabled={busy} style={buttonStyle('secondary')}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div id={id} role="group" aria-label={`Opciones de ${fullName}`} style={{ ...panel, ...row, flexDirection: 'row' }}>
      <button type="button" onClick={() => setMode('edit')} style={buttonStyle('secondary')}>Corregir nombre</button>
      {student.hasSecret && (
        <button type="button" onClick={() => setMode('secret')} style={buttonStyle('secondary')}>Restablecer imagen secreta</button>
      )}
      <button type="button" onClick={() => setMode('withdraw')} style={buttonStyle('secondary')}>Dar de baja</button>
      <button type="button" onClick={() => setMode('delete')} style={buttonStyle('ghost')}>Eliminar (registro por error)</button>
      <button type="button" onClick={onClose} style={{ ...buttonStyle('ghost'), marginLeft: 'auto' }}>Cerrar</button>
    </div>
  );
}
