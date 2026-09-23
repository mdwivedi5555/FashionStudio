import { create } from "zustand";
import { LIGHTING_PRESETS } from "@/convex/engineConfig";

export type Engine = "catalog" | "campaign";
export type Aesthetic = "standard" | "prompt_pulse";
export type AssetKind = "flatlay" | "mannequin" | "model_face" | "render_3d";

export interface StudioAsset {
  id: string;
  name: string;
  kind: AssetKind;
  url: string;
}

interface StudioState {
  // Ingestion
  selectedGarment: StudioAsset | null;
  selectedModel: StudioAsset | null;
  // Pipeline
  engine: Engine;
  aesthetic: Aesthetic;
  renderId: string;
  lighting: { keyIntensity: number; fillRatio: number; warmth: number };
  stylePrompt: string;
  promptPulseOn: boolean;
  // Actions
  setEngine: (e: Engine) => void;
  setAesthetic: (a: Aesthetic) => void;
  setRenderId: (id: string) => void;
  setLighting: (l: Partial<StudioState["lighting"]>) => void;
  setStylePrompt: (s: string) => void;
  togglePromptPulse: () => void;
  applyPreset: (id: string) => void;
  selectGarment: (a: StudioAsset | null) => void;
  selectModel: (a: StudioAsset | null) => void;
  reset: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  selectedGarment: null,
  selectedModel: null,
  engine: "catalog",
  aesthetic: "standard",
  renderId: "front",
  lighting: { keyIntensity: 55, fillRatio: 2, warmth: 50 },
  stylePrompt: "",
  promptPulseOn: false,

  setEngine: (engine) => set({ engine }),
  setAesthetic: (aesthetic) => set({ aesthetic }),
  setRenderId: (renderId) => set({ renderId }),
  setLighting: (l) => set((s) => ({ lighting: { ...s.lighting, ...l } })),
  setStylePrompt: (stylePrompt) => set({ stylePrompt }),
  togglePromptPulse: () =>
    set((s) => ({
      promptPulseOn: !s.promptPulseOn,
      aesthetic: !s.promptPulseOn ? "prompt_pulse" : "standard",
    })),
  applyPreset: (id) => {
    const preset = LIGHTING_PRESETS.find((p) => p.id === id);
    if (preset)
      set({
        lighting: {
          keyIntensity: preset.keyIntensity,
          fillRatio: preset.fillRatio,
          warmth: preset.warmth,
        },
      });
  },
  selectGarment: (a) => set({ selectedGarment: a }),
  selectModel: (a) => set({ selectedModel: a }),
  reset: () =>
    set({
      selectedGarment: null,
      selectedModel: null,
      engine: "catalog",
      aesthetic: "standard",
      renderId: "front",
      lighting: { keyIntensity: 55, fillRatio: 2, warmth: 50 },
      stylePrompt: "",
      promptPulseOn: false,
    }),
}));
