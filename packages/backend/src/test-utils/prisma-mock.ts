/**
 * Reusable Prisma mock factory for service unit tests.
 *
 * Usage:
 *   vi.mock('../utils/prisma.js', () => ({ prisma: createPrismaMock() }));
 *
 * Each model delegate is a plain object whose methods are vi.fn() stubs.
 * The $transaction helper supports both callback-style and array-style.
 */

type MockFn = ReturnType<typeof vi.fn>;

export interface PrismaModelMock {
  findUnique: MockFn;
  findFirst: MockFn;
  findMany: MockFn;
  create: MockFn;
  createMany: MockFn;
  update: MockFn;
  updateMany: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
  groupBy: MockFn;
  upsert: MockFn;
  aggregate: MockFn;
}

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

export interface PrismaMock {
  // Models
  employee: PrismaModelMock;
  refreshToken: PrismaModelMock;
  passwordResetCode: PrismaModelMock;
  notification: PrismaModelMock;
  auditLog: PrismaModelMock;
  documentComment: PrismaModelMock;
  delegationRule: PrismaModelMock;
  inventoryLevel: PrismaModelMock;
  inventoryLot: PrismaModelMock;
  lotConsumption: PrismaModelMock;
  mrrv: PrismaModelMock;
  mrrvLine: PrismaModelMock;
  mirv: PrismaModelMock;
  mirvLine: PrismaModelMock;
  mrv: PrismaModelMock;
  mrvLine: PrismaModelMock;
  rfim: PrismaModelMock;
  osdReport: PrismaModelMock;
  osdLine: PrismaModelMock;
  jobOrder: PrismaModelMock;
  joTransportDetail: PrismaModelMock;
  joRentalDetail: PrismaModelMock;
  joGeneratorDetail: PrismaModelMock;
  joScrapDetail: PrismaModelMock;
  joEquipmentLine: PrismaModelMock;
  joSlaTracking: PrismaModelMock;
  joApproval: PrismaModelMock;
  joPayment: PrismaModelMock;
  materialRequisition: PrismaModelMock;
  mrfLine: PrismaModelMock;
  gatePass: PrismaModelMock;
  gatePassItem: PrismaModelMock;
  stockTransfer: PrismaModelMock;
  stockTransferLine: PrismaModelMock;
  shipment: PrismaModelMock;
  shipmentLine: PrismaModelMock;
  customsTracking: PrismaModelMock;
  emailTemplate: PrismaModelMock;
  emailLog: PrismaModelMock;
  approvalWorkflow: PrismaModelMock;
  approvalStep: PrismaModelMock;
  imsf: PrismaModelMock;
  imsfLine: PrismaModelMock;
  scrapItem: PrismaModelMock;
  sscBid: PrismaModelMock;
  surplusItem: PrismaModelMock;
  item: PrismaModelMock;
  warehouse: PrismaModelMock;
  project: PrismaModelMock;
  supplier: PrismaModelMock;
  rentalContract: PrismaModelMock;
  rentalContractLine: PrismaModelMock;
  generatorFuelLog: PrismaModelMock;
  generatorMaintenance: PrismaModelMock;
  generator: PrismaModelMock;
  tool: PrismaModelMock;
  toolIssue: PrismaModelMock;
  storekeeperHandover: PrismaModelMock;
  laborStandard: PrismaModelMock;
  navigationOverride: PrismaModelMock;
  dynamicDocumentType: PrismaModelMock;
  dynamicDocumentField: PrismaModelMock;
  dynamicDocument: PrismaModelMock;
  semanticMeasure: PrismaModelMock;
  semanticDimension: PrismaModelMock;
  customDataSource: PrismaModelMock;
  customFieldDefinition: PrismaModelMock;
  customFieldValue: PrismaModelMock;
  workflow: PrismaModelMock;
  workflowRule: PrismaModelMock;
  workflowExecutionLog: PrismaModelMock;
  surplusDeclaration: PrismaModelMock;

  // Prisma utilities
  $transaction: MockFn;
  $queryRaw: MockFn;
  $executeRaw: MockFn;
}

/**
 * Create a fresh Prisma mock.  Every model delegate gets fresh vi.fn() stubs.
 *
 * `$transaction` supports:
 *  - Callback style: `prisma.$transaction(async tx => { ... })`
 *    The callback receives the mock itself (so `tx.model.method` uses the same stubs).
 *  - Array style: `prisma.$transaction([op1, op2])` — resolves with the array.
 */
export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    employee: createModelMock(),
    refreshToken: createModelMock(),
    passwordResetCode: createModelMock(),
    notification: createModelMock(),
    auditLog: createModelMock(),
    documentComment: createModelMock(),
    delegationRule: createModelMock(),
    inventoryLevel: createModelMock(),
    inventoryLot: createModelMock(),
    lotConsumption: createModelMock(),
    mrrv: createModelMock(),
    mrrvLine: createModelMock(),
    mirv: createModelMock(),
    mirvLine: createModelMock(),
    mrv: createModelMock(),
    mrvLine: createModelMock(),
    rfim: createModelMock(),
    osdReport: createModelMock(),
    osdLine: createModelMock(),
    jobOrder: createModelMock(),
    joTransportDetail: createModelMock(),
    joRentalDetail: createModelMock(),
    joGeneratorDetail: createModelMock(),
    joScrapDetail: createModelMock(),
    joEquipmentLine: createModelMock(),
    joSlaTracking: createModelMock(),
    joApproval: createModelMock(),
    joPayment: createModelMock(),
    materialRequisition: createModelMock(),
    mrfLine: createModelMock(),
    gatePass: createModelMock(),
    gatePassItem: createModelMock(),
    stockTransfer: createModelMock(),
    stockTransferLine: createModelMock(),
    shipment: createModelMock(),
    shipmentLine: createModelMock(),
    customsTracking: createModelMock(),
    emailTemplate: createModelMock(),
    emailLog: createModelMock(),
    approvalWorkflow: createModelMock(),
    approvalStep: createModelMock(),
    imsf: createModelMock(),
    imsfLine: createModelMock(),
    scrapItem: createModelMock(),
    sscBid: createModelMock(),
    surplusItem: createModelMock(),
    item: createModelMock(),
    warehouse: createModelMock(),
    project: createModelMock(),
    supplier: createModelMock(),
    rentalContract: createModelMock(),
    rentalContractLine: createModelMock(),
    generatorFuelLog: createModelMock(),
    generatorMaintenance: createModelMock(),
    generator: createModelMock(),
    tool: createModelMock(),
    toolIssue: createModelMock(),
    storekeeperHandover: createModelMock(),
    laborStandard: createModelMock(),
    navigationOverride: createModelMock(),
    dynamicDocumentType: createModelMock(),
    dynamicDocumentField: createModelMock(),
    dynamicDocument: createModelMock(),
    semanticMeasure: createModelMock(),
    semanticDimension: createModelMock(),
    customDataSource: createModelMock(),
    customFieldDefinition: createModelMock(),
    customFieldValue: createModelMock(),
    workflow: createModelMock(),
    workflowRule: createModelMock(),
    workflowExecutionLog: createModelMock(),
    surplusDeclaration: createModelMock(),

    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };

  // Default $transaction: execute callback with mock as tx, or resolve array
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: PrismaMock) => Promise<unknown>)(mock);
    }
    // Array-style: resolve each promise
    return Promise.all(arg as Promise<unknown>[]);
  });

  return mock;
}
