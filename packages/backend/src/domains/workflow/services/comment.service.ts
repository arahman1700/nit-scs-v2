import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

const AUTHOR_SELECT = { id: true, fullName: true, email: true, department: true } as const;

/**
 * Maps comment documentType route params to Prisma model delegates.
 * Used to verify the referenced document actually exists before
 * allowing comment operations.
 */
const DOCUMENT_DELEGATES: Record<
  string,
  { findUnique: (args: { where: { id: string }; select: { id: true } }) => Promise<unknown> }
> = {
  mrrv: prisma.mrrv,
  mirv: prisma.mirv,
  mrv: prisma.mrv,
  rfim: prisma.rfim,
  osd: prisma.osdReport,
  'job-order': prisma.jobOrder,
  'gate-pass': prisma.gatePass,
  'stock-transfer': prisma.stockTransfer,
  mrf: prisma.materialRequisition,
  shipment: prisma.shipment,
} as Record<string, any>;

/**
 * Verify the referenced document exists.
 * Throws NotFoundError if the document type is unknown or the document doesn't exist.
 */
export async function verifyDocumentExists(documentType: string, documentId: string): Promise<void> {
  const delegate = DOCUMENT_DELEGATES[documentType];
  if (!delegate) {
    throw new NotFoundError(`Unknown document type: ${documentType}`);
  }
  const doc = await delegate.findUnique({ where: { id: documentId }, select: { id: true } });
  if (!doc) {
    throw new NotFoundError(`Document not found: ${documentType}/${documentId}`);
  }
}

export interface CreateCommentDto {
  documentType: string;
  documentId: string;
  authorId: string;
  content: string;
}

export interface CommentListParams {
  documentType: string;
  documentId: string;
  page?: number;
  pageSize?: number;
}

/**
 * Create a new comment on a document.
 */
export async function createComment(dto: CreateCommentDto) {
  return prisma.documentComment.create({
    data: {
      documentType: dto.documentType,
      documentId: dto.documentId,
      authorId: dto.authorId,
      content: dto.content,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });
}

/**
 * List comments for a specific document (paginated, newest first).
 * Excludes soft-deleted comments.
 */
export async function listComments(params: CommentListParams) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where = {
    documentType: params.documentType,
    documentId: params.documentId,
    deletedAt: null,
  };

  const [comments, total] = await Promise.all([
    prisma.documentComment.findMany({
      where,
      include: { author: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.documentComment.count({ where }),
  ]);

  return { comments, total, page, pageSize };
}

/**
 * Get a single comment by ID (not soft-deleted).
 */
export async function getComment(commentId: string) {
  return prisma.documentComment.findFirst({
    where: { id: commentId, deletedAt: null },
    include: { author: { select: AUTHOR_SELECT } },
  });
}

/**
 * Update the content of a comment.
 * Only the author or admin/manager can update.
 */
export async function updateComment(commentId: string, content: string) {
  return prisma.documentComment.update({
    where: { id: commentId },
    data: { content },
    include: { author: { select: AUTHOR_SELECT } },
  });
}

/**
 * Soft-delete a comment.
 */
export async function deleteComment(commentId: string) {
  return prisma.documentComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Count comments for a document (for badge display).
 */
export async function countComments(documentType: string, documentId: string) {
  return prisma.documentComment.count({
    where: { documentType, documentId, deletedAt: null },
  });
}
