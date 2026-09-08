"""Apply only the reviewed follow-up to the first functional UI commit."""
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
expected = 'c3caf49a256beea5162a00fb734edf06151555d8'
if subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip() != expected:
    raise RuntimeError('Unexpected application base; refusing patch')
changed=[]
def replace(path,old,new):
    p=root/path
    text=p.read_text()
    if text.count(old)!=1:
        raise RuntimeError(f'Expected one anchor in {path}: {old[:90]}')
    p.write_text(text.replace(old,new))
    if path not in changed: changed.append(path)

# The former null fixtures represented a read failure, not a new athlete.
# Drive the same existing assertions with an actual failed read, and preserve
# the valid-empty tests elsewhere. Do not turn failure expectations into zeroes.
p='scripts/test-today-browser.mjs'
replace(p,'const lab = await openPanel("?panel=lab");','const lab = await openPanel("?panel=lab&scenario=failure");')
replace(p,'const journal = await openPanel("?panel=journal");','const journal = await openPanel("?panel=journal&scenario=failure");')
replace(p,'''  const stage = await bare.page
    .getByText("Your body, as GYMS.LIFE understands it today")
    .locator("xpath=ancestor::section[1]")
    .boundingBox();''','''  const stage = await bare.page.getByRole("region", { name: "Your Digital Twin", exact: true }).boundingBox();
  expect(stage).not.toBeNull();''')

# The reference always has four counters. Retain the same slots with unknown
# values while loading/failed instead of hiding them and losing the information
# hierarchy. Values already come from the guarded counted flag above.
p='src/components/future-lab/JournalIntelligence.tsx'
source=(root/p).read_text()
start=source.index('            <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2">')
end=source.index('\n\n            <nav',start)
block=source[start:end]
replace(p,block,'')
block='\n'.join(line[4:] if line.startswith('    ') else line for line in block.splitlines())
replace(p,'        {query.isError ? (',block+'\n\n        {query.isError ? (')

# The compact anatomical stage replaced an older empty-state card. It must
# still explain a blank model on desktop/mobile, and never call a failed read
# a first week. No measurements or model calculations change.
p='src/components/twin/TwinHome.tsx'
replace(p,'if (snapshotQuery.isError || !snapshot) {','if (snapshotQuery.isError || !snapshot || !snapshot.dataAvailable) {')
replace(p,'''        </header>
        <TwinStage
          presentation="cockpit"''','''        </header>
        {!snapshot.regions.some((region) => region.recoveryPct !== null) ? (
          <div data-testid="twin-evidence-empty" className="mx-3 mt-3 rounded-lg border border-border bg-surface/60 px-3 py-2 text-[11px] leading-relaxed">
            <p className="font-medium">{language === "lt" ? "Tavo dvynys dar mokosi" : "Your Twin is still learning"}</p>
            <p className="mt-1 text-muted-foreground">{language === "lt" ? "Šiame lange nepakanka užbaigtų setų duomenų atsistatymui įvertinti. Nežinomas regionas nereiškia atsistačiusio." : "This window has insufficient completed-set evidence to estimate recovery. An unknown region does not mean a recovered one."}</p>
          </div>
        ) : null}
        <TwinStage
          presentation="cockpit"''')

(root/'reference-patch-files.txt').write_text('\n'.join(changed)+'\n')
print('\n'.join(changed))
