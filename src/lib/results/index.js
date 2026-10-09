// Browser entry for result files: the published schemas (bundled as text) parsed once.
import { Schema } from './asn1-schema.js';
import buText from './schemas/bu.asn1?raw';
import rdvText from './schemas/rdv.asn1?raw';
import assinaturaText from './schemas/assinatura.asn1?raw';
import { verifyResults, findResultFiles } from './verify.js';

let schemas = null;
export function getSchemas() {
	schemas ??= { bu: new Schema(buText), rdv: new Schema(rdvText), assinatura: new Schema(assinaturaText) };
	return schemas;
}

/** Verify the result set (BU, RDV, signatures) found next to `path` in MEMFS. */
export async function verifyFromDirectory(app, path) {
	const dir = path.replace(/\/[^/]+$/, '');
	const prefix = path.split('/').pop().replace(/-(bu|rdv|imgbu)\.dat$|-vota\.vsc$/, '');
	const listing = await app.browse(dir);
	const files = {};
	for (const entry of listing.entries) if (!entry.isDir && entry.name.startsWith(prefix)) files[entry.name] = app.readFile(entry.path);
	const names = findResultFiles(Object.keys(files));
	if (!names.bu || !names.rdv) throw Error('O BU e o RDV da mesma seção precisam estar na mesma pasta.');
	return verifyResults(files, getSchemas());
}

export { findResultFiles };
