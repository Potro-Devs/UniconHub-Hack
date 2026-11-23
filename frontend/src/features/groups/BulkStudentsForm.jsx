import { useEffect, useRef, useState } from 'react';
import { COLORS } from '@/config/brand';
import { useAppUi } from '@/shared/state/AppUiContext';
import { alertBox, buttonStyle, card, mutedText, noticeBox } from '@/shared/styles/ui';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { groupsApi } from './groups.api';
import { MAX_BULK_LINES, MESSAGES, classifyBulkError, countListLines } from './groups.logic';
import { useTeacherGroups } from './TeacherGroupsContext';

/** Nombres ficticios para la demo (nunca datos reales). */
const SAMPLE_LIST = [
  'Sofía Ramírez López',
  'Mateo Hernández Cruz',
  'Valentina Torres Ruiz',
  'Díaz Peña, Santiago',
  'Camila Morales Vega',
].join('\n');


/**
 * Pegar lista (`POST /groups/:id/students/bulk`). Todo o nada: si hay renglones por revisar,
 * no se guarda ninguno y el texto se conserva (borrador por grupo en `TeacherGroupsContext`: sobrevive al navegar y se borra al cerrar sesión).
 */
export function BulkStudentsForm({ group, title, showExample, onSaved }) {
  const { say } = useAppUi();
  const { draftFor, setDraftFor } = useTeacherGroups();
  const draftText = draftFor(group.id);
  const setDraftText = (text) => setDraftFor(group.id, text);
  const savingRef = useRef(false);
  const { narrow } = useBreakpoint();
  const [phase, setPhase] = useState('editing'); // editing | confirming | saving
  const [error, setError] = useState(null); // { kind, lines? }
  const [editedAfterError, setEditedAfterError] = useState(false);
  const errorRef = useRef(null);
  const confirmRef = useRef(null);

  const count = countListLines(draftText);
  const tooMany = count > MAX_BULK_LINES;

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (phase === 'confirming') confirmRef.current?.focus();
  }, [phase]);

  const onChange = (event) => {
    setDraftText(event.target.value);
    if (error) setEditedAfterError(true);
    if (phase === 'confirming') setPhase('editing');
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setPhase('saving');
    try {
      const data = await groupsApi.addStudentsBulk(group.id, draftText);
      const n = data?.created?.length ?? count;
      setError(null);
      setDraftText('');
      say(`Se agregaron ${n} alumnos a ${group.name}.`);
      onSaved(n);
    } catch (err) {
      setEditedAfterError(false);
      setError(classifyBulkError(err));
    } finally {
      savingRef.current = false;
    }
    setPhase('editing');
  };

  const errorId = `bulk-error-${group.id}`;
  const helpId = `bulk-help-${group.id}`;
  const noticeId = `bulk-notice-${group.id}`;
  const countId = `bulk-count-${group.id}`;
  const hasLineErrors = error?.kind === 'invalidLines';
  const invalid = Boolean(error) || tooMany;
  const disabled = count === 0 || tooMany || phase === 'saving';

  return (
    <section aria-labelledby={`bulk-title-${group.id}`} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h2 id={`bulk-title-${group.id}`} className="font-display" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
          {title}
        </h2>
        {showExample && (
          <button type="button" onClick={() => onChange({ target: { value: SAMPLE_LIST } })} style={buttonStyle('ghost')}>
            Pegar lista de ejemplo
          </button>
        )}
      </div>

      <label htmlFor={`bulk-text-${group.id}`} style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.4 }}>
        Pega la lista de tu control escolar, un alumno por renglón.
      </label>
      <div id={helpId} style={mutedText}>
        Si un alumno tiene un solo apellido o dos nombres, escríbelo así: Apellidos, Nombres.
      </div>

      <textarea
        id={`bulk-text-${group.id}`}
        value={draftText}
        onChange={onChange}
        rows={8}
        aria-invalid={invalid}
        aria-describedby={[helpId, noticeId, countId, error ? errorId : null].filter(Boolean).join(' ')}
        placeholder={'Sofía Ramírez López\nDíaz Peña, Santiago\n…'}
        style={{
          minHeight: '180px',
          width: '100%',
          borderRadius: '14px',
          border: `${invalid ? 2 : 1}px solid ${invalid ? COLORS.alertFg : COLORS.borderInput}`,
          padding: '12px 14px',
          fontSize: '16px',
          lineHeight: 1.5,
          resize: 'vertical',
        }}
      />

      <div id={countId} aria-live="polite" style={{ fontSize: '15px', fontWeight: 700 }}>
        {count} de {MAX_BULK_LINES} alumnos
      </div>
      {tooMany && (
        <div role="alert" style={{ ...noticeBox, background: COLORS.alertBg, color: COLORS.alertFg }}>
          {MESSAGES.bulkTooMany}
        </div>
      )}

      <div id={noticeId} style={{ ...mutedText, fontSize: '15px' }}>
        Solo el nombre. No pidas CURP: el sistema crea un folio interno para unir su historial.
      </div>

      {error && (
        <div id={errorId} ref={errorRef} tabIndex={-1} role="alert" style={alertBox}>
          {hasLineErrors ? (
            <>
              {editedAfterError ? (
                <strong>Cuando termines, vuelve a guardar.</strong>
              ) : (
                <>
                  <strong style={{ fontSize: '16px' }}>No se guardó ningún alumno</strong>
                  <span>
                    {error.lines.length === 1
                      ? 'Hay 1 renglón por revisar. Corrígelo y vuelve a guardar: '
                      : `Hay ${error.lines.length} renglones por revisar. Corrígelos y vuelve a guardar: `}
                    la lista se guarda completa o no se guarda.
                  </span>
                </>
              )}
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {error.lines.map((l) => (
                  <li key={l.line} style={{ overflowWrap: 'anywhere' }}>
                    Renglón {l.line}: “{l.text}”
                  </li>
                ))}
              </ul>
              <span>Usa solo letras, espacios, guion, apóstrofo o punto. Cada renglón debe empezar con letra.</span>
            </>
          ) : error.kind === 'tooMany' ? (
            <span>{MESSAGES.bulkTooMany}</span>
          ) : (
            <span>{error.kind === 'network' ? MESSAGES.bulkNetwork : MESSAGES.bulkGeneric}</span>
          )}
        </div>
      )}

      {phase === 'confirming' ? (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-labelledby={`bulk-confirm-${group.id}`}
          style={{ ...noticeBox, display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <span id={`bulk-confirm-${group.id}`}>
            Se guardarán {count} alumnos en {group.name}. Después de guardar, el grado y el ciclo ya no se podrán cambiar.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={save}
              disabled={phase === 'saving'}
              style={{ ...buttonStyle('primary'), flex: narrow ? '1 1 100%' : '0 0 auto' }}
            >
              Guardar
            </button>
            <button type="button" onClick={() => setPhase('editing')} style={{ ...buttonStyle('secondary'), flex: narrow ? '1 1 100%' : '0 0 auto' }}>
              Revisar lista
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPhase('confirming')}
          style={{ ...buttonStyle('primary', { tall: true, fullWidth: narrow, disabled }), alignSelf: narrow ? 'stretch' : 'flex-start' }}
        >
          {phase === 'saving' ? 'Guardando…' : `Guardar ${count} alumnos`}
        </button>
      )}
    </section>
  );
}
