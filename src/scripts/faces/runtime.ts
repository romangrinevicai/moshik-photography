/**
 * Lazy runtime: imports the face engine (TF.js bundle, ~1.3 MB) on first use,
 * picks a compute backend and downloads the model weights with progress.
 * Nothing heavy happens at import time.
 */
import { FaceError } from './errors';
import type { ProgressFn } from './types';
import { withBase } from '../../config/base';

export type FaceApi = typeof import('@vladmandic/face-api/dist/face-api.esm.js');
export type Backend = 'webgl' | 'wasm' | 'cpu';
type WeightSpecs = Parameters<FaceApi['tf']['io']['decodeWeights']>[1];

/** The parts of the TF.js runtime used here that the bundled typings do not declare. */
export interface TfRuntime {
  setBackend(name: string): Promise<boolean>;
  getBackend(): string;
  ready(): Promise<void>;
  env(): { set(flag: string, value: unknown): void; flagRegistry?: Record<string, unknown> };
  memory(): { numTensors: number; numBytes: number; numBytesInGPU?: number; numBytesInGPUAllocated?: number };
  setWasmPaths?(prefix: string): void;
}

export interface FaceSettings {
  /** Base URL of the model files. */
  modelUrl: string;
  /**
   * Where the WASM backend fetches its binaries — used only when WebGL is not
   * available. `null` disables the WASM fallback (the slower CPU backend is used).
   */
  wasmPath: string | null;
  /** Force one backend (testing / troubleshooting). */
  backend: Backend | null;
}

export const settings: FaceSettings = {
  modelUrl: withBase('/models/face-api'),
  // Self-hosted by scripts/copy-face-models.mjs. The binaries must match the TF.js
  // version bundled in the engine exactly (4.22.0, pinned in package.json).
  wasmPath: withBase('/models/tfjs-wasm/'),
  backend: null,
};

const MODELS = [
  { net: 'ssdMobilenetv1', file: 'ssd_mobilenetv1_model', label: 'detector' },
  { net: 'faceLandmark68Net', file: 'face_landmark_68_model', label: 'landmarks' },
  { net: 'faceRecognitionNet', file: 'face_recognition_model', label: 'recognition' },
] as const;

interface ManifestGroup {
  paths: string[];
  weights: { name: string; shape: number[]; dtype: string; quantization?: { dtype: string } }[];
}

let apiPromise: Promise<FaceApi> | null = null;
let readyPromise: Promise<FaceApi> | null = null;
let backend: Backend | null = null;
const listeners = new Set<ProgressFn>();

export const tfRuntime = (api: FaceApi) => api.tf as unknown as TfRuntime;

/** The compute backend in use (null until the models are loaded). */
export const activeBackend = (): Backend | null => backend;

function emit(done: number, total: number, message: string) {
  for (const fn of listeners) {
    try {
      fn({ stage: 'models', done, total, message });
    } catch {
      /* a broken listener must not break loading */
    }
  }
}

function importEngine(): Promise<FaceApi> {
  apiPromise ??= import('@vladmandic/face-api/dist/face-api.esm.js').catch((err: unknown) => {
    apiPromise = null;
    throw new FaceError('unsupported', 'Could not load the face recognition engine', { cause: err });
  });
  return apiPromise;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function pickBackend(api: FaceApi): Promise<Backend> {
  const tf = tfRuntime(api);
  const order: Backend[] = settings.backend ? [settings.backend] : ['webgl', 'wasm', 'cpu'];
  for (const name of order) {
    if (name === 'webgl' && !hasWebGL()) continue;
    if (name === 'wasm') {
      if (!settings.wasmPath || typeof WebAssembly !== 'object' || !tf.setWasmPaths) continue;
      tf.setWasmPaths(settings.wasmPath);
    }
    try {
      if (await withTimeout(tf.setBackend(name), 20_000)) {
        await tf.ready();
        if (name === 'webgl') tuneWebGL(tf);
        return name;
      }
    } catch {
      /* try the next backend */
    }
  }
  throw new FaceError('unsupported', 'No compute backend is available in this browser');
}

function tuneWebGL(tf: TfRuntime) {
  try {
    // Bound the texture pool so long gallery runs cannot grow GPU memory without limit.
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 256 * 1024 * 1024);
  } catch {
    /* flag unknown to this TF.js version */
  }
}

