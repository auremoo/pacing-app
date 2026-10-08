// Mise en forme d'une description de séance pour l'écran.
//
// Les plans écrivent une séance entière dans une seule cellule de tableau
// markdown, donc sur une seule ligne : pour une séance de musculation, ça donne
// un pavé où échauffement, six exercices, consignes et retour au calme se
// suivent sans respiration (retour d'une débutante : « pas très facile à
// comprendre »). Le découpage se fait ici, à l'affichage, pour s'appliquer aussi
// aux plans déjà importés sans avoir à les regénérer.
//
// Forme reconnue (celle que demande le prompt débutant, et celle des plans
// existants) :
//   Échauffement … Retour au calme … 1) Nom — comment faire ; évite … .
//   3 × 12 répétitions, repos 90 s, charge légère … 2) …
// Sans exercices numérotés, seuls l'échauffement et le retour au calme sont mis
// à part ; une description courte reste telle quelle.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s).replace(/[&<>"]/g, c => ESC[c]);
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const trimPunct = s => s.trim().replace(/^[;,:.\s]+|[;,.\s]+$/g, '').trim();

// « 1) », « 2) »… en début de texte ou après une ponctuation / un espace.
const EXERCISE_MARK = /(?:^|\s)(\d{1,2})\)\s+/g;
// Séries × répétitions : « 3 × 12 », « 3–4 x 12 », « 2-3 × 20 s ».
const SETS = /(\d+(?:\s*[–-]\s*\d+)?)\s*[×x]\s*(\d+(?:\s*[–-]\s*\d+)?)/;

function sentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý0-9])/).map(s => s.trim()).filter(Boolean);
}

// Intro (avant le premier exercice) : échauffement d'un côté, retour au calme de
// l'autre (affiché à la fin, là où il a lieu), le reste à part.
function splitIntro(text) {
  const out = { warmup: [], cooldown: [], other: [] };
  let last = 'other';
  for (const s of sentences(text)) {
    if (/^(échauffement|echauffement)\b/i.test(s)) last = 'warmup';
    else if (/^retour au calme\b/i.test(s)) last = 'cooldown';
    else if (!/^(puis|ensuite|et)\b/i.test(s)) last = 'other';
    out[last].push(s);
  }
  return out;
}

function stripLabel(text, re) {
  return cap(text.replace(re, '').replace(/^\s*[:\-–—]\s*/, '').trim());
}

// « 3 × 12 répétitions » → « 3 séries de 12 », « 2–3 × 20 s de chaque côté »
// → « 2–3 séries de 20 s de chaque côté ».
function setsChip(text) {
  return text
    .replace(SETS, (_, s, r) => `${s.replace(/\s+/g, '')} séries de ${r.replace(/\s+/g, '')}`)
    .replace(/\s*répétitions?\b/i, '')
    .trim();
}

// Jargon de la charge (« 2–3 répétitions en réserve ») en phrase simple.
function reserveTip(text) {
  const m = text.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*répétitions?\s*(?:en réserve|possibles en fin de série|de plus)/i)
         || text.match(/rester\s+(\d+(?:\s*[–-]\s*\d+)?)\s*répétitions?/i);
  return m ? `À la fin de chaque série, tu dois pouvoir en faire encore ${m[1].replace(/\s+/g, '')}.` : '';
}

