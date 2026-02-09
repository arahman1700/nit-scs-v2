import type { Response } from 'express';
import { sendSuccess, sendError, sendCreated, sendNoContent } from './response.js';

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response;
  return res;
};

describe('response utilities', () => {
  describe('sendSuccess', () => {
    it('calls res.json with success: true and data', () => {
      const res = mockRes();
      const data = { id: 1, name: 'Test' };

      sendSuccess(res, data);

      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it('includes meta with totalPages calculated when meta is provided', () => {
      const res = mockRes();
      const data = [{ id: 1 }, { id: 2 }];
      const meta = { page: 2, pageSize: 10, total: 25 };

      sendSuccess(res, data, meta);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        meta: {
          page: 2,
          pageSize: 10,
          total: 25,
          totalPages: 3, // Math.ceil(25/10)
        },
      });
    });

    it('calculates totalPages correctly for exact division', () => {
      const res = mockRes();
      sendSuccess(res, [], { page: 1, pageSize: 10, total: 30 });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ totalPages: 3 }),
        }),
      );
    });

    it('does not include meta when not provided', () => {
      const res = mockRes();
      sendSuccess(res, 'hello');

      const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).not.toHaveProperty('meta');
    });
  });

  describe('sendError', () => {
    it('calls res.status(code).json with success: false and message', () => {
      const res = mockRes();

      sendError(res, 400, 'Bad request');

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bad request',
      });
    });

    it('includes errors array when provided', () => {
      const res = mockRes();
      const errors = [{ field: 'email', message: 'Invalid' }];

      sendError(res, 422, 'Validation failed', errors);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors,
      });
    });

    it('does not include errors key when errors is undefined', () => {
      const res = mockRes();

      sendError(res, 500, 'Server error');

      const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).not.toHaveProperty('errors');
    });
  });

  describe('sendCreated', () => {
    it('calls res.status(201).json with success: true and data', () => {
      const res = mockRes();
      const data = { id: 'new-1', name: 'Created item' };

      sendCreated(res, data);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });
  });

  describe('sendNoContent', () => {
    it('calls res.status(204).send()', () => {
      const res = mockRes();

      sendNoContent(res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledOnce();
    });
  });
});
