export function renderMarkdown(md) {
  if (!md || !md.trim()) return '';

  let html = escapeHtml(md);

  // Tables
  html = html.replace(/(\|.+\|\n)+/g, (match) => {
    const rows = match.trim().split('\n');
    const header = rows[0];
    const isSep = (r) => /^\|[-| :]+\|$/.test(r.trim());
    let out = '<table>';
    let inBody = false;
    for (const row of rows) {
      if (isSep(row)) { inBody = true; continue; }
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (!inBody) {
        out += '<tr>' + cells.map(c => `<th>${inline(c)}</th>`).join('') + '</tr>';
      } else {
        out += '<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
      }
    }
    return out + '</table>';
  });

  // Headings
  html = html.replace(/^### (.+)$/gm, (_, t) => `<h3>${inline(t)}</h3>`);
  html = html.replace(/^## (.+)$/gm, (_, t) => `<h2>${inline(t)}</h2>`);
  html = html.replace(/^# (.+)$/gm, (_, t) => `<h1>${inline(t)}</h1>`);

  // Unordered lists
  html = html.replace(/(^[-*] .+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(l => l.replace(/^[-*] /, ''));
    return '<ul>' + items.map(i => `<li>${inline(i)}</li>`).join('') + '</ul>';
  });

  // Ordered lists
  html = html.replace(/(^\d+\. .+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(l => l.replace(/^\d+\. /, ''));
    return '<ol>' + items.map(i => `<li>${inline(i)}</li>`).join('') + '</ol>';
  });

  // Paragraphs
  html = html.replace(/^(?!<[ht]|<ul|<ol|<table)(.+)$/gm, (_, p) => `<p>${inline(p)}</p>`);

  // Clean up extra blank lines
  html = html.replace(/\n{2,}/g, '\n');

  return html;
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
