// Eleitorado (-el.dat) of the loaded media: one record per voter, as stored by the TSE:
// [ [identifiers: [0] título, [1] CPF (optional), ASCII], name, unused, birth date AAAAMMDD, enum, enum ].
import { isSimulatedBiometricElement } from './simulated-biometrics.js';
import { VotaLoadFormat as F } from './load-format.js';

const ascii = new TextDecoder('ascii');

export function readEleitorado(files) {
	const entry = [...(files ?? [])].find(([path]) => path.endsWith('-el.dat'));
	if (!entry) return [];
	const root = F.parse(entry[1]);
	return (root.children?.[2]?.children ?? []).flatMap((item) => {
		const r = item.children?.[1]?.children;
		if (!r || r.length < 4) return [];
		const id = (tag) => r[0].children?.find((c) => c.tag === tag);
		return [{ title: ascii.decode(F.unhex(id(128)?.hex ?? r[0].children[0].hex)), cpf: id(129) ? ascii.decode(F.unhex(id(129).hex)) : '', name: r[1].text, birth: r[3].text, ...(r.some(isSimulatedBiometricElement) ? { simulatedBiometrics: true } : {}) }];
	});
}
