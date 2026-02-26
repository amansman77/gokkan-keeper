import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  className?: string;
  disableLinks?: boolean;
}

export default function MarkdownContent({ content, className = '', disableLinks = false }: MarkdownContentProps) {
  return (
    <div className={`text-gray-700 leading-relaxed ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-2xl font-bold text-gray-900 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 mb-2 text-xl font-semibold text-gray-900 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-2 text-lg font-semibold text-gray-900 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-gray-300 pl-4 text-gray-600 italic">{children}</blockquote>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-md bg-gray-900 px-4 py-3 text-sm text-gray-100">{children}</pre>
          ),
          code: ({ children }) => (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">{children}</code>
          ),
          a: ({ href, children }) => (
            disableLinks ? (
              <span className="text-blue-600 underline underline-offset-2">{children}</span>
            ) : (
              <a
                href={href}
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            )
          ),
          hr: () => <hr className="my-4 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
