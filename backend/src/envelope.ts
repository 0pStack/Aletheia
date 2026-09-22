import type { Response } from 'express'

export function ok<T>(res: Response, data: T): Response {
  return res.status(200).json({
    success: true,
    data,
    error: null,
  })
}

export function fail(res: Response, status: number, code: string, message: string): Response {
  return res.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  })
}
