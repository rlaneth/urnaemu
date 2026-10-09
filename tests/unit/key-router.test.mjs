import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyRouter } from '../../src/lib/engine/runtime/key-router.js';

test('native reads see only the keypad of the running side', async () => {
	const keys = createKeyRouter();
	await keys.input('mesario', () => keys.native.push('C')); // what votaPressKey does
	await keys.input('voter', () => keys.native.push('5'));
	assert.equal(keys.native.length, 0, 'no reader declared: VOTA sees no keys');
	assert.equal(keys.native.shift(), undefined);
	await keys.as('voter', () => {
		assert.equal(keys.native.length, 1);
		assert.equal(keys.native.shift(), '5');
		assert.equal(keys.native.shift(), undefined, 'the terminal key stays out of reach');
	});
	await keys.as('mesario', () => assert.equal(keys.native.shift(), 'C'));
});

test('readers nest and restore; drop discards unread keys', async () => {
	const dropped = [];
	const keys = createKeyRouter({ log: (kind, detail) => dropped.push(detail) });
	keys.queue('voter', '1');
	await keys.as('mesario', async () => {
		await keys.as('voter', () => assert.equal(keys.native.length, 1));
		assert.equal(keys.reader, 'mesario');
		await keys.asDefault('voter', () => assert.equal(keys.reader, 'mesario'));
	});
	assert.equal(keys.reader, null);
	assert.deepEqual(keys.drop('voter', 'test'), ['1']);
	assert.equal(dropped[0].keypad, 'voter');
	assert.equal(keys.pending(), 0);
	assert.throws(() => keys.queue('printer', 'x'), /Unknown keypad/);
});

test("VOTA's input clear cannot replace the router; it empties the reading side only", async () => {
	const keys = createKeyRouter();
	const Module = {};
	keys.install(Module);
	keys.queue('voter', '1');
	keys.queue('mesario', '2');
	await keys.as('voter', () => {
		Module.uenuxKeys = []; // wasm_input_clear
	});
	assert.equal(Module.uenuxKeys, keys.native, 'still the router');
	assert.deepEqual(keys.snapshot(), { reader: null, voter: [], mesario: ['2'] });
	Module.uenuxKeys = Module.uenuxKeys || []; // js_init / js_push_key keep it
	assert.equal(Module.uenuxKeys, keys.native);
});
