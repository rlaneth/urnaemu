// Test evidence goes to the OS temp directory, never into the project tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function evidencePath(name) {
	const dir = path.join(os.tmpdir(), 'urnaemu-evidence');
	fs.mkdirSync(dir, { recursive: true });
	return path.join(dir, name);
}
