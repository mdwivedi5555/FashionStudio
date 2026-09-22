import { v } from "convex/values";

/**
 * Luxemee Studio — Aesthetic Engine configuration.
 * Single source of truth shared by the backend and the UI.
 * Maps studio controls to prompt fragments injected into generation calls.
 */

export const ENGINE_IDS = {
  catalog: "fashn-v1.6",
  campaign: "flux-vton-pro",
  fallback: "catvton-fallback",
} as const;

export type EngineId = (typeof ENGINE_IDS)[keyof typeof ENGINE_IDS];

export const engineValidator = v.union(
  v.literal("catalog"),
  v.literal("campaign"),
);

export const engineUsedValidator = v.union(
  v.literal("catalog"),
  v.literal("campaign"),
  v.literal("fallback"),
);

export const kindValidator = v.union(
  v.literal("flatlay"),
  v.literal("mannequin"),
  v.literal("model_face"),
  v.literal("render_3d"),
);

export const planValidator = v.union(
  v.literal("free"),
  v.literal("studio"),
  v.literal("enterprise"),
);

export const AESTHETICS = {
  standard: {
    id: "standard",
    label: "Standard PDP",
    tagline: "Catalog-clean, fabric-true",
    prefix: "",
  },
  promptPulse: {
    id: "prompt_pulse",
    label: "PROMPT PULSE",
    tagline: "Vintage editorial poster art",
    prefix:
      "vintage editorial poster art style, 1970s luxury campaign, warm film grain, high-contrast risograph tones, screen-print texture, art-directed negative space, magazine cover composition",
  },
} as const;

export type AestheticId = keyof typeof AESTHETICS;

export const aestheticValidator = v.union(
  v.literal("standard"),
  v.literal("prompt_pulse"),
);

export const LIGHTING_PRESETS = [
  {
    id: "softbox",
    label: "Softbox Gallery",
    keyIntensity: 45,
    fillRatio: 2,
    warmth: 50,
  },
  {
    id: "directional",
    label: "Directional Key",
    keyIntensity: 75,
    fillRatio: 3,
    warmth: 55,
  },
  {
    id: "sunset",
    label: "Golden Hour",
    keyIntensity: 60,
    fillRatio: 2,
    warmth: 90,
  },
  {
    id: "noir",
    label: "Editorial Noir",
    keyIntensity: 90,
    fillRatio: 5,
    warmth: 25,
  },
] as const;

export const GALLERY_RENDERS = [
  { id: "flat", label: "Flat-lay", prompt: "flat-lay product photography on warm paper backdrop" },
  { id: "front", label: "Front Pose", prompt: "front-facing studio pose, neutral stance" },
  { id: "turn", label: "Three-Quarter", prompt: "three-quarter turn, editorial stance" },
  { id: "motion", label: "In Motion", prompt: "walking pose, fabric flowing in the wind" },
] as const;

/** Map UI lighting sliders to prompt language. */
export function lightingPrompt(l: {
  keyIntensity: number;
  fillRatio: number;
  warmth: number;
}): string {
  const key =
    l.keyIntensity > 80
      ? "hard directional key light"
      : l.keyIntensity > 55
        ? "directional key light"
        : "soft diffused key light";
  const fill = `fill ratio ${l.fillRatio}:1`;
  const warmth =
    l.warmth > 75 ? "warm tungsten cast" : l.warmth < 25 ? "cool daylight balance" : "neutral white balance";
  return `${key}, ${fill}, ${warmth}`;
}

/** Build the full generation prompt from studio controls. */
export function buildPrompt(opts: {
  aesthetic: "standard" | "prompt_pulse";
  lighting: { keyIntensity: number; fillRatio: number; warmth: number };
  stylePrompt?: string;
  renderId?: string;
}): string {
  const parts: string[] = [];
  const aesthetic =
    opts.aesthetic === "prompt_pulse" ? AESTHETICS.promptPulse : AESTHETICS.standard;
  if (aesthetic.prefix) parts.push(aesthetic.prefix);
  const render = GALLERY_RENDERS.find((r) => r.id === opts.renderId);
  if (render) parts.push(render.prompt);
  parts.push(
    "professional e-commerce fashion photography, absolute fabric fidelity, pattern preservation, sharp textures suitable for PDP zoom",
  );
  parts.push(lightingPrompt(opts.lighting));
  if (opts.stylePrompt) parts.push(opts.stylePrompt);
  return parts.join(", ");
}

/** Engine priority with programmatic fallback ordering. */
export function resolveEngineOrder(
  engine: "catalog" | "campaign",
): ("catalog" | "campaign" | "fallback")[] {
  if (engine === "catalog") return ["catalog", "fallback"];
  return ["campaign", "fallback"];
}

export const CREDIT_COST = 1; // credits per rendered image

export function estimateBatchCredits(rows: number): number {
  return rows * CREDIT_COST;
}
