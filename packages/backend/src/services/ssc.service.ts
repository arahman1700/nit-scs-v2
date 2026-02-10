/**
 * SSC (Scrap Selling Committee) Bid Service — V2
 * Prisma model: SscBid (table: ssc_bids)
 * State flow: submitted → accepted/rejected, then memo signing → finance notification
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import type { ListParams } from '../types/dto.js';

const LIST_INCLUDE = {
  scrapItem: {
    select: { id: true, scrapNumber: true, materialType: true, description: true },
  },
} satisfies Prisma.SscBidInclude;

const DETAIL_INCLUDE = {
  scrapItem: true,
} satisfies Prisma.SscBidInclude;

export async function listBids(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [{ bidderName: { contains: params.search, mode: 'insensitive' } }];
  }
  if (params.status) where.status = params.status;
  if (params.scrapItemId) where.scrapItemId = params.scrapItemId;

  const [data, total] = await Promise.all([
    prisma.sscBid.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.sscBid.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const bid = await prisma.sscBid.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!bid) throw new NotFoundError('SscBid', id);
  return bid;
}

export async function createBid(
  data: { scrapItemId: string; bidderName: string; bidderContact?: string; bidAmount: number },
  userId: string,
) {
  // Verify scrap item exists and is in SSC stage
  const scrapItem = await prisma.scrapItem.findUnique({ where: { id: data.scrapItemId } });
  if (!scrapItem) throw new NotFoundError('ScrapItem', data.scrapItemId);
  if (scrapItem.status !== 'in_ssc') {
    throw new BusinessRuleError('Bids can only be placed on scrap items with "in_ssc" status');
  }

  return prisma.sscBid.create({
    data: {
      scrapItemId: data.scrapItemId,
      bidderName: data.bidderName,
      bidderContact: data.bidderContact ?? null,
      bidAmount: data.bidAmount,
      bidDate: new Date(),
      status: 'submitted',
    },
    include: LIST_INCLUDE,
  });
}

export async function acceptBid(bidId: string, userId: string) {
  return prisma.$transaction(async tx => {
    const bid = await tx.sscBid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundError('SscBid', bidId);
    if (bid.status !== 'submitted') {
      throw new BusinessRuleError('Only bids in "submitted" status can be accepted');
    }

    // Accept this bid
    const accepted = await tx.sscBid.update({
      where: { id: bidId },
      data: { status: 'accepted' },
      include: DETAIL_INCLUDE,
    });

    // Reject all other bids for the same scrap item
    await tx.sscBid.updateMany({
      where: {
        scrapItemId: bid.scrapItemId,
        id: { not: bidId },
        status: 'submitted',
      },
      data: { status: 'rejected' },
    });

    return accepted;
  });
}

export async function rejectBid(bidId: string, userId: string) {
  const bid = await prisma.sscBid.findUnique({ where: { id: bidId } });
  if (!bid) throw new NotFoundError('SscBid', bidId);
  if (bid.status !== 'submitted') {
    throw new BusinessRuleError('Only bids in "submitted" status can be rejected');
  }

  return prisma.sscBid.update({
    where: { id: bidId },
    data: { status: 'rejected' },
    include: DETAIL_INCLUDE,
  });
}

export async function signMemo(bidId: string, userId: string) {
  const bid = await prisma.sscBid.findUnique({ where: { id: bidId } });
  if (!bid) throw new NotFoundError('SscBid', bidId);
  if (bid.status !== 'accepted') {
    throw new BusinessRuleError('Only accepted bids can have their SSC memo signed');
  }
  if (bid.sscMemoSigned) {
    throw new BusinessRuleError('SSC memo has already been signed for this bid');
  }

  return prisma.sscBid.update({
    where: { id: bidId },
    data: { sscMemoSigned: true },
    include: DETAIL_INCLUDE,
  });
}

export async function notifyFinance(bidId: string) {
  const bid = await prisma.sscBid.findUnique({ where: { id: bidId } });
  if (!bid) throw new NotFoundError('SscBid', bidId);
  if (bid.status !== 'accepted') {
    throw new BusinessRuleError('Only accepted bids can trigger finance notification');
  }
  if (!bid.sscMemoSigned) {
    throw new BusinessRuleError('SSC memo must be signed before notifying finance');
  }
  if (bid.financeCopyDate) {
    throw new BusinessRuleError('Finance has already been notified for this bid');
  }

  return prisma.sscBid.update({
    where: { id: bidId },
    data: { financeCopyDate: new Date() },
    include: DETAIL_INCLUDE,
  });
}
