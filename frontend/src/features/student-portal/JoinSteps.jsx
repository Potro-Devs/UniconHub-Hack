export function JoinSteps({ current }) {
  return <ol className="kid-access-steps" aria-label="Pasos para entrar">{['Tu grupo', 'Tu nombre', 'A aprender'].map((label, index) => <li key={label} aria-current={current === index + 1 ? 'step' : undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>;
}
