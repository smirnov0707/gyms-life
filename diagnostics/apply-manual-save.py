from pathlib import Path
import base64, gzip, hashlib, json, sys

payload = Path(__file__).parent
root = Path(sys.argv[1]).resolve()
packed = ''.join((payload / f'manual-save-payload-{i}.b64').read_text().strip() for i in range(1, 9))
raw = gzip.decompress(base64.b64decode(packed, validate=True))
assert hashlib.sha256(raw).hexdigest() == '442a1cd3931f9c6b9bd7e2c8f418bd03b3c4006e6ce9f0ab0a1b56da88754235', 'Candidate checksum mismatch'
data = json.loads(raw)
assert data['baseCommit'] == '20e2d1613e9a0b1a4408d461c717847fe5c2f9c3'
assert data['baseTree'] == '66f143c9828384067e1d5fe051f5442c33741d4a'
allowed = {
 'src/lib/endurance-submission.schema.ts', 'src/lib/endurance-submission.service.ts',
 'src/lib/endurance-submission.service.test.ts', 'src/lib/endurance-submission-store.ts',
 'src/lib/endurance-activity.functions.ts', 'src/components/QuickRunLog.tsx',
 'tests/core-browser/endurance-log-fixtures.ts', 'scripts/test-core-browser.mjs',
 'scripts/test-core-run-submission.mjs', 'tests/core-browser/auth-stub.tsx',
 'docs/endurance-initial-save-recovery.md',
}
assert len(data['files']) == len(allowed) == 11
assert {f['path'] for f in data['files']} == allowed

def blob(value):
 return hashlib.sha1(f'blob {len(value)}\0'.encode() + value).hexdigest()

prepared = []
for entry in data['files']:
 dest = root / entry['path']
 assert root in dest.resolve().parents
 if entry['before'] is None:
  assert not dest.exists(), f'New file already exists: {dest}'
  text = entry['content']
 else:
  old = dest.read_bytes()
  assert blob(old) == entry['before'], f'Source differs: {dest}'
  lines = old.decode().splitlines(keepends=True)
  for edit in reversed(entry['edits']):
   assert 0 <= edit['start'] <= edit['end'] <= len(lines)
   lines[edit['start']:edit['end']] = edit['text'].splitlines(keepends=True)
  text = ''.join(lines)
 new = text.encode()
 assert blob(new) == entry['blob'], f'Reconstructed file differs: {dest}'
 prepared.append((dest, new))
for dest, value in prepared:
 dest.parent.mkdir(parents=True, exist_ok=True)
 dest.write_bytes(value)
out = root / 'test-results/manual-save'
out.mkdir(parents=True, exist_ok=True)
manifest = {k: data[k] for k in ['baseCommit', 'baseTree']}
manifest['files'] = [{k: f[k] for k in ['path', 'before', 'blob']} for f in data['files']]
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('PASS checksum, original source and all 11 candidate file blobs')
