// End-to-end API flow. Start `npm run preview` (wrangler dev, local R2, .dev.vars ADMIN_PASSWORD) and run:
//   node tests/e2e/api-flow.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'devpass';
const ROOT = process.cwd();
const TMP = (await import('node:os')).tmpdir();
let cookie = '';
const ok = (cond, msg) => { if (!cond) { console.error('✗', msg); process.exitCode = 1; } else console.log('✓', msg); };

// CRC-32 (same algorithm as src/shared/crc32.ts)
const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

async function api(path, { method = 'GET', body, headers = {}, raw = false, admin = false } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (admin && method !== 'GET') h['x-requested-with'] = 'moshik-admin';
  let payload = body;
  if (body && !(body instanceof Uint8Array) && !(body instanceof Buffer)) { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  if (raw) return res;
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, res };
}

// 1. Inquiry (public)
const started = Date.now() - 10_000;
let r = await api('/api/inquiry', { method: 'POST', body: { lang: 'he', eventType: 'weddings', date: '2027-06-10', name: 'נועה לוי', phone: '050-123-4567', email: 'noa@example.com', message: 'נשמח לשמוע פרטים', startedAt: started, addons: ['magnets'], summary: 'test' } });
ok(r.status === 200 && r.data.ok, `inquiry accepted (${r.status})`);
r = await api('/api/inquiry', { method: 'POST', body: { name: 'x', phone: '1', eventType: 'weddings', startedAt: started } });
ok(r.status === 400 && r.data.code === 'invalid', 'invalid inquiry rejected');
r = await api('/api/inquiry', { method: 'POST', body: { name: 'Bot', phone: '0501234567', eventType: 'weddings', company: 'spam inc', startedAt: started } });
ok(r.status === 200, 'honeypot answered quietly');

