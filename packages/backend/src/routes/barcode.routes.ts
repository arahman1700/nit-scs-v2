import { Router } from 'express';
import type { Request, Response } from 'express';
import bwipjs from 'bwip-js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();
router.use(authenticate);

// ── Generate Barcode Image ──────────────────────────────────────────────────
router.get('/generate', async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'code128';
    const data = req.query.data as string;
    const width = req.query.width ? Number(req.query.width) : undefined;
    const height = req.query.height ? Number(req.query.height) : 10;

    if (!data) {
      sendError(res, 400, 'Missing required query parameter: data');
      return;
    }

    const allowedTypes = ['code128', 'qrcode', 'ean13', 'datamatrix'];
    if (!allowedTypes.includes(type)) {
      sendError(res, 400, `Invalid barcode type. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    const png = await bwipjs.toBuffer({
      bcid: type,
      text: data,
      scale: 3,
      height,
      width,
      includetext: true,
      textxalign: 'center',
    });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Barcode generation failed';
    sendError(res, 500, message);
  }
});

// ── Print Labels (HTML) ─────────────────────────────────────────────────────
router.post('/print-labels', async (req: Request, res: Response) => {
  try {
    const { itemIds } = req.body as { itemIds: string[] };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      sendError(res, 400, 'itemIds must be a non-empty array');
      return;
    }

    if (itemIds.length > 100) {
      sendError(res, 400, 'Maximum 100 items per print batch');
      return;
    }

    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        itemCode: true,
        itemDescription: true,
        barcode: true,
      },
    });

    if (items.length === 0) {
      sendError(res, 404, 'No items found for the given IDs');
      return;
    }

    const labels = items.map(item => {
      const barcodeData = item.barcode || item.itemCode;
      const barcodeUrl = `/api/barcodes/generate?type=code128&data=${encodeURIComponent(barcodeData)}`;
      return `
        <div class="label">
          <img src="${barcodeUrl}" alt="barcode" />
          <div class="info">
            <strong>${item.itemDescription}</strong><br/>
            <span>Code: ${item.itemCode}</span><br/>
            <span>Barcode: ${barcodeData}</span>
          </div>
        </div>`;
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Barcode Labels</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .label { display: inline-block; width: 300px; border: 1px solid #ccc; padding: 12px; margin: 8px; text-align: center; page-break-inside: avoid; }
    .label img { max-width: 280px; height: auto; }
    .info { margin-top: 8px; font-size: 12px; line-height: 1.4; }
    @media print {
      body { padding: 0; }
      .label { border: 1px solid #000; }
    }
  </style>
</head>
<body>${labels.join('\n')}</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Label generation failed';
    sendError(res, 500, message);
  }
});

// ── Lookup Item by Barcode ──────────────────────────────────────────────────
router.get('/lookup/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;

    const item = await prisma.item.findFirst({
      where: {
        OR: [{ barcode: code }, { itemCode: code }],
      },
      include: {
        uom: true,
        inventoryLevels: {
          include: { warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } } },
        },
      },
    });

    if (!item) {
      sendError(res, 404, `No item found for code: ${code}`);
      return;
    }

    sendSuccess(res, item);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup failed';
    sendError(res, 500, message);
  }
});

export default router;
