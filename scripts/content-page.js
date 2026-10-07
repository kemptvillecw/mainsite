import config from '../data/content.js';
import { createContentClient } from './content-api.js';
import { element, attribution, tagLinks, imageNode, renderBlocks, sensitiveNotice } from './content-renderer.js';
const client = createContentClient(); const host = document.querySelector('[data-content-reader]');
const status = document.querySelector('[data-content-status]'); const retry = document.querySelector('[data-content-retry]');
const reload = document.querySelector('[data-content-reload]');
const id = new URLSearchParams(location.search).get('id') || '';
let current = null; let controller; let generation = 0;
function render(item) {
  host.replaceChildren();
  if (!item || item.type === 'LINK') { host.append(element('h1', 'Content unavailable'), element('p', 'This item is not available. Browse the collection to find something else to read.')); document.title = 'Content unavailable | KCW'; return; }
  document.title = `${item.title} | Kemptville Creative Writers`;
  host.append(element('p', item.type === 'STORY' ? 'Story' : 'Article', 'eyebrow'), element('h1', item.title), attribution(item));
  if (item.sensitive) host.append(sensitiveNotice());
  if (item.image) { const image = imageNode(item.image); image.className = 'content-reader-image'; host.append(image); }
  if (item.summary) host.append(element('p', item.summary, 'content-lead'));
  const body = element('div', undefined, 'content-body'); body.append(renderBlocks(item.content)); host.append(body, tagLinks(item));
}
async function refresh(force = false) {
  controller?.abort(); controller = new AbortController(); const version = ++generation; retry.hidden = true;
  if (!current) status.textContent = 'Loading content…';
  try {
    const result = await client.get(id, controller.signal);
    if (version !== generation) return;
    const item = result.item;
    if (!item || !current || force) { render(item); current = item; reload.hidden = true; status.textContent = ''; return; }
    // Do not change the text under a reader. Withdrawn content is handled above.
    if (item.revision !== current.revision) { status.textContent = 'An updated version is available. Reload when you are ready.'; reload.hidden = false; }
    else status.textContent = '';
    if (JSON.stringify(item.image) !== JSON.stringify(current.image)) {
      const previous = host.querySelector('.content-reader-image');
      if (!item.image) { previous?.remove(); current.image = null; }
      else {
        const image = imageNode(item.image); image.className = 'content-reader-image'; image.loading = 'eager';
        image.onload = () => {
          if (version !== generation || !current) return;
          if (previous) previous.replaceWith(image); else host.querySelector('.content-body').before(image);
          current.image = item.image;
        };
      }
    }
  } catch (error) {
    if (version !== generation) return;
    status.textContent = current ? 'We could not check for updates. This reading copy may be out of date. Please try again.' : error.message;
    retry.hidden = false;
  }
}
retry.addEventListener('click', () => void refresh()); reload.addEventListener('click', () => void refresh(true));
const timer = setInterval(() => { if (!document.hidden) void refresh(); }, config.refreshMs);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
window.addEventListener('pagehide', () => { clearInterval(timer); controller?.abort(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
void refresh();
