import strings from './pt-BR.js';

/** Look up a dotted key and fill `{name}` placeholders. Missing keys return the key itself. */
export function t(key, params) {
	let value = key.split('.').reduce((node, part) => node?.[part], strings);
	if (typeof value !== 'string') return key;
	if (params) value = value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
	return value;
}
