/**
 * "Find me": the guest takes a selfie (or picks a photo), the face module
 * computes a 128-number descriptor on the device, and only those numbers are
 * sent to the API, which returns the photos with a matching face.
 *
 * The face module is loaded on demand. Tests can inject a stand-in through
 * `window.__MOSHIK_FACES__` (same shape as ~/scripts/faces).
 */
import type * as Faces from '~/scripts/faces';
import { ApiError, api, media } from './api';
import { t, tn } from './format';
import { closeDialog, openDialog } from './ui';
import { iconSvg } from '~/shared/icons';

type FacesModule = Pick<typeof Faces, 'loadFaceModels' | 'describeSelfie'>;

export interface FindMeContext {
  dlg: HTMLDialogElement;
  gid: string;
  total: () => number;
  has: (pid: string) => boolean;
  /** Matches found (closest first). Called as soon as the search succeeds. */
  onResult: (ids: string[]) => void;
  onClose?: () => void;
}

type Outcome = 'found' | 'none' | 'noface' | 'unavailable' | 'notready' | 'denied' | 'network';

let facesPromise: Promise<FacesModule> | null = null;
let modelsPromise: Promise<void> | null = null;
let modelProgress = -1;
const progressListeners = new Set<(p: number) => void>();

function loadFaces(): Promise<FacesModule> {
  const injected = (window as unknown as { __MOSHIK_FACES__?: FacesModule }).__MOSHIK_FACES__;
  facesPromise ??= injected ? Promise.resolve(injected) : import('~/scripts/faces');
  return facesPromise;
}

/** Load the face models once (also used to warm up as soon as the dialog opens). */
function prepare(): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = loadFaces()
      .then((m) =>
        m.loadFaceModels((info) => {
          if (info.stage !== 'models' || !info.total) return;
          modelProgress = Math.max(0, Math.min(1, info.done / info.total));
          progressListeners.forEach((fn) => fn(modelProgress));
        }),
      )
      .then(() => {
        modelProgress = 1;
      });
    modelsPromise.catch(() => {
      // allow a later retry
      modelsPromise = null;
      facesPromise = null;
      modelProgress = -1;
    });
  }
  return modelsPromise;
}

