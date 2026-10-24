import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUnlockedTrails, type TrailId } from "./engine";

const STORAGE_KEY = "@orbit-rush/mobile-progress-v1";

export interface Progress {
  bestScore: number;
  totalSparks: number;
  totalRuns: number;
  selectedTrail: TrailId;
}

export const DEFAULT_PROGRESS: Progress = {
  bestScore: 0,
  totalSparks: 0,
  totalRuns: 0,
  selectedTrail: "ion",
};

export async function loadProgress(): Promise<Progress> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PROGRESS };

    const parsed = JSON.parse(stored) as Partial<Progress>;
    const progress: Progress = {
      bestScore: safeInteger(parsed.bestScore),
      totalSparks: safeInteger(parsed.totalSparks),
      totalRuns: safeInteger(parsed.totalRuns),
      selectedTrail:
        parsed.selectedTrail === "solar" ||
        parsed.selectedTrail === "nova" ||
        parsed.selectedTrail === "prism"
          ? parsed.selectedTrail
          : "ion",
    };

    if (!getUnlockedTrails(progress.totalSparks).includes(progress.selectedTrail)) {
      progress.selectedTrail = "ion";
    }
    return progress;
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export async function saveProgress(progress: Progress): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

function safeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
