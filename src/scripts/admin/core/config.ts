/** Build-time data passed from AdminView.astro (labels for inquiry fields etc.). */
import type { Lang, Text } from './i18n';

export interface AdminConfig {
  lang: Lang;
  brand: string;
  labels: {
    event: Record<string, Text>;
    package: Record<string, Text>;
    addon: Record<string, Text>;
    guests: Record<string, Text>;
    budget: Record<string, Text>;
    source: Record<string, Text>;
    contact: Record<string, Text>;
  };
}

const empty: AdminConfig = {
  lang: 'he',
  brand: 'MOSHIK',
  labels: { event: {}, package: {}, addon: {}, guests: {}, budget: {}, source: {}, contact: {} },
};

function read(): AdminConfig {
  try {
    const raw = document.getElementById('adm-config')?.textContent;
    return raw ? { ...empty, ...(JSON.parse(raw) as AdminConfig) } : empty;
  } catch {
    return empty;
  }
}

export const config = read();

/** Label for a stored value (falls back to the raw value). */
export function label(group: keyof AdminConfig['labels'], value: string | undefined, l: Lang = config.lang): string {
  if (!value) return '';
  return config.labels[group][value]?.[l] ?? value;
}
