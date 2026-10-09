interface SectionRowProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  /** Shown while collapsed as well as expanded, so folding a section away
   *  never costs the reader the headline figure it contains. */
  summary: React.ReactNode;
}

export function SectionRow({ title, count, expanded, onToggle, summary }: SectionRowProps) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="gk-section-row">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`gk-chevron ${expanded ? 'gk-chevron-open' : ''}`}>
        <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="gk-section-row-title">
        {title}
        {count > 0 && <span className="gk-chip gk-chip-count">{count}</span>}
      </span>
      <span className="gk-section-row-summary">{summary}</span>
    </button>
  );
}

