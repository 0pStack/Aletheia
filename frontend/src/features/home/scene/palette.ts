import { Color } from 'three'

// How far into last light the scene is taken: 0 keeps the even, bright afternoon, 1 is the sun on
// the horizon with deep shadow and a near-black zenith. Everything the mood touches is derived
// from it here, so the whole scene moves together on one number.
export const NIGHTFALL = 0.38

function step(from: number, to: number): number {
  return from + (to - from) * NIGHTFALL
}

function blend(from: string, to: string): Color {
  return new Color(from).lerp(new Color(to), NIGHTFALL)
}

// HAZE is the dust in the air away from the sun, SUN_HAZE the same dust with the sun behind it;
// ground and sky both fade to a mix of the two, which is what stacks the landscape into layers.
export const HAZE = blend('#c39a63', '#8a5732')
export const SUN_HAZE = blend('#f7cf90', '#ff9c46')
export const ZENITH = blend('#3a6ba8', '#101d33')
export const SUNLIGHT = blend('#ffdfb4', '#ffb268')
// Deliberately cool, and weak once the sun is down: gold where the light lands and blue-violet
// where it does not is what gives the forms their depth and the shadows their density.
export const SKY_FILL = blend('#7d8fb5', '#3d4a80')
export const GROUND_BOUNCE = blend('#7a4a24', '#632f10')
export const DUST = new Color('#ffd3a1')

export const SUN_STRENGTH = step(4.9, 6.6)
export const FILL_STRENGTH = step(1.15, 0.5)
export const EXPOSURE = step(1.0, 0.82)
export const FOG_DENSITY = step(0.0010, 0.0014)
