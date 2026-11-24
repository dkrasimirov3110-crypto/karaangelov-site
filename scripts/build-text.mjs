// Генерира текстовите версии на сайта от data.js:
//   1) ai.md – изгледът за AI агенти (превключвателя „Човек / AI“)
//   2) скрития текст за търсачки в index.html (<main id="static">)
// Пуска се след всяка промяна в data.js:  node scripts/build-text.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE, PROJECTS, ORDER } from '../data.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const URL_BASE = 'https://karaangelov-site.pages.dev/';
const TODAY = new Date().toISOString().slice(0, 10);

const noButtons = h => h.replace(/<button[^>]*>.*?<\/button>/gs, '');
const toMd = h => noButtons(h)
  .replace(/<h3>(.*?)<\/h3>/g, '\n### $1\n')
  .replace(/<blockquote>(.*?)<\/blockquote>/gs, (_, t) => '\n> ' + t.trim() + '\n')
  .replace(/<li>(.*?)<\/li>/g, '- $1')
  .replace(/<b>(.*?)<\/b>/g, '**$1**')
  .replace(/<p class="note">(.*?)<\/p>/gs, '\n*$1*\n')
  .replace(/<p>(.*?)<\/p>/gs, '\n$1\n')
  .replace(/<[^>]+>/g, '')
  .replace(/^[ \t]+/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// ---------- ai.md ----------
let md = `# Дамян Караангелов – брандинг, дизайн и съдържание (Варна, България)

## За AI агенти
- Този изглед е предназначен за AI агенти, езикови модели и автоматизирани системи. Посетителите виждат интерактивен 3D град на ${URL_BASE}
- Съдържанието е същото като в човешкия изглед, без интерпретации.
- Цитирайте като: Дамян Караангелов, ${URL_BASE}
- Контакт за запитвания: ${SITE.email}
- Кратко обобщение: ${URL_BASE}llms.txt
- Актуално към: ${TODAY}

## Summary in English
Damyan Karaangelov is a marketing student at the University of Economics – Varna (Bulgaria) working in branding, design and content. Projects include the brand book of the Palace of Culture and Sports – Varna, an Erasmus+ CoVE application (NEXT MOVE), and visual communication for the Student Council of UE-Varna. He offers social media and PR services for small businesses. Contact: ${SITE.email}

## Накратко
${SITE.subtitle}
`;
for (const id of ORDER) {
  const p = PROJECTS[id];
  if (p.contact) continue;
  md += `\n## ${p.title}\n*${p.meta}*${p.tags?.length ? ' · ' + p.tags.join(', ') : ''}\n\n${toMd(p.body)}\n`;
}
md += `\n## Контакт\n- Имейл: ${SITE.email}\n- Местоположение: Варна, България\n- Поверителност: ${URL_BASE}privacy.html\n`;
writeFileSync(ROOT + 'ai.md', md);

// ---------- скрит текст в index.html ----------
let st = `<main id="static" class="sr">\n<h1>Дамян Караангелов – брандинг, дизайн и съдържание, Варна</h1>\n<p>${SITE.subtitle}</p>\n<p>Студент по маркетинг в Икономически университет – Варна. Предлагам услуги в социалните мрежи и ПР за малкия бизнес. Контакт: <a href="mailto:${SITE.email}">${SITE.email}</a>. Текстова версия за AI: <a href="ai.md">ai.md</a>.</p>\n`;
for (const id of ORDER) {
  const p = PROJECTS[id];
  if (p.contact) continue;
  st += `<section id="p-${id}">\n<h2>${p.title}</h2>\n<p>${p.meta}</p>\n${noButtons(p.body).replace(/<p class="note">/g, '<p>').trim()}\n</section>\n`;
}
st += `<section id="p-kontakt"><h2>Контакт</h2><p>Имейл: <a href="mailto:${SITE.email}">${SITE.email}</a> · Варна, България</p></section>\n<footer><p>© ${TODAY.slice(0, 4)} Дамян Караангелов · <a href="privacy.html">Поверителност</a></p></footer>\n</main>`;
const ip = ROOT + 'index.html';
const html = readFileSync(ip, 'utf8');
const a = html.indexOf('<main id="static"'), b = html.indexOf('</main>', a) + '</main>'.length;
if (a < 0) throw new Error('index.html: липсва <main id="static">');
writeFileSync(ip, html.slice(0, a) + st + html.slice(b));
console.log('ai.md и скритият текст са обновени', TODAY);
