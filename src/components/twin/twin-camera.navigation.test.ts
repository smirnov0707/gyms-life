import { describe, it, expect } from "vitest";
import { Ray, Vector3 } from "three";
import {
  clampTwinTargetY, moveTwinTargetY, twinCameraKey, twinNearSideReach, twinPresetDistance,
} from "./twin-camera.navigation";
import { TWIN_CAMERA, TWIN_FRAME, moveTwinCamera, isTwinTap } from "./twin-scene.model";

describe("bounded vertical Twin navigation", () => {
  it("moves the view vertically without deriving a body measurement", () => {
    expect(moveTwinTargetY(0.88, "pan-up", 1.7, 0.88)).toBeCloseTo(1.05);
    expect(moveTwinTargetY(0.88, "pan-down", 1.7, 0.88)).toBeCloseTo(0.71);
  });
  it("stops at the loaded mesh limits rather than losing the body", () => {
    let y = 0.88;
    for(let i=0;i<100;i++) y=moveTwinTargetY(y,"pan-up",1.7,0.88);
    expect(y).toBeCloseTo(1.7*0.94);
    for(let i=0;i<100;i++) y=moveTwinTargetY(y,"pan-down",1.7,0.88);
    expect(y).toBeCloseTo(1.7*0.08);
  });
  it("accounts for nonzero mesh origins", () => {
    const home=3+0.88;
    expect(moveTwinTargetY(home,"upper-body",1.7,home)).toBeCloseTo(3+1.7*0.73);
    expect(moveTwinTargetY(home,"lower-body",1.7,home)).toBeCloseTo(3+1.7*0.28);
  });
  it("restores home after panning, tilting and zooming", () => {
    expect(moveTwinTargetY(1.5,"reset",1.7,0.88)).toBe(0.88);
    expect(moveTwinCamera({yaw:9,pitch:0.9,distance:1},"reset",4)).toEqual({
      yaw:0,pitch:TWIN_CAMERA.defaultPitch,distance:4,
    });
  });
  it("keeps presets inside the zoom limits", () => {
    for(const command of ["upper-body","lower-body"] as const) {
      const distance=twinPresetDistance(command,4)!;
      expect(distance).toBeGreaterThan(4*TWIN_CAMERA.minDistanceRatio);
      expect(distance).toBeLessThan(4);
      expect(moveTwinCamera({yaw:Math.PI,pitch:1,distance:2},command,4).yaw).toBe(Math.PI);
    }
    expect(twinPresetDistance("pan-up",4)).toBeUndefined();
  });
  it.each([NaN, Infinity, -Infinity])("keeps invalid target coordinates finite: %s", value => {
    expect(clampTwinTargetY(value,NaN,NaN)).toBe(TWIN_FRAME.eyeHeight);
  });
  it("tilts in both directions without flipping or restricting horizontal turns", () => {
    let pose={yaw:0,pitch:Math.PI/2,distance:4};
    for(let i=0;i<100;i++) pose=moveTwinCamera(pose,"tilt-up",4);
    expect(pose.pitch).toBe(TWIN_CAMERA.minPitch);
    expect(pose.pitch).toBeGreaterThan(0);
    for(let i=0;i<100;i++) pose=moveTwinCamera(pose,"tilt-down",4);
    expect(pose.pitch).toBe(TWIN_CAMERA.maxPitch);
    expect(pose.pitch).toBeLessThan(Math.PI);
    for(let i=0;i<48;i++) pose=moveTwinCamera(pose,"rotate-right",4);
    expect(pose.yaw).toBeCloseTo(6*Math.PI);
  });
  it("still treats drag, pinch and cancellation histories as non-taps", () => {
    expect(isTwinTap(60,false)).toBe(false);
    expect(isTwinTap(0,true)).toBe(false);
    expect(isTwinTap(2,false)).toBe(true);
  });
});

describe("camera keyboard scope", () => {
  const event={key:"ArrowUp",shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,
    isComposing:false,defaultPrevented:false};
  it("separates vertical pan from tilt", () => {
    expect(twinCameraKey(event)).toBe("pan-up");
    expect(twinCameraKey({...event,key:"ArrowDown"})).toBe("pan-down");
    expect(twinCameraKey({...event,shiftKey:true})).toBe("tilt-up");
    expect(twinCameraKey({...event,key:"ArrowDown",shiftKey:true})).toBe("tilt-down");
  });
  it.each(["ctrlKey","altKey","metaKey","isComposing","defaultPrevented"] as const)(
    "does not capture %s", key => expect(twinCameraKey({...event,[key]:true})).toBeUndefined(),
  );
  it("preserves existing reset and zoom keys", () => {
    expect(twinCameraKey({...event,key:"Home"})).toBe("reset");
    expect(twinCameraKey({...event,key:"+"})).toBe("zoom-in");
    expect(twinCameraKey({...event,key:"-"})).toBe("zoom-out");
    expect(twinCameraKey({...event,key:"q"})).toBeUndefined();
  });
});

describe("near-side picking with a moved or tilted camera", () => {
  it.each([0,Math.PI/2,Math.PI,Math.PI*1.5])("keeps the body-axis cutoff at yaw %s", yaw => {
    const axis=new Vector3(0,0.88,0);
    const camera=new Vector3(Math.sin(yaw)*3,2,Math.cos(yaw)*3);
    const ray=new Ray(camera,new Vector3().subVectors(axis,camera).normalize());
    expect(twinNearSideReach(ray,camera,axis)).toBeCloseTo(camera.distanceTo(axis));
  });
  it("allows visible legs below a raised target without reaching the far side", () => {
    const axis=new Vector3(0,1.5,0);
    const camera=new Vector3(0,2,3);
    const middle=new Vector3(0,0.4,0);
    const ray=new Ray(camera,middle.clone().sub(camera).normalize());
    const reach=twinNearSideReach(ray,camera,axis);
    expect(reach).toBeCloseTo(camera.distanceTo(middle));
    expect(reach).toBeGreaterThan(camera.distanceTo(axis));
  });
  it("does not select behind or parallel to the body plane", () => {
    const axis=new Vector3(0,1,0), camera=new Vector3(0,1,3);
    expect(twinNearSideReach(new Ray(camera,new Vector3(1,0,0)),camera,axis)).toBe(0);
    expect(twinNearSideReach(new Ray(camera,new Vector3(0,0,1)),camera,axis)).toBe(0);
  });
});