export function initFindMe(ctx: FindMeContext) {
  const { dlg } = ctx;
  const panes = [...dlg.querySelectorAll<HTMLElement>('[data-fm-pane]')];
  const video = dlg.querySelector<HTMLVideoElement>('[data-fm-video]')!;
  const preview = dlg.querySelector<HTMLCanvasElement>('[data-fm-preview]')!;
  const status = dlg.querySelector<HTMLElement>('[data-fm-status]')!;
  const bar = dlg.querySelector<HTMLElement>('[data-fm-progress]')!;
  const fileInput = dlg.querySelector<HTMLInputElement>('[data-fm-file]')!;
  const fileCamera = dlg.querySelector<HTMLInputElement>('[data-fm-file-camera]')!;
  const resultIcon = dlg.querySelector<HTMLElement>('[data-fm-result-icon]')!;
  const resultTitle = dlg.querySelector<HTMLElement>('[data-fm-result-title]')!;
  const resultText = dlg.querySelector<HTMLElement>('[data-fm-result-text]')!;
  const resultThumbs = dlg.querySelector<HTMLElement>('[data-fm-thumbs]')!;
  const btnShow = dlg.querySelector<HTMLButtonElement>('[data-fm-show]')!;
  const btnRetry = dlg.querySelector<HTMLButtonElement>('[data-fm-retry]')!;
  const btnUploadAlt = dlg.querySelector<HTMLButtonElement>('[data-fm-upload-alt]')!;
  let stream: MediaStream | null = null;
  let runId = 0;

  const show = (name: string) => panes.forEach((p) => (p.hidden = p.dataset.fmPane !== name));

  const stopCamera = () => {
    stream?.getTracks().forEach((tr) => tr.stop());
    stream = null;
    video.srcObject = null;
  };

  const setProgress = (p: number | null) => {
    const track = bar.parentElement!;
    track.classList.toggle('is-indeterminate', p === null);
    bar.style.inlineSize = p === null ? '' : `${Math.round(4 + p * 96)}%`;
  };

  const outcome = (kind: Outcome, ids: string[] = []) => {
    show('result');
    const icon: Record<Outcome, Parameters<typeof iconSvg>[0]> = {
      found: 'sparkles',
      none: 'search',
      noface: 'scan-face',
      unavailable: 'info',
      notready: 'hourglass',
      denied: 'camera',
      network: 'refresh-cw',
    };
    resultIcon.innerHTML = iconSvg(icon[kind], { size: 22 });
    resultIcon.classList.toggle('g-dlg__badge--gold', kind === 'found');
    const copy: Record<Outcome, [string, string]> = {
      found: [tn('fmFound', ids.length), t('fmFoundText')],
      none: [t('fmNoneTitle'), t('fmNoneText')],
      noface: [t('fmNoFaceTitle'), t('fmNoFaceText')],
      unavailable: [t('fmUnavailableTitle'), t('fmUnavailableText')],
      notready: [t('fmNotReadyTitle'), t('fmNotReadyText')],
      denied: [t('fmCameraDeniedTitle'), t('fmCameraDeniedText')],
      network: [t('errNetworkTitle'), t('errNetworkText')],
    };
    resultTitle.textContent = copy[kind][0];
    resultText.textContent = copy[kind][1];
    resultThumbs.replaceChildren();
    if (kind === 'found') {
      ids.slice(0, 5).forEach((id, i) => {
        const img = document.createElement('img');
        img.src = media.photo(ctx.gid, id, 'thumb');
        img.alt = '';
        img.style.animationDelay = `${i * 70}ms`;
        resultThumbs.append(img);
      });
    }
    btnShow.hidden = kind !== 'found';
    btnRetry.hidden = kind === 'unavailable' || kind === 'notready';
    btnUploadAlt.hidden = kind !== 'denied';
    btnRetry.textContent = kind === 'network' ? t('actRetry') : t('fmRetry');
    resultTitle.focus({ preventScroll: true });
  };

  /** Square, centred preview of what is being analysed. */
  const drawPreview = async (source: Blob | HTMLCanvasElement, mirror: boolean) => {
    const size = 320;
    preview.width = size;
    preview.height = size;
    const c = preview.getContext('2d');
    if (!c) return;
    let img: CanvasImageSource | null = null;
    let w = 0;
    let h = 0;
    try {
      if (source instanceof HTMLCanvasElement) {
        img = source;
        w = source.width;
        h = source.height;
      } else {
        const bmp = await createImageBitmap(source, { imageOrientation: 'from-image' } as ImageBitmapOptions);
        img = bmp;
        w = bmp.width;
        h = bmp.height;
      }
    } catch {
      return;
    }
    const s = Math.min(w, h);
    c.save();
    if (mirror) {
      c.translate(size, 0);
      c.scale(-1, 1);
    }
    c.drawImage(img, (w - s) / 2, Math.max(0, (h - s) / 2 - h * 0.05), s, s, 0, 0, size, size);
    c.restore();
  };

  const run = async (source: Blob | HTMLCanvasElement, mirror = false) => {
    const id = ++runId;
    show('work');
    void drawPreview(source, mirror);
    status.textContent = t('fmPreparing');
    setProgress(modelProgress >= 0 ? modelProgress : null);
    const onProgress = (p: number) => id === runId && setProgress(p);
    progressListeners.add(onProgress);
    let faces: FacesModule;
    try {
      faces = await loadFaces();
      await prepare();
    } catch {
      progressListeners.delete(onProgress);
      if (id === runId) outcome('unavailable');
      return;
    }
    progressListeners.delete(onProgress);
    if (id !== runId) return;
    status.textContent = t('fmDetecting');
    setProgress(null);
    let selfie: Awaited<ReturnType<FacesModule['describeSelfie']>>;
    try {
      selfie = await faces.describeSelfie(source);
    } catch {
      if (id === runId) outcome('unavailable');
      return;
    }
    if (id !== runId) return;
    if (!selfie) return outcome('noface');
    status.textContent = t('fmSearching', { count: tn('photos', ctx.total()) });
    try {
      const matches = await api.searchFaces(ctx.gid, Array.from(selfie.descriptor));
      if (id !== runId) return;
      const seen = new Set<string>();
      const ids = [...matches]
        .sort((a, b) => a.distance - b.distance)
        .map((m) => m.id)
        .filter((pid) => ctx.has(pid) && !seen.has(pid) && !!seen.add(pid));
      if (!ids.length) return outcome('none');
      ctx.onResult(ids);
      outcome('found', ids);
    } catch (err) {
      if (id !== runId) return;
      const e = err as ApiError;
      if (e instanceof ApiError && e.kind === 'http' && e.status === 404) outcome('notready');
      else if (e instanceof ApiError && e.kind === 'network') outcome('network');
      else outcome('unavailable');
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      // No live camera (old browser / insecure context): the OS camera via file input.
      fileCamera.click();
      return;
    }
    show('camera');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (!dlg.open) return stopCamera();
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      dlg.querySelector<HTMLElement>('[data-fm-capture]')?.focus({ preventScroll: true });
    } catch {
      stopCamera();
      outcome('denied');
    }
  };

  const capture = () => {
    if (!stream || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    stopCamera();
    void run(canvas, true);
  };

  const onFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void run(file);
  };

  dlg.querySelector('[data-fm-camera]')!.addEventListener('click', () => void startCamera());
  dlg.querySelector('[data-fm-upload]')!.addEventListener('click', () => fileInput.click());
  btnUploadAlt.addEventListener('click', () => fileInput.click());
  dlg.querySelector('[data-fm-back]')!.addEventListener('click', () => {
    stopCamera();
    show('intro');
  });
  dlg.querySelector('[data-fm-capture]')!.addEventListener('click', capture);
  fileInput.addEventListener('change', () => onFile(fileInput));
  fileCamera.addEventListener('change', () => onFile(fileCamera));
  btnRetry.addEventListener('click', () => {
    runId++;
    show('intro');
    dlg.querySelector<HTMLElement>('[data-fm-camera]')?.focus();
  });
  btnShow.addEventListener('click', () => void closeDialog(dlg));

  return {
    open() {
      runId++;
      show('intro');
      openDialog(dlg, {
        focus: dlg.querySelector<HTMLElement>('[data-fm-camera]'),
        onClose: () => {
          runId++;
          stopCamera();
          ctx.onClose?.();
        },
      });
      // Warm up the models while the guest decides; errors surface later.
      prepare().catch(() => undefined);
    },
  };
}
