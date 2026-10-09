// The urna's general state ("estado geral", eg.bin) in the TSE web build is a test fixture
// ("7.2.1.3 - TESTE EG ASN1"). Its result correspondence (CCorrespondenciaResultado: the section
// this urna was loaded for, written into the BU) is built by func10261 (table slot 404) with
// fixed values, including the section it was loaded for: município 1 (u32 at +40), zona 1
// (u16 at +44) and seção 1 (u16 at +46), layout read from the live record. The RDV takes the
// configured section instead, so at any other section the BU and the RDV disagreed and the BU
// failed verification. The media conversion (load/section-relocation.js) moves the media to
// another município, zona or seção, so the wrapper lets the original build the record and then
// writes the configured município, zona and seção. Documented in src/lib/fidelidade.js.
import { hookTableSlot } from '../runtime/table-hook.js';

const FIXTURE = { slot: 404, functionIndex: 10261 };

// Installed right after instantiation, before the module's constructors run: the fixture may be
// built that early. The record's address is kept; the configured section is written once known
// (applyCorrespondenceSection, called before votaInit) and again on later constructions.
export function installCorrespondenceFixture(app) {
	const table = app.exports.Fb;
	// The table metadata (discovery) is not loaded yet at instantiation: check the slot's identity
	// by its signature/arity through the original function's length.
	const state = { constructed: [], applied: 0 };
	hookTableSlot(
		table,
		FIXTURE.slot,
		1,
		(original, self) => {
			const result = original(self);
			state.constructed.push(self);
			patch(app, self, state);
			return result;
		},
		{ result: true }
	);
	app.correspondenceFixture = state;
	return state;
}

function patch(app, self, state) {
	// The fixture is built while the module starts, before the boot configuration exists: use
	// the staged media's configuration (app.stagedConfig) then.
	const config = app.sessionConfig || app.bootConfig || app.stagedConfig;
	if (!config) return;
	const v = new DataView(app.exports.Cb.buffer);
	// Only the untouched fixture (município 1, zona 1, seção 1), and only when the media is for
	// another place.
	const municipio = v.getUint32(self + 40, true), zona = v.getUint16(self + 44, true), secao = v.getUint16(self + 46, true);
	const target = [Number(config.municipio), Number(config.zona), Number(config.secao)];
	if (municipio === 1 && zona === 1 && secao === 1 && target.join() !== '1,1,1') {
		v.setUint32(self + 40, target[0], true);
		v.setUint16(self + 44, target[1], true);
		v.setUint16(self + 46, target[2], true);
		state.applied++;
	}
}

/** Write the configured section into fixture records built before the configuration was known. */
export function applyCorrespondenceSection(app) {
	if (app.tableMetadata?.find((x) => x.slot === FIXTURE.slot)?.functionIndex !== FIXTURE.functionIndex) throw Error('Unexpected correspondence fixture ABI');
	const state = app.correspondenceFixture;
	for (const self of state?.constructed ?? []) patch(app, self, state);
}
