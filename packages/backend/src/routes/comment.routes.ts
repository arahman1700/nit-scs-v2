import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { auditAndEmit } from '../utils/routeHelpers.js';
import {
  createComment,
  listComments,
  getComment,
  updateComment,
  deleteComment,
  countComments,
} from '../services/comment.service.js';
import { createCommentSchema, updateCommentSchema } from '../schemas/comment.schema.js';
import type { Request, Response, NextFunction } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { emitToDocument } from '../socket/setup.js';

// Mounted at /api/v1/comments
const router = Router({ mergeParams: true });

/**
 * GET /comments/:documentType/:documentId
 * List comments for a document (paginated).
 */
router.get('/:documentType/:documentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentType = req.params.documentType as string;
    const documentId = req.params.documentId as string;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10)));

    const result = await listComments({ documentType, documentId, page, pageSize });

    sendSuccess(res, result.comments, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /comments/:documentType/:documentId/count
 * Get comment count for badge display.
 */
router.get(
  '/:documentType/:documentId/count',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentType = req.params.documentType as string;
      const documentId = req.params.documentId as string;
      const count = await countComments(documentType, documentId);
      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /comments/:documentType/:documentId
 * Create a new comment on a document.
 */
router.post(
  '/:documentType/:documentId',
  authenticate,
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentType = req.params.documentType as string;
      const documentId = req.params.documentId as string;
      const userId = req.user!.userId;

      const comment = await createComment({
        documentType,
        documentId,
        authorId: userId,
        content: req.body.content,
      });

      // Emit real-time event to users viewing this document
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        emitToDocument(io, documentId, 'comment:created', {
          documentType,
          documentId,
          comment,
        });
      }

      await auditAndEmit(req, {
        action: 'create',
        tableName: 'document_comments',
        recordId: comment.id,
        newValues: { documentType, documentId, content: req.body.content },
        entityEvent: 'created',
        entityName: 'comments',
      });

      sendCreated(res, comment);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /comments/:documentType/:documentId/:commentId
 * Update a comment (author or admin/manager only).
 */
router.put(
  '/:documentType/:documentId/:commentId',
  authenticate,
  validate(updateCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentType = req.params.documentType as string;
      const documentId = req.params.documentId as string;
      const commentId = req.params.commentId as string;
      const userId = req.user!.userId;

      const existing = await getComment(commentId);
      if (!existing) {
        sendError(res, 404, 'Comment not found');
        return;
      }

      // Only author or admin/manager can edit
      const isAuthor = existing.authorId === userId;
      const isPrivileged = ['admin', 'manager'].includes(req.user!.systemRole);
      if (!isAuthor && !isPrivileged) {
        sendError(res, 403, 'Not authorized to edit this comment');
        return;
      }

      const updated = await updateComment(commentId, req.body.content);

      // Emit real-time event
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        emitToDocument(io, documentId, 'comment:updated', {
          documentType,
          documentId,
          comment: updated,
        });
      }

      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /comments/:documentType/:documentId/:commentId
 * Soft-delete a comment (author or admin/manager only).
 */
router.delete(
  '/:documentType/:documentId/:commentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentType = req.params.documentType as string;
      const documentId = req.params.documentId as string;
      const commentId = req.params.commentId as string;
      const userId = req.user!.userId;

      const existing = await getComment(commentId);
      if (!existing) {
        sendError(res, 404, 'Comment not found');
        return;
      }

      // Only author or admin/manager can delete
      const isAuthor = existing.authorId === userId;
      const isPrivileged = ['admin', 'manager'].includes(req.user!.systemRole);
      if (!isAuthor && !isPrivileged) {
        sendError(res, 403, 'Not authorized to delete this comment');
        return;
      }

      await deleteComment(commentId);

      // Emit real-time event
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        emitToDocument(io, documentId, 'comment:deleted', {
          documentType,
          documentId,
          commentId,
        });
      }

      await auditAndEmit(req, {
        action: 'delete',
        tableName: 'document_comments',
        recordId: commentId,
        oldValues: { documentType, documentId, content: existing.content },
        entityEvent: 'deleted',
        entityName: 'comments',
      });

      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
