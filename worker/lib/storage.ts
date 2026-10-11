export const keys = {
  gallery: (gid: string) => `galleries/${gid}/gallery.json`,
  manifest: (gid: string) => `galleries/${gid}/manifest.json`,
  galleryPrefix: (gid: string) => `galleries/${gid}/`,
  photosPrefix: (gid: string) => `galleries/${gid}/photos/`,
  photo: (gid: string, pid: string, variant: string) => `galleries/${gid}/photos/${pid}/${variant}`,
  facesIndex: (gid: string) => `galleries/${gid}/faces/index.json`,
  facesBin: (gid: string) => `galleries/${gid}/faces/descriptors.bin`,
  people: (gid: string) => `galleries/${gid}/faces/people.json`,
  personCrop: (gid: string, personId: string) => `galleries/${gid}/people/${personId}`,
  selectionsPrefix: (gid: string) => `galleries/${gid}/selections/`,
  selection: (gid: string, id: string) => `galleries/${gid}/selections/${id}.json`,
  code: (normalized: string) => `codes/${normalized}.json`,
  leadsPrefix: 'leads/',
  lead: (id: string) => `leads/${id}.json`,
  availability: 'settings/availability.json',
};

export async function getJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  try {
    return (await obj.json()) as T;
  } catch {
    return null;
  }
}

export async function putJson(bucket: R2Bucket, key: string, data: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(data), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
}

export async function listAll(bucket: R2Bucket, prefix: string, opts: { include?: ('customMetadata' | 'httpMetadata')[]; delimiter?: string; limit?: number } = {}) {
  const objects: R2Object[] = [];
  const prefixes: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, include: opts.include, delimiter: opts.delimiter, limit: 1000 });
    objects.push(...page.objects);
    prefixes.push(...page.delimitedPrefixes);
    cursor = page.truncated ? page.cursor : undefined;
    if (opts.limit && objects.length >= opts.limit) break;
  } while (cursor);
  return { objects, prefixes };
}

export async function deletePrefix(bucket: R2Bucket, prefix: string): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    const batch = page.objects.map((o) => o.key);
    if (batch.length) {
      await bucket.delete(batch);
      deleted += batch.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}
