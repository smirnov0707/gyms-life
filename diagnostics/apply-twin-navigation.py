from pathlib import Path
import hashlib, json, subprocess
base = '656f4a6cb8fba5cddcab8c7b14eda67e906b3910'
root = Path.cwd()
def git(*args):
    return subprocess.check_output(['git','-c',f'safe.directory={root}',*args],text=True).strip()
expected = {
 'src/components/twin/twin-scene.model.ts':'10b8366acc116f59df1d609cdbfd88cc1810fac4',
 'src/components/twin/twin-scene.runtime.ts':'726eda276381516980254948ff1f3cafe45621fc',
 'src/components/twin/BodySceneStage.tsx':'3915f0b10f42c34b29e7eee680e7267977478e93',
}
for name, sha in expected.items():
    raw=Path(name).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==sha,name

def change(source, old, new):
    assert source.count(old)==1,(old[:100],source.count(old))
    return source.replace(old,new)

p=Path('src/components/twin/twin-scene.model.ts');s=p.read_text()
s=change(s,'  | "zoom-in"','  | "pan-up"\n  | "pan-down"\n  | "tilt-up"\n  | "tilt-down"\n  | "upper-body"\n  | "lower-body"\n  | "zoom-in"')
s=change(s,'minPitch: Math.PI * 0.37','minPitch: Math.PI * 0.22')
s=change(s,'maxPitch: Math.PI * 0.58','maxPitch: Math.PI * 0.78')
s=change(s,'  if (command === "zoom-in")','  if (command === "tilt-up") next.pitch -= TWIN_CAMERA.step / 2;\n  if (command === "tilt-down") next.pitch += TWIN_CAMERA.step / 2;\n  if (command === "upper-body" || command === "lower-body") next.pitch = Math.PI / 2;\n  if (command === "zoom-in")')
p.write_text(s)
p=Path('src/components/twin/twin-scene.runtime.ts');s=p.read_text()
s=change(s,'import { createTwinBody } from "./twin-body.geometry";', '''import { createTwinBody } from "./twin-body.geometry";
import {
  clampTwinTargetY, moveTwinTargetY, twinCameraKey, twinNearSideReach, twinPresetDistance,
} from "./twin-camera.navigation";''')
s=change(s,'    controls.enablePan = false;', '''    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.75;''')
s=change(s,'      canvas.dataset["twinDistance"] = controls.getDistance().toFixed(3);', '''      canvas.dataset["twinDistance"] = controls.getDistance().toFixed(3);
      canvas.dataset["twinPitch"] = controls.getPolarAngle().toFixed(3);
      canvas.dataset["twinTargetY"] = controls.target.y.toFixed(4);
      canvas.dataset["twinTargetX"] = controls.target.x.toFixed(4);
      canvas.dataset["twinTargetZ"] = controls.target.z.toFixed(4);
      canvas.dataset["twinHomeY"] = target.y.toFixed(4);
      canvas.dataset["twinFitDistance"] = fitDistance.toFixed(4);''')
s=change(s,'''    controls.addEventListener("change", requestRender);
    cleanups.push(() => controls.removeEventListener("change", requestRender));''','''    function constrainTarget() {
      // Vertical-only pan: retain the body's orbit axis and move the camera by
      // the same correction. Never let a two-finger gesture lose the body.
      const y = clampTwinTargetY(controls.target.y, bodyFrame?.height ?? TWIN_FRAME.height, target.y);
      const correction = new Vector3(target.x - controls.target.x, y - controls.target.y,
        target.z - controls.target.z);
      controls.target.add(correction);
      camera.position.add(correction);
    }
    const controlsChanged = () => { constrainTarget(); requestRender(); };
    controls.addEventListener("change", controlsChanged);
    cleanups.push(() => controls.removeEventListener("change", controlsChanged));''')
s=change(s,'''      if (action === "reset") controls.target.copy(target);
      controls.enableDamping = false;
      controls.update();
      const next = moveTwinCamera(''','''      controls.enableDamping = false;
      controls.update();
      const next = moveTwinCamera(''')
s=change(s,'''        fitDistance,
      );
      camera.position
        .copy(controls.target)''','''        fitDistance,
      );
      const nextY = moveTwinTargetY(controls.target.y, action,
        bodyFrame?.height ?? TWIN_FRAME.height, target.y);
      if (action === "reset" || action === "upper-body" || action === "lower-body")
        controls.target.copy(target);
      controls.target.y = nextY;
      const presetDistance = twinPresetDistance(action, fitDistance);
      if (presetDistance !== undefined) next.distance = presetDistance;
      camera.position
        .copy(controls.target)''')
s=change(s,'      // Keep the orbit axis inside the body, so the near-side picking cutoff','''      controls.enableDamping = false;
      controls.update();
      // Keep the orbit axis inside the body, so the near-side picking cutoff''')
s=change(s,'      controls.target.set(centre.x, centre.y, 0);','''      controls.target.set(target.x,
        clampTwinTargetY(centre.y, bodyFrame?.height ?? TWIN_FRAME.height, target.y), target.z);''')
