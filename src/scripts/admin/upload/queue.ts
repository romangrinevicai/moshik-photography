/**
 * Upload queue (one per tab, independent of the views so moving around the
 * admin never interrupts an upload).
 *
 * Per photo: decode + resize in the browser → CRC-32 → PUT thumb → PUT original
 * (optional) → PUT web LAST with X-Photo-Meta (the photo exists once web exists).
 * 3 photos in flight, 2 retries per request, stall detection, pause / cancel.
 */
import type { PhotoMeta } from '~/shared/gallery-types';
import { crc32Blob } from '~/shared/crc32';
import { ApiError, encodeMeta, isAbort, putBlob } from '../core/api';
import { holdUnload, keepAwake } from '../core/ui';
import { naturalCompare } from '../core/i18n';
import { readTakenAt } from '../lib/exif';
import { photoId } from '../lib/ids';
import { DecodeError, extOf, isImageFile, isRaw, mimeOf, preparePhoto } from '../lib/image';

export type ItemStatus = 'queued' | 'preparing' | 'uploading' | 'done' | 'skipped' | 'failed' | 'cancelled';
export type ItemReason = 'duplicate' | 'heic' | 'raw' | 'decode' | 'too-large' | 'network' | 'server' | 'auth' | 'unknown';

export interface UploadItem {
  key: string;
  gid: string;
  file: File;
  name: string;
  path: string;
  size: number;
  set?: string;
  order: number;
  keepOriginal: boolean;
  status: ItemStatus;
  reason?: ItemReason;
  /** Original was larger than the 100 MB request limit, so only web + thumb were stored. */
  originalSkipped?: boolean;
  loaded: number;
  total: number;
  attempts: number;
  dupCandidates?: PhotoMeta[];
  photo?: PhotoMeta;
  preview?: string;
  controller?: AbortController;
}

export interface AddResult {
  added: number;
  duplicates: number;
  notImages: number;
  raw: number;
}

export interface QueueStats {
  total: number;
  done: number;
  failed: number;
  skipped: number;
  cancelled: number;
  queued: number;
  active: number;
  bytesTotal: number;
  bytesDone: number;
  speed: number;
  eta: number;
}

const CONCURRENCY = 3;
const PREPARE_CONCURRENCY = (navigator.hardwareConcurrency ?? 4) >= 8 ? 2 : 1;
const MAX_RETRIES = 2;
const MAX_PUT = 100 * 1024 * 1024;
const STALL_MS = 60_000;
const RETRYABLE = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

/** Rough bytes to send before a photo is resized (refined once prepared). */
const estimate = (file: File, keep: boolean) => Math.min(file.size, 1_400_000) + (keep ? file.size : 0);

class UploadQueue extends EventTarget {
  items: UploadItem[] = [];
  state: 'idle' | 'running' | 'paused' = 'idle';
  private active = 0;
  private preparing = 0;
  private prepWaiters: (() => void)[] = [];
  private sent = 0;
  private samples: { t: number; bytes: number }[] = [];
  private changedGids = new Set<string>();
  private seq = 0;
  private emitQueued = false;

  /* ───────────── public API ───────────── */

  add(gid: string, files: File[], opts: { set?: string; keepOriginals: boolean; existing: PhotoMeta[]; pathOf?: (f: File) => string }): AddResult {
    const result: AddResult = { added: 0, duplicates: 0, notImages: 0, raw: 0 };
    const pathOf = opts.pathOf ?? ((f: File) => f.webkitRelativePath || f.name);
    const sorted = [...files].sort((a, b) => naturalCompare(pathOf(a), pathOf(b)));
    const byName = new Map<string, PhotoMeta[]>();
    for (const p of opts.existing) if (p.name) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
    const queued = new Set(this.items.filter((i) => i.gid === gid && i.status !== 'failed' && i.status !== 'cancelled' && i.status !== 'skipped').map((i) => `${i.name}|${i.size}`));
    let order = this.nextOrder(gid, opts.existing);

    for (const file of sorted) {
      if (!isImageFile(file)) {
        if (isRaw(file)) result.raw++;
        else result.notImages++;
        continue;
      }
      const sig = `${file.name}|${file.size}`;
      const same = byName.get(file.name) ?? [];
      if (queued.has(sig) || same.some((p) => p.origSize === file.size)) {
        result.duplicates++;
        continue;
      }
      queued.add(sig);
      const candidates = same.filter((p) => p.origSize === undefined);
      this.items.push({
        key: `u${++this.seq}`,
        gid,
        file,
        name: file.name,
        path: pathOf(file),
        size: file.size,
        set: opts.set || undefined,
        order: order++,
        keepOriginal: opts.keepOriginals,
        status: 'queued',
        loaded: 0,
        total: estimate(file, opts.keepOriginals),
        attempts: 0,
        dupCandidates: candidates.length ? candidates : undefined,
      });
      result.added++;
    }
    if (result.added) {
      if (this.state === 'idle') this.state = 'running';
      this.pump();
    }
    this.emit();
    return result;
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.emit();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.pump();
    this.emit();
  }

