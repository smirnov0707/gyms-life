export type ExerciseAnatomy = {
  primary: string;
  synergists: string;
  stabilizers: string;
};

const bySlug: Record<string, ExerciseAnatomy> = {
  "bench-dip": {
    primary: "Triceps brachii",
    synergists: "Anterior deltoid, pectoralis major",
    stabilizers: "Shoulder stabilizers, scapular stabilizers, core",
  },

  "chest-dip": {
    primary: "Pectoralis major",
    synergists: "Triceps brachii, anterior deltoid",
    stabilizers: "Shoulder stabilizers, scapular stabilizers, core",
  },

  "tricep-dip": {
    primary: "Triceps brachii",
    synergists: "Anterior deltoid, pectoralis major",
    stabilizers: "Shoulder stabilizers, scapular stabilizers, core",
  },

  "push-up": {
    primary: "Pectoralis major",
    synergists: "Triceps brachii, anterior deltoid",
    stabilizers: "Serratus anterior, rotator cuff, core",
  },

  "bench-press": {
    primary: "Pectoralis major",
    synergists: "Triceps brachii, anterior deltoid",
    stabilizers: "Rotator cuff, scapular stabilizers, core",
  },

  "incline-bench-press": {
    primary: "Upper pectoralis major",
    synergists: "Anterior deltoid, triceps brachii",
    stabilizers: "Rotator cuff, scapular stabilizers",
  },

  "barbell-row": {
    primary: "Latissimus dorsi, middle trapezius",
    synergists: "Rhomboids, posterior deltoid, biceps",
    stabilizers: "Erector spinae, core, forearms",
  },

  "lat-pulldown": {
    primary: "Latissimus dorsi",
    synergists: "Biceps brachii, brachialis, teres major",
    stabilizers: "Rotator cuff, lower trapezius, core",
  },

  "pull-up": {
    primary: "Latissimus dorsi",
    synergists: "Biceps brachii, brachialis, teres major",
    stabilizers: "Rotator cuff, scapular stabilizers, core",
  },

  "deadlift": {
    primary: "Gluteus maximus, hamstrings",
    synergists: "Erector spinae, adductor magnus, quadriceps",
    stabilizers: "Core, latissimus dorsi, forearms",
  },

  "romanian-deadlift": {
    primary: "Hamstrings, gluteus maximus",
    synergists: "Adductor magnus, erector spinae",
    stabilizers: "Core, latissimus dorsi, forearms",
  },

  "squat": {
    primary: "Quadriceps, gluteus maximus",
    synergists: "Adductors, hamstrings",
    stabilizers: "Core, erector spinae, calves",
  },

  "front-squat": {
    primary: "Quadriceps",
    synergists: "Gluteus maximus, adductors",
    stabilizers: "Core, erector spinae, upper back",
  },

  "leg-press": {
    primary: "Quadriceps",
    synergists: "Gluteus maximus, hamstrings, adductors",
    stabilizers: "Core, hip stabilizers",
  },

  "leg-extension": {
    primary: "Quadriceps",
    synergists: "—",
    stabilizers: "Hip flexors, core",
  },

  "leg-curl": {
    primary: "Hamstrings",
    synergists: "Gastrocnemius",
    stabilizers: "Gluteus maximus, core",
  },

  "hip-thrust": {
    primary: "Gluteus maximus",
    synergists: "Hamstrings, adductor magnus",
    stabilizers: "Core, hip abductors",
  },

  "glute-bridge": {
    primary: "Gluteus maximus",
    synergists: "Hamstrings, adductor magnus",
    stabilizers: "Core, hip abductors",
  },

  "barbell-curl": {
    primary: "Biceps brachii",
    synergists: "Brachialis, brachioradialis",
    stabilizers: "Wrist flexors, core",
  },

  "hammer-curl": {
    primary: "Brachialis, brachioradialis",
    synergists: "Biceps brachii",
    stabilizers: "Wrist stabilizers, core",
  },

  "triceps-pushdown": {
    primary: "Triceps brachii",
    synergists: "Anconeus",
    stabilizers: "Shoulder stabilizers, core, forearms",
  },

  "overhead-press": {
    primary: "Anterior and medial deltoid",
    synergists: "Triceps brachii, upper pectoralis major",
    stabilizers: "Rotator cuff, trapezius, core",
  },

  "lateral-raise": {
    primary: "Lateral deltoid",
    synergists: "Supraspinatus, anterior/posterior deltoid",
    stabilizers: "Rotator cuff, trapezius, core",
  },

  "face-pull": {
    primary: "Posterior deltoid",
    synergists: "Rhomboids, middle trapezius",
    stabilizers: "Rotator cuff, lower trapezius",
  },

  "bicycle-crunch": {
    primary: "Rectus abdominis",
    synergists: "Internal and external obliques, hip flexors",
    stabilizers: "Transverse abdominis, pelvic stabilizers",
  },

  "plank": {
    primary: "Transverse abdominis, rectus abdominis",
    synergists: "Obliques, gluteus maximus",
    stabilizers: "Shoulders, serratus anterior, spinal stabilizers",
  },

  "hanging-leg-raise": {
    primary: "Rectus abdominis",
    synergists: "Iliopsoas, rectus femoris",
    stabilizers: "Grip, latissimus dorsi, scapular stabilizers",
  },

  "russian-twist": {
    primary: "Internal and external obliques",
    synergists: "Rectus abdominis, hip flexors",
    stabilizers: "Transverse abdominis, spinal stabilizers",
  },
};

export function exerciseAnatomy(
  slug?: string | null,
  muscleGroup?: string | null,
): ExerciseAnatomy {
  const key = (slug ?? "").toLowerCase();

  if (bySlug[key]) {
    return bySlug[key];
  }

  const group = (muscleGroup ?? "").toLowerCase();

  const fallback: Record<string, ExerciseAnatomy> = {
    chest: {
      primary: "Pectoralis major",
      synergists: "Anterior deltoid, triceps brachii",
      stabilizers: "Rotator cuff, scapular stabilizers",
    },
    back: {
      primary: "Latissimus dorsi",
      synergists: "Rhomboids, trapezius, biceps",
      stabilizers: "Core, rotator cuff, spinal stabilizers",
    },
    shoulders: {
      primary: "Deltoids",
      synergists: "Triceps brachii, upper trapezius",
      stabilizers: "Rotator cuff, scapular stabilizers",
    },
    arms: {
      primary: "Biceps / Triceps brachii",
      synergists: "Brachialis, brachioradialis",
      stabilizers: "Wrist and shoulder stabilizers",
    },
    legs: {
      primary: "Quadriceps / Gluteus maximus",
      synergists: "Hamstrings, adductors",
      stabilizers: "Core, hip and ankle stabilizers",
    },
    glutes: {
      primary: "Gluteus maximus",
      synergists: "Hamstrings, adductor magnus",
      stabilizers: "Core, hip abductors",
    },
    core: {
      primary: "Rectus abdominis / Transverse abdominis",
      synergists: "Internal and external obliques",
      stabilizers: "Spinal and pelvic stabilizers",
    },
    abs: {
      primary: "Rectus abdominis",
      synergists: "Internal and external obliques",
      stabilizers: "Transverse abdominis, hip stabilizers",
    },
  };

  return (
    fallback[group] ?? {
      primary: "Primary target muscles",
      synergists: "Supporting muscles",
      stabilizers: "Stabilizers and joint-support muscles",
    }
  );
}
