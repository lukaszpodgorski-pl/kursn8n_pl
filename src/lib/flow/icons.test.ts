import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableIcons, assertIcons, iconClass } from './icons.ts';
import { parseFlow } from './parse.ts';

test('zbior ikon czyta sie z self-hostowanego Font Awesome', () => {
	const icons = availableIcons();
	assert.ok(icons.has('list'));
	assert.ok(icons.has('code-branch'));
	assert.ok(icons.size > 1000);
});

test('ikona bez prefiksu domyslnie jest solid', () => {
	assert.equal(iconClass('list'), 'fas fa-list');
});

test('marka wymaga jawnego prefiksu', () => {
	assert.equal(iconClass('fab/slack'), 'fab fa-slack');
});

test('brak ikony daje ikone domyslna', () => {
	assert.equal(iconClass(undefined), 'fas fa-diagram-project');
});

test('literowka w nazwie ikony wywraca build', () => {
	const graph = parseFlow('A:nie-ma-takiej-ikony -> B');
	assert.throws(() => assertIcons(graph), /nie istnieje/);
});

test('nieznana rodzina wywraca build', () => {
	const graph = parseFlow('A:faz/list -> B');
	assert.throws(() => assertIcons(graph), /rodzina/);
});

test('poprawny diagram przechodzi walidacje', () => {
	const graph = parseFlow('A:list -> B:fab/slack');
	assert.doesNotThrow(() => assertIcons(graph));
});
