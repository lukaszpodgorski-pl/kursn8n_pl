import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlow } from './parse.ts';

test('lancuch daje nody w kolejnosci wystapienia', () => {
	const graph = parseFlow('A -> B\nB -> C');
	assert.deepEqual(graph.nodes.map((n) => n.name), ['A', 'B', 'C']);
	assert.equal(graph.edges.length, 2);
	assert.equal(graph.edges[0].kind, 'main');
});

test('atrybuty czytaja sie z pierwszej wzmianki', () => {
	const graph = parseFlow('Dane (lista itemow):list @slate -> IF (kwota > 100?):code-branch @pink');
	assert.deepEqual(graph.nodes[0], {
		name: 'Dane', sub: 'lista itemow', icon: 'list', tone: 'slate', line: 1,
	});
	assert.equal(graph.nodes[1].sub, 'kwota > 100?');
	assert.equal(graph.nodes[1].icon, 'code-branch');
});

test('etykieta krawedzi moze miec spacje', () => {
	const graph = parseFlow('IF -regula 1-> A\nIF -false-> B');
	assert.equal(graph.edges[0].label, 'regula 1');
	assert.equal(graph.edges[1].label, 'false');
});

test('dywiz w nazwie nie jest mylony ze strzalka', () => {
	const graph = parseFlow('Execute Sub-workflow -> Dalej');
	assert.deepEqual(graph.nodes.map((n) => n.name), ['Execute Sub-workflow', 'Dalej']);
});

test('cudzyslow chroni nazwe ze znakiem specjalnym', () => {
	const graph = parseFlow('"HTML (Extract)":code @sky -> Dalej');
	assert.equal(graph.nodes[0].name, 'HTML (Extract)');
	assert.equal(graph.nodes[0].sub, undefined);
	assert.equal(graph.nodes[0].icon, 'code');
});

test('zagniezdzony nawias w podtytule zostaje w podtytule', () => {
	const graph = parseFlow('Worker (kolejka zadan (Bull)):gears @slate -> Dalej');
	assert.equal(graph.nodes[0].sub, 'kolejka zadan (Bull)');
});

test('przecinek w nazwie nie rozdziela poza lista sub-nodow', () => {
	const graph = parseFlow('Podstawy znam, chce AI:robot @pink -> Modul 6');
	assert.equal(graph.nodes[0].name, 'Podstawy znam, chce AI');
});

test('strzalka zwrotna daje krawedz loop', () => {
	const graph = parseFlow('A -> B\nB ~> A');
	assert.equal(graph.edges[1].kind, 'loop');
});

test('sub-nody AI ida od rodzica do kazdego dziecka', () => {
	const graph = parseFlow('Agent:robot <- Model:microchip, Pamiec:database');
	assert.equal(graph.edges.length, 2);
	assert.deepEqual(graph.edges.map((e) => [e.from, e.to, e.kind]), [
		['Agent', 'Model', 'ai'],
		['Agent', 'Pamiec', 'ai'],
	]);
});

test('sama nazwa w linii deklaruje nod bez krawedzi', () => {
	const graph = parseFlow('Model:microchip @blue\nAgent:robot <- Model');
	assert.equal(graph.nodes[0].icon, 'microchip');
	assert.equal(graph.nodes[0].tone, 'blue');
	assert.equal(graph.edges.length, 1);
});

test('komentarze i puste linie sa pomijane', () => {
	const graph = parseFlow('\n# to jest komentarz\nA -> B\n\n');
	assert.equal(graph.nodes.length, 2);
	assert.equal(graph.edges.length, 1);
});

test('numer linii wskazuje miejsce w spec', () => {
	const graph = parseFlow('A -> B\n\nB -> C');
	assert.equal(graph.edges[1].line, 3);
});

test('powtorzone atrybuty wywracaja build', () => {
	assert.throws(
		() => parseFlow('A:list @green -> B\nA:xmark @red -> C'),
		/ma juz atrybuty z linii 1/
	);
});

test('dwie strzalki w jednej linii wywracaja build', () => {
	assert.throws(() => parseFlow('A -> B -> C'), /Dwie strzalki/);
});

test('pusta nazwa wywraca build z numerem linii', () => {
	assert.throws(() => parseFlow('A -> :list @green'), /linia 1/);
});
