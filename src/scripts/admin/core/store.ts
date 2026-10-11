/** Small shared cache so moving between screens feels instant. */
import type { GalleryRecord } from '~/shared/gallery-types';

export const store = {
  galleries: null as GalleryRecord[] | null,

  /** Keep the list in sync after edits made in the gallery editor. */
  upsertGallery(g: GalleryRecord) {
    if (!this.galleries) return;
    const i = this.galleries.findIndex((x) => x.id === g.id);
    if (i >= 0) this.galleries[i] = { ...this.galleries[i], ...g };
    else this.galleries.unshift(g);
  },

  removeGallery(id: string) {
    if (this.galleries) this.galleries = this.galleries.filter((g) => g.id !== id);
  },

  reset() {
    this.galleries = null;
  },
};
