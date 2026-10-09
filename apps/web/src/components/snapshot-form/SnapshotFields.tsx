import type { ReactNode } from 'react';

interface SnapshotDateFieldProps {
  value?: string;
  onChange: (value: string) => void;
}
export function SnapshotDateField({ value, onChange }: SnapshotDateFieldProps) {
  return (
    <div>
      <label htmlFor="date" className="gk-label">날짜</label>
      <input type="date" id="date" required value={value || ''}
        onChange={e => onChange(e.target.value)} className="gk-input" />
    </div>
  );
}

interface SnapshotMemoFieldProps {
  value?: string | null;
  onChange: (value: string | undefined) => void;
  children?: ReactNode;
}
export function SnapshotMemoField({ value, onChange, children }: SnapshotMemoFieldProps) {
  return (
    <div>
      <label htmlFor="memo" className="gk-label">메모 (선택)</label>
      <textarea id="memo" rows={3} value={value || ''}
        onChange={e => onChange(e.target.value || undefined)} className="gk-input"
        placeholder="간단한 메모를 남기세요" />
      {children}
    </div>
  );
}

interface SnapshotAmountFieldProps {
  id: 'totalAmount' | 'availableBalance' | 'profitLoss';
  value: number | string | null | undefined;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  nonnegative?: boolean;
  hint?: ReactNode;
  children?: ReactNode;
}
export function SnapshotAmountField({ id, value, onChange, label, required, nonnegative, hint, children }: SnapshotAmountFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="gk-label">{label}{hint}</label>
      <input type="number" id={id} required={required} min={nonnegative ? '0' : undefined}
        step="0.01" value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="gk-input" placeholder={id === 'profitLoss' ? '양수: 수익, 음수: 손실' : undefined} />
      {children}
    </div>
  );
}