const bytesPerValue = (dtype: string) =>
  dtype === 'uint8' || dtype === 'bool' ? 1 : dtype === 'uint16' || dtype === 'float16' ? 2 : 4;

async function fetchModelFile(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status < 500) break;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  const reason = lastError instanceof Error ? lastError.message : 'network error';
  throw new FaceError('models', `Could not download ${url.split('/').pop()} (${reason})`, { cause: lastError });
}

async function readWithProgress(res: Response, onBytes: (n: number) => void): Promise<Uint8Array> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onBytes(buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onBytes(value.byteLength);
  }
  return concat(chunks);
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1 && parts[0]!.byteOffset === 0 && parts[0]!.byteLength === parts[0]!.buffer.byteLength) return parts[0]!;
  const out = new Uint8Array(parts.reduce((s, p) => s + p.byteLength, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

/** Downloads (in parallel) and installs the weights of every model that is not loaded yet. */
async function loadWeights(api: FaceApi) {
  const pending = MODELS.filter((m) => !api.nets[m.net].isLoaded);
  if (!pending.length) return;
  const base = settings.modelUrl.replace(/\/+$/, '');
  const manifests = await Promise.all(
    pending.map(async (m) => (await (await fetchModelFile(`${base}/${m.file}-weights_manifest.json`)).json()) as ManifestGroup[]),
  );
  const total = manifests
    .flat()
    .flatMap((g) => g.weights)
    .reduce((sum, w) => sum + w.shape.reduce((a, b) => a * b, 1) * bytesPerValue(w.quantization?.dtype ?? w.dtype), 0);
  let done = 0;
  emit(0, total, 'download');
  await Promise.all(
    pending.map(async (m, i) => {
      const weightMap = {};
      for (const group of manifests[i]!) {
        const parts = await Promise.all(
          group.paths.map(async (path) =>
            readWithProgress(await fetchModelFile(`${base}/${path}`), (n) => {
              done += n;
              emit(Math.min(done, total), total, m.label);
            }),
          ),
        );
        const data = concat(parts);
        Object.assign(weightMap, api.tf.io.decodeWeights(data.buffer as ArrayBuffer, group.weights as unknown as WeightSpecs));
      }
      api.nets[m.net].loadFromWeightMap(weightMap);
    }),
  );
}

/**
 * Loads the engine, picks a backend and downloads the models — once; later
 * calls resolve immediately. Every caller waiting on the same load receives
 * the progress events. Rejects with a FaceError (a retry is possible).
 */
export function ensureReady(onProgress?: ProgressFn): Promise<FaceApi> {
  if (onProgress) listeners.add(onProgress);
  readyPromise ??= (async () => {
    if (typeof document === 'undefined') throw new FaceError('unsupported', 'Face recognition needs a browser');
    emit(0, 1, 'engine');
    const api = await importEngine();
    backend ??= await pickBackend(api);
    await loadWeights(api);
    return api;
  })().catch((err: unknown) => {
    readyPromise = null;
    throw err instanceof FaceError ? err : new FaceError('models', 'Could not prepare face recognition', { cause: err });
  });
  if (!onProgress) return readyPromise;
  return readyPromise.then(
    (api) => {
      listeners.delete(onProgress);
      try {
        onProgress({ stage: 'models', done: 1, total: 1, message: 'ready' });
      } catch {
        /* a broken listener must not break loading */
      }
      return api;
    },
    (err: unknown) => {
      listeners.delete(onProgress);
      throw err;
    },
  );
}
