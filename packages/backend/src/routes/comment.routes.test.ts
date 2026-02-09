import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

// Ensure JWT secrets are available before any module evaluates
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

// ── Common mocks ──────────────────────────────────────────────────────────
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
vi.mock('../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
}));
vi.mock('../utils/routeHelpers.js', () => ({ auditAndEmit: vi.fn() }));

// ── Service mock ──────────────────────────────────────────────────────────
vi.mock('../services/comment.service.js', () => ({
  createComment: vi.fn(),
  listComments: vi.fn(),
  getComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  countComments: vi.fn(),
}));

import {
  createComment,
  listComments,
  getComment,
  updateComment,
  deleteComment,
  countComments,
} from '../services/comment.service.js';

const app = createTestApp();
const request = supertest(app);

const DOC_TYPE = 'mrrv';
const DOC_ID = '00000000-0000-0000-0000-000000000001';
const COMMENT_ID = '00000000-0000-0000-0000-000000000002';
const BASE = `/api/v1/comments/${DOC_TYPE}/${DOC_ID}`;

describe('Comment Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── GET /comments/:documentType/:documentId ──────────────────────────

  describe('GET /comments/:documentType/:documentId', () => {
    it('returns 200 with paginated comments', async () => {
      const mockResult = {
        comments: [{ id: COMMENT_ID, content: 'hello', authorId: 'test-user-id' }],
        page: 1,
        pageSize: 25,
        total: 1,
      };
      vi.mocked(listComments).mockResolvedValue(mockResult);

      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult.comments);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 25, total: 1 });
      expect(listComments).toHaveBeenCalledWith({
        documentType: DOC_TYPE,
        documentId: DOC_ID,
        page: 1,
        pageSize: 25,
      });
    });

    it('passes custom page and pageSize query params', async () => {
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        page: 2,
        pageSize: 10,
        total: 0,
      });

      const res = await request.get(`${BASE}?page=2&pageSize=10`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(listComments).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 10 }));
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /comments/:documentType/:documentId/count ────────────────────

  describe('GET /comments/:documentType/:documentId/count', () => {
    it('returns 200 with count', async () => {
      vi.mocked(countComments).mockResolvedValue(42);

      const res = await request.get(`${BASE}/count`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ count: 42 });
      expect(countComments).toHaveBeenCalledWith(DOC_TYPE, DOC_ID);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/count`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /comments/:documentType/:documentId ─────────────────────────

  describe('POST /comments/:documentType/:documentId', () => {
    // Note: createCommentSchema wraps body in z.object({ body: z.object({ content: ... }) })
    // The validate middleware parses req.body against this schema, so the HTTP body
    // must include the `body` wrapper to pass validation.

    it('returns 201 and creates a comment', async () => {
      const mockComment = { id: COMMENT_ID, authorId: 'test-user-id', content: 'new comment' };
      vi.mocked(createComment).mockResolvedValue(mockComment as any);

      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: { content: 'new comment' } });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockComment);
      expect(createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: DOC_TYPE,
          documentId: DOC_ID,
          authorId: 'test-user-id',
        }),
      );
    });

    it('sets authorId from req.user.userId', async () => {
      const userToken = signTestToken({ userId: 'specific-user-123', systemRole: 'viewer' });
      vi.mocked(createComment).mockResolvedValue({ id: 'c1' } as any);

      await request
        .post(BASE)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: { content: 'authored comment' } });

      expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ authorId: 'specific-user-123' }));
    });

    it('returns 400 for empty content', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: { content: '' } });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(createComment).not.toHaveBeenCalled();
    });

    it('returns 400 when content is missing', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ body: { content: 'test' } });
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /comments/:documentType/:documentId/:commentId ────────────────

  describe('PUT /comments/:documentType/:documentId/:commentId', () => {
    const url = `${BASE}/${COMMENT_ID}`;

    it('returns 200 when user is author', async () => {
      vi.mocked(getComment).mockResolvedValue({
        authorId: 'test-user-id',
        content: 'old',
      } as any);
      vi.mocked(updateComment).mockResolvedValue({
        id: COMMENT_ID,
        content: 'updated',
      } as any);

      const res = await request
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: { content: 'updated' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('updated');
    });

    it('returns 200 when user is admin even if not author', async () => {
      const adminToken = signTestToken({ userId: 'admin-user', systemRole: 'admin' });
      vi.mocked(getComment).mockResolvedValue({
        authorId: 'other-user',
        content: 'old',
      } as any);
      vi.mocked(updateComment).mockResolvedValue({
        id: COMMENT_ID,
        content: 'admin-edited',
      } as any);

      const res = await request
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: { content: 'admin-edited' } });

      expect(res.status).toBe(200);
      expect(updateComment).toHaveBeenCalled();
    });

    it('returns 200 when user is manager even if not author', async () => {
      const managerToken = signTestToken({ userId: 'manager-user', systemRole: 'manager' });
      vi.mocked(getComment).mockResolvedValue({
        authorId: 'other-user',
        content: 'old',
      } as any);
      vi.mocked(updateComment).mockResolvedValue({
        id: COMMENT_ID,
        content: 'manager-edited',
      } as any);

      const res = await request
        .put(url)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ body: { content: 'manager-edited' } });

      expect(res.status).toBe(200);
    });

    it('returns 404 when comment not found', async () => {
      vi.mocked(getComment).mockResolvedValue(null as any);

      const res = await request
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: { content: 'updated' } });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(updateComment).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not author and not admin/manager', async () => {
      const viewerToken = signTestToken({ userId: 'viewer-user', systemRole: 'viewer' });
      vi.mocked(getComment).mockResolvedValue({
        authorId: 'other-user',
        content: 'old',
      } as any);

      const res = await request
        .put(url)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ body: { content: 'try edit' } });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(updateComment).not.toHaveBeenCalled();
    });
  });

  // ── DELETE /comments/:documentType/:documentId/:commentId ─────────────

  describe('DELETE /comments/:documentType/:documentId/:commentId', () => {
    const url = `${BASE}/${COMMENT_ID}`;

    it('returns 204 when user is author', async () => {
      vi.mocked(getComment).mockResolvedValue({
        authorId: 'test-user-id',
        content: 'to delete',
      } as any);
      vi.mocked(deleteComment).mockResolvedValue(undefined as any);

      const res = await request.delete(url).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(deleteComment).toHaveBeenCalledWith(COMMENT_ID);
    });

    it('returns 204 when user is admin even if not author', async () => {
      const adminToken = signTestToken({ userId: 'admin-user', systemRole: 'admin' });
      vi.mocked(getComment).mockResolvedValue({
        authorId: 'other-user',
        content: 'to delete',
      } as any);
      vi.mocked(deleteComment).mockResolvedValue(undefined as any);

      const res = await request.delete(url).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('returns 404 when comment not found', async () => {
      vi.mocked(getComment).mockResolvedValue(null as any);

      const res = await request.delete(url).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(deleteComment).not.toHaveBeenCalled();
    });

    it('returns 403 when not authorized', async () => {
      const viewerToken = signTestToken({ userId: 'viewer-user', systemRole: 'viewer' });
      vi.mocked(getComment).mockResolvedValue({
        authorId: 'other-user',
        content: 'not yours',
      } as any);

      const res = await request.delete(url).set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(deleteComment).not.toHaveBeenCalled();
    });
  });
});
