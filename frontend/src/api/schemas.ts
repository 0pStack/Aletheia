import { z } from 'zod'

// Placeholder until the backend track agrees the session shape (issues #3, #11, #23).
export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
})

export type SessionUser = z.infer<typeof sessionUserSchema>
