import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { auditAndEmit } from '../../../utils/routeHelpers.js';
import { clientIp } from '../../../utils/helpers.js';
import { createSignature, getByDocument, getById } from '../services/digital-signature.service.js';
import { createSignatureSchema, listSignaturesQuerySchema } from '../schemas/digital-signature.schema.js';
import type { Request, Response, NextFunction } from 'express';

// Mounted at /api/v1/signatures
const router = Router();

/**
 * GET /signatures?documentType=&documentId=
 * List all signatures for a document.
 */
router.get(
  '/',
  authenticate,
  validate(listSignaturesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentType, documentId } = res.locals.validatedQuery as {
        documentType: string;
        documentId: string;
      };

      const signatures = await getByDocument(documentType, documentId);
      sendSuccess(res, signatures);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /signatures/:id
 * Get a single signature by ID.
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = await getById(req.params.id as string);
    if (!signature) {
      sendError(res, 404, 'Signature not found');
      return;
    }
    sendSuccess(res, signature);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /signatures
 * Create a new digital signature.
 */
router.post(
  '/',
  authenticate,
  validate(createSignatureSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const ip = clientIp(req);

      const signature = await createSignature({
        documentType: req.body.documentType,
        documentId: req.body.documentId,
        signedById: userId,
        signatureData: req.body.signatureData,
        purpose: req.body.purpose,
        ipAddress: ip,
        notes: req.body.notes,
      });

      await auditAndEmit(req, {
        action: 'create',
        tableName: 'digital_signatures',
        recordId: signature.id,
        newValues: {
          documentType: req.body.documentType,
          documentId: req.body.documentId,
          purpose: req.body.purpose,
        },
        entityEvent: 'created',
        entityName: 'signatures',
      });

      sendCreated(res, signature);
    } catch (err) {
      // Surface validation errors from the service as 400s
      if (err instanceof Error && (err.message.includes('Invalid') || err.message.includes('empty'))) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

export default router;
