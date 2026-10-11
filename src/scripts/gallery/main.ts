/**
 * Client gallery entry point.
 *   /gallery/               → code entry
 *   /gallery/?code=XXXX     → redeem the code, then show the gallery
 *   /gallery/?g={id}[&p=…]  → load the gallery directly (optionally open a photo)
 */
import type { ClientStrings } from '~/components/gallery/copy';
import { ID_RE } from '~/shared/gallery-types';
import { api } from './api';
import { initFormat } from './format';
import { endBoot, initEntry, normalizeCode, problemOf, showEntry, showGalleryView, showProblem, startBoot, syncLangLink } from './entry';
import { mountGallery, type AppConfig } from './app';
import { store } from './store';

interface Config extends AppConfig {
  strings: ClientStrings;
}

const cfg = JSON.parse(document.getElementById('gallery-config')!.textContent!) as Config;
initFormat(cfg.strings, cfg.lang);

let mounted = false;

async function openGallery(gid: string, opts: { viaCode: boolean; ref: string; photo?: string | null }) {
  try {
    const manifest = await api.gallery(gid);
    if (mounted) return;
    mounted = true;
    showGalleryView();
    mountGallery(manifest, cfg, { photo: opts.photo });
    endBoot();
  } catch (err) {
    const problem = problemOf(err, opts.viaCode);
    if (problem === 'missing' || problem === 'notFound') store.forgetRecent(gid);
    showProblem(problem, opts.ref);
  }
}

async function redeem(code: string, auto: boolean) {
  let id: string;
  try {
    id = (await api.access(code)).id;
  } catch (err) {
    const problem = problemOf(err, true);
    if (auto && problem !== 'notFound') {
      showProblem(problem, code);
    } else {
      // Show the code so it can be corrected; drop it from the address bar.
      if (auto) history.replaceState(null, '', location.pathname);
      syncLangLink();
      showEntry({ code, problem });
    }
    return;
  }
  history.replaceState(null, '', `${location.pathname}?g=${encodeURIComponent(id)}`);
  syncLangLink();
  if (!auto) startBoot();
  await openGallery(id, { viaCode: true, ref: code });
}

initEntry({
  submit: (code) => redeem(code, false),
  retry: () => location.reload(),
});
syncLangLink();

const params = new URLSearchParams(location.search);
const gid = params.get('g')?.trim();
const code = normalizeCode(params.get('code') ?? '');
if (gid) {
  if (ID_RE.test(gid)) void openGallery(gid, { viaCode: false, ref: gid, photo: params.get('p') });
  else showProblem('missing', gid);
} else if (code) {
  void redeem(code, true);
} else {
  showEntry();
}
