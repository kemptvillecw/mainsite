// Public wire contract. The server must independently enforce approved-public access.
export const PUBLIC_SCHEMA_VERSION = 1;
export const CONTENT_TYPES = Object.freeze(['ARTICLE', 'STORY', 'LINK']);
export const MAX_PAGE_SIZE = 48;
export class PublicContentError extends Error {
  constructor(path, reason) { super(`Invalid public content at ${path}: ${reason}`); this.name = 'PublicContentError'; }
}
const fail = (path, reason) => { throw new PublicContentError(path, reason); };
function object(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected object');
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unexpected field');
  for (const key of keys) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'missing field');
}
function text(value, path, max, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || Array.from(value).length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail(path, 'invalid text');
}
function integer(value, path, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(path, 'invalid integer');
}
function id(value, path, prefix = '') {
  text(value, path, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) || !value.startsWith(prefix)) fail(path, 'invalid public ID');
}
function timestamp(value, path, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(path, 'expected canonical UTC timestamp');
}
function array(value, path, max) { if (!Array.isArray(value) || value.length > max) fail(path, 'invalid array'); }
function unique(values, path) { if (new Set(values).size !== values.length) fail(path, 'duplicate values'); }
function https(value, path) {
  text(value, path, 2048);
  if (/\s/.test(value) || !value.startsWith('https://')) fail(path, 'expected HTTPS URL');
  let url;
  try { url = new URL(value); } catch { fail(path, 'invalid URL'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail(path, 'invalid destination');
}
function image(value, path) {
  if (value === null) return;
  object(value, ['path', 'alt'], path);
  text(value.path, `${path}.path`, 300);
  if (!/^images\/[A-Za-z0-9/_-]+\.(?:png|jpg|jpeg|webp|avif)$/.test(value.path)) fail(path, 'expected published KCW image path');
  text(value.alt, `${path}.alt`, 300);
}
const summaryFields = ['id', 'type', 'title', 'summary', 'author', 'publishedAt', 'updatedAt', 'tags', 'image', 'sensitive', 'externalUrl'];
function summary(value, path, detail = false) {
  object(value, detail ? [...summaryFields, 'revision', 'content'] : summaryFields, path);
  id(value.id, `${path}.id`);
  if (!CONTENT_TYPES.includes(value.type)) fail(path, 'unknown content type');
  text(value.title, `${path}.title`, 160); text(value.summary, `${path}.summary`, 300, true);
  if (value.author !== null) {
    object(value.author, ['publicId', 'displayName'], `${path}.author`);
    id(value.author.publicId, `${path}.author.publicId`, 'author_');
    text(value.author.displayName, `${path}.author.displayName`, 80);
  }
  timestamp(value.publishedAt, `${path}.publishedAt`, true); timestamp(value.updatedAt, `${path}.updatedAt`);
  array(value.tags, `${path}.tags`, 8);
  value.tags.forEach((tag, i) => {
    object(tag, ['publicId', 'label'], `${path}.tags[${i}]`);
    id(tag.publicId, `${path}.tags[${i}].publicId`, 'tag_'); text(tag.label, `${path}.tags[${i}].label`, 40);
  });
  unique(value.tags.map(tag => tag.publicId), `${path}.tags`);
  image(value.image, `${path}.image`);
  if (typeof value.sensitive !== 'boolean') fail(path, 'expected sensitive boolean');
  if (value.type === 'LINK') https(value.externalUrl, `${path}.externalUrl`);
  else if (value.externalUrl !== null) fail(path, 'only Links have a destination');
}
function spans(value, path, budget) {
  array(value, path, 2000);
  value.forEach((span, i) => {
    const at = `${path}[${i}]`;
    object(span, ['text', 'marks', 'href'], at); text(span.text, `${at}.text`, 200000, true);
    budget.characters += Array.from(span.text).length;
    array(span.marks, `${at}.marks`, 2); unique(span.marks, `${at}.marks`);
    if (span.marks.some(mark => !['bold', 'italic'].includes(mark))) fail(at, 'unknown mark');
    if (span.href !== null) https(span.href, `${at}.href`);
  });
}
function blocks(value, path, type) {
  object(value, ['version', 'blocks'], path);
  if (value.version !== 1) fail(path, 'unsupported block version');
  array(value.blocks, `${path}.blocks`, 2000);
  const budget = { characters: 0 };
  value.blocks.forEach((block, i) => {
    const at = `${path}.blocks[${i}]`;
    switch (block?.type) {
      case 'paragraph': case 'quote':
        object(block, ['type', 'spans'], at); spans(block.spans, `${at}.spans`, budget); break;
      case 'heading':
        object(block, ['type', 'level', 'spans'], at); integer(block.level, `${at}.level`, 2, 4);
        spans(block.spans, `${at}.spans`, budget); break;
      case 'list':
        object(block, ['type', 'ordered', 'items'], at);
        if (typeof block.ordered !== 'boolean') fail(at, 'expected ordered boolean');
        array(block.items, `${at}.items`, 1000);
        block.items.forEach((item, n) => spans(item, `${at}.items[${n}]`, budget)); break;
      case 'verse':
        object(block, ['type', 'text'], at); text(block.text, `${at}.text`, 62000, true);
        budget.characters += Array.from(block.text).length; break;
      case 'image':
        object(block, ['type', 'image', 'caption'], at);
        if (block.image === null) fail(at, 'image required');
        image(block.image, `${at}.image`); text(block.caption, `${at}.caption`, 300, true);
        budget.characters += Array.from(block.caption).length; break;
      case 'sceneBreak': object(block, ['type'], at); break;
      default: fail(at, 'unknown block type');
    }
  });
  const max = type === 'STORY' ? 62000 : type === 'LINK' ? 1000 : 200000;
  if (budget.characters > max) fail(path, 'body exceeds character limit');
}
function envelope(value, fields) {
  object(value, ['schemaVersion', 'generatedAt', 'dataAsOf', 'snapshotId', ...fields], '$');
  if (value.schemaVersion !== PUBLIC_SCHEMA_VERSION) fail('$', 'unsupported version');
  timestamp(value.generatedAt, '$.generatedAt'); timestamp(value.dataAsOf, '$.dataAsOf');
  if (value.dataAsOf > value.generatedAt) fail('$', 'snapshot newer than response');
  id(value.snapshotId, '$.snapshotId');
}
export function validatePublicList(value) {
  envelope(value, ['items', 'page', 'facets']);
  array(value.items, '$.items', MAX_PAGE_SIZE);
  value.items.forEach((item, i) => summary(item, `$.items[${i}]`)); unique(value.items.map(item => item.id), '$.items');
  object(value.page, ['number', 'size', 'totalItems', 'totalPages'], '$.page');
  integer(value.page.size, '$.page.size', 1, MAX_PAGE_SIZE); integer(value.page.totalItems, '$.page.totalItems');
  integer(value.page.totalPages, '$.page.totalPages'); integer(value.page.number, '$.page.number', 1, Math.max(1, value.page.totalPages));
  if (value.page.totalPages !== Math.ceil(value.page.totalItems / value.page.size)) fail('$.page', 'inconsistent total pages');
  const expected = Math.min(value.page.size, Math.max(0, value.page.totalItems - (value.page.number - 1) * value.page.size));
  if (value.items.length !== expected) fail('$.items', 'item count does not match page');
  object(value.facets, ['types', 'authors', 'tags'], '$.facets');
  for (const category of ['types', 'authors', 'tags']) {
    const options = value.facets[category]; array(options, `$.facets.${category}`, 5000);
    options.forEach((option, i) => {
      const at = `$.facets.${category}[${i}]`;
      object(option, ['value', 'label', 'count'], at);
      id(option.value, `${at}.value`, category === 'authors' ? 'author_' : category === 'tags' ? 'tag_' : '');
      if (category === 'types' && !CONTENT_TYPES.includes(option.value)) fail(at, 'unknown type');
      text(option.label, `${at}.label`, 80); integer(option.count, `${at}.count`);
    });
    unique(options.map(option => option.value), `$.facets.${category}`);
  }
  return value;
}
export function validatePublicDetail(value) {
  envelope(value, ['item']);
  if (value.item === null) return value; // Same response for missing, private, or withdrawn content.
  summary(value.item, '$.item', true); id(value.item.revision, '$.item.revision');
  blocks(value.item.content, '$.item.content', value.item.type);
  return value;
}
