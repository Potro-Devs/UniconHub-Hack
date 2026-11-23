import { forwardRef } from 'react';
import { alertBox, buttonStyle } from '@/shared/styles/ui';

/**
 * Aviso de grupo duplicado (409 `GROUP_ALREADY_EXISTS`). Recibe el foco al aparecer.
 */
export const DuplicateGroupAlert = forwardRef(function DuplicateGroupAlert({ label, schoolYear, existing, onGo }, ref) {
  return (
    <div ref={ref} tabIndex={-1} role="alert" style={alertBox}>
      <strong style={{ fontSize: '16px' }}>Ese grupo ya existe</strong>
      <span>
        Ya está registrado {label} del ciclo {schoolYear} en tu escuela. Elige otra sección o revisa con dirección.
      </span>
      {existing && (
        <button type="button" onClick={() => onGo(existing)} style={{ ...buttonStyle('secondary'), alignSelf: 'flex-start' }}>
          Ir a {existing.name}
        </button>
      )}
    </div>
  );
});
