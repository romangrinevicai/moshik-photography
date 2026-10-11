/**
 * Download dialog: favourites and the whole gallery as ZIP parts of at most
 * ZIP_PART_SIZE photos, web size or originals, with sizes from the manifest.
 */
import { ZIP_PART_SIZE, type PhotoMeta } from '~/shared/gallery-types';
import { iconSvg } from '~/shared/icons';
import { media } from './api';
import { fmtBytes, t, tn } from './format';
import { openDialog, toast } from './ui';

type Variant = 'web' | 'original';

export interface DownloadContext {
  dlg: HTMLDialogElement;
  gid: string;
  /** All photos, in manifest order (ZIP parts follow this order). */
  photos: PhotoMeta[];
  favIds: string[];
  allowOriginals: boolean;
}

/** Total bytes of some photos; `approx` when some sizes are unknown. */
export function sizeOf(list: PhotoMeta[], variant: Variant): { bytes: number; approx: boolean } | null {
  let known = 0;
  let count = 0;
  for (const p of list) {
    const b = variant === 'original' ? (p.origSize ?? p.webSize) : p.webSize;
    if (typeof b === 'number' && b > 0) {
      known += b;
      count++;
    }
  }
  if (!count) return null;
  if (count === list.length) return { bytes: known, approx: false };
  return { bytes: (known / count) * list.length, approx: true };
}

export function chunk<T>(list: T[], size = ZIP_PART_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const DL_ICON = iconSvg('download', { size: 18 });
const sizeLabel = (s: ReturnType<typeof sizeOf>) => (s ? `${s.approx ? '≈ ' : ''}${fmtBytes(s.bytes)}` : '');

function item(href: string, title: string, sub: string, size: string): HTMLLIElement {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'g-dl__item';
  a.href = href;
  a.setAttribute('download', '');
  a.innerHTML = `<span class="g-dl__item-icon">${DL_ICON}</span><span class="g-dl__item-text"><strong></strong><small></small></span><span class="g-dl__size"></span>`;
  a.querySelector('strong')!.textContent = title;
  a.querySelector('small')!.textContent = sub;
  a.querySelector('.g-dl__size')!.textContent = size;
  a.addEventListener('click', () => toast(t('dlStarting'), { icon: 'download' }));
  li.append(a);
  return li;
}

export function openDownloads(ctx: DownloadContext) {
  const { dlg, gid, photos, allowOriginals } = ctx;
  const quality = dlg.querySelector<HTMLFieldSetElement>('[data-dl-quality]')!;
  const favBox = dlg.querySelector<HTMLElement>('[data-dl-favs]')!;
  const allList = dlg.querySelector<HTMLUListElement>('[data-dl-all]')!;
  const note = dlg.querySelector<HTMLElement>('[data-dl-note]')!;
  const byId = new Map(photos.map((p) => [p.id, p]));
  const favs = ctx.favIds.map((id) => byId.get(id)).filter((p): p is PhotoMeta => !!p);
  quality.hidden = !allowOriginals;
  if (!allowOriginals) quality.querySelector<HTMLInputElement>('input[value="web"]')!.checked = true;

  const render = () => {
    const variant: Variant = allowOriginals && quality.querySelector<HTMLInputElement>('input:checked')?.value === 'original' ? 'original' : 'web';
    const kind = variant === 'original' ? t('dlOrig') : t('dlWeb');
    // favourites
    favBox.replaceChildren();
    if (!favs.length) {
      const p = document.createElement('p');
      p.className = 'g-dl__empty';
      p.textContent = t('dlFavsEmpty');
      favBox.append(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'g-dl__list';
      ul.setAttribute('role', 'list');
      const parts = chunk(favs);
      parts.forEach((part, i) => {
        const title = parts.length > 1 ? `${t('dlPart', { n: i + 1 })} · ${tn('photos', part.length)}` : tn('photos', part.length);
        ul.append(item(media.zipIds(gid, variant, part.map((p) => p.id)), title, `ZIP · ${kind}`, sizeLabel(sizeOf(part, variant))));
      });
      favBox.append(ul);
    }
    // whole gallery
    allList.replaceChildren();
    const parts = chunk(photos);
    parts.forEach((part, i) => {
      const a = i * ZIP_PART_SIZE + 1;
      const b = a + part.length - 1;
      const title = parts.length > 1 ? t('dlPart', { n: i + 1 }) : tn('photos', part.length);
      const sub = parts.length > 1 ? `${t('dlRange', { a, b })} · ${kind}` : `ZIP · ${kind}`;
      allList.append(item(media.zipPart(gid, variant, i + 1), title, sub, sizeLabel(sizeOf(part, variant))));
    });
    note.textContent = t('dlNote', { n: ZIP_PART_SIZE });
  };
  quality.onchange = render;
  render();
  openDialog(dlg);
}
