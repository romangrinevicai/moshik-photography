/** Types shared by the Worker API, the client gallery and the admin panel. */

export type GalleryStatus = 'draft' | 'published' | 'archived';
export type PhotoVariant = 'thumb' | 'web' | 'original';

export interface GallerySet {
  id: string;
  name: string;
}

/** Stored at galleries/{id}/gallery.json — the admin-side source of truth. */
export interface GalleryRecord {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  date?: string;
  lang: 'he' | 'en';
  status: GalleryStatus;
  coverPhotoId?: string;
  allowDownload: boolean;
  allowOriginals: boolean;
  faceSearch: boolean;
  /** Poll for new photos while the event is still happening. */
  live?: boolean;
  expiresAt?: string;
  message?: string;
  /** Optional: send visitors to an external gallery (Pixieset, Drive…) instead. */
  externalUrl?: string;
  sets: GallerySet[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  photoCount?: number;
}

/** Per-photo metadata kept in R2 customMetadata of the web variant. */
export interface PhotoMeta {
  id: string;
  w: number;
  h: number;
  set?: string;
  name?: string;
  order?: number;
  takenAt?: string;
  /** byte size + CRC-32 of each stored variant, used for streaming ZIPs */
  webSize?: number;
  webCrc?: number;
  origSize?: number;
  origCrc?: number;
  origExt?: string;
  uploadedAt?: string;
}

export interface Person {
  id: string;
  /** Number of photos this person appears in. */
  count: number;
  photoIds: string[];
  /** Whether a cropped face thumbnail exists at /media/{gallery}/people/{id}. */
  hasCrop: boolean;
}

/** Public manifest at galleries/{id}/manifest.json (what visitors download). */
export interface GalleryManifest {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  lang: 'he' | 'en';
  message?: string;
  coverPhotoId?: string;
  allowDownload: boolean;
  allowOriginals: boolean;
  faceSearch: boolean;
  live?: boolean;
  externalUrl?: string;
  sets: GallerySet[];
  photos: PhotoMeta[];
  people: Person[];
  hasFaces: boolean;
  version: number;
  updatedAt: string;
}

/** Face index stored with the gallery (admin-computed, browser-side). */
export interface FaceIndex {
  version: number;
  dims: number;
  /** One entry per detected face; descriptors live in descriptors.bin in the same order. */
  faces: { p: string; b: [number, number, number, number]; s?: number }[];
}

export interface FaceSearchMatch {
  id: string;
  distance: number;
}

export interface Selection {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
  photoIds: string[];
  createdAt: string;
}

export type LeadStatus = 'new' | 'contacted' | 'booked' | 'lost';

export interface Lead {
  id: string;
  status: LeadStatus;
  createdAt: string;
  lang: 'he' | 'en';
  eventType: string;
  date?: string;
  dateFlexible?: boolean;
  venue?: string;
  guests?: string;
  package?: string;
  addons?: string[];
  budget?: string;
  name: string;
  phone: string;
  email?: string;
  contactPref?: string;
  source?: string;
  message?: string;
  page?: string;
  referrer?: string;
  utm?: Record<string, string>;
  country?: string;
  notes?: string;
  summary?: string;
}

export interface Availability {
  booked: string[];
  limited: string[];
  updatedAt?: string;
}

export const ID_RE = /^[A-Za-z0-9]{6,32}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Face-api 128-d descriptors: same person ≈ < 0.5, different people ≈ > 0.6. */
export const FACE_MATCH_THRESHOLD = 0.5;
export const FACE_DIMS = 128;
/** Max photos per ZIP part, keeps each download comfortably within limits. */
export const ZIP_PART_SIZE = 250;
