/** Valores vacíos estables para selectores de zustand (evitan renders infinitos). */
export const EMPTY_ARR: never[] = [];
export const EMPTY_OBJ: Record<string, never> = Object.freeze({}) as Record<string, never>;
