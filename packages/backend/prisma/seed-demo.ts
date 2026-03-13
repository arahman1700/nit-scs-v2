import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function pad(n: number, len = 3): string {
  return String(n).padStart(len, '0');
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function seedDemo() {
  console.log('\n── seedDemo: loading demo data ──────────────────────────');

  // ── Lookup existing seed data ─────────────────────────────────────────────
  const admin       = await prisma.employee.findFirst({ where: { email: 'admin@nit.sa' } });
  const ahmed       = await prisma.employee.findFirst({ where: { email: 'ahmed@nit.sa' } });
  const khalid      = await prisma.employee.findFirst({ where: { email: 'khalid@nit.sa' } });
  const saad        = await prisma.employee.findFirst({ where: { email: 'saad@nit.sa' } });
  const abdulrahman = await prisma.employee.findFirst({ where: { email: 'abdulrahman@nit.sa' } });
  const mohammed    = await prisma.employee.findFirst({ where: { email: 'mohammed@nit.sa' } });
  const fahad       = await prisma.employee.findFirst({ where: { email: 'fahad@nit.sa' } });

  if (!admin || !ahmed || !khalid) {
    console.warn('  [seedDemo] Core employees not found — run main seed first.');
    return;
  }

  const mainWh = await prisma.warehouse.findFirst({ where: { warehouseCode: 'WH-MAIN' } });
  if (!mainWh) {
    console.warn('  [seedDemo] WH-MAIN not found — run main seed first.');
    return;
  }

  const prj1 = await prisma.project.findFirst({ where: { projectCode: 'PRJ-001' } });
  const prj2 = await prisma.project.findFirst({ where: { projectCode: 'PRJ-002' } });
  const prj3 = await prisma.project.findFirst({ where: { projectCode: 'PRJ-003' } });

  const uomMap: Record<string, string> = {};
  const allUoms = await prisma.unitOfMeasure.findMany();
  for (const u of allUoms) uomMap[u.uomCode] = u.id;

  const itemMap: Record<string, string> = {};
  const allItems = await prisma.item.findMany();
  for (const i of allItems) itemMap[i.itemCode] = i.id;

  const riyadhRegion = await prisma.region.findFirst({ where: { regionName: 'Riyadh' } });
  const makkahRegion = await prisma.region.findFirst({ where: { regionName: 'Makkah' } });
  const easternRegion = await prisma.region.findFirst({ where: { regionName: 'Eastern Province' } });
  const tabukRegion   = await prisma.region.findFirst({ where: { regionName: 'Tabuk' } });

  // ── Additional Projects ───────────────────────────────────────────────────
  const additionalProjects = [
    { projectCode: 'PRJ-004', projectName: 'مشروع مترو الرياض - المرحلة الثانية', client: 'هيئة تطوير الرياض', status: 'active' as const, regionCode: 'Riyadh' },
    { projectCode: 'PRJ-005', projectName: 'مشروع نيوم - البنية التحتية', client: 'NEOM', status: 'active' as const, regionCode: 'Tabuk' },
    { projectCode: 'PRJ-006', projectName: 'Jubail Industrial Expansion', client: 'Royal Commission Jubail', status: 'active' as const, regionCode: 'Eastern Province' },
    { projectCode: 'PRJ-007', projectName: 'King Salman Park Utilities', client: 'Royal Commission Riyadh', status: 'active' as const, regionCode: 'Riyadh' },
    { projectCode: 'PRJ-008', projectName: 'مشروع تطوير ميناء جدة', client: 'موانئ', status: 'active' as const, regionCode: 'Makkah' },
    { projectCode: 'PRJ-009', projectName: 'Dammam Ring Road Phase 3', client: 'Ministry of Transport', status: 'active' as const, regionCode: 'Eastern Province' },
    { projectCode: 'PRJ-010', projectName: 'Abha Smart City Infrastructure', client: 'Asir Development Authority', status: 'on_hold' as const, regionCode: 'Riyadh' },
  ];

  const projectMap: Record<string, string> = {};
  if (prj1) projectMap['PRJ-001'] = prj1.id;
  if (prj2) projectMap['PRJ-002'] = prj2.id;
  if (prj3) projectMap['PRJ-003'] = prj3.id;

  for (const p of additionalProjects) {
    const regionRecord =
      p.regionCode === 'Riyadh' ? riyadhRegion :
      p.regionCode === 'Makkah' ? makkahRegion :
      p.regionCode === 'Eastern Province' ? easternRegion :
      p.regionCode === 'Tabuk' ? tabukRegion : riyadhRegion;

    const created = await prisma.project
      .upsert({
        where: { projectCode: p.projectCode },
        update: {},
        create: {
          projectCode: p.projectCode,
          projectName: p.projectName,
          client: p.client,
          status: p.status,
          projectManagerId: admin.id,
          regionId: regionRecord?.id,
        },
      });
    projectMap[p.projectCode] = created.id;
  }
  console.log(`  Projects: ${additionalProjects.length} additional`);

  // ── Additional Warehouses ─────────────────────────────────────────────────
  const siteWhType = await prisma.warehouseType.findFirst({ where: { typeName: 'Site Warehouse' } });
  const openYardType = await prisma.warehouseType.findFirst({ where: { typeName: 'Open Yard' } });

  const additionalWarehouses = [
    { code: 'WH-NEOM-01',  name: 'NEOM Site Warehouse A', typeKey: 'site',     regionKey: 'Tabuk',            projectCode: 'PRJ-005' },
    { code: 'WH-RUH-02',   name: 'Riyadh Metro Depot Store', typeKey: 'site',  regionKey: 'Riyadh',           projectCode: 'PRJ-004' },
    { code: 'WH-JUB-01',   name: 'Jubail Industrial Store',  typeKey: 'site',  regionKey: 'Eastern Province', projectCode: 'PRJ-006' },
    { code: 'WH-JED-02',   name: 'Jeddah Port Yard',         typeKey: 'yard',  regionKey: 'Makkah',           projectCode: 'PRJ-008' },
  ];

  const warehouseMap: Record<string, string> = { 'WH-MAIN': mainWh.id };

  for (const wh of additionalWarehouses) {
    const whType = wh.typeKey === 'yard' ? openYardType : siteWhType;
    const regionRecord =
      wh.regionKey === 'Riyadh' ? riyadhRegion :
      wh.regionKey === 'Makkah' ? makkahRegion :
      wh.regionKey === 'Eastern Province' ? easternRegion :
      tabukRegion;

    if (!whType || !regionRecord) continue;
    const created = await prisma.warehouse
      .upsert({
        where: { warehouseCode: wh.code },
        update: {},
        create: {
          warehouseCode: wh.code,
          warehouseName: wh.name,
          warehouseTypeId: whType.id,
          regionId: regionRecord.id,
          status: 'active',
          projectId: projectMap[wh.projectCode] ?? null,
        },
      });
    warehouseMap[wh.code] = created.id;
  }
  console.log(`  Warehouses: ${additionalWarehouses.length} additional`);

  // ── Additional Suppliers ──────────────────────────────────────────────────
  const additionalSuppliers = [
    { supplierCode: 'SUP-004', supplierName: 'Arabian Pipes Company', types: ['mechanical', 'materials'], contactPerson: 'Suleiman Al-Harbi', phone: '+966511112222', email: 'suleiman@arabianpipes.sa', crNumber: 'CR-2024-001', vatNumber: 'VAT-2024-001', rating: 4, paymentTerms: 'Net 30' },
    { supplierCode: 'SUP-005', supplierName: 'National Cement Company', types: ['materials', 'construction'], contactPerson: 'Ibrahim Al-Dosari', phone: '+966522223333', email: 'ibrahim@ncc.sa', crNumber: 'CR-2024-002', vatNumber: 'VAT-2024-002', rating: 5, paymentTerms: 'Net 45' },
    { supplierCode: 'SUP-006', supplierName: 'الشركة السعودية للحديد والصلب', types: ['materials', 'construction'], contactPerson: 'عبدالعزيز الشمري', phone: '+966533334444', email: 'aziz@saudisteel.sa', crNumber: 'CR-2024-003', vatNumber: 'VAT-2024-003', rating: 4, paymentTerms: 'Net 30' },
    { supplierCode: 'SUP-007', supplierName: 'Saudi Electric Supply Co', types: ['electrical'], contactPerson: 'Waleed Mansour', phone: '+966544445555', email: 'waleed@sesco.sa', crNumber: 'CR-2024-004', vatNumber: 'VAT-2024-004', rating: 3, paymentTerms: 'Net 60' },
    { supplierCode: 'SUP-008', supplierName: 'Al-Zamil Industrial', types: ['mechanical', 'spare_parts'], contactPerson: 'Turki Al-Zamil', phone: '+966555556666', email: 'turki@zamil.sa', crNumber: 'CR-2024-005', vatNumber: 'VAT-2024-005', rating: 4, paymentTerms: 'Net 30' },
    { supplierCode: 'SUP-009', supplierName: 'Jotun Saudi Arabia', types: ['materials', 'consumables'], contactPerson: 'Ahmad Petersen', phone: '+966566667777', email: 'ahmad@jotun.sa', crNumber: 'CR-2024-006', vatNumber: 'VAT-2024-006', rating: 5, paymentTerms: 'Net 30' },
    { supplierCode: 'SUP-010', supplierName: 'شركة الفنار للمقاولات', types: ['construction', 'safety'], contactPerson: 'محمد الفنار', phone: '+966577778888', email: 'mfanar@alfannar.sa', crNumber: 'CR-2024-007', vatNumber: 'VAT-2024-007', rating: 4, paymentTerms: 'Net 45' },
    { supplierCode: 'SUP-011', supplierName: 'Halliburton Saudi Arabia', types: ['spare_parts', 'tools'], contactPerson: 'John Mitchell', phone: '+966588889999', email: 'jmitchell@halliburton.sa', crNumber: 'CR-2024-008', vatNumber: 'VAT-2024-008', rating: 3, paymentTerms: 'Net 60' },
  ];

  const supplierMap: Record<string, string> = {};
  const existingSuppliers = await prisma.supplier.findMany({ where: { supplierCode: { in: ['SUP-001', 'SUP-002', 'SUP-003'] } } });
  for (const s of existingSuppliers) supplierMap[s.supplierCode] = s.id;

  for (const s of additionalSuppliers) {
    const { crNumber, vatNumber, rating, paymentTerms, ...rest } = s;
    const created = await prisma.supplier
      .upsert({
        where: { supplierCode: s.supplierCode },
        update: {},
        create: { ...rest, crNumber, vatNumber, rating, paymentTerms, status: 'active' },
      });
    supplierMap[s.supplierCode] = created.id;
  }
  console.log(`  Suppliers: ${additionalSuppliers.length} additional`);

  // ── Additional Items ──────────────────────────────────────────────────────
  const additionalItems = [
    // Construction Materials
    { itemCode: 'STL-003', itemDescription: 'Steel Rebar 16mm Grade 60', category: 'construction', uomCode: 'KG',   minStock: 1000, standardCost: 3.8,  subCategory: 'Structural Steel' },
    { itemCode: 'STL-004', itemDescription: 'Hollow Section 100x100x5mm', category: 'construction', uomCode: 'M',    minStock: 500,  standardCost: 45.0, subCategory: 'Structural Steel' },
    { itemCode: 'CON-002', itemDescription: 'Cement White 50kg Bag',       category: 'construction', uomCode: 'BAG',  minStock: 200,  standardCost: 28.0, subCategory: 'Cement' },
    { itemCode: 'CON-003', itemDescription: 'Ready Mix Concrete C30',       category: 'construction', uomCode: 'M3',   minStock: 50,   standardCost: 320.0, subCategory: 'Concrete' },
    { itemCode: 'CON-004', itemDescription: 'Sand (Washed) Fine',            category: 'construction', uomCode: 'TON',  minStock: 100,  standardCost: 65.0, subCategory: 'Aggregates' },
    { itemCode: 'CON-005', itemDescription: 'Gravel 20mm Crushed Stone',     category: 'construction', uomCode: 'TON',  minStock: 100,  standardCost: 55.0, subCategory: 'Aggregates' },
    // Pipes & Fittings
    { itemCode: 'MEC-002', itemDescription: 'GI Pipe 2" Schedule 40',        category: 'mechanical',   uomCode: 'M',    minStock: 200,  standardCost: 38.0, subCategory: 'GI Pipes' },
    { itemCode: 'MEC-003', itemDescription: 'HDPE Pipe 110mm PN16',          category: 'mechanical',   uomCode: 'M',    minStock: 300,  standardCost: 52.0, subCategory: 'HDPE Pipes' },
    { itemCode: 'MEC-004', itemDescription: 'GI Elbow 90° 2"',               category: 'mechanical',   uomCode: 'EA',   minStock: 150,  standardCost: 18.5, subCategory: 'Fittings' },
    { itemCode: 'MEC-005', itemDescription: 'Gate Valve 2" Flanged',         category: 'mechanical',   uomCode: 'EA',   minStock: 50,   standardCost: 145.0, subCategory: 'Valves' },
    // Electrical
    { itemCode: 'ELC-003', itemDescription: 'Armoured Cable 4x10mm',         category: 'electrical',   uomCode: 'M',    minStock: 500,  standardCost: 42.0, subCategory: 'MV Cables' },
    { itemCode: 'ELC-004', itemDescription: 'Distribution Board 8-Way',      category: 'electrical',   uomCode: 'EA',   minStock: 20,   standardCost: 380.0, subCategory: 'Switchgear' },
    { itemCode: 'ELC-005', itemDescription: 'LED Floodlight 200W IP65',       category: 'electrical',   uomCode: 'EA',   minStock: 30,   standardCost: 220.0, subCategory: 'Lighting' },
    { itemCode: 'ELC-006', itemDescription: 'Conduit PVC 20mm (3m)',          category: 'electrical',   uomCode: 'EA',   minStock: 400,  standardCost: 8.5,  subCategory: 'Conduit' },
    // Safety Equipment
    { itemCode: 'SAF-003', itemDescription: 'Safety Harness Full Body',       category: 'safety',       uomCode: 'EA',   minStock: 50,   standardCost: 185.0, subCategory: 'Fall Protection' },
    { itemCode: 'SAF-004', itemDescription: 'Safety Boots Steel Toe Size 43', category: 'safety',       uomCode: 'EA',   minStock: 100,  standardCost: 95.0, subCategory: 'PPE Footwear' },
    { itemCode: 'SAF-005', itemDescription: 'Fire Extinguisher CO2 5kg',      category: 'safety',       uomCode: 'EA',   minStock: 40,   standardCost: 310.0, subCategory: 'Fire Safety' },
    { itemCode: 'SAF-006', itemDescription: 'First Aid Kit Large',            category: 'safety',       uomCode: 'EA',   minStock: 20,   standardCost: 145.0, subCategory: 'Medical' },
    // Tools & Spare Parts
    { itemCode: 'TOL-002', itemDescription: 'Angle Grinder 115mm 850W',       category: 'tools',        uomCode: 'EA',   minStock: 10,   standardCost: 320.0, subCategory: 'Power Tools' },
    { itemCode: 'SPR-002', itemDescription: 'Hydraulic Hose 1/2" x 1m',       category: 'spare_parts',  uomCode: 'EA',   minStock: 30,   standardCost: 78.0,  subCategory: 'Hydraulics' },
  ];

  for (const item of additionalItems) {
    const uomId = uomMap[item.uomCode];
    if (!uomId) { console.warn(`  Skipping item ${item.itemCode}: no UOM`); continue; }
    const { uomCode, subCategory, ...rest } = item;
    const created = await prisma.item
      .upsert({
        where: { itemCode: item.itemCode },
        update: {},
        create: { ...rest, uomId, subCategory, status: 'active' },
      });
    itemMap[item.itemCode] = created.id;
  }
  console.log(`  Items: ${additionalItems.length} additional`);

  // Refresh full item map after inserts
  const allItemsNow = await prisma.item.findMany();
  for (const i of allItemsNow) itemMap[i.itemCode] = i.id;

  // ── GRNs (Mrrv) ───────────────────────────────────────────────────────────
  const grnDefs = [
    {
      mrrvNumber: 'MRRV-2026-001', supplierId: supplierMap['SUP-005'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-002'],
      receiveDate: daysAgo(82), status: 'stored', rfimRequired: false,
      poNumber: 'PO-2025-0101', invoiceNumber: 'INV-NCC-8821', deliveryNote: 'DN-0921',
      totalValue: 145600, notes: 'Cement delivery for Riyadh Metro Phase 2',
      lines: [
        { itemCode: 'CON-001', qtyOrdered: 5000, qtyReceived: 5000, unitCost: 22,   condition: 'good' },
        { itemCode: 'CON-002', qtyOrdered: 1200, qtyReceived: 1200, unitCost: 28,   condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-002', supplierId: supplierMap['SUP-006'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-001'],
      receiveDate: daysAgo(75), status: 'stored', rfimRequired: false,
      poNumber: 'PO-2025-0112', invoiceNumber: 'INV-SS-3341', deliveryNote: 'DN-1045',
      totalValue: 312400,
      lines: [
        { itemCode: 'STL-001', qtyOrdered: 50000, qtyReceived: 50000, unitCost: 3.5,  condition: 'good' },
        { itemCode: 'STL-003', qtyOrdered: 30000, qtyReceived: 29850, unitCost: 3.8,  condition: 'mixed', qtyDamaged: 150 },
        { itemCode: 'STL-004', qtyOrdered: 800,   qtyReceived: 800,   unitCost: 45.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-003', supplierId: supplierMap['SUP-004'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-003'],
      receiveDate: daysAgo(68), status: 'qc_approved', rfimRequired: true,
      poNumber: 'PO-2025-0158', invoiceNumber: 'INV-APC-5501', deliveryNote: 'DN-1122',
      totalValue: 58600,
      lines: [
        { itemCode: 'MEC-002', qtyOrdered: 500, qtyReceived: 500, unitCost: 38.0, condition: 'good' },
        { itemCode: 'MEC-003', qtyOrdered: 300, qtyReceived: 300, unitCost: 52.0, condition: 'good' },
        { itemCode: 'MEC-004', qtyOrdered: 400, qtyReceived: 395, unitCost: 18.5, condition: 'mixed', qtyDamaged: 5 },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-004', supplierId: supplierMap['SUP-002'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-004'] ?? projectMap['PRJ-002'],
      receiveDate: daysAgo(60), status: 'received', rfimRequired: false,
      poNumber: 'PO-2025-0177', invoiceNumber: 'INV-SC-7712', deliveryNote: 'DN-1209',
      totalValue: 78500,
      lines: [
        { itemCode: 'ELC-001', qtyOrdered: 2000, qtyReceived: 2000, unitCost: 8.5,  condition: 'good' },
        { itemCode: 'ELC-003', qtyOrdered: 800,  qtyReceived: 800,  unitCost: 42.0, condition: 'good' },
        { itemCode: 'ELC-006', qtyOrdered: 1000, qtyReceived: 1000, unitCost: 8.5,  condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-005', supplierId: supplierMap['SUP-007'] ?? supplierMap['SUP-002'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-007'] ?? projectMap['PRJ-001'],
      receiveDate: daysAgo(55), status: 'pending_qc', rfimRequired: true,
      poNumber: 'PO-2025-0199', invoiceNumber: 'INV-SESCO-0012', deliveryNote: 'DN-1311',
      totalValue: 42100,
      lines: [
        { itemCode: 'ELC-002', qtyOrdered: 200, qtyReceived: 200, unitCost: 45.0,  condition: 'good' },
        { itemCode: 'ELC-004', qtyOrdered: 40,  qtyReceived: 40,  unitCost: 380.0, condition: 'good' },
        { itemCode: 'ELC-005', qtyOrdered: 50,  qtyReceived: 50,  unitCost: 220.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-006', supplierId: supplierMap['SUP-003'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-001'],
      receiveDate: daysAgo(48), status: 'stored', rfimRequired: false,
      poNumber: 'PO-2025-0211', invoiceNumber: 'INV-GS-4401', deliveryNote: 'DN-1398',
      totalValue: 53200,
      lines: [
        { itemCode: 'SAF-001', qtyOrdered: 500, qtyReceived: 500, unitCost: 25.0,  condition: 'good' },
        { itemCode: 'SAF-002', qtyOrdered: 500, qtyReceived: 500, unitCost: 18.0,  condition: 'good' },
        { itemCode: 'SAF-003', qtyOrdered: 100, qtyReceived: 100, unitCost: 185.0, condition: 'good' },
        { itemCode: 'SAF-004', qtyOrdered: 200, qtyReceived: 200, unitCost: 95.0,  condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-007', supplierId: supplierMap['SUP-009'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-JED-02'] ?? warehouseMap['WH-MAIN'],
      projectId: projectMap['PRJ-008'] ?? projectMap['PRJ-003'],
      receiveDate: daysAgo(40), status: 'stored', rfimRequired: false,
      poNumber: 'PO-2025-0244', invoiceNumber: 'INV-JOT-2201', deliveryNote: 'DN-1455',
      totalValue: 18600,
      lines: [
        { itemCode: 'CON-004', qtyOrdered: 200, qtyReceived: 200, unitCost: 65.0, condition: 'good' },
        { itemCode: 'CON-005', qtyOrdered: 100, qtyReceived: 100, unitCost: 55.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-008', supplierId: supplierMap['SUP-008'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-006'] ?? projectMap['PRJ-001'],
      receiveDate: daysAgo(35), status: 'pending_qc', rfimRequired: true, hasOsd: false,
      poNumber: 'PO-2026-0001', invoiceNumber: 'INV-ZAM-0088', deliveryNote: 'DN-1532',
      totalValue: 32450,
      lines: [
        { itemCode: 'MEC-005', qtyOrdered: 80, qtyReceived: 78, unitCost: 145.0, condition: 'mixed', qtyDamaged: 2 },
        { itemCode: 'SPR-001', qtyOrdered: 60, qtyReceived: 60, unitCost: 35.0,  condition: 'good' },
        { itemCode: 'SPR-002', qtyOrdered: 50, qtyReceived: 50, unitCost: 78.0,  condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-009', supplierId: supplierMap['SUP-006'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-NEOM-01'] ?? warehouseMap['WH-MAIN'],
      projectId: projectMap['PRJ-005'] ?? projectMap['PRJ-001'],
      receiveDate: daysAgo(28), status: 'received', rfimRequired: false,
      poNumber: 'PO-2026-0018', invoiceNumber: 'INV-SS-0331', deliveryNote: 'DN-1601',
      totalValue: 225000,
      lines: [
        { itemCode: 'STL-001', qtyOrdered: 40000, qtyReceived: 40000, unitCost: 3.5,  condition: 'good' },
        { itemCode: 'STL-002', qtyOrdered: 15000, qtyReceived: 15000, unitCost: 4.2,  condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-010', supplierId: supplierMap['SUP-005'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-RUH-02'] ?? warehouseMap['WH-MAIN'],
      projectId: projectMap['PRJ-004'] ?? projectMap['PRJ-002'],
      receiveDate: daysAgo(22), status: 'draft', rfimRequired: false,
      poNumber: 'PO-2026-0029', invoiceNumber: 'INV-NCC-0112',
      totalValue: 88000,
      lines: [
        { itemCode: 'CON-001', qtyOrdered: 3000, qtyReceived: 3000, unitCost: 22.0, condition: 'good' },
        { itemCode: 'CON-003', qtyOrdered: 80,   qtyReceived: 80,   unitCost: 320.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-011', supplierId: supplierMap['SUP-010'] ?? supplierMap['SUP-003'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-007'] ?? projectMap['PRJ-001'],
      receiveDate: daysAgo(18), status: 'pending_qc', rfimRequired: false,
      poNumber: 'PO-2026-0041', invoiceNumber: 'INV-FAN-0055',
      totalValue: 15800,
      lines: [
        { itemCode: 'SAF-005', qtyOrdered: 30, qtyReceived: 30, unitCost: 310.0, condition: 'good' },
        { itemCode: 'SAF-006', qtyOrdered: 20, qtyReceived: 20, unitCost: 145.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-012', supplierId: supplierMap['SUP-004'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-JUB-01'] ?? warehouseMap['WH-MAIN'],
      projectId: projectMap['PRJ-006'] ?? projectMap['PRJ-001'],
      receiveDate: daysAgo(14), status: 'stored', rfimRequired: false,
      poNumber: 'PO-2026-0055', invoiceNumber: 'INV-APC-0221',
      totalValue: 67200,
      lines: [
        { itemCode: 'MEC-002', qtyOrdered: 800,  qtyReceived: 800,  unitCost: 38.0, condition: 'good' },
        { itemCode: 'MEC-003', qtyOrdered: 400,  qtyReceived: 400,  unitCost: 52.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-013', supplierId: supplierMap['SUP-011'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-MAIN'], projectId: projectMap['PRJ-001'],
      receiveDate: daysAgo(10), status: 'pending_qc', rfimRequired: true,
      poNumber: 'PO-2026-0071', invoiceNumber: 'INV-HAL-0019',
      totalValue: 21450,
      lines: [
        { itemCode: 'TOL-001', qtyOrdered: 30, qtyReceived: 30, unitCost: 85.0,  condition: 'good' },
        { itemCode: 'TOL-002', qtyOrdered: 20, qtyReceived: 20, unitCost: 320.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-014', supplierId: supplierMap['SUP-002'] ?? supplierMap['SUP-001'],
      warehouseId: warehouseMap['WH-NEOM-01'] ?? warehouseMap['WH-MAIN'],
      projectId: projectMap['PRJ-005'] ?? projectMap['PRJ-001'],
      receiveDate: daysAgo(7), status: 'draft', rfimRequired: false,
      poNumber: 'PO-2026-0088', invoiceNumber: 'INV-SC-0441',
      totalValue: 55000,
      lines: [
        { itemCode: 'ELC-001', qtyOrdered: 3000, qtyReceived: 3000, unitCost: 8.5, condition: 'good' },
        { itemCode: 'ELC-003', qtyOrdered: 500,  qtyReceived: 500,  unitCost: 42.0, condition: 'good' },
      ],
    },
    {
      mrrvNumber: 'MRRV-2026-015', supplierId: supplierMap['SUP-007'] ?? supplierMap['SUP-002'],
      warehouseId: warehouseMap['WH-RUH-02'] ?? warehouseMap['WH-MAIN'],
      projectId: projectMap['PRJ-004'] ?? projectMap['PRJ-002'],
      receiveDate: daysAgo(3), status: 'draft', rfimRequired: false,
      poNumber: 'PO-2026-0095',
      totalValue: 19000,
      lines: [
        { itemCode: 'ELC-004', qtyOrdered: 20, qtyReceived: 20, unitCost: 380.0, condition: 'good' },
        { itemCode: 'ELC-005', qtyOrdered: 30, qtyReceived: 30, unitCost: 220.0, condition: 'good' },
      ],
    },
  ];

  const mrrvMap: Record<string, string> = {};

  for (const grn of grnDefs) {
    const { lines, ...header } = grn;
    const created = await prisma.mrrv
      .upsert({
        where: { mrrvNumber: header.mrrvNumber },
        update: {},
        create: {
          mrrvNumber: header.mrrvNumber,
          supplierId: header.supplierId,
          warehouseId: header.warehouseId,
          projectId: header.projectId ?? null,
          receivedById: ahmed.id,
          receiveDate: header.receiveDate,
          poNumber: (header as any).poNumber ?? null,
          invoiceNumber: (header as any).invoiceNumber ?? null,
          deliveryNote: (header as any).deliveryNote ?? null,
          totalValue: header.totalValue,
          rfimRequired: header.rfimRequired ?? false,
          hasOsd: (header as any).hasOsd ?? false,
          status: header.status,
          qcInspectorId: header.status !== 'draft' ? saad?.id : null,
          notes: (header as any).notes ?? null,
        },
      });
    mrrvMap[header.mrrvNumber] = created.id;

    // Create lines
    for (const line of lines) {
      const itemId = itemMap[line.itemCode];
      if (!itemId) continue;
      const uomId = allItemsNow.find(i => i.id === itemId)?.uomId;
      if (!uomId) continue;
      await prisma.mrrvLine.create({
        data: {
          mrrvId: created.id,
          itemId,
          uomId,
          qtyOrdered: line.qtyOrdered ?? null,
          qtyReceived: line.qtyReceived,
          qtyDamaged: (line as any).qtyDamaged ?? 0,
          unitCost: line.unitCost,
          condition: line.condition as any,
        },
      }).catch(() => null);
    }
  }
  console.log(`  GRNs (Mrrv): ${grnDefs.length}`);

  // ── MIs (Mirv) ────────────────────────────────────────────────────────────
  const miDefs = [
    {
      mirvNumber: 'MIRV-2026-001', projectCode: 'PRJ-002', status: 'issued',
      requestDate: daysAgo(70), issuedDate: daysAgo(68), priority: 'normal',
      estimatedValue: 42000, locationOfWork: 'Station 7 - Tunneling Zone B',
      lines: [
        { itemCode: 'STL-001', qtyRequested: 8000, qtyApproved: 8000, qtyIssued: 8000, unitCost: 3.5 },
        { itemCode: 'STL-003', qtyRequested: 5000, qtyApproved: 5000, qtyIssued: 5000, unitCost: 3.8 },
      ],
    },
    {
      mirvNumber: 'MIRV-2026-002', projectCode: 'PRJ-001', status: 'approved',
      requestDate: daysAgo(62), priority: 'urgent',
      estimatedValue: 65000, locationOfWork: 'NEOM - Site C, Grid 14-18',
      lines: [
        { itemCode: 'ELC-001', qtyRequested: 3000, qtyApproved: 3000, qtyIssued: null, unitCost: 8.5 },
        { itemCode: 'ELC-003', qtyRequested: 500,  qtyApproved: 500,  qtyIssued: null, unitCost: 42.0 },
        { itemCode: 'ELC-004', qtyRequested: 40,   qtyApproved: 40,   qtyIssued: null, unitCost: 380.0 },
      ],
    },
    {
      mirvNumber: 'MIRV-2026-003', projectCode: 'PRJ-003', status: 'partially_issued',
      requestDate: daysAgo(55), issuedDate: daysAgo(52), priority: 'normal',
      estimatedValue: 28500, locationOfWork: 'Jeddah Tower - Floor 22-28',
      lines: [
        { itemCode: 'MEC-002', qtyRequested: 200, qtyApproved: 200, qtyIssued: 150, unitCost: 38.0 },
        { itemCode: 'MEC-004', qtyRequested: 100, qtyApproved: 100, qtyIssued: 80,  unitCost: 18.5 },
        { itemCode: 'MEC-005', qtyRequested: 20,  qtyApproved: 20,  qtyIssued: 20,  unitCost: 145.0 },
      ],
    },
    {
      mirvNumber: 'MIRV-2026-004', projectCode: 'PRJ-004', status: 'pending_approval',
      requestDate: daysAgo(45), priority: 'high',
      estimatedValue: 18250, locationOfWork: 'Metro Line 2 - Depot Expansion',
      lines: [
        { itemCode: 'SAF-001', qtyRequested: 200, qtyApproved: null, qtyIssued: null, unitCost: 25.0 },
        { itemCode: 'SAF-002', qtyRequested: 200, qtyApproved: null, qtyIssued: null, unitCost: 18.0 },
        { itemCode: 'SAF-003', qtyRequested: 50,  qtyApproved: null, qtyIssued: null, unitCost: 185.0 },
      ],
    },
    {
      mirvNumber: 'MIRV-2026-005', projectCode: 'PRJ-005', status: 'issued',
      requestDate: daysAgo(38), issuedDate: daysAgo(36), priority: 'urgent',
      estimatedValue: 112000, locationOfWork: 'NEOM Linear City - Section 4',
      lines: [
        { itemCode: 'STL-001', qtyRequested: 20000, qtyApproved: 20000, qtyIssued: 20000, unitCost: 3.5 },
        { itemCode: 'CON-001', qtyOrdered: 2000,    qtyApproved: 2000,  qtyIssued: 2000,  unitCost: 22.0 },
      ],
    },
    {
      mirvNumber: 'MIRV-2026-006', projectCode: 'PRJ-006', status: 'draft',
      requestDate: daysAgo(20), priority: 'normal',
      estimatedValue: 29000, locationOfWork: 'Jubail Expansion - Piping Corridor',
      lines: [
        { itemCode: 'MEC-003', qtyRequested: 300, qtyApproved: null, qtyIssued: null, unitCost: 52.0 },
        { itemCode: 'MEC-002', qtyRequested: 200, qtyApproved: null, qtyIssued: null, unitCost: 38.0 },
      ],
    },
    {
      mirvNumber: 'MIRV-2026-007', projectCode: 'PRJ-007', status: 'approved',
      requestDate: daysAgo(15), priority: 'high',
      estimatedValue: 38600, locationOfWork: 'King Salman Park - Main Electrical Duct',
      lines: [
        { itemCode: 'ELC-005', qtyRequested: 80,   qtyApproved: 80,   qtyIssued: null, unitCost: 220.0 },
        { itemCode: 'ELC-006', qtyRequested: 500,  qtyApproved: 500,  qtyIssued: null, unitCost: 8.5 },
        { itemCode: 'ELC-002', qtyRequested: 100,  qtyApproved: 100,  qtyIssued: null, unitCost: 45.0 },
      ],
    },
    {
      mirvNumber: 'MIRV-2026-008', projectCode: 'PRJ-001', status: 'rejected',
      requestDate: daysAgo(30), priority: 'normal',
      estimatedValue: 5200, locationOfWork: 'NEOM Storage Unit 3',
      rejectionReason: 'Budget not approved for this quarter — defer to Q2',
      lines: [
        { itemCode: 'TOL-002', qtyRequested: 10, qtyApproved: null, qtyIssued: null, unitCost: 320.0 },
        { itemCode: 'SPR-001', qtyRequested: 20, qtyApproved: null, qtyIssued: null, unitCost: 35.0 },
      ],
    },
  ];

  const mirvMap: Record<string, string> = {};

  for (const mi of miDefs) {
    const { lines, projectCode, rejectionReason, ...header } = mi;
    const projectId = projectMap[projectCode] ?? prj1!.id;
    const created = await prisma.mirv
      .upsert({
        where: { mirvNumber: header.mirvNumber },
        update: {},
        create: {
          mirvNumber: header.mirvNumber,
          projectId,
          warehouseId: warehouseMap['WH-MAIN'],
          requestedById: khalid.id,
          requestDate: header.requestDate,
          status: header.status,
          priority: header.priority as any,
          estimatedValue: header.estimatedValue,
          locationOfWork: header.locationOfWork,
          approvedById: ['approved', 'issued', 'partially_issued'].includes(header.status) ? abdulrahman?.id ?? null : null,
          approvedDate:  ['approved', 'issued', 'partially_issued'].includes(header.status) ? new Date(header.requestDate.getTime() + 2 * 86400000) : null,
          issuedById:    ['issued', 'partially_issued'].includes(header.status) ? ahmed.id : null,
          issuedDate:    (header as any).issuedDate ?? null,
          rejectionReason: rejectionReason ?? null,
        },
      });
    mirvMap[header.mirvNumber] = created.id;

    for (const line of lines) {
      const itemId = itemMap[line.itemCode];
      if (!itemId) continue;
      await prisma.mirvLine.create({
        data: {
          mirvId: created.id,
          itemId,
          qtyRequested: line.qtyRequested,
          qtyApproved: line.qtyApproved ?? null,
          qtyIssued: line.qtyIssued ?? null,
          unitCost: line.unitCost,
        },
      }).catch(() => null);
    }
  }
  console.log(`  MIs (Mirv): ${miDefs.length}`);

  // ── MRNs (Mrv) ────────────────────────────────────────────────────────────
  const mrvDefs = [
    {
      mrvNumber: 'MRV-2026-001', projectCode: 'PRJ-002', returnType: 'return_to_warehouse',
      returnDate: daysAgo(58), status: 'completed', reason: 'Excess materials after completion of Zone A works',
      lines: [
        { itemCode: 'STL-001', qtyReturned: 500, condition: 'good' },
        { itemCode: 'CON-001', qtyReturned: 200, condition: 'good' },
      ],
    },
    {
      mrvNumber: 'MRV-2026-002', projectCode: 'PRJ-003', returnType: 'return_to_warehouse',
      returnDate: daysAgo(42), status: 'received', reason: 'Wrong specification ordered — returning to stock',
      lines: [
        { itemCode: 'MEC-002', qtyReturned: 50, condition: 'good' },
        { itemCode: 'MEC-004', qtyReturned: 20, condition: 'good' },
      ],
    },
    {
      mrvNumber: 'MRV-2026-003', projectCode: 'PRJ-001', returnType: 'return_to_supplier',
      returnDate: daysAgo(33), status: 'completed', reason: 'Defective batch — supplier agreed to accept return',
      lines: [
        { itemCode: 'STL-003', qtyReturned: 150, condition: 'damaged' },
      ],
    },
    {
      mrvNumber: 'MRV-2026-004', projectCode: 'PRJ-005', returnType: 'return_to_warehouse',
      returnDate: daysAgo(21), status: 'pending', reason: 'Project phase 1 complete — returning unused electrical materials',
      lines: [
        { itemCode: 'ELC-001', qtyReturned: 300, condition: 'good' },
        { itemCode: 'ELC-006', qtyReturned: 100, condition: 'used' },
      ],
    },
    {
      mrvNumber: 'MRV-2026-005', projectCode: 'PRJ-004', returnType: 'return_to_warehouse',
      returnDate: daysAgo(9), status: 'draft', reason: 'Safety equipment rotation — returning expired items',
      lines: [
        { itemCode: 'SAF-001', qtyReturned: 50, condition: 'used' },
        { itemCode: 'SAF-002', qtyReturned: 50, condition: 'used' },
      ],
    },
  ];

  for (const mrv of mrvDefs) {
    const { lines, projectCode, ...header } = mrv;
    const projectId = projectMap[projectCode] ?? prj1!.id;
    const created = await prisma.mrv
      .upsert({
        where: { mrvNumber: header.mrvNumber },
        update: {},
        create: {
          mrvNumber: header.mrvNumber,
          returnType: header.returnType as any,
          projectId,
          toWarehouseId: warehouseMap['WH-MAIN'],
          returnedById: khalid.id,
          returnDate: header.returnDate,
          status: header.status as any,
          reason: header.reason,
          receivedById: ['received', 'completed'].includes(header.status) ? ahmed.id : null,
          receivedDate: ['received', 'completed'].includes(header.status)
            ? new Date(header.returnDate.getTime() + 86400000) : null,
        },
      });

    for (const line of lines) {
      const itemId = itemMap[line.itemCode];
      if (!itemId) continue;
      const uomId = allItemsNow.find(i => i.id === itemId)?.uomId;
      if (!uomId) continue;
      await prisma.mrvLine.create({
        data: {
          mrvId: created.id,
          itemId,
          uomId,
          qtyReturned: line.qtyReturned,
          condition: line.condition as any,
        },
      }).catch(() => null);
    }
  }
  console.log(`  MRNs (Mrv): ${mrvDefs.length}`);

  // ── QCI (Rfim) ────────────────────────────────────────────────────────────
  const rfimDefs = [
    {
      rfimNumber: 'RFIM-2026-001', mrrvKey: 'MRRV-2026-003',
      inspectionType: 'Dimensional', priority: 'Normal',
      requestDate: daysAgo(66), inspectionDate: daysAgo(64),
      status: 'completed', result: 'pass',
      itemsDescription: 'GI Pipes and fittings — dimensional & wall thickness check',
      comments: 'All pipes meet API 5L specifications. Wall thickness within tolerance.',
    },
    {
      rfimNumber: 'RFIM-2026-002', mrrvKey: 'MRRV-2026-005',
      inspectionType: 'Functional', priority: 'Urgent',
      requestDate: daysAgo(53), inspectionDate: daysAgo(51),
      status: 'completed', result: 'conditional',
      itemsDescription: 'Circuit breakers and distribution boards functional test',
      comments: 'DB units passed. 5 circuit breakers failed trip test — quarantined for return.',
      pmApprovalRequired: true,
    },
    {
      rfimNumber: 'RFIM-2026-003', mrrvKey: 'MRRV-2026-008',
      inspectionType: 'Visual', priority: 'Normal',
      requestDate: daysAgo(33), inspectionDate: null,
      status: 'in_progress', result: null,
      itemsDescription: 'Gate valves and hydraulic components visual inspection',
      comments: null,
    },
    {
      rfimNumber: 'RFIM-2026-004', mrrvKey: 'MRRV-2026-013',
      inspectionType: 'Functional', priority: 'Normal',
      requestDate: daysAgo(9),
      status: 'pending', result: null,
      itemsDescription: 'Hand tools and power tools inspection before issue',
      comments: null,
    },
    {
      rfimNumber: 'RFIM-2026-005', mrrvKey: 'MRRV-2026-011',
      inspectionType: 'Visual', priority: 'Normal',
      requestDate: daysAgo(17), inspectionDate: daysAgo(15),
      status: 'completed', result: 'pass',
      itemsDescription: 'Fire extinguishers and first aid kits — labelling and seal check',
      comments: 'All 30 extinguishers sealed and in date. First aid kits complete.',
    },
  ];

  for (const rfim of rfimDefs) {
    const { mrrvKey, ...rest } = rfim;
    const mrrvId = mrrvMap[mrrvKey];
    if (!mrrvId) continue;
    await prisma.rfim
      .upsert({
        where: { rfimNumber: rfim.rfimNumber },
        update: {},
        create: {
          rfimNumber: rfim.rfimNumber,
          mrrvId,
          inspectorId: saad?.id ?? null,
          requestDate: rfim.requestDate,
          inspectionDate: (rfim as any).inspectionDate ?? null,
          inspectionType: rfim.inspectionType as any,
          priority: rfim.priority as any,
          itemsDescription: rfim.itemsDescription,
          result: rfim.result as any,
          comments: rfim.comments ?? null,
          status: rfim.status as any,
          pmApprovalRequired: (rfim as any).pmApprovalRequired ?? false,
          pmApprovalById: (rfim as any).pmApprovalRequired ? abdulrahman?.id ?? null : null,
          pmApprovalDate: (rfim as any).pmApprovalRequired && rfim.status === 'completed'
            ? new Date(rfim.requestDate.getTime() + 3 * 86400000) : null,
        },
      });
  }
  console.log(`  QCIs (Rfim): ${rfimDefs.length}`);

  // ── DR (OsdReport) ────────────────────────────────────────────────────────
  const osdDefs = [
    {
      osdNumber: 'OSD-2026-001', mrrvKey: 'MRRV-2026-002',
      reportDate: daysAgo(74), reportTypes: ['damage'],
      status: 'resolved', totalDamageValue: 570,
      resolutionType: 'credit_note', resolutionAmount: 570,
      claimSentDate: daysAgo(72), responseDate: daysAgo(65),
      lines: [{ itemCode: 'STL-003', qtyInvoice: 30000, qtyReceived: 29850, qtyDamaged: 150, unitCost: 3.8, damageType: 'physical' }],
    },
    {
      osdNumber: 'OSD-2026-002', mrrvKey: 'MRRV-2026-003',
      reportDate: daysAgo(67), reportTypes: ['damage'],
      status: 'claim_sent', totalDamageValue: 92.5,
      claimSentDate: daysAgo(65),
      lines: [{ itemCode: 'MEC-004', qtyInvoice: 400, qtyReceived: 395, qtyDamaged: 5, unitCost: 18.5, damageType: 'physical' }],
    },
    {
      osdNumber: 'OSD-2026-003', mrrvKey: 'MRRV-2026-008',
      reportDate: daysAgo(34), reportTypes: ['damage', 'short'],
      status: 'under_review', totalDamageValue: 290, totalShortValue: 0,
      lines: [{ itemCode: 'MEC-005', qtyInvoice: 80, qtyReceived: 78, qtyDamaged: 2, unitCost: 145.0, damageType: 'physical' }],
    },
  ];

  for (const osd of osdDefs) {
    const { mrrvKey, lines, ...header } = osd;
    const mrrvId = mrrvMap[mrrvKey];
    if (!mrrvId) continue;
    const mrrvRecord = grnDefs.find(g => g.mrrvNumber === mrrvKey);

    const created = await prisma.osdReport
      .upsert({
        where: { osdNumber: osd.osdNumber },
        update: {},
        create: {
          osdNumber: osd.osdNumber,
          mrrvId,
          supplierId: mrrvRecord ? (supplierMap[(mrrvRecord as any).supplierCode ?? ''] ?? null) : null,
          warehouseId: warehouseMap['WH-MAIN'],
          reportDate: header.reportDate,
          reportTypes: header.reportTypes,
          status: header.status as any,
          totalDamageValue: header.totalDamageValue ?? 0,
          totalShortValue: (header as any).totalShortValue ?? 0,
          claimSentDate: (header as any).claimSentDate ?? null,
          responseDate: (header as any).responseDate ?? null,
          resolutionType: (header as any).resolutionType ?? null,
          resolutionAmount: (header as any).resolutionAmount ?? null,
          resolutionDate: header.status === 'resolved' ? daysAgo(60) : null,
          resolvedById: header.status === 'resolved' ? abdulrahman?.id ?? null : null,
        },
      });

    for (const line of lines) {
      const itemId = itemMap[line.itemCode];
      if (!itemId) continue;
      const uomId = allItemsNow.find(i => i.id === itemId)?.uomId;
      if (!uomId) continue;
      await prisma.osdLine.create({
        data: {
          osdId: created.id,
          itemId,
          uomId,
          qtyInvoice: line.qtyInvoice,
          qtyReceived: line.qtyReceived,
          qtyDamaged: line.qtyDamaged ?? 0,
          damageType: line.damageType as any,
          unitCost: line.unitCost,
        },
      }).catch(() => null);
    }
  }
  console.log(`  DRs (OsdReport): ${osdDefs.length}`);

  // ── Job Orders ────────────────────────────────────────────────────────────
  const equipType = await prisma.equipmentType.findFirst({ where: { typeName: 'Crane' } });
  const forkType  = await prisma.equipmentType.findFirst({ where: { typeName: 'Forklift' } });
  const truckType = await prisma.equipmentType.findFirst({ where: { typeName: 'Flatbed Truck' } });
  const genType   = await prisma.equipmentType.findFirst({ where: { typeName: 'Diesel Generator' } });
  const excType   = await prisma.equipmentType.findFirst({ where: { typeName: 'Excavator' } });

  const joDefs = [
    {
      joNumber: 'JO-2026-001', joType: 'transport', projectCode: 'PRJ-002', status: 'completed',
      priority: 'normal', requestDate: daysAgo(78), completionDate: daysAgo(76),
      totalAmount: 8500, description: 'Transport of structural steel from WH-MAIN to Riyadh Metro Station 7',
      supplierId: supplierMap['SUP-010'] ?? null,
      transport: { pickupLocation: 'NIT Main Warehouse, Riyadh', deliveryLocation: 'Riyadh Metro Station 7, King Fahad Rd', cargoType: 'Steel Rebar', cargoWeightTons: 30, numberOfTrailers: 2, numberOfTrips: 1 },
    },
    {
      joNumber: 'JO-2026-002', joType: 'rental_monthly', projectCode: 'PRJ-001', status: 'in_progress',
      priority: 'high', requestDate: daysAgo(65), totalAmount: 45000,
      description: 'Monthly crane rental for NEOM site - 50-ton lattice boom crane',
      supplierId: supplierMap['SUP-010'] ?? null,
      rental: { rentalStartDate: daysAgo(55), rentalEndDate: daysAgo(-25), monthlyRate: 45000, withOperator: true },
    },
    {
      joNumber: 'JO-2026-003', joType: 'generator_maintenance', projectCode: 'PRJ-005', status: 'completed',
      priority: 'urgent', requestDate: daysAgo(60), completionDate: daysAgo(58),
      totalAmount: 3200, description: 'Emergency generator maintenance - 500 KVA unit at NEOM site',
      generator: { capacityKva: 500, maintenanceType: 'corrective', issueDescription: 'Coolant leak detected during shift change' },
    },
    {
      joNumber: 'JO-2026-004', joType: 'rental_daily', projectCode: 'PRJ-006', status: 'approved',
      priority: 'normal', requestDate: daysAgo(50), totalAmount: 12600,
      description: 'Daily forklift rental for Jubail warehouse unloading operations',
      supplierId: supplierMap['SUP-008'] ?? null,
      rental: { rentalStartDate: daysAgo(45), rentalEndDate: daysAgo(-5), dailyRate: 420, withOperator: true },
    },
    {
      joNumber: 'JO-2026-005', joType: 'transport', projectCode: 'PRJ-004', status: 'in_progress',
      priority: 'normal', requestDate: daysAgo(44), totalAmount: 6800,
      description: 'Transport of precast concrete elements to metro depot',
      supplierId: supplierMap['SUP-010'] ?? null,
      transport: { pickupLocation: 'Precast Factory, Industrial City Riyadh', deliveryLocation: 'Metro Depot, Sharafiyah', cargoType: 'Precast Concrete', cargoWeightTons: 45, numberOfTrailers: 3, numberOfTrips: 2 },
    },
    {
      joNumber: 'JO-2026-006', joType: 'scrap', projectCode: 'PRJ-002', status: 'completed',
      priority: 'low', requestDate: daysAgo(41), completionDate: daysAgo(38),
      totalAmount: 1800, description: 'Scrap steel disposal from Metro Station 7 formwork dismantling',
      scrap: { scrapType: 'Ferrous Scrap', scrapWeightTons: 4.5, scrapDescription: 'Used formwork steel, cut rebar ends', scrapDestination: 'Al-Baha Recycling Facility, Riyadh' },
    },
    {
      joNumber: 'JO-2026-007', joType: 'generator_rental', projectCode: 'PRJ-008', status: 'pending_approval',
      priority: 'high', requestDate: daysAgo(30), totalAmount: 22000,
      description: 'Generator rental for Jeddah Port project — 3 units 350 KVA for temporary power',
      supplierId: supplierMap['SUP-008'] ?? null,
      generator: { capacityKva: 350, maintenanceType: null, issueDescription: null },
    },
    {
      joNumber: 'JO-2026-008', joType: 'rental_monthly', projectCode: 'PRJ-007', status: 'quoted',
      priority: 'normal', requestDate: daysAgo(25), totalAmount: 38000,
      description: 'Excavator rental for King Salman Park utility trenching',
      supplierId: supplierMap['SUP-010'] ?? null,
      rental: { rentalStartDate: daysAgo(-5), rentalEndDate: daysAgo(-35), monthlyRate: 38000, withOperator: true },
    },
    {
      joNumber: 'JO-2026-009', joType: 'transport', projectCode: 'PRJ-005', status: 'assigned',
      priority: 'urgent', requestDate: daysAgo(18), totalAmount: 15200,
      description: 'Emergency transport — power cables for NEOM infrastructure urgent delivery',
      supplierId: supplierMap['SUP-010'] ?? null,
      driverName: 'سعد القحطاني', vehiclePlate: 'أ ب ت 1234', vehicleBrand: 'Mercedes Actros',
      transport: { pickupLocation: 'Saudi Cables Factory, Jeddah', deliveryLocation: 'NEOM Linear City Depot, Tabuk', cargoType: 'MV Cable Drums', cargoWeightTons: 18, numberOfTrailers: 1, numberOfTrips: 1 },
    },
    {
      joNumber: 'JO-2026-010', joType: 'generator_maintenance', projectCode: 'PRJ-001', status: 'in_progress',
      priority: 'normal', requestDate: daysAgo(12), totalAmount: 4500,
      description: 'Scheduled 500-hour preventive maintenance for three generators at NEOM site',
      generator: { capacityKva: 500, maintenanceType: 'preventive', issueDescription: '500-hour service interval reached' },
    },
    {
      joNumber: 'JO-2026-011', joType: 'rental_daily', projectCode: 'PRJ-009', status: 'draft',
      priority: 'normal', requestDate: daysAgo(8), totalAmount: 9800,
      description: 'Water tanker daily rental for dust suppression on Dammam Ring Road works',
      rental: { rentalStartDate: daysAgo(-2), rentalEndDate: daysAgo(-16), dailyRate: 700, withOperator: true },
    },
  ];

  for (const jo of joDefs) {
    const { transport, rental, generator: genDetail, scrap, projectCode, ...header } = jo as any;
    const projectId = projectMap[projectCode] ?? prj1!.id;

    const created = await prisma.jobOrder
      .upsert({
        where: { joNumber: header.joNumber },
        update: {},
        create: {
          joNumber: header.joNumber,
          joType: header.joType,
          projectId,
          supplierId: header.supplierId ?? null,
          requestedById: mohammed?.id ?? admin.id,
          requestDate: header.requestDate,
          status: header.status,
          priority: header.priority,
          description: header.description,
          totalAmount: header.totalAmount,
          completionDate: header.completionDate ?? null,
          completedById: header.completionDate ? fahad?.id ?? null : null,
          driverName: header.driverName ?? null,
          vehiclePlate: header.vehiclePlate ?? null,
          vehicleBrand: header.vehicleBrand ?? null,
        },
      });

    if (transport) {
      await prisma.joTransportDetail.upsert({
        where: { jobOrderId: created.id },
        update: {},
        create: { jobOrderId: created.id, ...transport },
      }).catch(() => null);
    }
    if (rental) {
      await prisma.joRentalDetail.upsert({
        where: { jobOrderId: created.id },
        update: {},
        create: { jobOrderId: created.id, ...rental },
      }).catch(() => null);
    }
    if (genDetail) {
      await prisma.joGeneratorDetail.upsert({
        where: { jobOrderId: created.id },
        update: {},
        create: { jobOrderId: created.id, ...genDetail },
      }).catch(() => null);
    }
    if (scrap) {
      await prisma.joScrapDetail.upsert({
        where: { jobOrderId: created.id },
        update: {},
        create: { jobOrderId: created.id, ...scrap },
      }).catch(() => null);
    }

    // Equipment lines for rental types
    if (header.joType === 'rental_monthly' || header.joType === 'rental_daily') {
      const eType =
        header.joType === 'rental_monthly' && header.joNumber === 'JO-2026-002' ? equipType :
        header.joType === 'rental_daily'   && header.joNumber === 'JO-2026-004' ? forkType :
        header.joType === 'rental_monthly' && header.joNumber === 'JO-2026-008' ? excType : null;
      if (eType) {
        await prisma.joEquipmentLine.create({
          data: { jobOrderId: created.id, equipmentTypeId: eType.id, quantity: 1, withOperator: true },
        }).catch(() => null);
      }
    }
  }
  console.log(`  Job Orders: ${joDefs.length}`);

  // ── Stock Transfers ───────────────────────────────────────────────────────
  const stDefs = [
    {
      transferNumber: 'ST-2026-001', transferType: 'warehouse_to_project',
      fromWarehouseCode: 'WH-MAIN', toWarehouseCode: 'WH-NEOM-01',
      fromProjectCode: null, toProjectCode: 'PRJ-005',
      transferDate: daysAgo(72), status: 'completed',
      notes: 'Initial stock transfer for NEOM site opening',
      lines: [
        { itemCode: 'SAF-001', quantity: 100, condition: 'good' },
        { itemCode: 'SAF-002', quantity: 100, condition: 'good' },
        { itemCode: 'SAF-003', quantity: 30,  condition: 'good' },
      ],
    },
    {
      transferNumber: 'ST-2026-002', transferType: 'warehouse_to_project',
      fromWarehouseCode: 'WH-MAIN', toWarehouseCode: 'WH-RUH-02',
      fromProjectCode: null, toProjectCode: 'PRJ-004',
      transferDate: daysAgo(58), status: 'completed',
      notes: 'Tools and consumables for Metro Depot Phase 2',
      lines: [
        { itemCode: 'TOL-001', quantity: 10,  condition: 'good' },
        { itemCode: 'CON-001', quantity: 500, condition: 'good' },
      ],
    },
    {
      transferNumber: 'ST-2026-003', transferType: 'project_to_project',
      fromWarehouseCode: 'WH-MAIN', toWarehouseCode: 'WH-JUB-01',
      fromProjectCode: 'PRJ-001', toProjectCode: 'PRJ-006',
      transferDate: daysAgo(45), status: 'received',
      notes: 'Surplus pipes from NEOM redirected to Jubail expansion',
      lines: [
        { itemCode: 'MEC-002', quantity: 100, condition: 'good' },
        { itemCode: 'MEC-003', quantity: 80,  condition: 'good' },
      ],
    },
    {
      transferNumber: 'ST-2026-004', transferType: 'warehouse_to_project',
      fromWarehouseCode: 'WH-MAIN', toWarehouseCode: 'WH-JED-02',
      fromProjectCode: null, toProjectCode: 'PRJ-008',
      transferDate: daysAgo(30), status: 'shipped',
      notes: 'Electrical materials for Jeddah Port site store',
      lines: [
        { itemCode: 'ELC-001', quantity: 500, condition: 'good' },
        { itemCode: 'ELC-005', quantity: 20,  condition: 'good' },
      ],
    },
    {
      transferNumber: 'ST-2026-005', transferType: 'warehouse_to_project',
      fromWarehouseCode: 'WH-MAIN', toWarehouseCode: 'WH-MAIN',
      fromProjectCode: null, toProjectCode: 'PRJ-007',
      transferDate: daysAgo(12), status: 'draft',
      notes: 'Planned stock allocation for King Salman Park Phase 2',
      lines: [
        { itemCode: 'STL-001', quantity: 5000, condition: 'good' },
        { itemCode: 'ELC-006', quantity: 200,  condition: 'good' },
      ],
    },
  ];

  for (const st of stDefs) {
    const { lines, fromWarehouseCode, toWarehouseCode, fromProjectCode, toProjectCode, ...header } = st;
    const fromWhId = warehouseMap[fromWarehouseCode] ?? warehouseMap['WH-MAIN'];
    const toWhId   = warehouseMap[toWarehouseCode]   ?? warehouseMap['WH-MAIN'];

    const created = await prisma.stockTransfer
      .upsert({
        where: { transferNumber: header.transferNumber },
        update: {},
        create: {
          transferNumber: header.transferNumber,
          transferType: header.transferType as any,
          fromWarehouseId: fromWhId,
          toWarehouseId: toWhId,
          fromProjectId: fromProjectCode ? projectMap[fromProjectCode] ?? null : null,
          toProjectId:   toProjectCode   ? projectMap[toProjectCode]   ?? null : null,
          requestedById: khalid.id,
          transferDate: header.transferDate,
          status: header.status as any,
          notes: header.notes ?? null,
          shippedDate: ['shipped', 'received', 'completed'].includes(header.status)
            ? new Date(header.transferDate.getTime() + 2 * 86400000) : null,
          receivedDate: ['received', 'completed'].includes(header.status)
            ? new Date(header.transferDate.getTime() + 4 * 86400000) : null,
        },
      });

    for (const line of lines) {
      const itemId = itemMap[line.itemCode];
      if (!itemId) continue;
      const uomId = allItemsNow.find(i => i.id === itemId)?.uomId;
      if (!uomId) continue;
      await prisma.stockTransferLine.create({
        data: {
          transferId: created.id,
          itemId,
          uomId,
          quantity: line.quantity,
          condition: line.condition,
        },
      }).catch(() => null);
    }
  }
  console.log(`  Stock Transfers: ${stDefs.length}`);

  // ── Gate Passes ───────────────────────────────────────────────────────────
  const gpDefs = [
    {
      gatePassNumber: 'GP-2026-001', passType: 'inbound', status: 'released',
      issueDate: daysAgo(82), validUntil: daysAgo(81),
      vehicleNumber: 'ر ك م 7788', driverName: 'علي بن محمد القحطاني',
      destination: 'NIT Main Warehouse — Receiving Dock 1', purpose: 'Delivery of cement and aggregates per GRN MRRV-2026-001',
      items: [{ itemCode: 'CON-001', quantity: 5000, description: 'Portland Cement 50kg bags' }],
    },
    {
      gatePassNumber: 'GP-2026-002', passType: 'inbound', status: 'released',
      issueDate: daysAgo(75), validUntil: daysAgo(74),
      vehicleNumber: 'ح ص ع 4412', driverName: 'محمد إبراهيم الدوسري',
      destination: 'NIT Main Warehouse — Steel Yard', purpose: 'Steel rebar delivery per MRRV-2026-002',
      items: [{ itemCode: 'STL-001', quantity: 50000, description: 'Steel Rebar 12mm' }],
    },
    {
      gatePassNumber: 'GP-2026-003', passType: 'outbound', status: 'returned',
      issueDate: daysAgo(68), validUntil: daysAgo(65),
      vehicleNumber: 'ب ت ث 9901', driverName: 'خالد عمر السهلاوي',
      destination: 'Riyadh Metro Station 7 — Construction Site', purpose: 'Material issue per MIRV-2026-001',
      items: [
        { itemCode: 'STL-001', quantity: 8000, description: 'Steel Rebar 12mm for structure' },
        { itemCode: 'STL-003', quantity: 5000, description: 'Steel Rebar 16mm for columns' },
      ],
    },
    {
      gatePassNumber: 'GP-2026-004', passType: 'outbound', status: 'approved',
      issueDate: daysAgo(36), validUntil: daysAgo(30),
      vehicleNumber: 'ج ح خ 3355', driverName: 'تركي عبدالله النجار',
      destination: 'NEOM Linear City — Site D', purpose: 'Steel delivery MIRV-2026-005',
      items: [
        { itemCode: 'STL-001', quantity: 20000, description: 'Steel Rebar for foundations' },
      ],
    },
    {
      gatePassNumber: 'GP-2026-005', passType: 'transfer', status: 'released',
      issueDate: daysAgo(44), validUntil: daysAgo(42),
      vehicleNumber: 'د ذ ر 6677', driverName: 'فيصل سعود العتيبي',
      destination: 'NIT Jubail Industrial Store', purpose: 'Stock transfer ST-2026-003 — Pipes',
      items: [
        { itemCode: 'MEC-002', quantity: 100, description: 'GI Pipe 2"' },
        { itemCode: 'MEC-003', quantity: 80,  description: 'HDPE Pipe 110mm' },
      ],
    },
    {
      gatePassNumber: 'GP-2026-006', passType: 'inbound', status: 'pending',
      issueDate: daysAgo(10), validUntil: daysAgo(8),
      vehicleNumber: 'ز س ش 2241', driverName: 'عمر سلمان الغامدي',
      destination: 'NIT Main Warehouse — Electrical Store', purpose: 'Electrical materials delivery MRRV-2026-014',
      items: [{ itemCode: 'ELC-001', quantity: 3000, description: 'Power cable drums' }],
    },
    {
      gatePassNumber: 'GP-2026-007', passType: 'outbound', status: 'draft',
      issueDate: daysAgo(5), validUntil: daysAgo(-1),
      vehicleNumber: 'ص ض ط 8821', driverName: 'يوسف خالد المطيري',
      destination: 'King Salman Park — Utility Trench Zone', purpose: 'Electrical issue per MIRV-2026-007',
      items: [
        { itemCode: 'ELC-005', quantity: 80,  description: 'LED Floodlights' },
        { itemCode: 'ELC-006', quantity: 500, description: 'PVC Conduit' },
      ],
    },
    {
      gatePassNumber: 'GP-2026-008', passType: 'outbound', status: 'expired',
      issueDate: daysAgo(52), validUntil: daysAgo(49),
      vehicleNumber: 'ع غ ف 1192', driverName: 'ناصر حمد القرني',
      destination: 'Jeddah Tower Site — Floor 22', purpose: 'Pipes partial issue MIRV-2026-003',
      items: [
        { itemCode: 'MEC-002', quantity: 150, description: 'GI Pipe 2"' },
      ],
    },
  ];

  for (const gp of gpDefs) {
    const { items, ...header } = gp;
    const created = await prisma.gatePass
      .upsert({
        where: { gatePassNumber: header.gatePassNumber },
        update: {},
        create: {
          gatePassNumber: header.gatePassNumber,
          passType: header.passType as any,
          warehouseId: warehouseMap['WH-MAIN'],
          vehicleNumber: header.vehicleNumber,
          driverName: header.driverName,
          destination: header.destination,
          purpose: header.purpose,
          issueDate: header.issueDate,
          validUntil: header.validUntil,
          status: header.status as any,
          issuedById: ahmed.id,
          exitTime: ['released', 'returned'].includes(header.status) ? new Date(header.issueDate.getTime() + 3600000) : null,
          returnTime: header.status === 'returned' ? new Date(header.issueDate.getTime() + 5 * 3600000) : null,
        },
      });

    for (const item of items) {
      const itemId = itemMap[item.itemCode];
      if (!itemId) continue;
      const uomId = allItemsNow.find(i => i.id === itemId)?.uomId;
      if (!uomId) continue;
      await prisma.gatePassItem.create({
        data: {
          gatePassId: created.id,
          itemId,
          uomId,
          quantity: item.quantity,
          description: item.description,
        },
      }).catch(() => null);
    }
  }
  console.log(`  Gate Passes: ${gpDefs.length}`);

  // ── Shipments ─────────────────────────────────────────────────────────────
  const portOfEntry = await prisma.port.findFirst({ where: { portCode: 'SAJED' } });

  const shipmentDefs = [
    {
      shipmentNumber: 'SH-2026-001', supplierId: supplierMap['SUP-011'],
      projectCode: 'PRJ-001', modeOfShipment: 'sea_fcl', originCountry: 'Germany',
      portOfLoading: 'Hamburg Port', status: 'at_port',
      orderDate: daysAgo(90), expectedShipDate: daysAgo(60), actualShipDate: daysAgo(58),
      etaPort: daysAgo(18), actualArrivalDate: daysAgo(16),
      awbBlNumber: 'BL-HH-2026-00812', containerNumber: 'MSCU4412871',
      vesselFlight: 'MSC SARAH V.002E', commercialValue: 385000,
      freightCost: 22000, insuranceCost: 4500, dutiesEstimated: 38500,
      description: 'Drilling equipment and spare parts for NEOM infrastructure',
      lines: [
        { itemCode: 'SPR-002', description: 'Hydraulic Hose 1/2"', quantity: 200, unitValue: 78,  hsCode: '8307.10' },
        { itemCode: 'TOL-001', description: 'HSS Drill Bit Sets',   quantity: 80,  unitValue: 85,  hsCode: '8207.50' },
      ],
    },
    {
      shipmentNumber: 'SH-2026-002', supplierId: supplierMap['SUP-007'],
      projectCode: 'PRJ-004', modeOfShipment: 'sea_lcl', originCountry: 'South Korea',
      portOfLoading: 'Busan Port', status: 'customs_clearing',
      orderDate: daysAgo(75), expectedShipDate: daysAgo(45), actualShipDate: daysAgo(42),
      etaPort: daysAgo(10), actualArrivalDate: daysAgo(8),
      awbBlNumber: 'BL-BS-2026-01144', containerNumber: 'HLXU7733210',
      vesselFlight: 'HYUNDAI CONFIDENCE V.015W', commercialValue: 192000,
      freightCost: 14500, insuranceCost: 2800, dutiesEstimated: 19200,
      description: 'Smart distribution boards and metering equipment for Metro Line 2',
      lines: [
        { itemCode: 'ELC-004', description: 'Smart Distribution Board 8-Way', quantity: 60, unitValue: 380, hsCode: '8537.10' },
        { itemCode: 'ELC-002', description: 'MCB 32A Type B', quantity: 500, unitValue: 45,  hsCode: '8536.20' },
      ],
    },
    {
      shipmentNumber: 'SH-2026-003', supplierId: supplierMap['SUP-004'],
      projectCode: 'PRJ-006', modeOfShipment: 'land', originCountry: 'UAE',
      portOfLoading: 'Ruwais Industrial Zone', status: 'in_delivery',
      orderDate: daysAgo(30), expectedShipDate: daysAgo(12), actualShipDate: daysAgo(11),
      etaPort: daysAgo(5), actualArrivalDate: daysAgo(4),
      awbBlNumber: null, containerNumber: null,
      vesselFlight: 'Land Route via King Fahad Causeway',
      commercialValue: 145000,
      freightCost: 8200, insuranceCost: 1500, dutiesEstimated: 0,
      description: 'HDPE pipes and fittings for Jubail industrial expansion',
      lines: [
        { itemCode: 'MEC-003', description: 'HDPE Pipe 110mm PN16', quantity: 500, unitValue: 52, hsCode: '3917.32' },
        { itemCode: 'MEC-005', description: 'Gate Valve 2" Flanged', quantity: 60, unitValue: 145, hsCode: '8481.20' },
      ],
    },
  ];

  for (const sh of shipmentDefs) {
    const { lines, projectCode, ...header } = sh;
    const projectId = projectMap[projectCode] ?? prj1!.id;
    const created = await prisma.shipment
      .upsert({
        where: { shipmentNumber: header.shipmentNumber },
        update: {},
        create: {
          shipmentNumber: header.shipmentNumber,
          supplierId: header.supplierId ?? supplierMap['SUP-001'],
          projectId,
          modeOfShipment: header.modeOfShipment as any,
          originCountry: header.originCountry,
          portOfLoading: header.portOfLoading,
          portOfEntryId: portOfEntry?.id ?? null,
          destinationWarehouseId: warehouseMap['WH-MAIN'],
          status: header.status as any,
          orderDate: header.orderDate,
          expectedShipDate: header.expectedShipDate,
          actualShipDate: header.actualShipDate ?? null,
          etaPort: header.etaPort ?? null,
          actualArrivalDate: (header as any).actualArrivalDate ?? null,
          awbBlNumber: header.awbBlNumber ?? null,
          containerNumber: header.containerNumber ?? null,
          vesselFlight: header.vesselFlight ?? null,
          commercialValue: header.commercialValue,
          freightCost: header.freightCost,
          insuranceCost: header.insuranceCost,
          dutiesEstimated: header.dutiesEstimated,
          description: header.description,
        },
      });

    for (const line of lines) {
      const itemId = itemMap[line.itemCode];
      const uomId  = itemId ? allItemsNow.find(i => i.id === itemId)?.uomId : null;
      await prisma.shipmentLine.create({
        data: {
          shipmentId: created.id,
          itemId: itemId ?? null,
          description: line.description,
          quantity: line.quantity,
          uomId: uomId ?? null,
          unitValue: line.unitValue,
          hsCode: line.hsCode,
        },
      }).catch(() => null);
    }

    // Customs tracking for at_port/customs_clearing shipments
    if (['at_port', 'customs_clearing'].includes(header.status)) {
      await prisma.customsTracking.create({
        data: {
          shipmentId: created.id,
          stage: header.status === 'at_port' ? 'docs_submitted' : 'declaration_filed',
          stageDate: new Date(header.etaPort!.getTime() + 86400000),
          customsDeclaration: `CD-2026-${Math.floor(Math.random() * 90000) + 10000}`,
          inspectionType: 'document_review',
          dutiesAmount: header.dutiesEstimated,
          vatAmount: header.commercialValue * 0.15,
          paymentStatus: header.status === 'customs_clearing' ? 'awaiting_payment' : 'pending_calculation',
        },
      }).catch(() => null);
    }
  }
  console.log(`  Shipments: ${shipmentDefs.length}`);

  // ── Audit Log Entries ─────────────────────────────────────────────────────
  const auditEntries = [
    // GRN activity
    { table: 'RCV_RECEIPT_HEADERS', action: 'create', user: ahmed,   daysBack: 82, fields: ['status'], newVals: { status: 'draft', mrrvNumber: 'MRRV-2026-001' } },
    { table: 'RCV_RECEIPT_HEADERS', action: 'update', user: ahmed,   daysBack: 81, fields: ['status'], oldVals: { status: 'draft' }, newVals: { status: 'pending_qc' } },
    { table: 'RCV_RECEIPT_HEADERS', action: 'update', user: saad,    daysBack: 80, fields: ['status', 'qc_approved_date'], oldVals: { status: 'pending_qc' }, newVals: { status: 'qc_approved' } },
    { table: 'RCV_RECEIPT_HEADERS', action: 'update', user: ahmed,   daysBack: 79, fields: ['status'], oldVals: { status: 'qc_approved' }, newVals: { status: 'stored' } },
    // MI activity
    { table: 'ONT_ISSUE_HEADERS',   action: 'create', user: khalid,  daysBack: 70, fields: ['status'], newVals: { status: 'draft', mirvNumber: 'MIRV-2026-001' } },
    { table: 'ONT_ISSUE_HEADERS',   action: 'update', user: khalid,  daysBack: 69, fields: ['status'], oldVals: { status: 'draft' }, newVals: { status: 'pending_approval' } },
    { table: 'ONT_ISSUE_HEADERS',   action: 'update', user: abdulrahman, daysBack: 68, fields: ['status', 'approved_date'], oldVals: { status: 'pending_approval' }, newVals: { status: 'approved' } },
    { table: 'ONT_ISSUE_HEADERS',   action: 'update', user: ahmed,   daysBack: 68, fields: ['status', 'issued_date'], oldVals: { status: 'approved' }, newVals: { status: 'issued' } },
    // Supplier update
    { table: 'FND_SUPPLIERS',       action: 'update', user: admin,   daysBack: 66, fields: ['rating'], oldVals: { rating: 3 }, newVals: { rating: 4, supplierCode: 'SUP-004' } },
    // QCI activity
    { table: 'RCV_INSPECTION_HEADERS', action: 'create', user: saad, daysBack: 66, fields: ['status'], newVals: { status: 'pending', rfimNumber: 'RFIM-2026-001' } },
    { table: 'RCV_INSPECTION_HEADERS', action: 'update', user: saad, daysBack: 64, fields: ['status', 'result', 'inspection_date'], oldVals: { status: 'in_progress' }, newVals: { status: 'completed', result: 'pass' } },
    // Job order approvals
    { table: 'WMS_JOB_ORDERS',      action: 'create', user: mohammed, daysBack: 65, fields: ['status'], newVals: { status: 'draft', joNumber: 'JO-2026-002' } },
    { table: 'WMS_JOB_ORDERS',      action: 'update', user: abdulrahman, daysBack: 63, fields: ['status'], oldVals: { status: 'draft' }, newVals: { status: 'pending_approval' } },
    { table: 'WMS_JOB_ORDERS',      action: 'update', user: admin,   daysBack: 62, fields: ['status'], oldVals: { status: 'pending_approval' }, newVals: { status: 'approved' } },
    { table: 'WMS_JOB_ORDERS',      action: 'update', user: admin,   daysBack: 60, fields: ['status'], oldVals: { status: 'approved' }, newVals: { status: 'in_progress' } },
    // Stock transfer
    { table: 'MTL_TRANSFER_HEADERS', action: 'create', user: khalid, daysBack: 45, fields: ['status'], newVals: { status: 'draft', transferNumber: 'ST-2026-003' } },
    { table: 'MTL_TRANSFER_HEADERS', action: 'update', user: khalid, daysBack: 44, fields: ['status'], oldVals: { status: 'draft' }, newVals: { status: 'pending' } },
    { table: 'MTL_TRANSFER_HEADERS', action: 'update', user: abdulrahman, daysBack: 43, fields: ['status'], oldVals: { status: 'pending' }, newVals: { status: 'approved' } },
    { table: 'MTL_TRANSFER_HEADERS', action: 'update', user: fahad,  daysBack: 43, fields: ['status', 'shipped_date'], oldVals: { status: 'approved' }, newVals: { status: 'shipped' } },
    { table: 'MTL_TRANSFER_HEADERS', action: 'update', user: ahmed,  daysBack: 41, fields: ['status', 'received_date'], oldVals: { status: 'shipped' }, newVals: { status: 'received' } },
    // OSD raised
    { table: 'RCV_DISCREPANCY_HEADERS', action: 'create', user: ahmed, daysBack: 74, fields: ['status'], newVals: { status: 'draft', osdNumber: 'OSD-2026-001' } },
    { table: 'RCV_DISCREPANCY_HEADERS', action: 'update', user: abdulrahman, daysBack: 72, fields: ['status', 'claim_sent_date'], oldVals: { status: 'draft' }, newVals: { status: 'claim_sent' } },
    { table: 'RCV_DISCREPANCY_HEADERS', action: 'update', user: abdulrahman, daysBack: 60, fields: ['status', 'resolution_type'], oldVals: { status: 'negotiating' }, newVals: { status: 'resolved', resolution_type: 'credit_note' } },
    // Item created
    { table: 'MTL_SYSTEM_ITEMS',    action: 'create', user: admin,   daysBack: 30, fields: ['itemCode', 'itemDescription'], newVals: { itemCode: 'MEC-005', itemDescription: 'Gate Valve 2" Flanged' } },
    // New GRN recent
    { table: 'RCV_RECEIPT_HEADERS', action: 'create', user: ahmed,   daysBack: 10, fields: ['status'], newVals: { status: 'draft', mrrvNumber: 'MRRV-2026-013' } },
    { table: 'RCV_RECEIPT_HEADERS', action: 'update', user: ahmed,   daysBack: 9,  fields: ['status'], oldVals: { status: 'draft' }, newVals: { status: 'pending_qc' } },
    // Shipment arrival
    { table: 'WSH_DELIVERY_HEADERS', action: 'update', user: mohammed, daysBack: 16, fields: ['status', 'actual_arrival_date'], oldVals: { status: 'in_transit' }, newVals: { status: 'at_port', shipmentNumber: 'SH-2026-001' } },
    { table: 'WSH_DELIVERY_HEADERS', action: 'update', user: admin,   daysBack: 8,  fields: ['status'], oldVals: { status: 'at_port' }, newVals: { status: 'customs_clearing', shipmentNumber: 'SH-2026-002' } },
    // Gate pass
    { table: 'WMS_GATE_PASSES',     action: 'create', user: ahmed,   daysBack: 36, fields: ['status'], newVals: { status: 'draft', gatePassNumber: 'GP-2026-004' } },
    { table: 'WMS_GATE_PASSES',     action: 'update', user: abdulrahman, daysBack: 35, fields: ['status'], oldVals: { status: 'pending' }, newVals: { status: 'approved' } },
  ];

  // Get a fake-but-stable UUID to use as record_id for audit entries
  const fakeId = '00000000-0000-0000-0000-000000000001';

  for (const entry of auditEntries) {
    await prisma.auditLog.create({
      data: {
        tableName: entry.table,
        recordId: fakeId,
        action: entry.action as any,
        changedFields: entry.fields,
        oldValues: (entry as any).oldVals ?? null,
        newValues: (entry as any).newVals ?? null,
        performedById: entry.user?.id ?? admin.id,
        performedAt: daysAgo(entry.daysBack),
        ipAddress: `10.0.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 254) + 1}`,
      },
    }).catch(() => null);
  }
  console.log(`  Audit Log entries: ${auditEntries.length}`);

  // ── Notifications ─────────────────────────────────────────────────────────
  const notifDefs = [
    { recipientId: ahmed.id,        title: 'GRN Pending QC Review', body: 'MRRV-2026-013 has been submitted for QC inspection. Please review within 24 hours.', type: 'grn_status', daysBack: 9, isRead: false },
    { recipientId: saad!.id,        title: 'Inspection Request: RFIM-2026-003', body: 'A new inspection request has been assigned to you for gate valves and hydraulic components.', type: 'rfim_assigned', daysBack: 33, isRead: true },
    { recipientId: abdulrahman!.id, title: 'MI Approval Required: MIRV-2026-004', body: 'Material issue request MIRV-2026-004 requires your approval. Estimated value: SAR 18,250.', type: 'mirv_approval', daysBack: 45, isRead: true },
    { recipientId: admin.id,        title: 'Job Order High Value: JO-2026-007', body: 'Job Order JO-2026-007 for generator rental (SAR 22,000) is pending approval — requires admin sign-off.', type: 'jo_approval', daysBack: 30, isRead: false },
    { recipientId: mohammed!.id,    title: 'Shipment Arrived at Port: SH-2026-001', body: 'Shipment SH-2026-001 (Halliburton equipment) has arrived at Jeddah Islamic Port. Customs clearance is in progress.', type: 'shipment_update', daysBack: 16, isRead: true },
    { recipientId: khalid.id,       title: 'Stock Transfer Received: ST-2026-003', body: 'Stock transfer ST-2026-003 has been received at Jubail Industrial Store. Please verify quantities.', type: 'transfer_update', daysBack: 41, isRead: true },
    { recipientId: ahmed.id,        title: 'OSD Claim Resolved: OSD-2026-001', body: 'Discrepancy report OSD-2026-001 has been resolved. Credit note issued by Al-Rajhi Steel for SAR 570.', type: 'osd_resolved', daysBack: 60, isRead: true },
    { recipientId: admin.id,        title: 'Customs Clearance Required: SH-2026-002', body: 'Shipment SH-2026-002 is now at customs. Duties payable: approx. SAR 19,200. Action required.', type: 'customs_alert', daysBack: 8, isRead: false },
    { recipientId: fahad!.id,       title: 'Gate Pass Expired: GP-2026-008', body: 'Gate Pass GP-2026-008 has expired without vehicle return recorded. Please investigate.', type: 'gp_expired', daysBack: 49, isRead: true },
    { recipientId: saad!.id,        title: 'QCI Completed: RFIM-2026-002 — Conditional Pass', body: 'Inspection RFIM-2026-002 completed with conditional pass result. 5 circuit breakers quarantined — awaiting PM approval.', type: 'rfim_completed', daysBack: 51, isRead: true },
  ];

  for (const notif of notifDefs) {
    const { daysBack, isRead, type, ...data } = notif;
    await prisma.notification.create({
      data: {
        recipientId: data.recipientId,
        title: data.title,
        body: data.body,
        notificationType: type,
        isRead,
        createdAt: daysAgo(daysBack),
      },
    }).catch(() => null);
  }
  console.log(`  Notifications: ${notifDefs.length}`);

  console.log('── seedDemo: complete ───────────────────────────────────\n');
}
