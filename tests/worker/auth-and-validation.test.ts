import { describe, expect, it } from 'vitest';
import { createSession, verifySession, safeEqual, getCookie } from '../../worker/lib/auth';
import { accessCode, normalizeCode, randomId, leadId } from '../../worker/lib/ids';
import { validateInquiry, replyGreeting } from '../../worker/routes/inquiry';
import { toWhatsAppNumber } from '../../worker/lib/notify';
import { isExpired, safeName } from '../../worker/lib/galleries';
import { ID_RE } from '../../src/shared/gallery-types';
import type { Env } from '../../worker/env';

const env = { SESSION_SECRET: 'test-secret-value', ADMIN_PASSWORD: 'pw' } as unknown as Env;

describe('admin sessions', () => {
  it('signs and verifies tokens, rejecting tampering and expiry', async () => {
    const { token } = await createSession(env);
    expect(await verifySession(env, token)).toBe(true);
    expect(await verifySession(env, token.slice(0, -2) + 'xx')).toBe(false);
    expect(await verifySession({ ...env, SESSION_SECRET: 'other' } as Env, token)).toBe(false);
    expect(await verifySession(env, token, Date.now() + 15 * 24 * 3600 * 1000)).toBe(false);
    expect(await verifySession(env, null)).toBe(false);
  });

  it('compares secrets safely and parses cookies', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    const req = new Request('https://x.test', { headers: { cookie: 'a=1; mp_admin=v1.2.3.4; b=2' } });
    expect(getCookie(req, 'mp_admin')).toBe('v1.2.3.4');
  });
});

describe('ids and codes', () => {
  it('creates unguessable ids that match the shared pattern', () => {
    const ids = new Set(Array.from({ length: 500 }, () => randomId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(ID_RE.test(id)).toBe(true);
  });

  it('builds friendly access codes', () => {
    expect(accessCode('Noa & Daniel')).toMatch(/^NOA-DANIEL-[A-Z2-9]{4}$/);
    expect(accessCode('נועה ודניאל')).toMatch(/^M-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizeCode(' noa-daniel k7qm ')).toBe('NOADANIELK7QM');
  });

  it('orders leads newest first', () => {
    const older = leadId(1_700_000_000_000);
    const newer = leadId(1_800_000_000_000);
    expect(newer < older).toBe(true);
  });
});

describe('inquiry validation', () => {
  const valid = { name: 'Noa Levi', phone: '050-123-4567', eventType: 'weddings', date: '2027-06-10', lang: 'he' };

  it('accepts a good inquiry and normalises fields', () => {
    const { lead, errors } = validateInquiry({ ...valid, addons: ['magnets', 'album'], message: '  hi \u0007 there ' });
    expect(errors).toEqual([]);
    expect(lead?.message).toBe('hi  there');
    expect(lead?.addons).toEqual(['magnets', 'album']);
  });

  it('reports invalid fields', () => {
    const { errors } = validateInquiry({ ...valid, name: 'a', phone: '12', email: 'bad@', eventType: 'x', date: '10/06/2027' });
    expect(errors.sort()).toEqual(['date', 'email', 'eventType', 'name', 'phone']);
  });

  it('prepares a WhatsApp reply in the client language', () => {
    expect(toWhatsAppNumber('050-123-4567')).toBe('972501234567');
    expect(toWhatsAppNumber('+972 50 123 4567')).toBe('972501234567');
    expect(replyGreeting({ ...valid, lang: 'en', name: 'Noa Levi' } as never)).toMatch(/^Hi Noa! It's Moshik/);
    expect(replyGreeting({ ...valid, lang: 'he', name: 'נועה לוי' } as never)).toMatch(/^היי נועה! כאן מושיק/);
  });
});

describe('gallery helpers', () => {
  it('handles expiry dates at the end of the day in Israel', () => {
    expect(isExpired({ expiresAt: '2000-01-01' })).toBe(true);
    expect(isExpired({ expiresAt: '2999-01-01' })).toBe(false);
    expect(isExpired({})).toBe(false);
  });

  it('makes safe file names and keeps Hebrew', () => {
    expect(safeName('נועה / דניאל: "חתונה"')).toBe('נועה דניאל חתונה');
    expect(safeName('   ')).toBe('gallery');
  });
});