  /** Stop everything for a gallery (or all): in-flight requests are aborted. */
  cancel(gid?: string) {
    for (const item of this.items) {
      if (gid && item.gid !== gid) continue;
      if (item.status === 'queued') item.status = 'cancelled';
      else if (item.status === 'preparing' || item.status === 'uploading') item.controller?.abort();
    }
    this.pump();
    this.emit();
  }

  retryFailed(gid?: string) {
    let n = 0;
    for (const item of this.items) {
      if ((gid && item.gid !== gid) || item.status !== 'failed') continue;
      if (item.reason === 'heic' || item.reason === 'raw' || item.reason === 'decode') continue;
      item.status = 'queued';
      item.reason = undefined;
      item.loaded = 0;
      item.attempts = 0;
      n++;
    }
    if (n) {
      if (this.state === 'idle') this.state = 'running';
      this.pump();
    }
    this.emit();
    return n;
  }

  /** Forget finished rows (done / skipped / cancelled / failed). */
  clearFinished(gid?: string) {
    this.items = this.items.filter((i) => {
      const keep = (gid && i.gid !== gid) || i.status === 'queued' || i.status === 'preparing' || i.status === 'uploading';
      if (!keep && i.preview) URL.revokeObjectURL(i.preview);
      return keep;
    });
    this.emit();
  }

  forGallery(gid: string) {
    return this.items.filter((i) => i.gid === gid);
  }

  busy(gid?: string) {
    return this.items.some((i) => (!gid || i.gid === gid) && (i.status === 'queued' || i.status === 'preparing' || i.status === 'uploading'));
  }

  stats(gid?: string): QueueStats {
    const list = gid ? this.forGallery(gid) : this.items;
    const s: QueueStats = { total: 0, done: 0, failed: 0, skipped: 0, cancelled: 0, queued: 0, active: 0, bytesTotal: 0, bytesDone: 0, speed: 0, eta: Number.NaN };
    for (const i of list) {
      if (i.status === 'skipped') {
        s.skipped++;
        continue;
      }
      if (i.status === 'cancelled') {
        s.cancelled++;
        continue;
      }
      s.total++;
      if (i.status === 'done') s.done++;
      else if (i.status === 'failed') s.failed++;
      else if (i.status === 'queued') s.queued++;
      else s.active++;
      if (i.status !== 'failed') {
        s.bytesTotal += i.total;
        s.bytesDone += i.status === 'done' ? i.total : i.loaded;
      }
    }
    const now = performance.now();
    const first = this.samples.find((x) => now - x.t <= 12_000);
    if (first && now - first.t > 1500) s.speed = ((this.sent - first.bytes) / (now - first.t)) * 1000;
    if (s.speed > 0) s.eta = Math.max(0, s.bytesTotal - s.bytesDone) / s.speed;
    return s;
  }

  /* ───────────── engine ───────────── */

  private nextOrder(gid: string, existing: PhotoMeta[]) {
    let max = -1;
    existing.forEach((p, i) => (max = Math.max(max, p.order ?? i)));
    for (const i of this.items) if (i.gid === gid && i.status !== 'cancelled') max = Math.max(max, i.order);
    return max + 1;
  }

  private pump() {
    if (this.state === 'running') {
      while (this.active < CONCURRENCY) {
        const next = this.items.find((i) => i.status === 'queued');
        if (!next) break;
        this.active++;
        next.status = 'preparing';
        void this.run(next).finally(() => {
          this.active--;
          this.pump();
          this.emit();
        });
      }
    }
    const pending = this.items.some((i) => i.status === 'queued');
    if (this.active === 0 && !pending && this.state !== 'idle') this.finish();
    const busy = this.active > 0 || pending;
    holdUnload('upload', busy);
    void keepAwake('upload', this.active > 0);
  }

  private finish() {
    this.state = 'idle';
    this.samples = [];
    const gids = [...this.changedGids];
    this.changedGids.clear();
    this.dispatchEvent(new CustomEvent('drain', { detail: { gids } }));
  }

  private async acquirePrep() {
    if (this.preparing < PREPARE_CONCURRENCY) {
      this.preparing++;
      return;
    }
    await new Promise<void>((r) => this.prepWaiters.push(r));
    this.preparing++;
  }

  private releasePrep() {
    this.preparing--;
    this.prepWaiters.shift()?.();
  }

