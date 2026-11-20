export type MoveId = "pushIn" | "pullOut" | "panLeft" | "panRight" | "craneUp" | "orbit" | "vertigo" | "wiggle";
export type EffectId = "none" | "snow" | "rain" | "dust" | "bokeh" | "fog" | "film";
export type Strength = "subtle" | "medium" | "strong";

export type Camera = {
  zoom: number;
  pan: [number, number];
  shift: [number, number];
  dolly: number;
};

export const MOVES: { id: MoveId; label: string; hint: string }[] = [
  { id: "pushIn", label: "Push in", hint: "Camera moves toward the subject" },
  { id: "pullOut", label: "Pull out", hint: "Camera backs away to reveal the scene" },
  { id: "panLeft", label: "Slide left", hint: "Camera slides sideways, background shifts" },
  { id: "panRight", label: "Slide right", hint: "Camera slides sideways, background shifts" },
  { id: "craneUp", label: "Crane up", hint: "Camera rises over the scene" },
  { id: "orbit", label: "Orbit", hint: "Camera circles around the subject" },
  { id: "vertigo", label: "Vertigo", hint: "Subject holds still while the background stretches" },
  { id: "wiggle", label: "3D wiggle", hint: "Quick left-right wobble that pops in 3D" },
];

export const EFFECTS: { id: EffectId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "snow", label: "Snow" },
  { id: "rain", label: "Rain" },
  { id: "dust", label: "Gold dust" },
  { id: "bokeh", label: "Bokeh" },
  { id: "fog", label: "Depth fog" },
  { id: "film", label: "Film" },
];

export const STRENGTH: Record<Strength, number> = { subtle: 0.6, medium: 1, strong: 1.5 };

const A = 0.03;

const ease = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)));

export function overscan(strength: Strength) {
  return 1.04 + A * 2.2 * STRENGTH[strength];
}

export function camera(move: MoveId, t: number, duration: number, strength: Strength): Camera {
  const p = t / duration;
  const e = ease(p);
  const k = STRENGTH[strength];
  const a = A * k;
  switch (move) {
    case "pushIn":
      return { zoom: 1 + 0.1 * e * k, pan: [0, 0], shift: [0, 0], dolly: 0.16 * e * k };
    case "pullOut":
      return { zoom: 1 + 0.1 * (1 - e) * k, pan: [0, 0], shift: [0, 0], dolly: 0.16 * (1 - e) * k };
    case "panLeft":
      return { zoom: 1, pan: [0.02 * k * (1 - 2 * e), 0], shift: [a * (2 * e - 1), 0], dolly: 0 };
    case "panRight":
      return { zoom: 1, pan: [0.02 * k * (2 * e - 1), 0], shift: [a * (1 - 2 * e), 0], dolly: 0 };
    case "craneUp":
      return { zoom: 1.02, pan: [0, 0.02 * k * (1 - 2 * e)], shift: [0, a * (2 * e - 1)], dolly: 0 };
    case "orbit": {
      const th = 2 * Math.PI * p;
      return { zoom: 1.02, pan: [0, 0], shift: [a * Math.sin(th), a * 0.55 * (1 - Math.cos(th)) - a * 0.3], dolly: 0 };
    }
    case "vertigo":
      return { zoom: 1 + 0.22 * e * k, pan: [0, 0], shift: [0, 0], dolly: -0.32 * e * k };
    case "wiggle": {
      const cycles = Math.max(1, Math.round(duration * 1.25));
      const s = Math.tanh(3 * Math.sin(2 * Math.PI * cycles * p)) / Math.tanh(3);
      return { zoom: 1.01, pan: [0, 0], shift: [a * 1.2 * s, 0], dolly: 0 };
    }
  }
}
