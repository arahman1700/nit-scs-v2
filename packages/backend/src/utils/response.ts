import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, meta?: { page: number; pageSize: number; total: number }) {
  const response: Record<string, unknown> = { success: true, data };
  if (meta) {
    response.meta = {
      page: meta.page,
      pageSize: meta.pageSize,
      total: meta.total,
      totalPages: Math.ceil(meta.total / meta.pageSize),
    };
  }
  res.json(response);
}

export function sendError(res: Response, statusCode: number, message: string, errors?: unknown[]) {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
}

export function sendCreated<T>(res: Response, data: T) {
  res.status(201).json({ success: true, data });
}

export function sendNoContent(res: Response) {
  res.status(204).send();
}
