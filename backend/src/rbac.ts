import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from './auth.js'

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session.user

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
        },
      })
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      })
    }

    next()
  }
}
