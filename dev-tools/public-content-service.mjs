// Pure public read model. Repository methods must read only approved projection collections.
export class PublicContentService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.now = options.now || (() => new Date());
    this.dayOf = options.dayOf || (value => {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
      return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
    });
  }
  envelope(data, at) {
    return Object.assign({ schemaVersion: 1, generatedAt: this.now().toISOString(), dataAsOf: at, snapshotId: 'read-' + Date.parse(at) }, data);
  }
  summary(record, labels) {
    if (!record || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(record.id || '') || !['ARTICLE', 'STORY', 'LINK'].includes(record.type)) throw new Error('Invalid public projection');
    const canonical = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
    let author = null;
    if (record.author && /^author_[A-Za-z0-9_-]+$/.test(record.author.publicId || '')) {
      const found = labels.authors.find(value => value.publicId === record.author.publicId) || record.author;
      if (found.displayName) author = { publicId: record.author.publicId, displayName: String(found.displayName) };
    }
    let image = null;
    const path = String(record.heroImage || '').replace(/^\//, '');
    if (path && /^images\/[A-Za-z0-9/_-]+\.(png|jpg|jpeg|webp|avif)$/.test(path) && record.heroImageAltText) image = { path, alt: String(record.heroImageAltText) };
    return {
      id: record.id, type: record.type, title: String(record.title || 'Untitled'), summary: String(record.shortDescription || ''), author,
      publishedAt: canonical(record.publishedAt), updatedAt: canonical(record.updatedAt) || '1970-01-01T00:00:00.000Z',
      tags: (record.tags || []).map(id => ({ publicId: 'tag_' + id, label: String((labels.tags.find(tag => tag.id === id) || {}).label || id) })),
      image, sensitive: record.sensitive === true, externalUrl: record.type === 'LINK' ? String(record.externalUrl || '') : null
    };
  }
  query(params) {
    const out = {};
    for (const key of ['type', 'author', 'tag']) {
      const values = params[key] || [];
      if (!Array.isArray(values) || values.length > 30 || values.some(value => typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value))) throw new Error('Invalid filters');
      out[key] = [...new Set(values)];
    }
    if (out.type.some(type => !['ARTICLE', 'STORY', 'LINK'].includes(type))) throw new Error('Invalid content type');
    for (const key of ['from', 'to']) {
      const value = (params[key] || [''])[0];
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Invalid date');
      out[key] = value;
    }
    if (out.from && out.to && out.from > out.to) throw new Error('Invalid range');
    for (const [key, fallback, max] of [['page', 1, 1000000], ['size', 12, 48]]) {
      const raw = (params[key] || [String(fallback)])[0];
      if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) throw new Error('Invalid page');
      out[key] = Number(raw);
    }
    return out;
  }
  list(params = {}) {
    const q = this.query(params);
    const at = this.now().toISOString();
    const labels = this.repository.labels();
    const items = this.repository.listPublic().map(record => this.summary(record, labels));
    const match = (item, skip) => {
      if (skip !== 'type' && q.type.length && !q.type.includes(item.type)) return false;
      if (skip !== 'author' && q.author.length && !q.author.includes(item.author && item.author.publicId)) return false;
      if (skip !== 'tag' && q.tag.length && !item.tags.some(tag => q.tag.includes(tag.publicId))) return false;
      if (q.from || q.to) {
        if (!item.publishedAt) return false;
        const day = this.dayOf(item.publishedAt);
        if (q.from && day < q.from || q.to && day > q.to) return false;
      }
      return true;
    };
    const facet = (category, options) => {
      const matching = items.filter(item => match(item, category));
      return options.map(option => ({ value: option.value, label: option.label, count: matching.filter(item => category === 'type' ? item.type === option.value : category === 'author' ? item.author && item.author.publicId === option.value : item.tags.some(tag => tag.publicId === option.value)).length }))
        .filter(option => option.count || q[category].includes(option.value));
    };
    const options = (category, values) => {
      const map = new Map(values.map(value => [value.value, value]));
      q[category].forEach(value => { if (!map.has(value)) map.set(value, { value, label: value }); });
      return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
    };
    const facets = {
      types: facet('type', ['ARTICLE', 'STORY', 'LINK'].map(value => ({ value, label: value[0] + value.slice(1).toLowerCase() }))),
      authors: facet('author', options('author', items.filter(item => item.author).map(item => ({ value: item.author.publicId, label: item.author.displayName })))),
      tags: facet('tag', options('tag', items.flatMap(item => item.tags.map(tag => ({ value: tag.publicId, label: tag.label })))))
    };
    const found = items.filter(item => match(item)).sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || a.id.localeCompare(b.id));
    const totalPages = Math.ceil(found.length / q.size);
    const page = Math.min(q.page, Math.max(1, totalPages));
    return this.envelope({ items: found.slice((page - 1) * q.size, page * q.size), page: { number: page, size: q.size, totalItems: found.length, totalPages }, facets }, at);
  }
  get(id) {
    const at = this.now().toISOString();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(id || '')) return this.envelope({ item: null }, at);
    const pair = this.repository.getPublic(id);
    if (!pair) return this.envelope({ item: null }, at);
    const item = this.summary(pair.metadata, this.repository.labels());
    item.revision = 'revision-' + (Date.parse(item.updatedAt) || 0);
    item.content = publicMarkdownBlocks(pair.body.bodyMarkdown || '');
    return this.envelope({ item }, at);
  }
}

// Compatibility adapter for the existing Markdown editor. HTML remains ordinary text.
export function publicMarkdownBlocks(source) {
  const inline = text => {
    const spans = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    const add = (text, marks = [], href = null) => { if (text) spans.push({ text, marks, href }); };
    for (const match of String(text).matchAll(re)) {
      add(text.slice(cursor, match.index));
      const token = match[0];
      if (token.startsWith('**')) add(token.slice(2, -2), ['bold']);
      else if (token.startsWith('*')) add(token.slice(1, -1), ['italic']);
      else {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        // The website performs URL validation too. Unsupported schemes stay readable as text.
        if (/^https:\/\/[^\s@]+$/i.test(link[2])) add(link[1], [], link[2]); else add(token);
      }
      cursor = match.index + token.length;
    }
    add(text.slice(cursor));
    return spans;
  };
  const blocks = []; let list = null; let verse = null;
  const flush = () => { if (list) blocks.push(list); list = null; };
  for (const line of String(source).replace(/\r\n?/g, '\n').split('\n')) {
    if (line === '```verse') { flush(); verse = []; continue; }
    if (verse) { if (line === '```') { blocks.push({ type: 'verse', text: verse.join('\n') }); verse = null; } else verse.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const item = line.match(/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/);
    if (item) { const ordered = Boolean(item[2]); if (list && list.ordered !== ordered) flush(); if (!list) list = { type: 'list', ordered, items: [] }; list.items.push(inline(item[3])); continue; }
    flush();
    if (heading) blocks.push({ type: 'heading', level: heading[1].length + 1, spans: inline(heading[2]) });
    else if (/^(?:---+|\*\*\*+)\s*$/.test(line)) blocks.push({ type: 'sceneBreak' });
    else if (line.startsWith('> ')) blocks.push({ type: 'quote', spans: inline(line.slice(2)) });
    else blocks.push({ type: 'paragraph', spans: inline(line) });
  }
  flush(); if (verse) blocks.push({ type: 'verse', text: '```verse\n' + verse.join('\n') });
  return { version: 1, blocks };
}
