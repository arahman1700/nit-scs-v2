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

export function paginate(defaultSort = 'createdAt') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const sortBy = (req.query.sortBy as string) || defaultSort;
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
