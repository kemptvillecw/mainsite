export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function safeLink(href) {
  try { const url = new URL(href); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function link(label, href, external = false) {
  const a = element('a', label); a.href = href;
  if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}
export function imageNode(image) {
  const img = element('img'); img.src = new URL(image.path, new URL('../', import.meta.url)).href;
  img.alt = image.alt; img.loading = 'lazy'; img.decoding = 'async';
  img.addEventListener('error', () => { img.hidden = true; }, { once: true });
  return img;
}
export function attribution(item) {
  const row = element('p', undefined, 'content-attribution');
  if (item.author) row.append(link(item.author.displayName, 'browse.html?' + new URLSearchParams({ author: item.author.publicId })));
  if (item.author && item.publishedAt) row.append(document.createTextNode(' · '));
  if (item.publishedAt) {
    const date = element('time', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium' }).format(new Date(item.publishedAt)));
    date.dateTime = item.publishedAt; row.append(date);
  }
  return row;
}
export function tagLinks(item) {
  const tags = element('div', undefined, 'content-tags');
  for (const tag of item.tags) tags.append(link(tag.label, 'browse.html?' + new URLSearchParams({ tag: tag.publicId })));
  return tags;
}
export function sensitiveNotice() { return element('p', 'Sensitive material — reader discretion advised.', 'content-sensitive'); }
export function contentCard(item) {
  const card = element('article', undefined, 'content-card');
  if (item.image) card.append(imageNode(item.image));
  const body = element('div', undefined, 'content-card-body');
  body.append(element('p', item.type[0] + item.type.slice(1).toLowerCase(), 'content-kind'));
  body.append(element('h2', item.title), attribution(item));
  if (item.sensitive) body.append(sensitiveNotice());
  body.append(element('p', item.summary), tagLinks(item));
  if (item.type === 'LINK') {
    const href = safeLink(item.externalUrl);
    if (href) { body.append(element('p', new URL(href).hostname, 'content-domain')); const action = link('View website ↗', href, true); action.className = 'button'; body.append(action); }
  } else {
    const action = link(item.type === 'STORY' ? 'Read story →' : 'Read article →', 'content.html?' + new URLSearchParams({ id: item.id }));
    action.className = 'button'; body.append(action);
  }
  card.append(body); return card;
}
function inline(host, spans) {
  for (const span of spans) {
    let node = document.createTextNode(span.text);
    for (const mark of span.marks) { const wrapper = element(mark === 'bold' ? 'strong' : 'em'); wrapper.append(node); node = wrapper; }
    if (span.href && safeLink(span.href)) { const a = link('', safeLink(span.href), true); a.append(node); node = a; }
    host.append(node);
  }
}
export function renderBlocks(content) {
  const fragment = document.createDocumentFragment();
  for (const block of content.blocks) {
    let node;
    if (['paragraph', 'quote', 'heading'].includes(block.type)) {
      node = element(block.type === 'paragraph' ? 'p' : block.type === 'quote' ? 'blockquote' : 'h' + block.level); inline(node, block.spans);
    } else if (block.type === 'list') {
      node = element(block.ordered ? 'ol' : 'ul');
      for (const spans of block.items) { const li = element('li'); inline(li, spans); node.append(li); }
    } else if (block.type === 'verse') node = element('pre', block.text, 'content-verse');
    else if (block.type === 'sceneBreak') { node = element('hr'); node.setAttribute('aria-label', 'Scene break'); }
    else if (block.type === 'image') { node = element('figure'); node.append(imageNode(block.image)); if (block.caption) node.append(element('figcaption', block.caption)); }
    else throw new Error('Unsupported content block');
    fragment.append(node);
  }
  return fragment;
}
