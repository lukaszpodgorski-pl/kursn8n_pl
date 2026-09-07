import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTone, DEFAULT_TONE, TONES } from './tokens.ts';

test('token nazwany daje pare hexow z palety', () => {
	assert.deepEqual(resolveTone('green'), { from: '#16a34a', to: '#15803d' });
});

test('brak tonu daje ton domyslny', () => {
	assert.deepEqual(resolveTone(undefined), resolveTone(DEFAULT_TONE));
});

test('para hexow przechodzi doslownie', () => {
	assert.deepEqual(resolveTone('#ff0000/#00ff00'), { from: '#ff0000', to: '#00ff00' });
});

test('nieznany ton wywraca sie z lista dostepnych', () => {
	assert.throws(() => resolveTone('turkusowy'), /@green/);
});

test('paleta odwzorowuje osiem par uzywanych dzis w repo', () => {
	assert.equal(Object.keys(TONES).length, 8);
});
