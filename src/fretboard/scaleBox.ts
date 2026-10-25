/** A "box" is a window of 5 consecutive frets (start..start+4) showing one scale position. */
export const BOX_SPAN = 4;
export const BOX_MAX_START = 8;

/** Sensible default box: the one whose lowest root sits on the 6th string. */
export const defaultBoxStart = (tonic: number): number => Math.min(((tonic - 4) % 12 + 12) % 12, BOX_MAX_START);
