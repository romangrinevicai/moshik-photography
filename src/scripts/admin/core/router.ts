/** Hash routing: #/galleries, #/galleries/{gid}/{tab}, #/inquiries/{id}, #/availability, #/help */

export const EDITOR_TABS = ['photos', 'details', 'faces', 'share', 'selections'] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

export type Route =
  | { view: 'galleries' }
  | { view: 'gallery'; id: string; tab: EditorTab }
  | { view: 'inquiries'; id?: string }
  | { view: 'availability' }
  | { view: 'help' };

export type ViewName = Route['view'];

export function parseHash(hash: string = location.hash): Route {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  switch (parts[0]) {
    case 'galleries': {
      const id = parts[1];
      if (id && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
        const tab = (EDITOR_TABS as readonly string[]).includes(parts[2] ?? '') ? (parts[2] as EditorTab) : 'photos';
        return { view: 'gallery', id, tab };
      }
      return { view: 'galleries' };
    }
    case 'inquiries':
      return { view: 'inquiries', id: parts[1] };
    case 'availability':
      return { view: 'availability' };
    case 'help':
      return { view: 'help' };
    default:
      return { view: 'galleries' };
  }
}

export const routes = {
  galleries: () => '#/galleries',
  gallery: (id: string, tab: EditorTab = 'photos') => `#/galleries/${encodeURIComponent(id)}${tab === 'photos' ? '' : `/${tab}`}`,
  inquiries: (id?: string) => (id ? `#/inquiries/${encodeURIComponent(id)}` : '#/inquiries'),
  availability: () => '#/availability',
  help: () => '#/help',
};

export function go(hash: string) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

/** Change the URL without triggering a route change (e.g. reverting a cancelled navigation). */
export function replaceHash(hash: string) {
  history.replaceState(history.state, '', hash || location.pathname);
}
