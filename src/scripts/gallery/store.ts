/**
 * Browser-side memory for the client gallery: favourites (per gallery),
 * recently opened galleries, sent selections, contact details for the
 * selection form and the last "find me" result (session only).
 * Storage can be unavailable (private mode, blocked cookies) — everything
 * degrades to in-memory state.
 */
const P = 'moshik-gallery';

function read<T>(key: string, fallback: T, store: Storage | null = safeLocal()): T {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown, store: Storage | null = safeLocal()) {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or privacy mode — ignore */
  }
}
function safeLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function safeSession(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export interface RecentGallery {
  id: string;
  title: string;
  cover?: string;
  at: number;
}
export interface SentInfo {
  count: number;
  at: number;
  ids: string[];
}
export interface ContactInfo {
  name?: string;
  phone?: string;
  email?: string;
}

export const favKey = (gid: string) => `${P}:favs:${gid}`;

export const store = {
  recent: (): RecentGallery[] => read<RecentGallery[]>(`${P}:recent`, []).filter((r) => r && typeof r.id === 'string'),
  pushRecent(entry: Omit<RecentGallery, 'at'>) {
    const list = store.recent().filter((r) => r.id !== entry.id);
    list.unshift({ ...entry, at: Date.now() });
    write(`${P}:recent`, list.slice(0, 4));
  },
  forgetRecent(id: string) {
    write(`${P}:recent`, store.recent().filter((r) => r.id !== id));
  },
  sent: (gid: string): SentInfo | null => read<SentInfo | null>(`${P}:sent:${gid}`, null),
  setSent: (gid: string, info: SentInfo) => write(`${P}:sent:${gid}`, info),
  contact: (): ContactInfo => read<ContactInfo>(`${P}:contact`, {}),
  setContact: (c: ContactInfo) => write(`${P}:contact`, c),
  me: (gid: string): string[] => read<string[]>(`${P}:me:${gid}`, [], safeSession()),
  setMe: (gid: string, ids: string[] | null) => write(`${P}:me:${gid}`, ids, safeSession()),
};

/** Favourites of one gallery, persisted per browser and synced across tabs. */
export class Favourites extends EventTarget {
  private set: Set<string>;
  constructor(private gid: string) {
    super();
    this.set = new Set(read<string[]>(favKey(gid), []));
    window.addEventListener('storage', (e) => {
      if (e.key !== favKey(gid)) return;
      this.set = new Set(read<string[]>(favKey(gid), []));
      this.emit(null);
    });
  }
  has = (pid: string) => this.set.has(pid);
  get size() {
    return this.set.size;
  }
  /** Favourite ids, in the given order (photos no longer in the gallery are dropped). */
  ordered(order: string[]): string[] {
    return order.filter((id) => this.set.has(id));
  }
  toggle(pid: string, on = !this.set.has(pid)): boolean {
    if (on) this.set.add(pid);
    else this.set.delete(pid);
    write(favKey(this.gid), [...this.set]);
    this.emit(pid);
    return on;
  }
  /** Drop ids that are not part of the gallery any more. */
  prune(valid: Set<string>) {
    const before = this.set.size;
    for (const id of this.set) if (!valid.has(id)) this.set.delete(id);
    if (this.set.size !== before) write(favKey(this.gid), [...this.set]);
  }
  private emit(pid: string | null) {
    this.dispatchEvent(new CustomEvent('change', { detail: { pid } }));
  }
}
