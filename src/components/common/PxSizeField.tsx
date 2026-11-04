import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPx, normalizePx } from '@/utils/pxSize';

/**
 * Een maat in pixels (tekstgrootte of rijhoogte) met een knop terug naar de standaardwaarde.
 *
 * De invoer is een gewoon getalveld met een kladwaarde: tijdens het typen gebeurt er niets, pas bij
 * Enter of het verlaten van het veld wordt de waarde geklemd op [min, max], afgerond op `step` en
 * doorgegeven. Een leeg of onleesbaar veld zet de laatst geldige waarde terug. Escape verwerpt de
 * kladwaarde. De resetknop staat er altijd, maar is uitgeschakeld zolang de waarde al de standaard is;
 * hij noemt die standaard (bv. "100 % (11 px)"), zodat zichtbaar is waar hij naartoe springt.
 */
interface Props {
  id: string;
  /** Huidige waarde in px. */
  value: number;
  /** Standaardwaarde in px (de oude 100 %). */
  defaultValue: number;
  /** De waarde staat op de standaard (bij een automatische standaard die met iets anders meebeweegt). */
  isDefault?: boolean;
  min: number;
  max: number;
  step: number;
  /** Toegankelijke naam van het getalveld. */
  ariaLabel: string;
  onChange: (px: number) => void;
  onReset: () => void;
  /** `data-ops-px-field`-sleutel voor tests. */
  dataKey: string;
  className?: string;
}

export function PxSizeField({
  id, value, defaultValue, isDefault, min, max, step, ariaLabel, onChange, onReset, dataKey, className,
}: Props) {
  const { t } = useTranslation('common');
  const [draft, setDraft] = useState(formatPx(value));
  useEffect(() => { setDraft(formatPx(value)); }, [value]);
  const atDefault = isDefault ?? Math.abs(value - defaultValue) < 1e-6;

  const commit = () => {
    const next = normalizePx(draft, min, max, step);
    if (next === undefined) { setDraft(formatPx(value)); return; }
    setDraft(formatPx(next));
    if (Math.abs(next - value) > 1e-6) onChange(next);
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 ${className ?? ''}`} data-ops-px-field={dataKey}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        aria-label={ariaLabel}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); setDraft(formatPx(value)); }
        }}
        className="input !text-small !leading-4 !px-2 !py-1 !w-16 flex-shrink-0"
      />
      <span className="text-text-secondary flex-shrink-0">px</span>
      <button
        type="button"
        className="btn btn--secondary btn--sm whitespace-nowrap"
        disabled={atDefault}
        onClick={onReset}
        title={t('pxField.resetTitle', { px: formatPx(defaultValue) })}
        data-ops-px-reset={dataKey}
      >
        {t('pxField.reset', { px: formatPx(defaultValue) })}
      </button>
    </div>
  );
}
