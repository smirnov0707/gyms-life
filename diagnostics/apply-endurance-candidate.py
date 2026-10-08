from pathlib import Path
import base64, gzip, hashlib, json, sys

payload_root = Path(__file__).resolve().parent
root = Path(sys.argv[1]).resolve()
expected_parts = ['1466fa3886b4233d541a4bb1555497d724ae3584', '2553e8e044d629ea662b0b767d0f541f0f1384b0', 'af437b4f9486c03c04563def2a147ca5531aaee8', 'f5718cfbb38a546fdbff4c732a6a14112ddb9a49']
def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
parts = []
for i, expected in enumerate(expected_parts):
    part = (payload_root / f'endurance-payload.part{i}').read_bytes()
    assert blob(part) == expected, f'Corrupt transport part {i}'
    parts.append(part)
compressed = base64.b64decode(b''.join(parts), validate=True)
assert hashlib.sha256(compressed).hexdigest() == 'f8526e90ba564956676d90c5b005778f0a9625d6546678b46b0c09dd849fac70', 'Payload digest mismatch'
payload = json.loads(gzip.decompress(compressed))
assert payload['baseCommit'] == 'a465c64446ace43ae0e7626aced427d23b377346'
allowed = {'src/lib/endurance-race-enrichment.schema.ts', 'src/lib/endurance-race-enrichment.service.ts', 'src/lib/endurance-race-enrichment.service.test.ts', 'src/lib/endurance-activity.service.ts', 'src/lib/endurance-activity.functions.ts', 'src/components/QuickRunLog.tsx', 'scripts/test-core-endurance-log.mjs', 'scripts/test-core-browser.mjs', 'tests/core-browser/endurance-log-fixtures.ts', 'tests/core-browser/functions-stub.ts', 'tests/core-browser/fixture.tsx'}
assert len(payload['files']) == len(allowed)
assert {f['path'] for f in payload['files']} == allowed
for entry in payload['files']:
    dest = root / entry['path']
    if entry['baseBlob'] is None:
        assert not dest.exists(), f'Unexpected existing file {dest}'
        text = entry['content']
    else:
        raw = dest.read_bytes()
        assert blob(raw) == entry['baseBlob'], f'Base changed: {dest}'
        lines = raw.decode().splitlines(keepends=True)
        for edit in reversed(entry['edits']):
            start, count = edit['start'], edit['delete']
            assert 0 <= start <= len(lines) and 0 <= count <= len(lines) - start
            lines[start:start+count] = edit['insert']
        text = ''.join(lines)
    encoded = text.encode()
    assert blob(encoded) == entry['blob'], f'Candidate mismatch: {dest}'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(encoded)
out = root / 'test-results/endurance-reliability'
out.mkdir(parents=True, exist_ok=True)
manifest = {k: v for k, v in payload.items() if k != 'files'}
manifest['files'] = [{k: f[k] for k in ('path', 'baseBlob', 'blob')} for f in payload['files']]
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('PASS exact candidate applied to the pinned production source: 11 verified files')
