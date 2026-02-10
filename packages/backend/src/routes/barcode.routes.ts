import { Router } from 'express';
import type { Request, Response } from 'express';
import bwipjs from 'bwip-js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { formatGS1Barcode, generateBinLocationQR, generateItemLabel } from '../services/barcode.service.js';

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

// ── Generate GS1-128 Barcode Image ──────────────────────────────────────────
router.get('/generate/gs1', async (req: Request, res: Response) => {
  try {
    const itemCode = req.query.itemCode as string;
    if (!itemCode) {
      sendError(res, 400, 'Missing required query parameter: itemCode');
      return;
    }

    const lot = typeof req.query.lot === 'string' ? req.query.lot : undefined;
    const expiryStr = typeof req.query.expiry === 'string' ? req.query.expiry : undefined;
    const qtyStr = typeof req.query.qty === 'string' ? req.query.qty : undefined;

    const gs1Data = formatGS1Barcode({
      itemCode,
      lot,
      expiry: expiryStr ? new Date(expiryStr) : undefined,
      qty: qtyStr ? Number(qtyStr) : undefined,
    });

    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: gs1Data,
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: 'center',
    });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GS1 barcode generation failed';
    sendError(res, 500, message);
  }
});

// ── Generate QR Code for a Bin Location ─────────────────────────────────────
router.get('/generate/bin-qr/:binCardId', async (req: Request, res: Response) => {
  try {
    const binCardId = req.params.binCardId as string;
    const binCard = await prisma.binCard.findUnique({
      where: { id: binCardId },
      include: {
        warehouse: { select: { warehouseCode: true } },
      },
    });

    if (!binCard) {
      sendError(res, 404, 'Bin card not found');
      return;
    }

    // Extract zone code from binNumber (format: zone-aisle-shelf, e.g. A-03-12)
    const zonePart = binCard.binNumber.split('-')[0] || binCard.binNumber;

    const qrData = generateBinLocationQR({
      warehouseId: binCard.warehouse.warehouseCode,
      zoneCode: zonePart,
      binCode: binCard.binNumber,
    });

    const png = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: qrData,
      scale: 3,
      height: 30,
      width: 30,
    });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bin QR generation failed';
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

// ── Print Labels for GRN Items ──────────────────────────────────────────────
router.post('/print-labels/grn/:grnId', async (req: Request, res: Response) => {
  try {
    const grnId = req.params.grnId as string;
    const grn = await prisma.mrrv.findUnique({
      where: { id: grnId },
      include: {
        mrrvLines: {
          include: {
            item: { select: { id: true, itemCode: true, itemDescription: true, barcode: true } },
            uom: { select: { uomCode: true } },
          },
        },
        supplier: { select: { supplierName: true } },
      },
    });

    if (!grn) {
      sendError(res, 404, 'GRN not found');
      return;
    }

    const labels = grn.mrrvLines.map(line => {
      const labelData = generateItemLabel({
        itemCode: line.item.itemCode,
        itemDescription: line.item.itemDescription,
        barcode: line.item.barcode ?? undefined,
        uom: line.uom.uomCode,
      });
      const barcodeUrl = `/api/barcodes/generate?type=${labelData.barcodeType}&data=${encodeURIComponent(labelData.barcodeValue)}`;
      return `
        <div class="label">
          <img src="${barcodeUrl}" alt="barcode" />
          <div class="info">
            ${labelData.lines.map(l => `<div>${l}</div>`).join('\n')}
            <div>GRN: ${grn.mrrvNumber}</div>
            <div>Supplier: ${grn.supplier.supplierName}</div>
            <div>Qty: ${line.qtyReceived}</div>
          </div>
        </div>`;
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GRN Labels — ${grn.mrrvNumber}</title>
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
    const message = err instanceof Error ? err.message : 'GRN label generation failed';
    sendError(res, 500, message);
  }
});

// ── Print QR Labels for Bin Locations ───────────────────────────────────────
router.post('/print-labels/bins', async (req: Request, res: Response) => {
  try {
    const { binCardIds, warehouseId, zoneId } = req.body as {
      binCardIds?: string[];
      warehouseId?: string;
      zoneId?: string;
    };

    let binCards;

    if (Array.isArray(binCardIds) && binCardIds.length > 0) {
      if (binCardIds.length > 200) {
        sendError(res, 400, 'Maximum 200 bin cards per print batch');
        return;
      }
      binCards = await prisma.binCard.findMany({
        where: { id: { in: binCardIds } },
        include: {
          warehouse: { select: { warehouseCode: true, warehouseName: true } },
          item: { select: { itemCode: true, itemDescription: true } },
        },
      });
    } else if (warehouseId) {
      const where: Record<string, unknown> = { warehouseId };
      // If zoneId provided, filter by zone code prefix in binNumber
      if (zoneId) {
        const zone = await prisma.warehouseZone.findUnique({ where: { id: zoneId } });
        if (zone) {
          where.binNumber = { startsWith: zone.zoneCode };
        }
      }
      binCards = await prisma.binCard.findMany({
        where,
        include: {
          warehouse: { select: { warehouseCode: true, warehouseName: true } },
          item: { select: { itemCode: true, itemDescription: true } },
        },
        take: 200,
      });
    } else {
      sendError(res, 400, 'Provide binCardIds array or warehouseId');
      return;
    }

    if (!binCards || binCards.length === 0) {
      sendError(res, 404, 'No bin cards found');
      return;
    }

    const labels = binCards.map(bc => {
      const zonePart = bc.binNumber.split('-')[0] || bc.binNumber;
      const qrData = generateBinLocationQR({
        warehouseId: bc.warehouse.warehouseCode,
        zoneCode: zonePart,
        binCode: bc.binNumber,
      });
      const qrUrl = `/api/barcodes/generate?type=qrcode&data=${encodeURIComponent(qrData)}`;
      return `
        <div class="label">
          <img src="${qrUrl}" alt="qr" />
          <div class="info">
            <strong>${bc.binNumber}</strong><br/>
            <div>${bc.warehouse.warehouseName}</div>
            <div>${bc.item.itemCode} — ${bc.item.itemDescription}</div>
          </div>
        </div>`;
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Bin Location QR Labels</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .label { display: inline-block; width: 250px; border: 1px solid #ccc; padding: 12px; margin: 8px; text-align: center; page-break-inside: avoid; }
    .label img { max-width: 200px; height: auto; }
    .info { margin-top: 8px; font-size: 11px; line-height: 1.4; }
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
    const message = err instanceof Error ? err.message : 'Bin label generation failed';
    sendError(res, 500, message);
  }
});

// ── Lookup Bin by Scanned QR Code ───────────────────────────────────────────
// NOTE: Must be registered BEFORE /lookup/:code to avoid `:code` matching "bin"
router.get('/lookup/bin/:code', async (req: Request, res: Response) => {
  try {
    const raw = req.params.code as string;
    let binNumber: string;
    let warehouseCode: string | undefined;

    // Try to parse as JSON QR payload
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (parsed.type === 'bin' && parsed.bin) {
        binNumber = parsed.bin;
        warehouseCode = parsed.wh;
      } else {
        binNumber = raw;
      }
    } catch {
      // Not JSON — treat as raw bin number
      binNumber = raw;
    }

    const where: Record<string, unknown> = { binNumber };
    if (warehouseCode) {
      where.warehouse = { warehouseCode };
    }

    const binCard = await prisma.binCard.findFirst({
      where,
      include: {
        item: {
          select: { id: true, itemCode: true, itemDescription: true, barcode: true },
        },
        warehouse: {
          select: { id: true, warehouseCode: true, warehouseName: true },
        },
        transactions: {
          take: 10,
          orderBy: { performedAt: 'desc' },
        },
      },
    });

    if (!binCard) {
      sendError(res, 404, `No bin card found for code: ${binNumber}`);
      return;
    }

    sendSuccess(res, binCard);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bin lookup failed';
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
