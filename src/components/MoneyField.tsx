import { useId } from 'react';
import { formatMoney, MAX_MONEY_CENTS, type MoneyLimits } from '../../shared/money';
export function MoneyField({
  label,
  value,
  onChange,
  error,
  min = 0,
  max = MAX_MONEY_CENTS,
  available,
}: MoneyLimits & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="money-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={!!error}
        aria-describedby={`${id}-limits${error ? ` ${id}-error` : ''}`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={`${id}-limits`} className="hint">
        Mínimo {formatMoney(min)} · Máximo {formatMoney(max)}
        {available !== undefined && <> · Disponible {formatMoney(available)}</>}
      </p>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
