import config from '../data/content.js';
import { createContentClient } from './content-api.js';
import { readFilters, toggleFilter, datePreset } from './content-filters.js';
import { element, contentCard } from './content-renderer.js';
const client = createContentClient();
const results = document.querySelector('[data-content-results]');
const status = document.querySelector('[data-content-status]');
const count = document.querySelector('[data-content-count]');
const filters = document.querySelector('[data-content-filters]');
const chips = document.querySelector('[data-content-chips]');
const pager = document.querySelector('[data-content-pages]');
const retry = document.querySelector('[data-content-retry]');
let params = readFilters(location.search); let current = null; let controller; let generation = 0;
function button(text, fn, className = 'button') {
  const node = element('button', text, className); node.type = 'button'; node.addEventListener('click', fn); return node;
}
function navigate(next, replace = false) {
  params = next;
  const query = params.toString();
  history[replace ? 'replaceState' : 'pushState'](null, '', location.pathname + (query ? '?' + query : ''));
  void load(false);
}
function remove(key, value) {
  const next = toggleFilter(params, key, value, false);
  if (['from', 'to'].includes(key)) next.delete('period');
  navigate(next);
}
function renderFilters(facets) {
  const focusId = document.activeElement?.id;
  const open = new Set([...filters.querySelectorAll('details[open]')].map(node => node.dataset.category));
  filters.replaceChildren(); chips.replaceChildren();
  for (const [key, category, label] of [['type', 'types', 'Content type'], ['author', 'authors', 'Author'], ['tag', 'tags', 'Tags']]) {
    const group = element('details', undefined, 'content-filter'); group.dataset.category = key;
    group.open = open.has(key) || params.getAll(key).length > 0;
    group.append(element('summary', label));
    const fieldset = element('fieldset'); fieldset.append(element('legend', label, 'visually-hidden'));
    for (const option of facets[category]) {
      const row = element('label'); const input = element('input'); input.type = 'checkbox'; input.value = option.value;
      input.id = `filter-${key}-${option.value}`; input.checked = params.getAll(key).includes(option.value);
      input.addEventListener('change', () => navigate(toggleFilter(params, key, option.value, input.checked)));
      row.append(input, document.createTextNode(`${option.label} (${option.count})`)); fieldset.append(row);
      if (input.checked) chips.append(button(`${option.label} ×`, () => remove(key, option.value), 'content-chip'));
    }
    if (!facets[category].length) fieldset.append(element('p', 'No matching options.'));
    group.append(fieldset); filters.append(group);
  }
  const dates = element('fieldset', undefined, 'content-dates'); dates.append(element('legend', 'Publication date'));
  const select = element('select'); select.id = 'content-period'; select.setAttribute('aria-label', 'Date range');
  for (const [value, label] of [['all', 'All dates'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['year', 'This year'], ['custom', 'Custom range']]) {
    const option = element('option', label); option.value = value; select.append(option);
  }
  select.value = params.get('period') || (params.has('from') || params.has('to') ? 'custom' : 'all');
  select.addEventListener('change', () => {
    const next = new URLSearchParams(params); next.delete('page'); next.delete('from'); next.delete('to'); next.delete('period');
    if (select.value !== 'all') next.set('period', select.value);
    const range = datePreset(select.value); for (const key of ['from', 'to']) if (range[key]) next.set(key, range[key]);
    navigate(next);
  }); dates.append(select);
  for (const [key, label] of [['from', 'From'], ['to', 'Through']]) {
    const wrapper = element('label', label); const input = element('input'); input.type = 'date'; input.id = 'content-' + key; input.value = params.get(key) || '';
    input.addEventListener('change', () => { const next = new URLSearchParams(params); next.delete(key); next.delete('page'); next.set('period', 'custom'); if (input.value) next.set(key, input.value); navigate(next); });
    wrapper.append(input); dates.append(wrapper);
    if (params.has(key)) chips.append(button(`${label} ${params.get(key)} ×`, () => remove(key, params.get(key)), 'content-chip'));
  }
  filters.append(dates);
  if (['type', 'author', 'tag', 'from', 'to', 'period'].some(key => params.has(key))) chips.append(button('Clear all', () => navigate(new URLSearchParams()), 'content-clear'));
  if (focusId) document.getElementById(focusId)?.focus();
}
function draw(data) {
  renderFilters(data.facets);
  count.textContent = `${data.page.totalItems} ${data.page.totalItems === 1 ? 'item' : 'items'}`;
  results.replaceChildren(...data.items.map(contentCard));
  if (!data.items.length) results.append(element('p', params.toString() ? 'No content matches these filters. Try removing a filter or clearing all.' : 'There is no published content to browse yet.', 'content-empty'));
  pager.replaceChildren();
  if (data.page.totalPages > 1) {
    const move = amount => { const next = new URLSearchParams(params); next.set('page', String(data.page.number + amount)); navigate(next); results.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    const previous = button('Previous', () => move(-1)); previous.disabled = data.page.number <= 1;
    const next = button('Next', () => move(1)); next.disabled = data.page.number >= data.page.totalPages;
    pager.append(previous, element('span', `Page ${data.page.number} of ${data.page.totalPages}`), next);
  }
}
async function load(refresh) {
  controller?.abort(); controller = new AbortController(); const version = ++generation;
  retry.hidden = true; results.setAttribute('aria-busy', 'true');
  if (!refresh) { current = null; results.replaceChildren(); pager.replaceChildren(); count.textContent = ''; status.textContent = 'Loading content…'; }
  try {
    const data = await client.list(params, controller.signal);
    if (version !== generation) return;
    const requested = Number(params.get('page') || 1);
    if (data.page.number !== requested) { params.set('page', String(data.page.number)); history.replaceState(null, '', location.pathname + '?' + params); }
    current = data; draw(data);
    status.textContent = data.page.number !== requested ? 'The listing changed; showing the last available page.' : '';
  } catch (error) {
    if (version !== generation) return;
    status.textContent = refresh && current ? 'Updates are temporarily unavailable. The items below may have changed. Try again.' : error.message;
    retry.hidden = false;
  } finally { if (version === generation) results.removeAttribute('aria-busy'); }
}
retry.addEventListener('click', () => void load(Boolean(results.children.length)));
window.addEventListener('popstate', () => { params = readFilters(location.search); void load(false); });
const timer = setInterval(() => { if (!document.hidden) void load(true); }, config.refreshMs);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void load(true); });
window.addEventListener('pagehide', () => { clearInterval(timer); controller?.abort(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
renderFilters({ types: ['ARTICLE', 'STORY', 'LINK'].map(value => ({ value, label: value, count: 0 })), authors: [], tags: [] });
void load(false);
