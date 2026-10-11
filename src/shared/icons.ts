import { brandIcons, strokeIcons } from './icon-data';

export type StrokeIconName = keyof typeof strokeIcons;
export type BrandIconName = keyof typeof brandIcons;
export type IconName = StrokeIconName | BrandIconName;

/** Returns an inline SVG string. Stroke icons use a thin, refined line weight. */
export function iconSvg(name: IconName, opts: { size?: number | string; stroke?: number; className?: string; label?: string } = {}): string {
  const { size = '1em', stroke = 1.4, className = '', label } = opts;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  const cls = `icon icon--${name}${className ? ` ${className}` : ''}`;
  if (name in brandIcons) {
    const d = brandIcons[name as BrandIconName];
    return `<svg class="${cls}" ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg>`;
  }
  const body = strokeIcons[name as StrokeIconName] ?? '';
  return `<svg class="${cls}" ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
