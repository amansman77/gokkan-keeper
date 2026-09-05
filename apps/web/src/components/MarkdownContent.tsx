import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  className?: string;
  disableLinks?: boolean;
  /**
   * 'prose' switches to the Judgment Diary reading setting (lighter weight,
   * larger size, wider leading, bounded measure) — see docs/DESIGN_SYSTEM.md.
   * 'lead' is the same setting one step heavier, for a summary paragraph.
   * Defaults to the compact setting used by cards and previews.
   */
  variant?: 'default' | 'prose' | 'lead';
}

const VARIANT_CLASSES: Record<NonNullable<MarkdownContentProps['variant']>, string> = {
  default: 'text-ink-muted leading-relaxed',
  prose: 'gk-prose gk-prose-measure',
  lead: 'gk-prose gk-prose-lead gk-prose-measure',
};

export default function MarkdownContent({
  content,
  className = '',
  disableLinks = false,
  variant = 'default',
}: MarkdownContentProps) {
  return (
    <div className={`${VARIANT_CLASSES[variant]} ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-2xl font-bold text-ink first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 mb-2 text-xl font-semibold text-ink first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-2 text-lg font-semibold text-ink first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children, start }) => (
            <ol start={start} className="mb-3 list-decimal pl-5 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-line pl-4 text-ink-muted italic">{children}</blockquote>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-md bg-inverse px-4 py-3 text-sm text-inverse-ink">{children}</pre>
          ),
          code: ({ children }) => (
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm text-ink">{children}</code>
          ),
          a: ({ href, children }) => (
            disableLinks ? (
              <span className="text-accent underline underline-offset-2">{children}</span>
            ) : (
              <a
                href={href}
                className="text-accent underline underline-offset-2 hover:text-accent-ink"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            )
          ),
          hr: () => <hr className="my-4 border-line-soft" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
