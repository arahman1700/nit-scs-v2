import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackDocumentOperation,
  updateSocketClients,
  documentOperationsTotal,
  socketioConnectedClients,
} from './business-metrics.js';

describe('business-metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test to ensure clean state
    documentOperationsTotal.reset();
    socketioConnectedClients.reset();
  });

  describe('trackDocumentOperation', () => {
    it('increments nit_document_operations_total with correct labels', async () => {
      trackDocumentOperation('mrrv', 'create');

      const metrics = await documentOperationsTotal.get();
      const entry = metrics.values.find(v => v.labels.doc_type === 'grn' && v.labels.operation === 'create');
      expect(entry).toBeDefined();
      expect(entry!.value).toBe(1);
    });

    it('maps V1 entity type mirv to V2 name mi', async () => {
      trackDocumentOperation('mirv', 'approve');

      const metrics = await documentOperationsTotal.get();
      const entry = metrics.values.find(v => v.labels.doc_type === 'mi' && v.labels.operation === 'approve');
      expect(entry).toBeDefined();
      expect(entry!.value).toBe(1);
    });

    it('passes through unknown entity types unchanged', async () => {
      trackDocumentOperation('custom_doc', 'update');

      const metrics = await documentOperationsTotal.get();
      const entry = metrics.values.find(v => v.labels.doc_type === 'custom_doc' && v.labels.operation === 'update');
      expect(entry).toBeDefined();
      expect(entry!.value).toBe(1);
    });
  });

  describe('updateSocketClients', () => {
    it('sets the gauge to the specified count', async () => {
      updateSocketClients(5);

      const metrics = await socketioConnectedClients.get();
      expect(metrics.values[0].value).toBe(5);
    });

    it('sets gauge to 0 after disconnect', async () => {
      updateSocketClients(5);
      updateSocketClients(0);

      const metrics = await socketioConnectedClients.get();
      expect(metrics.values[0].value).toBe(0);
    });
  });
});
