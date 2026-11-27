import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { assessmentsApi } from '@/features/assessments/assessments.api';
import { groupsApi } from '@/features/groups/groups.api';
import { formatJoinCode } from '@/features/groups/groups.logic';
import { errorMessageOf } from '@/shared/api/client';
import { alertBox, buttonStyle, card, inputStyle, mutedText, noticeBox, sectionTitle } from '@/shared/styles/ui';
import { assignmentErrorMessage, assignmentFieldError, assignmentFormErrors, assignmentPayload, toggleSelection } from './curriculum.logic';

const labelStyle = { display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700 };
const fieldErrorStyle = { margin: '5px 0 0', color: COLORS.alertFg, fontSize: '14px' };

export function AssignmentPanel({ group, skills, selectedSkills, onSkillsChange, headingRef, selectionNotice }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [recipients, setRecipients] = useState('all');
  const [studentIds, setStudentIds] = useState([]);
  const [modality, setModality] = useState('screen');
  const [students, setStudents] = useState({ status: 'loading', data: [], error: null });
  const [assignments, setAssignments] = useState({ status: 'loading', data: [], error: null });
  const [submission, setSubmission] = useState({ pending: false, error: '', fields: {}, created: null });
  const mounted = useRef(false);
  const sending = useRef(false);
  const studentsVersion = useRef(0);
  const assignmentsVersion = useRef(0);

  const loadStudents = useCallback(async () => {
    const version = ++studentsVersion.current;
    setStudents((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await groupsApi.listStudents(group.id);
      if (mounted.current && version === studentsVersion.current) setStudents({ status: 'ready', data, error: null });
    } catch (error) {
      if (mounted.current && version === studentsVersion.current) setStudents({ status: 'error', data: [], error });
    }
  }, [group.id]);

  const loadAssignments = useCallback(async () => {
    const version = ++assignmentsVersion.current;
    setAssignments((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await assessmentsApi.listAssignments(group.id);
      if (mounted.current && version === assignmentsVersion.current) setAssignments({ status: 'ready', data, error: null });
    } catch (error) {
      if (mounted.current && version === assignmentsVersion.current) setAssignments((current) => ({ ...current, status: 'error', error }));
    }
  }, [group.id]);

  useEffect(() => {
    mounted.current = true;
    loadStudents();
    loadAssignments();
    return () => { mounted.current = false; ++studentsVersion.current; ++assignmentsVersion.current; };
  }, [loadStudents, loadAssignments]);

  const submit = async (event) => {
    event.preventDefault();
    if (sending.current || submission.created) return;
    const draft = { title, skills: selectedSkills, recipients, studentIds, modality };
    const fields = assignmentFormErrors(draft);
    if (Object.keys(fields).length) {
      setSubmission({ pending: false, error: 'Revisa los campos indicados antes de asignar.', fields, created: null });
      return;
    }
    sending.current = true;
    setSubmission({ pending: true, error: '', fields: {}, created: null });
    try {
      const created = await assessmentsApi.createAssignment(group.id, assignmentPayload(draft));
      if (!mounted.current) return;
      setSubmission({ pending: false, error: '', fields: {}, created });
      // La creación ya terminó: un fallo al recargar la lista no debe invitar a duplicarla.
      setAssignments((current) => ({ ...current, data: [created, ...current.data.filter((item) => item.id !== created.id)] }));
      if (modality === 'paper') navigate(`/docente/papel/${created.id}`);
      else loadAssignments();
    } catch (error) {
      if (!mounted.current) return;
      const message = assignmentErrorMessage(error, skills);
      const field = assignmentFieldError(error);
      setSubmission({ pending: false, error: message, fields: field ? { [field]: message } : {}, created: null });
    } finally { sending.current = false; }
  };

  const disabled = submission.pending || Boolean(submission.created);
  const targetCount = recipients === 'all' ? students.data.length : studentIds.length;
  const fieldError = (field) => submission.fields[field] && <p id={`assignment-${field}-error`} role="alert" style={fieldErrorStyle}>{submission.fields[field]}</p>;

  return <aside className="curriculum-stack curriculum-assignment" aria-labelledby="assignment-heading">
    <section style={card}>
      <h2 id="assignment-heading" tabIndex={-1} ref={headingRef} className="font-display curriculum-panel-heading" style={sectionTitle}>Asignar prueba</h2>
      <p style={{ ...mutedText, margin: 0 }}>Elige habilidades del temario. La prueba usa los reactivos disponibles para {group.grade}.º grado; cada habilidad necesita al menos 3.</p>
      {selectionNotice && <p role="status" style={{ ...noticeBox, margin: 0 }}>{selectionNotice}</p>}
      {submission.created && <div role="status" style={noticeBox}>
        <strong>Prueba «{submission.created.title}» asignada.</strong>
        <span>Los alumnos elegidos la verán al entrar con el código <strong>{formatJoinCode(group.joinCode)}</strong>.</span>
        <button type="button" style={buttonStyle('secondary')} onClick={() => { setTitle(''); setSubmission({ pending: false, error: '', fields: {}, created: null }); }}>Preparar otra prueba</button>
      </div>}
      <form className="curriculum-form" onSubmit={submit} noValidate>
        <fieldset disabled={disabled} className="curriculum-form">
          <label style={labelStyle} htmlFor="assignment-title">Título de la prueba
            <input id="assignment-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} style={inputStyle} placeholder="Ej. Lo que aprendimos esta semana" aria-invalid={Boolean(submission.fields.title)} aria-describedby={submission.fields.title ? 'assignment-title-error' : undefined} />
          </label>
          {fieldError('title')}
          <fieldset aria-describedby={submission.fields.skills ? 'assignment-skills-error' : undefined}>
            <legend>1. Habilidades</legend>
            {skills.length === 0 ? <p style={mutedText}>Este temario aún no tiene habilidades para evaluar.</p> : skills.map((skill) => <label key={skill.code} className="curriculum-choice">
              <input type="checkbox" checked={selectedSkills.includes(skill.code)} onChange={() => onSkillsChange(toggleSelection(selectedSkills, skill.code))} />
              <span>{skill.name}</span>
            </label>)}
            {fieldError('skills')}
          </fieldset>
          <fieldset>
            <legend>2. Destinatarios</legend>
            {students.status === 'loading' ? <p role="status" style={mutedText}>Cargando alumnos…</p> : students.status === 'error' ? <div role="alert" style={alertBox}>
              <span>{errorMessageOf(students.error)}</span><button type="button" style={buttonStyle('secondary')} onClick={loadStudents}>Reintentar alumnos</button>
            </div> : students.data.length === 0 ? <p style={mutedText}>Agrega alumnos a este grupo antes de asignar. <Link to={`/docente/grupos/${group.id}`}>Ir al grupo</Link></p> : <>
              <label className="curriculum-choice"><input type="radio" name="assignment-recipients" checked={recipients === 'all'} onChange={() => setRecipients('all')} /><span>Todo el grupo ({students.data.length})</span></label>
              <label className="curriculum-choice"><input type="radio" name="assignment-recipients" checked={recipients === 'selected'} onChange={() => setRecipients('selected')} /><span>Elegir alumnos</span></label>
              {recipients === 'selected' && <div className="curriculum-students" role="group" aria-label="Alumnos destinatarios">
                <p style={{ ...mutedText, margin: '6px 0' }}>{studentIds.length} alumnos elegidos</p>
                {students.data.map((student) => <label className="curriculum-choice" key={student.id}>
                  <input type="checkbox" checked={studentIds.includes(student.id)} onChange={() => setStudentIds((current) => toggleSelection(current, student.id))} />
                  <span aria-hidden="true" style={{ flex: 'none', background: student.avatarColor, color: COLORS.ink, border: `1px solid ${COLORS.border}`, borderRadius: '50%', width: '34px', height: '34px', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{student.initials}</span>
                  <span>{student.fullName ?? `${student.firstNames} ${student.lastNames}`}</span>
                </label>)}
              </div>}
            </>}
            {fieldError('studentIds')}
          </fieldset>
          <fieldset>
            <legend>3. Modalidad</legend>
            <label className="curriculum-choice"><input type="radio" name="assignment-modality" checked={modality === 'screen'} onChange={() => setModality('screen')} /><span>En pantalla</span></label>
            <label className="curriculum-choice"><input type="radio" name="assignment-modality" checked={modality === 'paper'} onChange={() => setModality('paper')} /><span>En papel</span></label>
            {fieldError('modality')}
            {modality === 'paper' && <p style={{ ...mutedText, margin: '6px 0 0' }}>Después de asignar irás a la hoja para imprimir. La prueba quedará bloqueada en el portal del alumno.</p>}
          </fieldset>
          <p style={{ ...mutedText, margin: 0 }}>Resumen: <strong>{group.name}</strong> · {students.status === 'ready' ? `${targetCount} destinatarios` : 'Cargando destinatarios'} · {selectedSkills.length} habilidades · {modality === 'paper' ? 'En papel' : 'En pantalla'}.</p>
          {submission.error && <p role="alert" style={{ ...alertBox, margin: 0 }}>{submission.error}</p>}
          <button type="submit" style={buttonStyle('primary', { disabled: disabled || students.status !== 'ready' || students.data.length === 0 || skills.length === 0, fullWidth: true })} disabled={disabled || students.status !== 'ready' || students.data.length === 0 || skills.length === 0}>
            {submission.pending ? 'Asignando…' : modality === 'paper' ? 'Asignar e imprimir' : 'Asignar en pantalla'}
          </button>
        </fieldset>
      </form>
    </section>
    <section style={card} aria-labelledby="recent-assignments-heading">
      <h2 id="recent-assignments-heading" className="font-display" style={sectionTitle}>Pruebas del grupo</h2>
      {assignments.status === 'loading' && <p role="status" style={mutedText}>Cargando pruebas…</p>}
      {assignments.status === 'error' && <div role="alert" style={alertBox}><span>No pudimos actualizar la lista de pruebas. Las asignaciones creadas se conservan.</span><button type="button" style={buttonStyle('secondary')} onClick={loadAssignments}>Actualizar lista</button></div>}
      {assignments.status === 'ready' && assignments.data.length === 0 && <p style={mutedText}>Todavía no hay pruebas asignadas a este grupo.</p>}
      {assignments.data.length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>{assignments.data.slice(0, 5).map((assignment) => <li key={assignment.id} style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px' }}>
        <strong>{assignment.title}</strong><div style={mutedText}>{assignment.modality === 'paper' ? 'En papel' : 'En pantalla'} · {assignment.questionCount} reactivos</div>
        {assignment.modality === 'paper' && <Link to={`/docente/papel/${assignment.id}`} style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>Abrir hoja y captura →</Link>}
      </li>)}</ul>}
    </section>
  </aside>;
}
