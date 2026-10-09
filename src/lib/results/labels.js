// pt-BR names for result enumerations (from the published schemas).
export const CARGOS = {
	1: 'Presidente', 2: 'Vice-presidente', 3: 'Governador', 4: 'Vice-governador', 5: 'Senador',
	6: 'Deputado federal', 7: 'Deputado estadual', 8: 'Deputado distrital', 9: '1º suplente de senador',
	10: '2º suplente de senador', 11: 'Prefeito', 12: 'Vice-prefeito', 13: 'Vereador'
};
export const TIPO_VOTO_BU = { 1: 'Nominal', 2: 'Branco', 3: 'Nulo', 4: 'Legenda', 5: 'Cargo sem candidato' };
export const TIPO_VOTO_RDV = {
	1: 'Legenda', 2: 'Nominal', 3: 'Branco', 4: 'Nulo', 5: 'Branco após suspensão', 6: 'Nulo após suspensão',
	7: 'Nulo por repetição', 8: 'Nulo (cargo sem candidato)', 9: 'Nulo após suspensão (cargo sem candidato)'
};
export const FASES = { 1: 'Simulado', 2: 'Oficial', 3: 'Treinamento' };

export function cargoName(codigoCargo) {
	if (typeof codigoCargo === 'number') return CARGOS[codigoCargo] ?? `Cargo ${codigoCargo}`;
	if (codigoCargo?.cargoConstitucional !== undefined) return CARGOS[codigoCargo.cargoConstitucional] ?? `Cargo ${codigoCargo.cargoConstitucional}`;
	const value = Object.values(codigoCargo ?? {})[0];
	return `Consulta ${value}`;
}

/** "20261004T170512" → "04/10/2026 17:05:12". */
export function dataHoraJE(text) {
	const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(text ?? '');
	return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : (text ?? '');
}
