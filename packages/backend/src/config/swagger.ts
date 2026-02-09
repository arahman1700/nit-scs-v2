// ---------------------------------------------------------------------------
// Swagger / OpenAPI Configuration
// ---------------------------------------------------------------------------
// Generates the OpenAPI 3.0.3 spec for the NIT Supply Chain System API.
// The spec is served as interactive docs at /api/docs and raw JSON at
// /api/docs.json.
// ---------------------------------------------------------------------------

import type { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'NIT Supply Chain System API',
    version: '1.0.0',
    description:
      'RESTful API for the NIT Supply Chain System (NIT-SCS) — a comprehensive ' +
      'material and logistics management platform. The system handles the full ' +
      'lifecycle of supply-chain operations including material receiving (MRRV), ' +
      'material issuance (MIRV), material returns (MRV), request for inspection ' +
      '(RFIM), over/short/damage reporting (OSD), inventory tracking, warehouse ' +
      'management, job orders, gate passes, stock transfers, material requisitions ' +
      '(MRF), shipments, workflow-driven approvals, barcode generation & lookup, ' +
      'bulk operations, Excel import/export, audit logging, dashboards, and reports. ' +
      'All endpoints (except auth) require a Bearer JWT token.',
    contact: {
      name: 'NIT x Idaratech',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 (default)',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication & session management' },
    {
      name: 'Master Data',
      description: 'Items, projects, suppliers, warehouses, employees and other reference entities',
    },
    { name: 'MRRV', description: 'Material Receiving Report Voucher — inbound material receipts' },
    { name: 'MIRV', description: 'Material Issue Report Voucher — outbound material issuance' },
    { name: 'MRV', description: 'Material Return Voucher — returning issued materials' },
    { name: 'RFIM', description: 'Request for Inspection of Materials' },
    { name: 'OSD', description: 'Over / Short / Damage reports' },
    { name: 'Job Orders', description: 'Job order creation and tracking' },
    { name: 'Gate Passes', description: 'Gate pass issuance and verification' },
    { name: 'Stock Transfers', description: 'Inter-warehouse stock transfers' },
    { name: 'MRF', description: 'Material Requisition Forms' },
    { name: 'Shipments', description: 'Shipment tracking and management' },
    { name: 'Inventory', description: 'Real-time inventory queries' },
    { name: 'Approvals', description: 'Workflow-driven approval actions' },
    { name: 'Comments', description: 'Document-level comments and discussions' },
    { name: 'Bulk Operations', description: 'Batch actions on multiple records' },
    { name: 'Import/Export', description: 'Excel import preview & execution' },
    { name: 'Delegations', description: 'Approval delegation rules' },
    { name: 'Notifications', description: 'User notification feed' },
    { name: 'Audit Log', description: 'Immutable audit trail' },
    { name: 'Dashboards', description: 'Dashboard summaries and analytics' },
    { name: 'Reports', description: 'Configurable report generation' },
    { name: 'Workflows', description: 'Workflow engine configuration' },
    { name: 'Email Templates', description: 'Transactional email template management' },
    { name: 'Barcodes', description: 'Barcode generation and lookup' },
    { name: 'Settings', description: 'System-wide and user settings' },
    { name: 'System', description: 'Health check and system status' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the JWT token obtained from POST /auth/login',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', description: 'Response payload' },
        },
        required: ['success', 'data'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
        },
        required: ['success', 'message', 'code'],
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { type: 'object' } },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              pageSize: { type: 'integer', example: 25 },
              total: { type: 'integer', example: 142 },
              totalPages: { type: 'integer', example: 6 },
            },
            required: ['page', 'pageSize', 'total', 'totalPages'],
          },
        },
        required: ['success', 'data', 'meta'],
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email & password',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@nit-scs.com' },
                  password: { type: 'string', example: 'P@ssw0rd' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful — returns access and refresh tokens',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token using a refresh token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refreshToken: { type: 'string' },
                },
                required: ['refreshToken'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'New access token issued',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '401': {
            description: 'Invalid or expired refresh token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user profile',
        responses: {
          '200': {
            description: 'User profile',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── MRRV ──────────────────────────────────────────────────────────────
    '/mrrv': {
      get: {
        tags: ['MRRV'],
        summary: 'List Material Receiving Report Vouchers',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Free-text search' },
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by status' },
        ],
        responses: {
          '200': {
            description: 'Paginated list of MRRVs',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
      post: {
        tags: ['MRRV'],
        summary: 'Create a new MRRV',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '201': {
            description: 'MRRV created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/mrrv/{id}': {
      get: {
        tags: ['MRRV'],
        summary: 'Get MRRV by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'MRRV details',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      put: {
        tags: ['MRRV'],
        summary: 'Update an existing MRRV',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': {
            description: 'MRRV updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/mrrv/{id}/actions/{action}': {
      post: {
        tags: ['MRRV'],
        summary: 'Execute a workflow action on an MRRV (submit, approve, reject, etc.)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'action',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['submit', 'approve', 'reject', 'revise', 'cancel'] },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  comment: { type: 'string', description: 'Optional comment for the action' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Action executed successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Action not allowed in current state',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── MIRV ──────────────────────────────────────────────────────────────
    '/mirv': {
      get: {
        tags: ['MIRV'],
        summary: 'List Material Issue Report Vouchers',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of MIRVs',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
      post: {
        tags: ['MIRV'],
        summary: 'Create a new MIRV',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '201': {
            description: 'MIRV created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/mirv/{id}': {
      get: {
        tags: ['MIRV'],
        summary: 'Get MIRV by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'MIRV details',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── Inventory ──────────────────────────────────────────────────────────
    '/inventory': {
      get: {
        tags: ['Inventory'],
        summary: 'Query current inventory levels',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'warehouseId', in: 'query', schema: { type: 'string' }, description: 'Filter by warehouse' },
          { name: 'itemId', in: 'query', schema: { type: 'string' }, description: 'Filter by item' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated inventory records',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── Items (Master Data) ───────────────────────────────────────────────
    '/items': {
      get: {
        tags: ['Master Data'],
        summary: 'List items / materials',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of items',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── Bulk Operations ───────────────────────────────────────────────────
    '/bulk/execute': {
      post: {
        tags: ['Bulk Operations'],
        summary: 'Execute a bulk action on multiple records',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  entityType: { type: 'string', example: 'mrrv' },
                  action: { type: 'string', example: 'submit' },
                  ids: { type: 'array', items: { type: 'string' } },
                },
                required: ['entityType', 'action', 'ids'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Bulk action result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── Import ────────────────────────────────────────────────────────────
    '/import/preview': {
      post: {
        tags: ['Import/Export'],
        summary: 'Preview an Excel import — validates data without persisting',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  entityType: { type: 'string' },
                },
                required: ['file', 'entityType'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Import preview with validation results',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Invalid file or data',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/import/execute': {
      post: {
        tags: ['Import/Export'],
        summary: 'Execute a previously previewed import',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  importId: { type: 'string', description: 'ID returned from /import/preview' },
                },
                required: ['importId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Import executed — returns summary of created/updated records',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Import failed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── Health Check ──────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check — DB, Redis, memory status',
        security: [],
        responses: {
          '200': {
            description: 'System healthy or degraded',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '503': {
            description: 'System unhealthy (database down)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── MRV ──────────────────────────────────────────────────────────────
    '/mrv': {
      get: {
        tags: ['MRV'],
        summary: 'List Material Return Vouchers',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of MRVs',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
      post: {
        tags: ['MRV'],
        summary: 'Create a new MRV',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': {
            description: 'MRV created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── RFIM ─────────────────────────────────────────────────────────────
    '/rfim': {
      get: {
        tags: ['RFIM'],
        summary: 'List Requests for Inspection',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── OSD ──────────────────────────────────────────────────────────────
    '/osd': {
      get: {
        tags: ['OSD'],
        summary: 'List Over/Short/Damage reports',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── Job Orders ───────────────────────────────────────────────────────
    '/job-orders': {
      get: {
        tags: ['Job Orders'],
        summary: 'List Job Orders',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          {
            name: 'joType',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by JO type (transport, equipment, etc.)',
          },
        ],
        responses: {
          '200': {
            description: 'Paginated list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
      post: {
        tags: ['Job Orders'],
        summary: 'Create a new Job Order',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': {
            description: 'Job Order created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/job-orders/{id}': {
      get: {
        tags: ['Job Orders'],
        summary: 'Get Job Order by ID (includes all subtype details)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Job Order details',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // ── Gate Passes ──────────────────────────────────────────────────────
    '/gate-passes': {
      get: {
        tags: ['Gate Passes'],
        summary: 'List Gate Passes',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── Stock Transfers ─────────────────────────────────────────────────
    '/stock-transfers': {
      get: {
        tags: ['Stock Transfers'],
        summary: 'List Stock Transfers',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── MRF ──────────────────────────────────────────────────────────────
    '/mrf': {
      get: {
        tags: ['MRF'],
        summary: 'List Material Requisition Forms',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── Shipments ────────────────────────────────────────────────────────
    '/shipments': {
      get: {
        tags: ['Shipments'],
        summary: 'List Shipments',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── Notifications ────────────────────────────────────────────────────
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get notifications for the current user',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'isRead', in: 'query', schema: { type: 'boolean' }, description: 'Filter by read status' },
        ],
        responses: {
          '200': {
            description: 'Paginated notifications',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark a notification as read',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Notification marked as read',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },

    // ── Audit Log ────────────────────────────────────────────────────────
    '/audit': {
      get: {
        tags: ['Audit Log'],
        summary: 'Query audit trail entries',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'tableName', in: 'query', schema: { type: 'string' }, description: 'Filter by entity type' },
          { name: 'recordId', in: 'query', schema: { type: 'string' }, description: 'Filter by record ID' },
        ],
        responses: {
          '200': {
            description: 'Paginated audit entries',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } },
          },
        },
      },
    },

    // ── Comments ─────────────────────────────────────────────────────────
    '/comments': {
      get: {
        tags: ['Comments'],
        summary: 'List comments for a document',
        parameters: [
          {
            name: 'documentType',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'e.g. mrrv, mirv, jo',
          },
          { name: 'documentId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'List of comments',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
      post: {
        tags: ['Comments'],
        summary: 'Add a comment to a document',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  documentType: { type: 'string', example: 'mrrv' },
                  documentId: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['documentType', 'documentId', 'content'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Comment created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },

    // ── Delegations ──────────────────────────────────────────────────────
    '/delegations': {
      get: {
        tags: ['Delegations'],
        summary: 'List delegation rules',
        responses: {
          '200': {
            description: 'Delegation rules',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
      post: {
        tags: ['Delegations'],
        summary: 'Create a delegation rule',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  delegateId: { type: 'string' },
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                  scope: { type: 'string', example: 'all' },
                },
                required: ['delegateId', 'startDate', 'endDate'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Delegation created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },

    // ── Dashboard ─────────────────────────────────────────────────────────
    '/dashboard/stats': {
      get: {
        tags: ['Dashboards'],
        summary: 'Overall KPIs (projects, items, pending approvals, low stock)',
        responses: {
          '200': {
            description: 'Dashboard statistics',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/dashboard/inventory-summary': {
      get: {
        tags: ['Dashboards'],
        summary: 'Inventory overview (total value, low stock, expiring items)',
        responses: {
          '200': {
            description: 'Inventory summary',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/dashboard/document-counts': {
      get: {
        tags: ['Dashboards'],
        summary: 'Document status breakdown (MRRV, MIRV, MRV, JO)',
        responses: {
          '200': {
            description: 'Document count breakdown',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/dashboard/sla-compliance': {
      get: {
        tags: ['Dashboards'],
        summary: 'SLA compliance percentages for MIRV and JO',
        responses: {
          '200': {
            description: 'SLA metrics',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/dashboard/recent-activity': {
      get: {
        tags: ['Dashboards'],
        summary: 'Recent audit log entries grouped by day',
        responses: {
          '200': {
            description: 'Recent activity',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/dashboard/top-projects': {
      get: {
        tags: ['Dashboards'],
        summary: 'Top 5 projects by active document count',
        responses: {
          '200': {
            description: 'Top projects',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },

    // ── Barcodes ──────────────────────────────────────────────────────────
    '/barcodes/lookup/{code}': {
      get: {
        tags: ['Barcodes'],
        summary: 'Look up an entity by its barcode value',
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Barcode value to look up',
          },
        ],
        responses: {
          '200': {
            description: 'Entity associated with the barcode',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '404': {
            description: 'Barcode not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerDefinition;
