import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createZipStream, zipSize, type ZipEntry } from '../../worker/lib/zip';
import { crc32 } from '../../src/shared/crc32';

const enc = new TextEncoder();

function entry(name: string, data: Uint8Array, chunk = 7): ZipEntry {
  return {
    name,
    size: data.length,
    crc: crc32(data),
    date: new Date('2026-05-20T18:30:00'),
    open: async () =>
      new ReadableStream<Uint8Array>({
        start(c) {
          for (let i = 0; i < data.length; i += chunk) c.enqueue(data.slice(i, i + chunk));
          c.close();
        },
      }),
  };
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const pyCheck = (file: string) =>
  execFileSync('python3', ['-c', `import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); bad=z.testzip(); print(json.dumps({"bad":bad,"names":z.namelist()[:5],"count":len(z.namelist())}))`, file]).toString();

describe('streaming zip', () => {
  it('produces a valid archive with the exact advertised size and UTF-8 names', async () => {
    const files = [
      entry('נועה ודניאל/0001 - חופה.jpg', enc.encode('first file contents '.repeat(50))),
      entry('נועה ודניאל/0002 - party.jpg', crypto.getRandomValues(new Uint8Array(5000))),
      entry('נועה ודניאל/0003 - empty.jpg', new Uint8Array(0)),
    ];
    const { stream, size } = createZipStream(files);
    const bytes = await collect(stream);
    expect(bytes.length).toBe(size);
    expect(zipSize(files)).toBe(size);
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const file = join(dir, 'test.zip');
    writeFileSync(file, bytes);
    const result = JSON.parse(pyCheck(file));
    expect(result.bad).toBeNull();
    expect(result.count).toBe(3);
    expect(result.names[0]).toBe('נועה ודניאל/0001 - חופה.jpg');
    // the system unzip tool agrees
    expect(execFileSync('unzip', ['-t', file]).toString()).toMatch(/No errors detected/);
  });

  it('switches to ZIP64 records when there are more than 65,534 entries', async () => {
    const tiny = enc.encode('x');
    const files: ZipEntry[] = Array.from({ length: 65_540 }, (_, i) => ({ ...entry(`f${i}.txt`, tiny, 1) }));
    const { stream, size } = createZipStream(files);
    const bytes = await collect(stream);
    expect(bytes.length).toBe(size);
    const dir = mkdtempSync(join(tmpdir(), 'zip64-'));
    const file = join(dir, 'big.zip');
    writeFileSync(file, bytes);
    const result = JSON.parse(pyCheck(file));
    expect(result.count).toBe(65_540);
    expect(result.bad).toBeNull();
  });

  it('errors when a file is shorter than declared', async () => {
    const bad = { ...entry('a.jpg', enc.encode('hello')), size: 10 };
    const { stream } = createZipStream([bad]);
    await expect(collect(stream)).rejects.toThrow(/Size mismatch/);
  });
});
