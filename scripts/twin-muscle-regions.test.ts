import { describe, expect, it } from "vitest";
// @ts-expect-error - the build scripts are plain ESM with no type declarations.
import { MUSCLE_REGIONS, regionForMuscle } from "./twin-muscle-regions.mjs";

/**
 * The region map decides which part of the athlete's body a colour lands on.
 * It is the only place where "this muscle is an arm" is written down, it runs
 * inside a build script no reviewer executes, and its mistakes are invisible
 * in the diff and visible on the figure — an earlier pattern accepted every
 * "digitorum" suffix and painted arm recovery on the feet, which shipped.
 *
 * So the mapping is checked by name here, against muscles that actually exist
 * in Terminologia Anatomica, rather than by looking at the built asset.
 */

const regions = MUSCLE_REGIONS as string[];
const region = regionForMuscle as (name: string) => string | null;

/** Every side and part prefix the atlas uses, applied to one muscle name. */
const spellings = (name: string) => [
  name,
  `right ${name}`,
  `left ${name}`,
  name.toUpperCase(),
  ` ${name} `,
];

describe("twin muscle regions", () => {
  it("offers the eight regions the figure is coloured by", () => {
    expect(regions).toEqual([
      "chest",
      "shoulders",
      "back",
      "arms",
      "abs",
      "core",
      "glutes",
      "legs",
    ]);
  });

  describe("places each muscle where the athlete would look for it", () => {
    const expected: Record<string, string[]> = {
      chest: [
        "pectoralis minor",
        "clavicular part of pectoralis major",
        "sternocostal part of pectoralis major",
      ],
      shoulders: ["deltoid", "acromial part of deltoid", "spinal part of deltoid"],
      back: [
        "latissimus dorsi",
        "descending part of trapezius",
        "infraspinatus",
        "teres major",
        "rhomboid major",
        "erector spinae",
        "levator scapulae",
      ],
      arms: [
        "long head of biceps brachii",
        "medial head of triceps brachii",
        "brachialis",
        "brachioradialis",
        "supinator",
        "pronator teres",
        "flexor carpi ulnaris",
        "extensor digitorum",
        "flexor digitorum profundus",
        "extensor pollicis longus",
        "abductor pollicis longus",
        "flexor pollicis longus",
      ],
      abs: [
        "external oblique",
        "internal oblique",
        "rectus abdominis",
        "muscle of anterior abdominal wall",
      ],
      core: ["transversus abdominis", "serratus anterior", "quadratus lumborum"],
      glutes: ["gluteus maximus", "gluteus medius", "gluteus minimus"],
      legs: [
        "rectus femoris",
        "vastus lateralis",
        "long head of biceps femoris",
        "semitendinosus",
        "gastrocnemius",
        "soleus",
        "adductor magnus",
        "tibialis anterior",
        "tibialis posterior",
        "peroneus longus",
        "psoas major",
      ],
    };
    for (const [name, muscles] of Object.entries(expected)) {
      for (const muscle of muscles) {
        it(`${muscle} is ${name}`, () => {
          for (const spelling of spellings(muscle)) expect(region(spelling)).toBe(name);
        });
      }
    }
  });

  describe("keeps the leg's long digit muscles out of the arms", () => {
    // These are the reason this file exists. Their names differ from the
    // forearm muscles only by a suffix, and all of them are below the knee.
    for (const muscle of [
      "extensor digitorum longus",
      "flexor digitorum longus",
      "flexor hallucis longus",
      "extensor hallucis longus",
    ]) {
      it(`${muscle} is a leg, not an arm`, () => {
        expect(region(muscle)).toBe("legs");
      });
    }

    it("never files anything below the knee as an arm", () => {
      for (const muscle of [
        "extensor digitorum brevis",
        "flexor digitorum brevis",
        "abductor hallucis",
        "quadratus plantae",
        "flexor hallucis brevis",
      ]) {
        expect(region(muscle)).not.toBe("arms");
      }
    });
  });

  it("leaves the hand and the foot to the skin", () => {
    // The figure draws skin wherever no muscle lies under it, so a hand or
    // foot muscle here is the difference between a hand and a flayed palm.
    // These are all too small to see at any zoom the app allows.
    for (const muscle of [
      "flexor pollicis brevis",
      "abductor pollicis brevis",
      "opponens pollicis",
      "abductor digiti minimi",
      "first dorsal interosseous",
      "lumbrical muscle of hand",
      "flexor digitorum brevis",
      "quadratus plantae",
    ]) {
      expect(region(muscle)).toBeNull();
    }
  });

  it("does not claim structures that are not muscle", () => {
    // The atlas names arteries, nerves and fasciae in the same file, and some
    // of them carry a muscle's name — "fascia of pectoralis major" is not the
    // pectoralis, and drawing it would put a sheet over the chest.
    for (const name of [
      "brachial artery",
      "median nerve",
      "fascia of pectoralis major",
      "tendon of biceps brachii",
      "deltoid ligament",
      "subacromial bursa",
      "axillary lymph node",
      "sheath of rectus abdominis",
    ]) {
      expect(region(name)).toBeNull();
    }
  });

  it("returns null rather than guessing for anything it does not know", () => {
    for (const name of ["", "   ", "muscle organ", "anatomical entity", "left kidney", "heart"]) {
      expect(region(name)).toBeNull();
    }
  });
});
