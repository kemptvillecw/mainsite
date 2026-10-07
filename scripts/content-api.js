import config from '../data/content.js';
import { validatePublicList, validatePublicDetail } from './public-content-contract.js';
export function createContentClient(settings = config, transport = fetch) {
  async function request(action, query, signal) {
    if (!settings.enabled) throw new Error('Content browsing is being prepared. Please check back soon.');
    const url = new URL(settings.publicApiUrl);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Content is temporarily unavailable.');
    url.search = query.toString();
    url.searchParams.set('action', action);
    url.searchParams.set('_', String(Date.now()));
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, settings.timeoutMs);
    try {
      const response = await transport(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'follow' });
      if (!response.ok) throw new Error('Content is temporarily unavailable. Please try again.');
      const raw = await response.text();
      if (raw.length > 2000000) throw new Error('Content could not be loaded.');
      const data = JSON.parse(raw);
      if (data.ok === false) throw new Error(data.code === 'INVALID_QUERY' ? 'Check the selected filters and dates.' : 'Content is temporarily unavailable. Please try again.');
      return action === 'public.list' ? validatePublicList(data) : validatePublicDetail(data);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw new Error('The content request took too long. Please try again.');
      if (error instanceof TypeError) throw new Error('Unable to reach the content service. Please try again.');
      if (error instanceof SyntaxError || error.name === 'PublicContentError') throw new Error('Content could not be loaded. Please try again later.');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  return {
    list(params, signal) {
      const query = new URLSearchParams();
      for (const key of ['type', 'author', 'tag', 'from', 'to', 'page']) for (const value of params.getAll(key)) query.append(key, value);
      query.set('size', String(settings.pageSize));
      return request('public.list', query, signal);
    },
    get(id, signal) { return request('public.get', new URLSearchParams({ id }), signal); }
  };
}
