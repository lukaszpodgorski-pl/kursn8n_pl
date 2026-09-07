/**
 * Blad w diagramie przerywa build. Numer linii odnosi sie do propsa `spec`,
 * nie do pliku MDX - autor widzi dokladnie te linie, ktora napisal.
 */
export class FlowError extends Error {
	constructor(message: string, line?: number, source?: string) {
		const where =
			line === undefined ? '' : `\n  linia ${line}${source ? `: ${source.trim()}` : ''}`;
		super(message + where);
		this.name = 'FlowError';
	}
}
