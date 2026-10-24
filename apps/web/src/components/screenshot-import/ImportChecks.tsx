import type { ImportResult } from '@gokkan-keeper/shared';

/** Blocking checks first, then advisory warnings. */
export function ImportChecks({ result }: { result: ImportResult }) {
  return (
    <div className="gk-card gk-card-pad gk-stack">
      <h2 className="gk-section-heading">검증</h2>
      <ul className="gk-stack-sm">
        {result.checks.map((check) => (
          <li key={check.code} className={`rounded-md px-3 py-2 text-sm ${check.passed ? 'bg-success-tint text-success' : 'bg-danger-tint text-danger'}`}>
            <span className="font-semibold">{check.passed ? '통과' : '실패'}</span> · {check.detail}
          </li>
        ))}
      </ul>
      {result.warnings.length > 0 && (
        <div>
          <h3 className="gk-label">확인이 필요해요</h3>
          <ul className="gk-stack-sm">
            {result.warnings.map((warning, index) => (
              <li key={index} className="text-sm text-ink-muted">• {warning.detail}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
