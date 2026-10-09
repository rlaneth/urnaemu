// Audible alarm of vota::CSuspensaoAutomaticaEleitor ("O eleitor está demorando").
// Natively, the screen starts a std::thread whose only work is one beep on the terminal
// (IScreenMT, arguments 50 and 3), in StartState and on each countdown tick. The web build
// cannot start threads, so the wasm patch 'thread-alarme-eleitor-demorando' makes that start
// return; this module plays the beep from the browser at exactly those points instead.
// Documented in src/lib/adaptacoes.js.
import { hookTableSlot } from '../runtime/table-hook.js';

const START_STATE = { slot: 4247, functionIndex: 10409 }; // CSuspensaoAutomaticaEleitor StartState
const COUNTDOWN_TICK = { slot: 4251, functionIndex: 10405 }; // countdown tick (calls the thread start while counting)

export function installVoterAlarm(app) {
	for (const { slot, functionIndex } of [START_STATE, COUNTDOWN_TICK])
		if (app.tableMetadata.find((x) => x.slot === slot)?.functionIndex !== functionIndex) throw Error('Unexpected voter-alarm ABI');
	const table = app.exports.Fb, view = () => new DataView(app.exports.Cb.buffer);
	const state = { beeps: 0 };
	// Approximation of the native terminal beep: three short tones.
	function beep() {
		state.beeps++;
		for (let i = 0; i < 3; i++) Module.uenuxBeepQueue?.(1800, 50);
		app.log?.('voter-alarm', { beeps: state.beeps });
	}
	hookTableSlot(table, START_STATE.slot, 1, (original, self) => {
		beep();
		return original(self);
	});
	hookTableSlot(table, COUNTDOWN_TICK.slot, 2, (original, self, message) => {
		// Same conditions as the native ProcessTick(tickId): the tick is this screen's (id at
		// byte 12), the countdown is not done (byte 24) and still at 2 or more (int64 at 16).
		const v = view();
		if (message === v.getUint8(self + 12) && !v.getUint8(self + 24) && v.getBigInt64(self + 16, true) >= 2n) beep();
		return original(self, message);
	});
	app.voterAlarm = state;
	return state;
}
