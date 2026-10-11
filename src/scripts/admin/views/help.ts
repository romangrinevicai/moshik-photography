/** Help: static guide rendered by HelpPanel.astro; only in-page jumps are handled here. */
import type { View } from '../core/view';

let wired = false;

export const helpView: View = {
  mount() {
    if (wired) return;
    wired = true;
    document.querySelectorAll<HTMLAnchorElement>('[data-help-jump]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(a.dataset.helpJump!);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target?.focus({ preventScroll: true });
      }),
    );
  },
};
