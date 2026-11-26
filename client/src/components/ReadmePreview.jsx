function inlineMarkdown(text, keyPrefix) {
  return String(text).split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={keyPrefix + index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-indigo-700">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={keyPrefix + index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={keyPrefix + index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function ReadmePreview({ content, repositoryName }) {
  const lines = String(content || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) code.push(lines[index++]);
      index += 1;
      blocks.push(<pre key={"code-" + index} className="my-5 overflow-x-auto rounded-xl bg-slate-950 p-5 text-sm leading-6 text-slate-100"><span className="mb-3 block text-xs uppercase tracking-wider text-slate-400">{language || "Code"}</span><code>{code.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const className = level === 1 ? "mb-5 mt-1 border-b border-slate-200 pb-4 text-3xl font-bold tracking-tight text-slate-900" : level === 2 ? "mb-3 mt-8 border-b border-slate-100 pb-2 text-xl font-semibold text-slate-800" : "mb-2 mt-5 text-base font-semibold text-slate-800";
      const Tag = "h" + level;
      blocks.push(<Tag key={"heading-" + index} className={className}>{inlineMarkdown(heading[2], "heading-" + index)}</Tag>);
      index += 1;
      continue;
    }

    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) { blocks.push(<hr key={"rule-" + index} className="my-6 border-slate-200"/>); index += 1; continue; }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) items.push(lines[index++].replace(/^\s*[-*+]\s+/, ""));
      blocks.push(<ul key={"list-" + index} className="my-4 list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-700">{items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, "list-" + index + "-" + itemIndex)}</li>)}</ul>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={"quote-" + index} className="my-4 border-l-4 border-indigo-300 bg-indigo-50/70 px-4 py-3 text-[15px] leading-7 text-slate-700">{quote.map((part, quoteIndex) => <p key={quoteIndex}>{inlineMarkdown(part, "quote-" + index + "-" + quoteIndex)}</p>)}</blockquote>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s|^\s*[-*+]\s+|^>\s?|^\s*```/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={"paragraph-" + index} className="my-3 text-[15px] leading-7 text-slate-700">{paragraph.map((part, partIndex) => <span key={partIndex}>{partIndex > 0 && " "}{inlineMarkdown(part, "paragraph-" + index + "-" + partIndex)}</span>)}</p>);
  }

  return <section className="my-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-6 py-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Project documentation</p><h2 className="mt-1 text-lg font-semibold text-slate-900">README.md</h2></div>
      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">{repositoryName}</span>
    </header>
    <article className="px-6 py-5 sm:px-9 sm:py-8">{blocks.length ? blocks : <p className="text-sm text-slate-500">README is empty.</p>}</article>
  </section>;
}
