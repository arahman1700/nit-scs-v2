import type { Request, Response, NextFunction } from 'express';

export interface PaginationQuery {
  page: number;
  pageSize: number;
  skip: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  search?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      pagination?: PaginationQuery;
    }
  }
}

/**
 * Validate that sortBy contains only safe characters (letters, digits, underscore).
 * Prevents Prisma validation errors or injection of unexpected field paths.
 */
const SAFE_SORT_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export function paginate(defaultSort = 'createdAt', allowedSortFields?: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    let sortBy = (req.query.sortBy as string) || defaultSort;
    // Validate sortBy: must match safe pattern and be in allowed list (if provided)
    if (!SAFE_SORT_PATTERN.test(sortBy)) {
      sortBy = defaultSort;
    }
    if (allowedSortFields?.length && !allowedSortFields.includes(sortBy)) {
      sortBy = defaultSort;
    }

    const sortDir = ((req.query.sortDir as string) || 'desc') === 'asc' ? ('asc' as const) : ('desc' as const);
    const search = req.query.search as string | undefined;

    req.pagination = {
      page,
      pageSize,
      skip: (page - 1) * pageSize,
      sortBy,
      sortDir,
      search,
    };

    next();
  };
}
