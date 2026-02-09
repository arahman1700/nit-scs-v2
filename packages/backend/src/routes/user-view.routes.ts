import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, sendCreated } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '@nit-scs/shared';

const router = Router();

// GET /api/v1/views/:entityType — List user's saved views
router.get('/:entityType', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { entityType } = req.params;

    const views = await prisma.userView.findMany({
      where: { userId, entityType: entityType as string },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        viewType: true,
        config: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, views);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// POST /api/v1/views — Save a new view
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { entityType, name, viewType, config, isDefault } = req.body;

    if (!entityType || !config) {
      sendError(res, 400, 'entityType and config are required');
      return;
    }

    // If setting as default, unset other defaults for same entity
    if (isDefault) {
      await prisma.userView.updateMany({
        where: { userId, entityType, isDefault: true },
        data: { isDefault: false },
      });
    }

    const view = await prisma.userView.create({
      data: {
        userId,
        entityType,
        name: name ?? 'Default',
        viewType: viewType ?? 'grid',
        config,
        isDefault: isDefault ?? false,
      },
    });

    sendCreated(res, view);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// PATCH /api/v1/views/:id — Update a view
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name, viewType, config, isDefault } = req.body;

    const existing = await prisma.userView.findFirst({
      where: { id: id as string, userId },
    });
    if (!existing) throw new NotFoundError('UserView', id as string);

    // If setting as default, unset other defaults for same entity
    if (isDefault) {
      await prisma.userView.updateMany({
        where: { userId, entityType: existing.entityType, isDefault: true, id: { not: id as string } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.userView.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(viewType !== undefined && { viewType }),
        ...(config !== undefined && { config }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    sendSuccess(res, updated);
  } catch (err) {
    const status = (err as any).statusCode ?? 500;
    sendError(res, status, (err as Error).message);
  }
});

// DELETE /api/v1/views/:id — Delete a view
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const existing = await prisma.userView.findFirst({
      where: { id: id as string, userId },
    });
    if (!existing) throw new NotFoundError('UserView', id as string);

    await prisma.userView.delete({ where: { id: id as string } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    const status = (err as any).statusCode ?? 500;
    sendError(res, status, (err as Error).message);
  }
});

export default router;