s=change(s,'      const reach = raycaster.ray.origin.distanceTo(controls.target);','      const reach = twinNearSideReach(raycaster.ray, camera.position, target);')
start=s.index('      const action: TwinCameraCommand | undefined = (',s.index('    const key = '))
end=s.index('      if (action) {',start)
s=s[:start]+'      const action = twinCameraKey(event);\n'+s[end:]
p.write_text(s)
p=Path('src/components/twin/BodySceneStage.tsx');s=p.read_text()
s=change(s,'import { ChevronDown, Minus, Plus, RotateCcw, RotateCw, Settings2, Undo2 } from "lucide-react";', '''import { ArrowUp, ArrowDown, ChevronDown, Minus, Plus, RotateCcw, RotateCw, Settings2, Undo2 } from "lucide-react";
import "./twin-camera-navigation.css";''')
s=change(s,'Interactive human body. Drag to rotate; pinch to zoom. Keyboard: left/right arrows rotate, plus/minus zoom, Home resets.','Interactive human body. Drag sideways to rotate 360 degrees, vertically to tilt. Two fingers move the view vertically or pinch to zoom. Keyboard: left/right rotate, up/down move vertically, Shift+up/down tilt, plus/minus zoom, Home resets.')
s=change(s,'Drag to rotate 360° · Pinch or scroll to zoom','Drag to rotate 360° and tilt · Two fingers move up/down or zoom · Right-drag moves up/down')
s=change(s,'Interaktyvus žmogaus kūnas. Tempk, kad pasuktum; suglausk pirštus, kad keistum mastelį. Klaviatūra: rodyklės suka, pliusas ir minusas keičia mastelį, Home atkuria vaizdą.','Interaktyvus žmogaus kūnas. Tempk į šonus, kad suktum 360 laipsnių, aukštyn ar žemyn – kad keistum kampą. Dviem pirštais perkelk vaizdą arba keisk mastelį. Klaviatūra: kairėn ir dešinėn suka, aukštyn ir žemyn perkelia, Shift ir vertikalios rodyklės keičia kampą, pliusas ir minusas keičia mastelį, Home atkuria vaizdą.')
s=change(s,'Tempk ir suk 360° · Mastelį keisk dviem pirštais','Vienu pirštu suk ir keisk kampą · Dviem perkelk aukštyn / žemyn ar keisk mastelį · Pele perkelk laikydamas dešinį mygtuką')
s=change(s,'    rotateLeft: "Rotate left",','''    panUp: "Move view up",
    panDown: "Move view down",
    tiltUp: "Look from above",
    tiltDown: "Look from below",
    upperBody: "Upper body",
    lowerBody: "Lower body",
    navigation: "Vertical view controls",
    rotateLeft: "Rotate left",''')
s=change(s,'    rotateLeft: "Pasukti kairėn",','''    panUp: "Apžiūrėti aukščiau",
    panDown: "Apžiūrėti žemiau",
    tiltUp: "Žiūrėti iš aukščiau",
    tiltDown: "Žiūrėti iš žemiau",
    upperBody: "Kūno viršus",
    lowerBody: "Kūno apačia",
    navigation: "Vertikalus vaizdo valdymas",
    rotateLeft: "Pasukti kairėn",''')
s=change(s,'          {!show3D && (','''          {show3D && presentation === "full" && (
            <div data-twin-navigation role="group" aria-label={copy.navigation}>
              {([["pan-up", ArrowUp, copy.panUp], ["pan-down", ArrowDown, copy.panDown]] as const)
                .map(([action, Icon, name]) => (
                  <button key={action} type="button" onClick={() => command(action)}
                    style={controlStyle} aria-label={name} title={name}>
                    <Icon aria-hidden="true" className="size-4" />
                  </button>
                ))}
            </div>
          )}
          {!show3D && (''')
s=change(s,'                ["rotate-right", RotateCw, copy.rotateRight],','''                ["rotate-right", RotateCw, copy.rotateRight],
                ["tilt-up", ArrowUp, copy.tiltUp],
                ["tilt-down", ArrowDown, copy.tiltDown],''')
s=change(s,'''        {show3D && (
          <label''','''        {show3D && (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {([["upper-body", copy.upperBody], ["lower-body", copy.lowerBody]] as const)
              .map(([action, name]) => (
                <button key={action} type="button" style={controlStyle}
                  className={controlClass} onClick={() => command(action)}>{name}</button>
              ))}
          </div>
        )}
        {show3D && (
          <label''')
p.write_text(s)
p=Path('scripts/test-twin-camera-navigation.mjs');s=p.read_text()
s=change(s,'expect((await read()).x).toBeCloseTo(0,3);','expect((await read()).x).toBeCloseTo(pose.x,3);')
s=change(s,'expect((await read()).z).toBeCloseTo(0,3);','expect((await read()).z).toBeCloseTo(pose.z,3);')
p.write_text(s)
files=[
 '.github/workflows/twin-camera-navigation.yml','docs/twin-camera-navigation.md',
 'scripts/test-twin-camera-navigation.mjs','src/components/twin/BodySceneStage.tsx',
 'src/components/twin/twin-camera-navigation.css','src/components/twin/twin-camera.navigation.test.ts',
 'src/components/twin/twin-camera.navigation.ts','src/components/twin/twin-scene.model.ts',
 'src/components/twin/twin-scene.runtime.ts','tests/twin-browser/navigation-fixture.tsx',
 'tests/twin-browser/navigation.html',
]
assert len(files)==11 and all(Path(f).is_file() for f in files)
Path('test-results').mkdir(exist_ok=True)
Path('test-results/navigation-files.json').write_text(json.dumps(files))
