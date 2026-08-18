export * from "./types.js";
export * from "./shared.js";
export * from "./unal.js";
export * from "./udea.js";
export * from "./funlam.js";

import { funlamAdapter } from "./funlam.js";
import { udeaAdapter } from "./udea.js";
import { unalAdapter } from "./unal.js";
import type { UniversityAdapter } from "./types.js";

export const builtInAdapters: UniversityAdapter[] = [unalAdapter, udeaAdapter, funlamAdapter];
