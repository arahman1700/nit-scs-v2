import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../../../utils/response.js';
import { auditAndEmit } from '../../../utils/routeHelpers.js';
import {
  createComment,
  listComments,
  getComment,
  updateComment,
  deleteComment,
  countComments,
  verifyDocumentExists,
} from '../services/comment.service.js';
import {
  createCommentSchema,
  updateCommentSchema,
  commentParamsSchema,
  commentIdParamsSchema,
} from '../schemas/comment.schema.js';
import type { Request, Response, NextFunction } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { emitToDocument } from '../../../socket/setup.js';

// Mounted at /api/v1/comments
const router = Router({ mergeParams: true });

/**
 * Validate and extract document params (documentType + documentId).
 * Returns parsed params or sends 400 and returns null.
 */
function parseDocumentParams(req: Request, res: Response): { documentType: string; documentId: string } | null {
  const result = commentParamsSchema.safeParse(req.params);
  if (!result.success) {
    sendError(
      res,
      400,
      'Invalid document params',
      result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    );
    return null;
  }
  return result.data;
}

/**
 * Validate and extract comment params (documentType + documentId + commentId).
 * Returns parsed params or sends 400 and returns null.
 */
function parseCommentIdParams(
  req: Request,
  res: Response,
): { documentType: string; documentId: string; commentId: string } | null {
  const result = commentIdParamsSchema.safeParse(req.params);
  if (!result.success) {
    sendError(
      res,
      400,
      'Invalid params',
      result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    );
    return null;
  }
  return result.data;
}

/**
 * GET /comments/:documentType/:documentId
 * List comments for a document (paginated).
 */
router.get('/:documentType/:documentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = parseDocumentParams(req, res);
    if (!params) return;

    await verifyDocumentExists(params.documentType, params.documentId);

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10)));

    const result = await listComments({
      documentType: params.documentType,
      documentId: params.documentId,
      page,
      pageSize,
    });

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
      const params = parseDocumentParams(req, res);
      if (!params) return;

      await verifyDocumentExists(params.documentType, params.documentId);

      const count = await countComments(params.documentType, params.documentId);
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
      const params = parseDocumentParams(req, res);
      if (!params) return;

      await verifyDocumentExists(params.documentType, params.documentId);

      const userId = req.user!.userId;

      const comment = await createComment({
        documentType: params.documentType,
        documentId: params.documentId,
        authorId: userId,
        content: req.body.content,
      });

      // Emit real-time event to users viewing this document
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        emitToDocument(io, params.documentId, 'comment:created', {
          documentType: params.documentType,
          documentId: params.documentId,
          comment,
        });
      }

      await auditAndEmit(req, {
        action: 'create',
        tableName: 'document_comments',
        recordId: comment.id,
        newValues: { documentType: params.documentType, documentId: params.documentId, content: req.body.content },
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
      const params = parseCommentIdParams(req, res);
      if (!params) return;

      const userId = req.user!.userId;

      const existing = await getComment(params.commentId);
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

      const updated = await updateComment(params.commentId, req.body.content);

      // Emit real-time event
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        emitToDocument(io, params.documentId, 'comment:updated', {
          documentType: params.documentType,
          documentId: params.documentId,
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
      const params = parseCommentIdParams(req, res);
      if (!params) return;

      const userId = req.user!.userId;

      const existing = await getComment(params.commentId);
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

      await deleteComment(params.commentId);

      // Emit real-time event
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        emitToDocument(io, params.documentId, 'comment:deleted', {
          documentType: params.documentType,
          documentId: params.documentId,
          commentId: params.commentId,
        });
      }

      await auditAndEmit(req, {
        action: 'delete',
        tableName: 'document_comments',
        recordId: params.commentId,
        oldValues: { documentType: params.documentType, documentId: params.documentId, content: existing.content },
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