// 2. Admin auth
r = await api('/api/admin/galleries');
ok(r.status === 401, 'admin requires login');
r = await api('/api/admin/login', { method: 'POST', body: { password: 'wrong' } });
ok(r.status === 401, 'wrong password rejected');
r = await api('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
ok(r.status === 200 && cookie.startsWith('mp_admin='), 'login sets session cookie');
r = await api('/api/admin/galleries', { method: 'POST', body: { title: 'Noa & Daniel' } });
ok(r.status === 403 && r.data.code === 'csrf', 'mutations require X-Requested-With');

// 3. Leads
r = await api('/api/admin/leads');
ok(r.status === 200 && r.data.leads.length >= 1 && r.data.leads[0].name === 'נועה לוי', 'lead stored and listed');
const leadId = r.data.leads[0].id;
r = await api(`/api/admin/leads/${leadId}`, { method: 'PATCH', admin: true, body: { status: 'contacted', notes: 'called back' } });
ok(r.status === 200 && r.data.lead.status === 'contacted', 'lead status updated');

// 4. Gallery create + upload
r = await api('/api/admin/galleries', { method: 'POST', admin: true, body: { title: 'Noa & Daniel', subtitle: 'Wedding · Caesarea', date: '2026-09-18', lang: 'he' } });
ok(r.status === 200 && r.data.gallery.code.startsWith('NOA-DANIEL-'), `gallery created with code ${r.data.gallery?.code}`);
const g = r.data.gallery;
const sources = ['stories/noa-and-daniel/01.jpg', 'stories/noa-and-daniel/02.jpg', 'stories/noa-and-daniel/03.jpg', 'portfolio/weddings/05.jpg'];
const pids = [];
for (const [i, src] of sources.entries()) {
  const input = readFileSync(`${ROOT}/src/assets/photos/${src}`);
  const meta = await sharp(input).metadata();
  const web = await sharp(input).resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  const thumb = await sharp(input).resize({ width: 640, height: 640, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
  const pid = 'P' + Math.random().toString(36).slice(2, 12).padEnd(10, 'x') + 'abcde';
  pids.push(pid);
  let x = await api(`/api/admin/galleries/${g.id}/photos/${pid}/thumb`, { method: 'PUT', admin: true, body: thumb, headers: { 'content-type': 'image/jpeg' } });
  ok(x.status === 200, `thumb ${i + 1} uploaded`);
  x = await api(`/api/admin/galleries/${g.id}/photos/${pid}/original`, { method: 'PUT', admin: true, body: input, headers: { 'content-type': 'image/jpeg', 'x-photo-meta': encodeURIComponent(JSON.stringify({ name: `חתונה-${i + 1}.jpg`, origExt: 'jpg' })) } });
  ok(x.status === 200, `original ${i + 1} uploaded`);
  const pmeta = { w: meta.width, h: meta.height, name: `חתונה-${i + 1}.jpg`, order: i, webSize: web.length, webCrc: crc32(web), origSize: input.length, origCrc: crc32(input), origExt: 'jpg' };
  x = await api(`/api/admin/galleries/${g.id}/photos/${pid}/web`, { method: 'PUT', admin: true, body: web, headers: { 'content-type': 'image/jpeg', 'x-photo-meta': encodeURIComponent(JSON.stringify(pmeta)) } });
  ok(x.status === 200 && x.data.size === web.length, `web ${i + 1} uploaded with meta`);
}
r = await api(`/api/admin/galleries/${g.id}/photos/${pids[0]}/web`, { method: 'PUT', admin: true, body: Buffer.from('x'), headers: { 'content-type': 'image/jpeg' } });
ok(r.status === 400, 'web upload without X-Photo-Meta rejected');

// 5. Not visible before publishing
const savedCookie = cookie; cookie = '';
r = await api('/api/gallery/access', { method: 'POST', body: { code: g.code.toLowerCase().replace(/-/g, ' ') } });
ok(r.status === 403 && r.data.code === 'draft', 'draft gallery hidden from visitors');
r = await api(`/media/${g.id}/${pids[0]}/thumb`, { raw: true });
ok(r.status === 404, 'draft media hidden from visitors');
cookie = savedCookie;

// 6. Faces: fake two faces of the same person + one other
const desc = (seed) => { let s = seed; return Array.from({ length: 128 }, () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return ((s / 0x7fffffff) - 0.5) * 0.3; }); };
const personA = desc(7), personB = desc(99);
const near = personA.map((v, i) => v + Math.sin(i) * 0.01);
function encode(descs) {
  const out = Buffer.alloc(descs.length * 132);
  descs.forEach((d, i) => { const max = Math.max(...d.map(Math.abs)); const scale = max / 127; out.writeFloatLE(scale, i * 132); d.forEach((v, k) => out.writeInt8(Math.round(v / scale), i * 132 + 4 + k)); });
  return out;
}
r = await api(`/api/admin/galleries/${g.id}/faces/index`, { method: 'PUT', admin: true, body: { version: Date.now(), dims: 128, faces: [{ p: pids[0], b: [0.1, 0.1, 0.2, 0.2], s: 0.99 }, { p: pids[1], b: [0.3, 0.1, 0.2, 0.2], s: 0.95 }, { p: pids[2], b: [0.3, 0.1, 0.2, 0.2], s: 0.9 }] } });
ok(r.status === 200, 'face index uploaded');
r = await api(`/api/admin/galleries/${g.id}/faces/descriptors`, { method: 'PUT', admin: true, body: encode([personA, near, personB]), headers: { 'content-type': 'application/octet-stream' } });
ok(r.status === 200, 'face descriptors uploaded');
const crop = await sharp(readFileSync(`${ROOT}/src/assets/photos/portfolio/portraits/01.jpg`)).resize(192, 192).jpeg().toBuffer();
r = await api(`/api/admin/galleries/${g.id}/people/personAAAAA1`, { method: 'PUT', admin: true, body: crop, headers: { 'content-type': 'image/jpeg' } });
ok(r.status === 200, 'person crop uploaded');
r = await api(`/api/admin/galleries/${g.id}/faces/people`, { method: 'PUT', admin: true, body: { people: [{ id: 'personAAAAA1', photoIds: [pids[0], pids[1]], count: 2, hasCrop: true }] } });
ok(r.status === 200, 'people uploaded');

// 7. Publish
r = await api(`/api/admin/galleries/${g.id}/publish`, { method: 'POST', admin: true, body: { status: 'published' } });
ok(r.status === 200 && r.data.manifest.photos.length === 4 && r.data.manifest.people.length === 1 && r.data.manifest.hasFaces, 'published manifest has photos, people and faces');
ok(r.data.manifest.photos[0].name === 'חתונה-1.jpg' && r.data.manifest.photos[0].webCrc > 0, 'photo metadata survives (Hebrew names, CRCs)');

// 8. Visitor flow
cookie = '';
r = await api('/api/gallery/access', { method: 'POST', body: { code: g.code.toLowerCase().replace(/-/g, ' ') } });
ok(r.status === 200 && r.data.id === g.id, 'code works case/dash-insensitively');
r = await api('/api/gallery/access', { method: 'POST', body: { code: 'NOPE-NOPE-1234' } });
ok(r.status === 404, 'unknown code → 404');
r = await api(`/api/gallery/${g.id}`);
ok(r.status === 200 && r.data.gallery.title === 'Noa & Daniel', 'visitor reads manifest');
const m = r.data.gallery;
r = await api(`/media/${g.id}/${pids[0]}/thumb`, { raw: true });
ok(r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && r.headers.get('cache-control').includes('immutable'), 'thumb served with long cache');
const etag = r.headers.get('etag');
r = await api(`/media/${g.id}/${pids[0]}/thumb`, { raw: true, headers: { 'if-none-match': etag } });
ok(r.status === 304, 'conditional request → 304');
r = await api(`/media/${g.id}/${pids[0]}/original`, { raw: true });
ok(r.status === 403, 'originals blocked when allowOriginals=false');
r = await api(`/media/${g.id}/${pids[0]}/web?dl=1`, { raw: true });
ok(r.status === 200 && /attachment/.test(r.headers.get('content-disposition')), 'single download has attachment header');
r = await api(`/media/${g.id}/people/personAAAAA1`, { raw: true });
ok(r.status === 200, 'person crop served');

// 9. Face search
r = await api(`/api/gallery/${g.id}/faces/search`, { method: 'POST', body: { descriptor: personA.map((v, i) => v + Math.cos(i) * 0.005) } });
ok(r.status === 200 && r.data.matches.map((x) => x.id).join() === [pids[0], pids[1]].join(), `face search finds the right photos (${JSON.stringify(r.data.matches)})`);
r = await api(`/api/gallery/${g.id}/faces/search`, { method: 'POST', body: { descriptor: [1, 2] } });
ok(r.status === 400, 'bad descriptor rejected');

// 10. ZIP
r = await api(`/api/gallery/${g.id}/zip?variant=web`, { raw: true });
const zipBuf = Buffer.from(await r.arrayBuffer());
ok(r.status === 200 && Number(r.headers.get('content-length')) === zipBuf.length, `zip streamed with exact content-length (${zipBuf.length} bytes)`);
writeFileSync(`${TMP}/moshik-e2e.zip`, zipBuf);
const zipCheck = execFileSync('python3', ['-c', 'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({"bad": z.testzip(), "names": z.namelist()}, ensure_ascii=False))', `${TMP}/moshik-e2e.zip`]).toString();
const zc = JSON.parse(zipCheck);
ok(zc.bad === null && zc.names.length === 4, `zip valid: ${zc.names.join(' | ')}`);
r = await api(`/api/gallery/${g.id}/zip?variant=web&ids=${pids[1]},${pids[3]}`, { raw: true });
ok(r.status === 200, 'favourites zip ok');
r = await api(`/api/gallery/${g.id}/zip?variant=original`, { raw: true });
ok(r.status === 403, 'originals zip blocked');

// 11. Selections
r = await api(`/api/gallery/${g.id}/selections`, { method: 'POST', body: { name: 'נועה', phone: '0501234567', note: 'לאלבום', photoIds: [pids[0], pids[2], 'NOTREALID123'] } });
ok(r.status === 200, 'selection submitted');

// 12. Admin follow-ups
cookie = savedCookie;
r = await api(`/api/admin/galleries/${g.id}/selections`);
ok(r.status === 200 && r.data.selections[0].photoIds.length === 2, 'selection stored (unknown ids dropped)');
r = await api('/api/admin/galleries', { method: 'POST', admin: true, body: { title: 'Second', code: 'SECOND-CODE' } });
const g2 = r.data.gallery;
r = await api(`/api/admin/galleries/${g2.id}`, { method: 'PATCH', admin: true, body: { code: g.code } });
ok(r.status === 409 && r.data.code === 'code_taken', 'duplicate code → 409');
r = await api(`/api/admin/galleries/${g.id}`, { method: 'PATCH', admin: true, body: { allowOriginals: true, message: 'תודה שבחרתם בי ❤️', sets: [{ id: 'ceremony', name: 'חופה' }] } });
ok(r.status === 200 && r.data.gallery.allowOriginals === true, 'settings updated');
cookie = '';
r = await api(`/media/${g.id}/${pids[0]}/original?dl=1`, { raw: true });
ok(r.status === 200 && /%D7%97%D7%AA%D7%95%D7%A0%D7%94/.test(r.headers.get('content-disposition')), 'original download allowed after toggle (UTF-8 filename)');
r = await api(`/api/gallery/${g.id}`);
ok(r.data.gallery.message === 'תודה שבחרתם בי ❤️', 'manifest refreshed after settings change');
cookie = savedCookie;
r = await api('/api/admin/availability', { method: 'PUT', admin: true, body: { booked: ['2027-06-10', 'bad', '2027-06-10'], limited: ['2027-06-17', '2027-06-10'] } });
ok(r.status === 200, 'availability saved');
cookie = '';
r = await api('/api/availability');
ok(JSON.stringify(r.data.booked) === '["2027-06-10"]' && JSON.stringify(r.data.limited) === '["2027-06-17"]', 'public availability cleaned & deduped');
cookie = savedCookie;
r = await api(`/api/admin/galleries/${g.id}`);
ok(r.status === 200 && r.data.photos.length === 4 && r.data.faces.faces === 3, 'admin gallery detail');
r = await api('/api/admin/galleries');
ok(r.data.galleries.length >= 2, 'admin gallery list');
r = await api(`/api/admin/galleries/${g2.id}`, { method: 'DELETE', admin: true });
ok(r.status === 200, 'gallery deleted');
r = await api('/api/admin/logout', { method: 'POST', admin: true });
r = await api('/api/admin/session');
ok(r.status === 401, 'logout clears session');
console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED', '· gallery id', g.id, '· code', g.code);
