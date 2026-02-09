import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  createComment,
  listComments,
  getComment,
  updateComment,
  deleteComment,
  countComments,
  type CreateCommentDto,
} from './comment.service.js';

const AUTHOR_SELECT = { id: true, fullName: true, email: true, department: true };

describe('comment.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
  });

  // ---------------------------------------------------------------------------
  // createComment
  // ---------------------------------------------------------------------------
  describe('createComment', () => {
    const dto: CreateCommentDto = {
      documentType: 'mrrv',
      documentId: 'mrrv-001',
      authorId: 'user-001',
      content: 'Looks good to me',
    };

    it('should call prisma.documentComment.create with correct data and include', async () => {
      const created = { id: 'comment-1', ...dto, author: { id: 'user-001', fullName: 'John' } };
      mockPrisma.documentComment.create.mockResolvedValue(created);

      const result = await createComment(dto);

      expect(mockPrisma.documentComment.create).toHaveBeenCalledOnce();
      expect(mockPrisma.documentComment.create).toHaveBeenCalledWith({
        data: {
          documentType: 'mrrv',
          documentId: 'mrrv-001',
          authorId: 'user-001',
          content: 'Looks good to me',
        },
        include: { author: { select: AUTHOR_SELECT } },
      });
      expect(result).toBe(created);
    });

    it('should return the created comment', async () => {
      const created = { id: 'comment-2', content: 'Test' };
      mockPrisma.documentComment.create.mockResolvedValue(created);

      const result = await createComment(dto);

      expect(result).toEqual(created);
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.documentComment.create.mockRejectedValue(new Error('DB error'));

      await expect(createComment(dto)).rejects.toThrow('DB error');
    });
  });

  // ---------------------------------------------------------------------------
  // listComments
  // ---------------------------------------------------------------------------
  describe('listComments', () => {
    it('should use default pagination (page 1, pageSize 25)', async () => {
      mockPrisma.documentComment.findMany.mockResolvedValue([]);
      mockPrisma.documentComment.count.mockResolvedValue(0);

      const result = await listComments({ documentType: 'mrrv', documentId: 'mrrv-001' });

      expect(mockPrisma.documentComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 25 }));
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
    });

    it('should use custom pagination values', async () => {
      mockPrisma.documentComment.findMany.mockResolvedValue([]);
      mockPrisma.documentComment.count.mockResolvedValue(0);

      const result = await listComments({
        documentType: 'mirv',
        documentId: 'mirv-001',
        page: 3,
        pageSize: 10,
      });

      expect(mockPrisma.documentComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it('should filter by documentType, documentId, and deletedAt:null', async () => {
      mockPrisma.documentComment.findMany.mockResolvedValue([]);
      mockPrisma.documentComment.count.mockResolvedValue(0);

      await listComments({ documentType: 'mrrv', documentId: 'mrrv-001' });

      const expectedWhere = {
        documentType: 'mrrv',
        documentId: 'mrrv-001',
        deletedAt: null,
      };

      expect(mockPrisma.documentComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.documentComment.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('should include author with correct select', async () => {
      mockPrisma.documentComment.findMany.mockResolvedValue([]);
      mockPrisma.documentComment.count.mockResolvedValue(0);

      await listComments({ documentType: 'mrrv', documentId: 'mrrv-001' });

      expect(mockPrisma.documentComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { author: { select: AUTHOR_SELECT } },
        }),
      );
    });

    it('should order by createdAt desc', async () => {
      mockPrisma.documentComment.findMany.mockResolvedValue([]);
      mockPrisma.documentComment.count.mockResolvedValue(0);

      await listComments({ documentType: 'mrrv', documentId: 'mrrv-001' });

      expect(mockPrisma.documentComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should return { comments, total, page, pageSize }', async () => {
      const comments = [{ id: 'c-1' }, { id: 'c-2' }];
      mockPrisma.documentComment.findMany.mockResolvedValue(comments);
      mockPrisma.documentComment.count.mockResolvedValue(42);

      const result = await listComments({
        documentType: 'mrrv',
        documentId: 'mrrv-001',
        page: 2,
        pageSize: 10,
      });

      expect(result).toEqual({ comments, total: 42, page: 2, pageSize: 10 });
    });

    it('should pass the same where to both findMany and count', async () => {
      mockPrisma.documentComment.findMany.mockResolvedValue([]);
      mockPrisma.documentComment.count.mockResolvedValue(0);

      await listComments({ documentType: 'lot', documentId: 'lot-99' });

      const findWhere = mockPrisma.documentComment.findMany.mock.calls[0][0].where;
      const countWhere = mockPrisma.documentComment.count.mock.calls[0][0].where;
      expect(findWhere).toEqual(countWhere);
    });
  });

  // ---------------------------------------------------------------------------
  // getComment
  // ---------------------------------------------------------------------------
  describe('getComment', () => {
    it('should call findFirst with commentId and deletedAt:null', async () => {
      const comment = { id: 'comment-1', content: 'Hello' };
      mockPrisma.documentComment.findFirst.mockResolvedValue(comment);

      const result = await getComment('comment-1');

      expect(mockPrisma.documentComment.findFirst).toHaveBeenCalledWith({
        where: { id: 'comment-1', deletedAt: null },
        include: { author: { select: AUTHOR_SELECT } },
      });
      expect(result).toBe(comment);
    });

    it('should return null when comment not found', async () => {
      mockPrisma.documentComment.findFirst.mockResolvedValue(null);

      const result = await getComment('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateComment
  // ---------------------------------------------------------------------------
  describe('updateComment', () => {
    it('should update comment content and include author', async () => {
      const updated = { id: 'comment-1', content: 'Updated content' };
      mockPrisma.documentComment.update.mockResolvedValue(updated);

      const result = await updateComment('comment-1', 'Updated content');

      expect(mockPrisma.documentComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { content: 'Updated content' },
        include: { author: { select: AUTHOR_SELECT } },
      });
      expect(result).toBe(updated);
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.documentComment.update.mockRejectedValue(new Error('Record not found'));

      await expect(updateComment('nonexistent', 'text')).rejects.toThrow('Record not found');
    });
  });

  // ---------------------------------------------------------------------------
  // deleteComment
  // ---------------------------------------------------------------------------
  describe('deleteComment', () => {
    it('should soft-delete by setting deletedAt to a Date', async () => {
      const softDeleted = { id: 'comment-1', deletedAt: new Date() };
      mockPrisma.documentComment.update.mockResolvedValue(softDeleted);

      const result = await deleteComment('comment-1');

      expect(mockPrisma.documentComment.update).toHaveBeenCalledOnce();
      const callArgs = mockPrisma.documentComment.update.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: 'comment-1' });
      expect(callArgs.data.deletedAt).toBeInstanceOf(Date);
      expect(result).toBe(softDeleted);
    });

    it('should not call prisma.documentComment.delete (uses update for soft-delete)', async () => {
      mockPrisma.documentComment.update.mockResolvedValue({});

      await deleteComment('comment-1');

      expect(mockPrisma.documentComment.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // countComments
  // ---------------------------------------------------------------------------
  describe('countComments', () => {
    it('should count with documentType, documentId, and deletedAt:null', async () => {
      mockPrisma.documentComment.count.mockResolvedValue(15);

      const result = await countComments('mrrv', 'mrrv-001');

      expect(mockPrisma.documentComment.count).toHaveBeenCalledWith({
        where: { documentType: 'mrrv', documentId: 'mrrv-001', deletedAt: null },
      });
      expect(result).toBe(15);
    });

    it('should return 0 when no comments exist', async () => {
      mockPrisma.documentComment.count.mockResolvedValue(0);

      const result = await countComments('mirv', 'mirv-001');

      expect(result).toBe(0);
    });
  });
});
