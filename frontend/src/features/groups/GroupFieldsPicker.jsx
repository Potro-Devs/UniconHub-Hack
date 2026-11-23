import { COLORS } from '@/config/brand';
import { GRADES, SCHOOL_YEARS, SECTIONS, gradeLabel, phaseForGrade, schoolYearToDisplay } from './groups.logic';

/**
 * Grupo de botones de selección única (`aria-pressed` + ✓ visible: el color nunca va solo).
 */
export function ChoiceButtons({ legend, options, value, onChange, disabled = false, describedBy }) {
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={describedBy}
      style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <legend style={{ padding: 0, fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>{legend}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              style={{
                minWidth: '64px',
                minHeight: '48px',
                padding: '0 14px',
                borderRadius: '12px',
                border: '2px solid',
                fontSize: '16px',
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                background: selected ? COLORS.ink : COLORS.surface,
                color: selected ? COLORS.onPrimary : COLORS.ink,
                borderColor: selected ? COLORS.ink : COLORS.borderInput,
              }}
            >
              {selected && <span aria-hidden="true">✓ </span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const GRADE_OPTIONS = GRADES.map((g) => ({ value: g, label: gradeLabel(g) }));

/**
 * Grado, grupo (sección) y ciclo escolar. `value.schoolYear` va en formato de la API.
 * Con `lockGradeYear`, grado y ciclo quedan deshabilitados (`lockedNoteId` explica por qué).
 * `phase` (de `group.phase`) tiene prioridad sobre la fase calculada para la vista previa.
 */
export function GroupFieldsPicker({ value, onChange, lockGradeYear = false, lockedNoteId, phase: knownPhase }) {
  const set = (field) => (v) => onChange({ ...value, [field]: v });
  const yearOptions = Array.from(new Set([...SCHOOL_YEARS, value.schoolYear].filter(Boolean))).map((y) => ({
    value: y,
    label: schoolYearToDisplay(y),
  }));
  const sectionOptions = Array.from(new Set([...SECTIONS, value.section].filter(Boolean))).map((s) => ({
    value: s,
    label: s,
  }));
  const phase = knownPhase ?? phaseForGrade(value.grade);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <ChoiceButtons
          legend="Grado"
          options={GRADE_OPTIONS}
          value={value.grade}
          onChange={set('grade')}
          disabled={lockGradeYear}
          describedBy={lockGradeYear ? lockedNoteId : undefined}
        />
        {phase && <div style={{ fontSize: '15px', color: COLORS.muted }}>Fase {phase}</div>}
      </div>
      <ChoiceButtons legend="Grupo" options={sectionOptions} value={value.section} onChange={set('section')} />
      <ChoiceButtons
        legend="Ciclo escolar"
        options={yearOptions}
        value={value.schoolYear}
        onChange={set('schoolYear')}
        disabled={lockGradeYear}
        describedBy={lockGradeYear ? lockedNoteId : undefined}
      />
    </div>
  );
}
