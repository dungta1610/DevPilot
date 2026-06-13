import { Fragment } from "react";

/** Render inline `**bold**` and `` `code` `` spans within a line. */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return tokens.map((token, i) => {
    const key = `${keyBase}-${i}`;
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={key} className="text-foreground font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={key}
          className="bg-muted rounded px-1 py-0.5 font-mono text-[0.8em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{token}</Fragment>;
  });
}

/**
 * Minimal markdown renderer for the synthesized review (headings, bullets,
 * bold, inline code). Kept dependency-free per the project constraints.
 */
export function ReviewResult({ summary }: { summary: string }) {
  const lines = summary.split("\n");

  return (
    <div className="text-foreground/90 space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const key = `line-${i}`;
        const trimmed = line.trim();
        if (!trimmed) return <div key={key} className="h-1" />;
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={key} className="text-foreground pt-2 text-sm font-semibold">
              {renderInline(trimmed.slice(3), key)}
            </h3>
          );
        }
        if (trimmed.startsWith("- ")) {
          return (
            <div key={key} className="flex gap-2 pl-1">
              <span className="text-muted-foreground mt-1.5 size-1 shrink-0 rounded-full bg-current" />
              <span>{renderInline(trimmed.slice(2), key)}</span>
            </div>
          );
        }
        return <p key={key}>{renderInline(trimmed, key)}</p>;
      })}
    </div>
  );
}
