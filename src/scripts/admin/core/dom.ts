/** Tiny DOM helpers — no framework, just readable element builders. */
import { iconSvg, type IconName } from '~/shared/icons';

export type Child = Node | string | number | null | undefined | false | Child[];
export type Props = Record<string, unknown>;

/** Properties that must be set as DOM properties rather than attributes. */
const PROPS = new Set(['value', 'checked', 'selected', 'indeterminate', 'defaultValue']);

export function append(el: Element | DocumentFragment, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

/** Replace an element's children (nulls and arrays allowed). */
export function setChildren(el: Element, ...children: Child[]) {
  el.replaceChildren();
  append(el, children);
}

/**
 * h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'Label', icon('x'))
 * `on*` function props become event listeners; `html` sets innerHTML (trusted markup only).
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k === 'dataset') Object.assign(el.dataset, v as Record<string, string>);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (PROPS.has(k)) (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

const tpl = document.createElement('template');

/** Inline SVG icon element (aria-hidden unless a label is given). */
export function icon(name: IconName, size: number | string = 18, className = '', label?: string): SVGSVGElement {
  tpl.innerHTML = iconSvg(name, { size, className, label });
  return tpl.content.firstElementChild as SVGSVGElement;
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`[admin] missing element ${sel}`);
  return el;
};
export const $maybe = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] => [...root.querySelectorAll<T>(sel)];

/** Unique id for aria wiring. */
let uid = 0;
export const nextId = (prefix = 'adm') => `${prefix}-${++uid}`;

/** Debounce helper. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t = 0;
  const run = (...args: A) => {
    clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
  run.cancel = () => clearTimeout(t);
  return run;
}

/** Run at most once per animation frame. */
export function rafThrottle(fn: () => void) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

export const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-motion');
