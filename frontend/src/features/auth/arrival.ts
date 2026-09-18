import { z } from 'zod'

// Router state handed from the login dive to the app shell, so the shell can settle in over
// the liquid the dive ends on instead of snapping in.
export const DIVE_ARRIVAL_STATE = { arrival: 'dive' } as const

const diveArrivalSchema = z.object({ arrival: z.literal('dive') })

export function arrivedByDive(state: unknown): boolean {
  return diveArrivalSchema.safeParse(state).success
}
