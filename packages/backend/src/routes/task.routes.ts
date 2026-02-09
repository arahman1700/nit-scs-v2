import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../utils/prisma.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  createTaskSchema,
  updateTaskSchema,
  changeStatusSchema,
  assignTaskSchema,
  addCommentSchema,
} from '../schemas/task.schema.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

const INCLUDE_RELATIONS = {
  assignee: { select: { id: true, fullName: true, email: true } },
  creator: { select: { id: true, fullName: true, email: true } },
  project: { select: { id: true, projectName: true, projectCode: true } },
  comments: {
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

// GET /api/tasks — List (paginated, filterable)
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10)));
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const assigneeId = req.query.assigneeId as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (projectId) where.projectId = projectId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          creator: { select: { id: true, fullName: true, email: true } },
          project: { select: { id: true, projectName: true, projectCode: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    sendSuccess(res, tasks, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id — Get with comments
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.findUnique({ where: { id }, include: INCLUDE_RELATIONS });
    if (!task) { sendError(res, 404, 'Task not found'); return; }
    sendSuccess(res, task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks — Create
router.post('/', authenticate, validate(createTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const task = await prisma.task.create({
      data: {
        ...req.body.body ?? req.body,
        creatorId: userId,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      },
      include: INCLUDE_RELATIONS,
    });

    const io = req.app.get('io');
    io?.emit('entity:created', { entity: 'tasks' });

    await createAuditLog({ tableName: 'tasks', recordId: task.id, action: 'create', newValues: task, performedById: userId, ipAddress: req.ip as string });
    sendCreated(res, task);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id — Update metadata (creator or admin/manager)
router.put('/:id', authenticate, validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) { sendError(res, 404, 'Task not found'); return; }

    // Only creator or admin/manager can update
    const isOwner = existing.creatorId === userId;
    const isAdminOrManager = ['admin', 'manager'].includes(req.user!.systemRole);
    if (!isOwner && !isAdminOrManager) { sendError(res, 403, 'Not authorized to update this task'); return; }

    const updateData: Record<string, unknown> = { ...req.body };
    if (req.body.dueDate) updateData.dueDate = new Date(req.body.dueDate);
    if (req.body.dueDate === null) updateData.dueDate = null;

    const task = await prisma.task.update({ where: { id }, data: updateData, include: INCLUDE_RELATIONS });
    const io = req.app.get('io');
    io?.emit('entity:updated', { entity: 'tasks' });
    sendSuccess(res, task);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id/assign — Assign to employee (admin, manager)
router.put('/:id/assign', authenticate, requireRole('admin', 'manager'), validate(assignTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.update({
      where: { id },
      data: { assigneeId: req.body.assigneeId },
      include: INCLUDE_RELATIONS,
    });
    const io = req.app.get('io');
    io?.emit('entity:updated', { entity: 'tasks' });
    io?.emit('task:assigned', { taskId: id, assigneeId: req.body.assigneeId });
    sendSuccess(res, task);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id/status — Change status (assignee, creator, admin)
router.put('/:id/status', authenticate, validate(changeStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) { sendError(res, 404, 'Task not found'); return; }

    const isOwner = existing.creatorId === userId || existing.assigneeId === userId;
    const isAdmin = req.user!.systemRole === 'admin';
    if (!isOwner && !isAdmin) { sendError(res, 403, 'Not authorized'); return; }

    const newStatus = req.body.status;
    const data: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'completed') data.completedAt = new Date();
    if (newStatus === 'open') data.completedAt = null;

    const task = await prisma.task.update({ where: { id }, data, include: INCLUDE_RELATIONS });
    const io = req.app.get('io');
    io?.emit('entity:updated', { entity: 'tasks' });
    if (newStatus === 'completed') io?.emit('task:completed', { taskId: id });
    sendSuccess(res, task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/comments — Add comment
router.post('/:id/comments', authenticate, validate(addCommentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.id as string;
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) { sendError(res, 404, 'Task not found'); return; }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        authorId: req.user!.userId,
        body: req.body.body,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });

    const io = req.app.get('io');
    io?.emit('entity:updated', { entity: 'tasks' });
    sendCreated(res, comment);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id — Delete (creator, admin)
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) { sendError(res, 404, 'Task not found'); return; }

    const isCreator = existing.creatorId === userId;
    const isAdmin = req.user!.systemRole === 'admin';
    if (!isCreator && !isAdmin) { sendError(res, 403, 'Not authorized'); return; }

    await prisma.task.delete({ where: { id } });
    const io = req.app.get('io');
    io?.emit('entity:deleted', { entity: 'tasks' });
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

export default router;
