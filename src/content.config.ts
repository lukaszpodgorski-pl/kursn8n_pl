import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				// GEO/AEO - dane strukturalne (schema.org) przenoszone z meta.php
				// starego serwisu; generowanie JSON-LD z tych pól: Etap 2 migracji.
				educationalLevel: z
					.enum(['Beginner', 'Intermediate', 'Advanced'])
					.optional(),
				teaches: z.array(z.string()).optional(),
				// Data pierwszej publikacji na żywej stronie (head.php, blok
				// LearningResource) - odrębna od `dateModified` (Starlight
				// `lastUpdated`, liczone z historii git). `z.coerce.date()` przyjmuje
				// zarówno natywną datę YAML (`2026-05-21`), jak i string ISO, i daje
				// ten sam typ `Date` co `route.lastUpdated` w Head.astro - `buildArticle`
				// wywołuje na obu ten sam `.toISOString()`. Pole opcjonalne.
				datePublished: z.coerce.date().optional(),
				about: z
					.array(z.object({ name: z.string(), sameAs: z.string().url() }))
					.optional(),
				mentions: z
					.array(
						z.object({
							name: z.string(),
							sameAs: z.string().url(),
							type: z.string().optional(),
						}),
					)
					.optional(),
				faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
				// Ukrywa wygenerowaną sekcję "Częste pytania" w treści strony, przy
				// zachowaniu bloku FAQPage w JSON-LD (Head.astro nie sprawdza tej
				// flagi). Ustaw, gdy artykuł sam w sobie jest FAQ (np. zasoby/faq.md)
				// i wygenerowana sekcja powielałaby te same pytania, które już są
				// nagłówkami `##` w treści.
				faqHidden: z.boolean().optional(),
			}),
		}),
	}),
};
