import { Fragment } from "react";

/** Détecte http(s):// et www. dans un message texte */
const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"]|www\.[^\s<]+[^\s<.,;:!?)}\]'"])/gi;

export function linkifyToNodes(text) {
  const str = String(text ?? "");
  if (!str) return [""];

  const nodes = [];
  let last = 0;
  let key = 0;

  for (const match of str.matchAll(URL_REGEX)) {
    const raw = match[0];
    const start = match.index ?? 0;
    if (start > last) nodes.push(str.slice(last, start));
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    nodes.push(
      <a
        key={`link-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 text-[var(--vsm-red)] hover:opacity-90 break-all"
      >
        {raw}
      </a>
    );
    last = start + raw.length;
  }

  if (last < str.length) nodes.push(str.slice(last));
  return nodes.length ? nodes : [str];
}

export default function LinkifiedText({ text, className = "" }) {
  return (
    <div className={className}>
      {linkifyToNodes(text).map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </div>
  );
}