  private track(item: UploadItem, loaded: number) {
    const delta = loaded - item.loaded;
    if (delta > 0) this.sent += delta;
    item.loaded = Math.max(0, loaded);
    const now = performance.now();
    const last = this.samples[this.samples.length - 1];
    if (!last || now - last.t > 400) {
      this.samples.push({ t: now, bytes: this.sent });
      while (this.samples.length && now - this.samples[0]!.t > 20_000) this.samples.shift();
    }
    this.emit();
  }

  private async withRetry<T>(item: UploadItem, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (isAbort(e) || !(e instanceof ApiError) || !RETRYABLE.has(e.status) || attempt >= MAX_RETRIES) throw e;
        item.attempts++;
        this.emit();
        const retryAfter = (e as ApiError & { retryAfter?: number }).retryAfter;
        const wait = e.status === 429 ? Math.min(30, retryAfter ?? 5) * 1000 : 1500 * (attempt + 1) ** 2;
        await sleep(wait + Math.random() * 400, item.controller?.signal);
      }
    }
  }

  private async run(item: UploadItem) {
    const ctrl = new AbortController();
    item.controller = ctrl;
    try {
      await this.acquirePrep();
      let prepared;
      let takenAt: string | undefined;
      let webCrc = 0;
      let origCrc = 0;
      try {
        if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        [prepared, takenAt] = await Promise.all([preparePhoto(item.file), readTakenAt(item.file)]);
        webCrc = await crc32Blob(prepared.web);
        if (item.keepOriginal && item.file.size <= MAX_PUT) origCrc = await crc32Blob(item.file);
      } finally {
        this.releasePrep();
      }
      if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // Same file name already in the gallery without a stored original: compare the resized bytes.
      if (item.dupCandidates?.some((p) => p.webSize === prepared.web.size)) {
        item.status = 'skipped';
        item.reason = 'duplicate';
        return;
      }

      const keepOriginal = item.keepOriginal && item.file.size <= MAX_PUT;
      item.originalSkipped = item.keepOriginal && !keepOriginal;
      const id = photoId();
      const origExt = extOf(item.name) || 'jpg';
      const meta: Omit<PhotoMeta, 'id'> = {
        w: prepared.w,
        h: prepared.h,
        ...(item.set ? { set: item.set } : {}),
        name: item.name,
        order: item.order,
        ...(takenAt ? { takenAt } : {}),
        webSize: prepared.web.size,
        webCrc,
        ...(keepOriginal ? { origSize: item.file.size, origCrc, origExt } : {}),
      };
      item.total = prepared.thumb.size + prepared.web.size + (keepOriginal ? item.file.size : 0);
      item.loaded = 0;
      item.preview = URL.createObjectURL(prepared.thumb);
      item.status = 'uploading';
      this.emit();

      const base = `/api/admin/galleries/${encodeURIComponent(item.gid)}/photos/${id}`;
      let sentParts = 0;
      const put = async (variant: 'thumb' | 'original' | 'web', blob: Blob, contentType: string, header: Record<string, unknown>) => {
        await this.withRetry(item, () =>
          putBlob(`${base}/${variant}`, blob, {
            contentType,
            headers: { 'X-Photo-Meta': encodeMeta(header) },
            signal: ctrl.signal,
            stallMs: STALL_MS,
            onProgress: (loaded) => this.track(item, sentParts + loaded),
          }),
        );
        sentParts += blob.size;
        this.track(item, sentParts);
      };
      await put('thumb', prepared.thumb, 'image/jpeg', { name: item.name });
      if (keepOriginal) await put('original', item.file, mimeOf(item.file), { name: item.name, origExt });
      await put('web', prepared.web, 'image/jpeg', meta);

      item.status = 'done';
      item.photo = { id, ...meta, uploadedAt: new Date().toISOString() };
      this.changedGids.add(item.gid);
      this.dispatchEvent(new CustomEvent('photo', { detail: { gid: item.gid, photo: item.photo } }));
    } catch (e) {
      if (isAbort(e)) {
        item.status = 'cancelled';
      } else if (e instanceof DecodeError) {
        item.status = 'failed';
        item.reason = e.kind;
      } else if (e instanceof ApiError) {
        item.status = 'failed';
        item.reason = e.status === 401 ? 'auth' : e.status === 413 ? 'too-large' : e.status === 0 ? 'network' : 'server';
        if (e.status === 401) this.pause();
      } else {
        item.status = 'failed';
        item.reason = 'unknown';
      }
    } finally {
      item.controller = undefined;
      if (item.preview && item.status !== 'uploading') {
        URL.revokeObjectURL(item.preview);
        item.preview = undefined;
      }
    }
  }

  private emit() {
    if (this.emitQueued) return;
    this.emitQueued = true;
    requestAnimationFrame(() => {
      this.emitQueued = false;
      this.dispatchEvent(new Event('change'));
    });
  }
}

export const uploads = new UploadQueue();