function parseExercise(chunk) {
  const ex = { name: '', how: '', avoid: '', chips: [], tip: '', after: [] };
  let rest = chunk.trim();

  // Nom : jusqu'au tiret long (ou « : »).
  const dash = rest.match(/\s[—–]\s|\s-\s|:\s/);
  if (dash && dash.index < 90) {
    ex.name = rest.slice(0, dash.index).trim();
    rest = rest.slice(dash.index + dash[0].length);
  } else {
    const first = sentences(rest)[0] || rest;
    ex.name = first.replace(/[.;]$/, '');
    rest = rest.slice(first.length);
  }

  // Prescription : la phrase qui contient « séries × répétitions ».
  const sets = rest.match(SETS);
  let presc = '';
  if (sets) {
    const before = rest.slice(0, sets.index);
    // début de la phrase de prescription : après le dernier « . » ou « ; »
    const cut = Math.max(before.lastIndexOf('. '), before.lastIndexOf('; '));
    const head = cut >= 0 ? before.slice(0, cut + 1) : '';
    const fromSets = rest.slice(cut >= 0 ? cut + 2 : sets.index);
    const end = fromSets.search(/\.\s+(?=[A-ZÀ-ÖØ-Ý])|\.$/);
    presc = end >= 0 ? fromSets.slice(0, end) : fromSets;
    const tail = end >= 0 ? fromSets.slice(end + 1) : '';
    ex.after = sentences(tail);
    rest = head;
  }

  // « ; évite … » / « Évite … » : l'erreur à éviter.
  const avoid = rest.match(/(?:^|[;.]\s*)(évite[rz]?\b[^.;]*)/i);
  if (avoid) {
    // « évite de cambrer » → « Cambrer », « évite l'élan » → « L'élan »
    ex.avoid = cap(trimPunct(avoid[1])
      .replace(/^évite[rz]?\s+(?:de\s+(?!l')|d'(?=[aeiouyéèêh]))?/i, '')
      .replace(/\bou de\s+(?!l')/g, 'ou ').replace(/\bou d'(?=[aeiouyéèêh])/g, 'ou '));
    rest = rest.slice(0, avoid.index) + rest.slice(avoid.index + avoid[0].length);
  }
  ex.how = cap(trimPunct(rest));

  if (presc) {
    ex.tip = reserveTip(presc);
    const parts = presc.split(/,\s+|;\s+/).map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      if (SETS.test(p)) ex.chips.push(setsChip(p));
      else if (/^repos\b/i.test(p)) ex.chips.push(cap(p));
      else if (/^charge\b/i.test(p)) ex.chips.push(cap(p.split(/\s*:\s*/)[0]));
      else if (/répétitions?\s+(en réserve|possibles)/i.test(p)) continue;   // dit par le conseil
      else ex.chips.push(cap(p));
    }
  }
  return ex;
}

// → { warmup, exercises, cooldown, notes, other } ou null si rien à structurer.
export function parseSessionDescription(desc) {
  const text = (desc || '').trim();
  if (!text) return null;

  const marks = [...text.matchAll(EXERCISE_MARK)].filter((m, i, all) =>
    parseInt(m[1]) === (i === 0 ? 1 : parseInt(all[i - 1][1]) + 1));
  if (marks.length >= 2) {
    const intro = splitIntro(text.slice(0, marks[0].index));
    const exercises = marks.map((m, i) => {
      const start = m.index + m[0].length;
      const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
      return parseExercise(text.slice(start, end));
    });
    // Phrases qui suivent la prescription du dernier exercice : consignes
    // générales de la séance (douleur, séance déjà faite…).
    const last = exercises[exercises.length - 1];
    const notes = last.after;
    last.after = [];
    exercises.forEach(e => { if (e.after.length) { e.how = [e.how, ...e.after].filter(Boolean).join(' '); e.after = []; } });
    return { warmup: intro.warmup, cooldown: intro.cooldown, other: intro.other, exercises, notes };
  }

  // Pas d'exercices numérotés : on sort seulement échauffement / retour au calme,
  // et pas sur un texte court (« Séance club. Échauffement 10 min. ») qui se lit
  // très bien tel quel.
  if (text.length < 200) return null;
  const intro = splitIntro(text);
  if (!intro.warmup.length && !intro.cooldown.length) return null;
  return { warmup: intro.warmup, cooldown: intro.cooldown, other: intro.other, exercises: [], notes: [] };
}

function block(label, lines, mod = '') {
  if (!lines.length) return '';
  return `<div class="sx-block ${mod}"><div class="sx-block__label">${label}</div><p>${inline(lines.join(' '))}</p></div>`;
}

export function renderSessionDescription(desc) {
  const parsed = parseSessionDescription(desc);
  if (!parsed) return inline(desc || '');
  const { warmup, cooldown, other, exercises, notes } = parsed;
  const warm = warmup.length ? [stripLabel(warmup[0], /^(échauffement|echauffement)\b/i), ...warmup.slice(1)] : [];
  const cool = cooldown.length ? [stripLabel(cooldown[0], /^retour au calme\b/i), ...cooldown.slice(1)] : [];
  return `<div class="sx">
    ${block('Échauffement', warm)}
    ${block(exercises.length ? 'Consignes' : 'Au programme', other)}
    ${exercises.length ? `<ol class="sx-list">${exercises.map((e, i) => `
      <li class="sx-ex">
        <div class="sx-ex__head"><span class="sx-ex__num">${i + 1}</span><span class="sx-ex__name">${inline(e.name)}</span></div>
        ${e.chips.length ? `<div class="sx-ex__chips">${e.chips.map(c => `<span>${inline(c)}</span>`).join('')}</div>` : ''}
        ${e.how ? `<p class="sx-ex__line"><span class="sx-ex__tag">Comment faire</span>${inline(e.how)}</p>` : ''}
        ${e.avoid ? `<p class="sx-ex__line sx-ex__line--avoid"><span class="sx-ex__tag">À éviter</span>${inline(e.avoid)}</p>` : ''}
        ${e.tip ? `<p class="sx-ex__line sx-ex__line--tip"><span class="sx-ex__tag">Le bon poids</span>${inline(e.tip)}</p>` : ''}
      </li>`).join('')}</ol>` : ''}
    ${block('Retour au calme', cool)}
    ${block('À savoir', notes, 'sx-block--note')}
  </div>`;
}

// Résumé d'une ligne pour l'accueil : la liste des exercices, sinon le texte.
export function sessionDescriptionSummary(desc) {
  const parsed = parseSessionDescription(desc);
  if (parsed?.exercises.length) return parsed.exercises.map(e => e.name).join(' · ');
  return desc || '';
}
