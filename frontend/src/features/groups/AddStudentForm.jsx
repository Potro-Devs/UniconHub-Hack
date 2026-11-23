import { useEffect, useRef, useState } from 'react';
import { COLORS } from '@/config/brand';
import { alertBox, buttonStyle, card, inputStyle } from '@/shared/styles/ui';
import { groupsApi } from './groups.api';
import { MESSAGES, classifyAddStudentError } from './groups.logic';


/**
 * Alta individual (`POST /groups/:id/students`). Los campos no se borran si hay error.
 */
export function AddStudentForm({ group, onSaved, onClose }) {
  const [firstNames, setFirstNames] = useState('');
  const [lastNames, setLastNames] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const firstRef = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess('');
    try {
      const student = await groupsApi.addStudent(group.id, { firstNames, lastNames });
      const message = `Se agregó a ${student?.firstNames ?? firstNames.trim()}.`;
      setSuccess(message);
      setFirstNames('');
      setLastNames('');
      firstRef.current?.focus();
      onSaved();
    } catch (err) {
      const kind = classifyAddStudentError(err);
      setError(
        kind === 'invalidName' ? MESSAGES.studentInvalidName : kind === 'network' ? MESSAGES.studentNetwork : MESSAGES.studentGeneric,
      );
    } finally {
      setSaving(false);
    }
  };

  const errorId = `add-student-error-${group.id}`;
  const field = (id, label, value, setValue, autoComplete) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 220px', minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: '16px', fontWeight: 700 }}>
        {label}
      </label>
      <input
        id={id}
        ref={id.startsWith('first') ? firstRef : undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete={autoComplete}
        maxLength={80}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        style={inputStyle}
      />
    </div>
  );

  const disabled = saving || !firstNames.trim() || !lastNames.trim();

  return (
    <form onSubmit={onSubmit} noValidate style={card} aria-labelledby={`add-student-title-${group.id}`}>
      <h2 id={`add-student-title-${group.id}`} className="font-display" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
        Agregar un alumno
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {field(`first-names-${group.id}`, 'Nombre(s)', firstNames, setFirstNames, 'off')}
        {field(`last-names-${group.id}`, 'Apellidos', lastNames, setLastNames, 'off')}
      </div>
      {error && (
        <div id={errorId} ref={errorRef} tabIndex={-1} role="alert" style={alertBox}>
          {error}
        </div>
      )}
      <div aria-live="polite" style={{ fontSize: '15px', fontWeight: 700, color: COLORS.successFg }}>
        {success}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button type="submit" disabled={disabled} style={buttonStyle('primary', { disabled })}>
          {saving ? 'Agregando…' : 'Agregar'}
        </button>
        <button type="button" onClick={onClose} style={buttonStyle('secondary')}>
          Cerrar
        </button>
      </div>
    </form>
  );
}
