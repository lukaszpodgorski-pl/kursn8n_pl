import { FlowError } from './error.ts';

/**
 * Lustro palety diagramow. Tokeny nosza nazwy barw, nie rol, bo odwzorowuja
 * 1:1 pary hexow uzywane dzis w repo - migracja ma nie ruszyc wygladu.
 * Ujednolicanie kolorow semantycznie to osobna, tresciowa decyzja.
 */
export const TONES = {
	green: ['#16a34a', '#15803d'],
	blue: ['#2563eb', '#1e40af'],
	pink: ['#ea4b71', '#6d28d9'],
	slate: ['#64748b', '#475569'],
	sky: ['#0ea5e9', '#0369a1'],
	amber: ['#d97706', '#b45309'],
	red: ['#dc2626', '#b91c1c'],
	violet: ['#6d28d9', '#4c1d95'],
} as const;

export type ToneName = keyof typeof TONES;

export const DEFAULT_TONE: ToneName = 'slate';

export interface ToneColors {
	from: string;
	to: string;
}

// Furtka dla migracji: para spoza palety przechodzi doslownie, zamiast ginac.
const LITERAL = /^(#[0-9a-f]{6})\/(#[0-9a-f]{6})$/i;

/** Zamienia zapis tonu z DSL (bez `@`) na pare kolorow gradientu ikony. */
export function resolveTone(raw: string | undefined, line?: number): ToneColors {
	const key = raw ?? DEFAULT_TONE;

	if (Object.hasOwn(TONES, key)) {
		const [from, to] = TONES[key as ToneName];
		return { from, to };
	}

	const literal = LITERAL.exec(key);
	if (literal) return { from: literal[1], to: literal[2] };

	const available = Object.keys(TONES)
		.map((name) => `@${name}`)
		.join(', ');
	throw new FlowError(
		`Nieznany ton "@${key}". Dostepne: ${available}, albo para hexow, np. @#16a34a/#15803d.`,
		line
	);
}
