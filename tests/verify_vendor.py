"""Verify the vendored Simulador de Votação files against static/vendor/SHA256SUMS, byte for byte.

The SHA256SUMS list is produced from the TSE's Simulador snapshot; this check confirms the copy
shipped here still matches it, without needing the original snapshot."""
import hashlib
from pathlib import Path

vendor = Path(__file__).resolve().parents[1] / 'static' / 'vendor'
sums = vendor / 'SHA256SUMS'

expected = {}
for line in sums.read_text().splitlines():
    if not line.strip():
        continue
    digest, name = line.split(None, 1)
    expected[name.strip()] = digest

present = {f.relative_to(vendor).as_posix() for f in vendor.rglob('*') if f.is_file() and f.name != 'SHA256SUMS'}
missing = set(expected) - present
assert not missing, f'listed in SHA256SUMS but missing: {sorted(missing)}'

count = 0
for rel in sorted(present):
    assert rel in expected, f'{rel} is not listed in SHA256SUMS'
    digest = hashlib.sha256((vendor / rel).read_bytes()).hexdigest()
    assert digest == expected[rel], rel
    count += 1

print(f'{count} vendor files match SHA256SUMS byte-for-byte')
