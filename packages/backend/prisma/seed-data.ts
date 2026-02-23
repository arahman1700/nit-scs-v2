/**
 * Operational seed data for the NIT Supply Chain System.
 * Run AFTER seed.ts (reference data, employees, entity) and seed-templates.ts.
 *
 *   npx tsx prisma/seed-data.ts
 *
 * Idempotent: every create is wrapped with .catch(() => null) so re-runs
 * skip rows that already exist (unique-constraint violations are swallowed).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a city by name or throw */
async function city(name: string) {
  const c = await prisma.city.findFirst({ where: { cityName: name } });
  if (!c) throw new Error(`City "${name}" not found – run seed.ts first`);
  return c;
}

/** Look up a region by name or throw */
async function region(name: string) {
  const r = await prisma.region.findFirst({ where: { regionName: name } });
  if (!r) throw new Error(`Region "${name}" not found – run seed.ts first`);
  return r;
}

/** Look up a UOM by code or throw */
async function uom(code: string) {
  const u = await prisma.unitOfMeasure.findFirst({ where: { uomCode: code } });
  if (!u) throw new Error(`UOM "${code}" not found – run seed.ts first`);
  return u;
}

/** Look up a warehouse type by name or throw */
async function whType(name: string) {
  const wt = await prisma.warehouseType.findFirst({ where: { typeName: name } });
  if (!wt) throw new Error(`Warehouse type "${name}" not found – run seed.ts first`);
  return wt;
}

/** Look up an employee by email or throw */
async function employee(email: string) {
  const e = await prisma.employee.findFirst({ where: { email } });
  if (!e) throw new Error(`Employee "${email}" not found – run seed.ts first`);
  return e;
}

/** Look up the NIT entity or throw */
async function nitEntity() {
  const e = await prisma.entity.findFirst({ where: { entityCode: 'NIT' } });
  if (!e) throw new Error('Entity "NIT" not found – run seed.ts first');
  return e;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding operational data ...\n');

  // ── 0. Resolve reference data ──────────────────────────────────────────
  const entity = await nitEntity();

  const riyadhCity = await city('Riyadh');
  const jeddahCity = await city('Jeddah');
  const dammamCity = await city('Dammam');
  const jubailCity = await city('Jubail');
  const makkahCity = await city('Makkah');
  const tabukCity = await city('Tabuk');
  const neomCity = await city('NEOM');

  const riyadhRegion = await region('Riyadh');
  const makkahRegion = await region('Makkah');
  const easternRegion = await region('Eastern Province');
  const tabukRegion = await region('Tabuk');

  const uomEA = await uom('EA');
  const uomKG = await uom('KG');
  const uomM = await uom('M');
  const uomM2 = await uom('M2');
  const uomL = await uom('L');
  const uomBAG = await uom('BAG');
  const uomDRUM = await uom('DRUM');

  const whMain = await whType('Main Warehouse');
  const whSite = await whType('Site Warehouse');
  const whYard = await whType('Open Yard');

  // Employees – looked up by email from seed.ts
  const empAdmin = await employee('admin@nit.sa');
  const empAhmed = await employee('ahmed@nit.sa'); // warehouse_staff
  const empMohammed = await employee('mohammed@nit.sa'); // logistics_coordinator
  const empKhalid = await employee('khalid@nit.sa'); // site_engineer
  const empSaad = await employee('saad@nit.sa'); // qc_officer
  const empAbdulrahman = await employee('abdulrahman@nit.sa'); // manager

  // ── 1. Suppliers (8) ───────────────────────────────────────────────────
  console.log('  Creating suppliers ...');

  const supplierData = [
    {
      supplierCode: 'SUP-001',
      supplierName: 'Al-Rajhi Steel Industries',

      types: ['steel', 'construction'],
      contactPerson: 'Fahad Al-Rajhi',
      email: 'fahad@alrajhisteel.sa',
      phone: '+966501000001',
      address: 'Industrial City, 2nd Ring Road',
      cityId: riyadhCity.id,
      crNumber: '1010234567',
      vatNumber: '310123456700003',
      rating: 4,
      paymentTerms: 'Net 30',
      status: 'active' as const,
    },
    {
      supplierCode: 'SUP-002',
      supplierName: 'Saudi Cement Company',
      types: ['cement', 'construction'],
      contactPerson: 'Omar Bakr',
      email: 'omar@saudicement.sa',
      phone: '+966502000002',
      address: 'King Fahad Industrial Port Rd',
      cityId: dammamCity.id,
      crNumber: '2050345678',
      vatNumber: '310234567800003',
      rating: 5,
      paymentTerms: 'Net 45',
      status: 'active' as const,
    },
    {
      supplierCode: 'SUP-003',
      supplierName: 'Gulf Electrical Supplies',
      types: ['electrical'],
      contactPerson: 'Tariq Mansour',
      email: 'tariq@gulfelectrical.sa',
      phone: '+966503000003',
      address: 'Al-Khayyat Commercial Center',
      cityId: jeddahCity.id,
      crNumber: '4030456789',
      vatNumber: '310345678900003',
      rating: 4,
      paymentTerms: 'Net 30',
      status: 'active' as const,
    },
    {
      supplierCode: 'SUP-004',
      supplierName: 'National Pipe Company (Napco)',
      types: ['piping', 'mechanical'],
      contactPerson: 'Sultan Al-Otaibi',
      email: 'sultan@napco.sa',
      phone: '+966504000004',
      address: 'Jubail Industrial City, Sector B',
      cityId: jubailCity.id,
      crNumber: '2055567890',
      vatNumber: '310456789000003',
      rating: 5,
      paymentTerms: 'Net 60',
      status: 'active' as const,
    },
    {
      supplierCode: 'SUP-005',
      supplierName: 'Al-Marai Industrial Supplies',
      types: ['consumables', 'general'],
      contactPerson: 'Nasser Al-Marai',
      email: 'nasser@almarai-ind.sa',
      phone: '+966505000005',
      address: 'Exit 15, Northern Ring Rd',
      cityId: riyadhCity.id,
      crNumber: '1010678901',
      vatNumber: '310567890100003',
      rating: 3,
      paymentTerms: 'Net 15',
      status: 'active' as const,
    },
    {
      supplierCode: 'SUP-006',
      supplierName: 'Hassan Safety Equipment Co.',
      types: ['safety', 'ppe'],
      contactPerson: 'Hassan Khalil',
      email: 'hassan@hassansafety.sa',
      phone: '+966506000006',
      address: 'Industrial Area 1, Block 12',
      cityId: dammamCity.id,
      crNumber: '2050789012',
      vatNumber: '310678901200003',
      rating: 4,
      paymentTerms: 'Net 30',
      status: 'active' as const,
    },
    {
      supplierCode: 'SUP-007',
      supplierName: 'Bin Laden Construction Materials',
      types: ['construction', 'general'],
      contactPerson: 'Youssef Bin Laden',
      email: 'youssef@blcm.sa',
      phone: '+966507000007',
      address: 'Makkah-Jeddah Expressway, KM 25',
      cityId: makkahCity.id,
      crNumber: '4031890123',
      vatNumber: '310789012300003',
      rating: 5,
      paymentTerms: 'Net 45',
      status: 'active' as const,
    },
    {
      supplierCode: 'SUP-008',
      supplierName: 'NESMA Trading Company',
      types: ['general', 'trading'],
      contactPerson: 'Ali Turki',
      email: 'ali@nesmatrading.sa',
      phone: '+966508000008',
      address: 'Al Rawdah District, Prince Sultan St',
      cityId: jeddahCity.id,
      crNumber: '4030901234',
      vatNumber: '310890123400003',
      rating: 4,
      paymentTerms: 'Net 30',
      status: 'active' as const,
    },
  ];

  const suppliers: Record<string, { id: string }> = {};
  for (const s of supplierData) {
    const created = await prisma.supplier
      .create({ data: s })
      .catch(() => prisma.supplier.findFirst({ where: { supplierCode: s.supplierCode } }).then(r => r!));
    suppliers[s.supplierCode] = created;
  }
  console.log(`    ${Object.keys(suppliers).length} suppliers`);

  // ── 2. Projects (5) ────────────────────────────────────────────────────
  console.log('  Creating projects ...');

  const projectData = [
    {
      projectCode: 'PRJ-001',
      projectName: 'NEOM Bay Phase 1',
      client: 'NEOM Company',
      entityId: entity.id,
      regionId: tabukRegion.id,
      cityId: neomCity.id,
      projectManagerId: empAbdulrahman.id,
      status: 'active' as const,
      startDate: new Date('2025-06-01'),
      endDate: new Date('2027-12-31'),
      budget: 850000000,
      description: 'NEOM Bay coastal development – infrastructure and utilities phase 1',
    },
    {
      projectCode: 'PRJ-002',
      projectName: 'Jubail Industrial Expansion',
      client: 'Royal Commission for Jubail',
      entityId: entity.id,
      regionId: easternRegion.id,
      cityId: jubailCity.id,
      projectManagerId: empAbdulrahman.id,
      status: 'active' as const,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2027-06-30'),
      budget: 320000000,
      description: 'Expansion of petrochemical support infrastructure in Jubail Industrial City',
    },
    {
      projectCode: 'PRJ-003',
      projectName: 'Riyadh Metro Line 3',
      client: 'Royal Commission for Riyadh City',
      entityId: entity.id,
      regionId: riyadhRegion.id,
      cityId: riyadhCity.id,
      projectManagerId: empKhalid.id,
      status: 'active' as const,
      startDate: new Date('2025-03-15'),
      endDate: new Date('2028-03-31'),
      budget: 1200000000,
      description: 'Underground metro construction – stations and tunnel works for Line 3',
    },
    {
      projectCode: 'PRJ-004',
      projectName: 'Jeddah Tower Foundation Works',
      client: 'Jeddah Economic Company',
      entityId: entity.id,
      regionId: makkahRegion.id,
      cityId: jeddahCity.id,
      projectManagerId: empKhalid.id,
      status: 'active' as const,
      startDate: new Date('2025-01-10'),
      endDate: new Date('2026-12-31'),
      budget: 450000000,
      description: 'Deep foundation and substructure works for Jeddah Tower project',
    },
    {
      projectCode: 'PRJ-005',
      projectName: 'Tabuk Solar Farm',
      client: 'Saudi Electricity Company (SEC)',
      entityId: entity.id,
      regionId: tabukRegion.id,
      cityId: tabukCity.id,
      projectManagerId: empAbdulrahman.id,
      status: 'active' as const,
      startDate: new Date('2025-11-01'),
      endDate: new Date('2027-04-30'),
      budget: 180000000,
      description: '200 MW solar photovoltaic plant – EPC and grid connection',
    },
  ];

  const projects: Record<string, { id: string }> = {};
  for (const p of projectData) {
    const created = await prisma.project
      .create({ data: p })
      .catch(() => prisma.project.findFirst({ where: { projectCode: p.projectCode } }).then(r => r!));
    projects[p.projectCode] = created;
  }
  console.log(`    ${Object.keys(projects).length} projects`);

  // ── 3. Warehouses (4) ──────────────────────────────────────────────────
  console.log('  Creating warehouses ...');

  const warehouseData = [
    {
      warehouseCode: 'WH-001',
      warehouseName: 'Dammam Main Warehouse',
      warehouseTypeId: whMain.id,
      regionId: easternRegion.id,
      cityId: dammamCity.id,
      address: 'Industrial Area 2, Warehouse Complex A, Dammam 31432',
      managerId: empAhmed.id,
      contactPhone: '+966138200100',
      status: 'active' as const,
      latitude: 26.3927,
      longitude: 49.9777,
    },
    {
      warehouseCode: 'WH-002',
      warehouseName: 'Jubail Site Store',
      warehouseTypeId: whSite.id,
      regionId: easternRegion.id,
      cityId: jubailCity.id,
      projectId: projects['PRJ-002'].id,
      address: 'Jubail Industrial City, Sector C, Gate 4',
      managerId: empAhmed.id,
      contactPhone: '+966133471500',
      status: 'active' as const,
      latitude: 27.0046,
      longitude: 49.6225,
    },
    {
      warehouseCode: 'WH-003',
      warehouseName: 'Riyadh Distribution Center',
      warehouseTypeId: whMain.id,
      regionId: riyadhRegion.id,
      cityId: riyadhCity.id,
      address: 'Logistics Hub, Exit 18, Eastern Ring Rd, Riyadh 11564',
      managerId: empAbdulrahman.id,
      contactPhone: '+966114650200',
      status: 'active' as const,
      latitude: 24.7136,
      longitude: 46.6753,
    },
    {
      warehouseCode: 'WH-004',
      warehouseName: 'NEOM Project Yard',
      warehouseTypeId: whYard.id,
      regionId: tabukRegion.id,
      cityId: neomCity.id,
      projectId: projects['PRJ-001'].id,
      address: 'NEOM Bay Logistics Zone, Sector A1',
      managerId: empMohammed.id,
      contactPhone: '+966144100300',
      status: 'active' as const,
      latitude: 27.95,
      longitude: 35.3,
    },
  ];

  const warehouses: Record<string, { id: string }> = {};
  for (const w of warehouseData) {
    const created = await prisma.warehouse
      .create({ data: w })
      .catch(() => prisma.warehouse.findFirst({ where: { warehouseCode: w.warehouseCode } }).then(r => r!));
    warehouses[w.warehouseCode] = created;
  }
  console.log(`    ${Object.keys(warehouses).length} warehouses`);

  // ── 4. Items (20) ──────────────────────────────────────────────────────
  console.log('  Creating items ...');

  const itemDefs = [
    {
      code: 'STL-001',
      desc: 'Steel Rebar 12mm',
      cat: 'construction',
      uomId: uomKG.id,
      cost: 4.5,
      barcode: '6280001000011',
      reorder: 1000,
    },
    {
      code: 'STL-002',
      desc: 'Steel Plate 10mm',
      cat: 'construction',
      uomId: uomKG.id,
      cost: 6.8,
      barcode: '6280001000028',
      reorder: 500,
    },
    {
      code: 'CEM-001',
      desc: 'Portland Cement 50kg Bag',
      cat: 'construction',
      uomId: uomBAG.id,
      cost: 18.0,
      barcode: '6280001000035',
      reorder: 200,
    },
    {
      code: 'PIP-001',
      desc: 'GRP Pipe 200mm',
      cat: 'mechanical',
      uomId: uomM.id,
      cost: 145.0,
      barcode: '6280001000042',
      reorder: 50,
    },
    {
      code: 'PIP-002',
      desc: 'PVC Pipe 110mm',
      cat: 'mechanical',
      uomId: uomM.id,
      cost: 32.5,
      barcode: '6280001000059',
      reorder: 100,
    },
    {
      code: 'ELC-001',
      desc: 'Cable 4x16mm2 XLPE',
      cat: 'electrical',
      uomId: uomM.id,
      cost: 28.0,
      barcode: '6280001000066',
      reorder: 200,
    },
    {
      code: 'ELC-002',
      desc: 'Circuit Breaker 63A 3P',
      cat: 'electrical',
      uomId: uomEA.id,
      cost: 185.0,
      barcode: '6280001000073',
      reorder: 30,
    },
    {
      code: 'ELC-003',
      desc: 'LED Flood Light 200W IP65',
      cat: 'electrical',
      uomId: uomEA.id,
      cost: 320.0,
      barcode: '6280001000080',
      reorder: 25,
    },
    {
      code: 'SAF-001',
      desc: 'Safety Helmet EN397',
      cat: 'safety',
      uomId: uomEA.id,
      cost: 45.0,
      barcode: '6280001000097',
      reorder: 100,
    },
    {
      code: 'SAF-002',
      desc: 'Safety Vest Hi-Vis',
      cat: 'safety',
      uomId: uomEA.id,
      cost: 25.0,
      barcode: '6280001000103',
      reorder: 150,
    },
    {
      code: 'SAF-003',
      desc: 'Safety Boots Steel-Toe',
      cat: 'safety',
      uomId: uomEA.id,
      cost: 180.0,
      barcode: '6280001000110',
      reorder: 80,
    },
    {
      code: 'TOL-001',
      desc: 'Drill Machine Bosch GBH 2-26',
      cat: 'tools',
      uomId: uomEA.id,
      cost: 850.0,
      barcode: '6280001000127',
      reorder: 10,
    },
    {
      code: 'TOL-002',
      desc: 'Welding Machine 300A MIG',
      cat: 'tools',
      uomId: uomEA.id,
      cost: 2500.0,
      barcode: '6280001000134',
      reorder: 5,
    },
    {
      code: 'CON-001',
      desc: 'Diesel Fuel (EN 590)',
      cat: 'consumables',
      uomId: uomL.id,
      cost: 2.18,
      barcode: '6280001000141',
      reorder: 2000,
    },
    {
      code: 'CON-002',
      desc: 'Lubricant Oil 20L Drum',
      cat: 'consumables',
      uomId: uomDRUM.id,
      cost: 145.0,
      barcode: '6280001000158',
      reorder: 20,
    },
    {
      code: 'SPR-001',
      desc: 'Bearing SKF 6205-2RS',
      cat: 'spare_parts',
      uomId: uomEA.id,
      cost: 38.0,
      barcode: '6280001000165',
      reorder: 50,
    },
    {
      code: 'SPR-002',
      desc: 'V-Belt B65',
      cat: 'spare_parts',
      uomId: uomEA.id,
      cost: 22.0,
      barcode: '6280001000172',
      reorder: 60,
    },
    {
      code: 'CON-003',
      desc: 'Welding Rod E6013 2.5mm',
      cat: 'consumables',
      uomId: uomKG.id,
      cost: 12.5,
      barcode: '6280001000189',
      reorder: 100,
    },
    {
      code: 'STL-003',
      desc: 'Wire Mesh 4mm 2x3m',
      cat: 'construction',
      uomId: uomM2.id,
      cost: 35.0,
      barcode: '6280001000196',
      reorder: 200,
    },
    {
      code: 'ELC-004',
      desc: 'Distribution Panel 12-Way',
      cat: 'electrical',
      uomId: uomEA.id,
      cost: 750.0,
      barcode: '6280001000202',
      reorder: 15,
    },
  ];

  const items: Record<string, { id: string; uomId: string }> = {};
  for (const i of itemDefs) {
    const created = await prisma.item
      .create({
        data: {
          itemCode: i.code,
          itemDescription: i.desc,
          category: i.cat,
          uomId: i.uomId,
          standardCost: i.cost,
          barcode: i.barcode,
          reorderPoint: i.reorder,
          minStock: Math.round(i.reorder * 0.5),
          status: 'active',
        },
      })
      .catch(() => prisma.item.findFirst({ where: { itemCode: i.code } }).then(r => r!));
    items[i.code] = { id: created.id, uomId: i.uomId };
  }
  console.log(`    ${Object.keys(items).length} items`);

  // ── 5. Inventory Levels ────────────────────────────────────────────────
  console.log('  Creating inventory levels ...');

  // Each entry: itemCode, warehouseCode, qtyOnHand, qtyReserved, location
  const invData: Array<[string, string, number, number, string]> = [
    // Construction items – large quantities in main warehouses
    ['STL-001', 'WH-001', 4500, 200, 'A1-01'],
    ['STL-001', 'WH-003', 2200, 0, 'A1-02'],
    ['STL-002', 'WH-001', 3200, 150, 'A1-03'],
    ['STL-002', 'WH-002', 800, 0, 'A2-01'],
    ['CEM-001', 'WH-001', 1800, 100, 'B1-01'],
    ['CEM-001', 'WH-003', 950, 50, 'B1-02'],
    ['STL-003', 'WH-001', 1200, 0, 'A2-04'],
    ['STL-003', 'WH-004', 600, 0, 'Y1-01'],

    // Mechanical / piping
    ['PIP-001', 'WH-001', 320, 40, 'C1-01'],
    ['PIP-001', 'WH-002', 180, 0, 'C1-02'],
    ['PIP-002', 'WH-001', 450, 0, 'C2-01'],
    ['PIP-002', 'WH-003', 220, 0, 'C2-02'],

    // Electrical
    ['ELC-001', 'WH-001', 380, 50, 'D1-01'],
    ['ELC-001', 'WH-003', 260, 0, 'D1-02'],
    ['ELC-002', 'WH-003', 120, 10, 'D2-01'],
    ['ELC-003', 'WH-003', 85, 0, 'D2-02'],
    ['ELC-004', 'WH-003', 42, 5, 'D3-01'],

    // Safety – spread across 2 warehouses
    ['SAF-001', 'WH-001', 450, 0, 'E1-01'],
    ['SAF-001', 'WH-003', 300, 0, 'E1-02'],
    ['SAF-002', 'WH-001', 620, 0, 'E1-03'],
    ['SAF-002', 'WH-004', 200, 0, 'Y2-01'],
    ['SAF-003', 'WH-001', 180, 20, 'E2-01'],

    // Tools – small quantities
    ['TOL-001', 'WH-003', 12, 2, 'F1-01'],
    ['TOL-002', 'WH-001', 8, 1, 'F1-02'],
    ['TOL-002', 'WH-002', 5, 0, 'F1-03'],

    // Consumables
    ['CON-001', 'WH-001', 8500, 500, 'G1-01'],
    ['CON-001', 'WH-004', 3200, 0, 'Y3-01'],
    ['CON-002', 'WH-001', 45, 5, 'G2-01'],
    ['CON-002', 'WH-003', 30, 0, 'G2-02'],
    ['CON-003', 'WH-001', 650, 0, 'G3-01'],
    ['CON-003', 'WH-002', 280, 0, 'G3-02'],

    // Spare parts
    ['SPR-001', 'WH-001', 120, 10, 'H1-01'],
    ['SPR-001', 'WH-003', 75, 0, 'H1-02'],
    ['SPR-002', 'WH-001', 95, 5, 'H1-03'],
    ['SPR-002', 'WH-002', 55, 0, 'H1-04'],
  ];

  let invCount = 0;
  for (const [itemCode, whCode, qtyOnHand, qtyReserved, _location] of invData) {
    await prisma.inventoryLevel
      .create({
        data: {
          itemId: items[itemCode].id,
          warehouseId: warehouses[whCode].id,
          qtyOnHand,
          qtyReserved,
          lastMovementDate: new Date(),
          version: 1,
        },
      })
      .catch(() => null);
    invCount++;
  }
  console.log(`    ${invCount} inventory levels`);

  // ── 6. MRRV Documents (3) ─────────────────────────────────────────────
  console.log('  Creating MRRV documents ...');

  // MRRV-1: Draft, Al-Rajhi Steel -> Dammam WH
  const mrrv1 = await prisma.mrrv
    .create({
      data: {
        mrrvNumber: 'MRRV-2026-0001',
        supplierId: suppliers['SUP-001'].id,
        poNumber: 'PO-2026-00123',
        warehouseId: warehouses['WH-001'].id,
        projectId: projects['PRJ-002'].id,
        receivedById: empAhmed.id,
        receiveDate: new Date('2026-02-01T08:00:00Z'),
        invoiceNumber: 'INV-ARS-2026-0451',
        deliveryNote: 'DN-ARS-8820',
        status: 'draft',
        notes: 'Steel delivery for Jubail Industrial Expansion project',
      },
    })
    .catch(() => prisma.mrrv.findFirst({ where: { mrrvNumber: 'MRRV-2026-0001' } }).then(r => r!));

  // MRRV-1 lines
  await prisma.mrrvLine
    .create({
      data: {
        mrrvId: mrrv1.id,
        itemId: items['STL-001'].id,
        uomId: uomKG.id,
        qtyOrdered: 5000,
        qtyReceived: 5000,
        unitCost: 4.5,
        condition: 'good',
        storageLocation: 'A1-01',
      },
    })
    .catch(() => null);
  await prisma.mrrvLine
    .create({
      data: {
        mrrvId: mrrv1.id,
        itemId: items['STL-002'].id,
        uomId: uomKG.id,
        qtyOrdered: 3000,
        qtyReceived: 2950,
        qtyDamaged: 50,
        unitCost: 6.8,
        condition: 'mixed',
        storageLocation: 'A1-03',
      },
    })
    .catch(() => null);

  // MRRV-2: Pending QC, Gulf Electrical -> Riyadh WH
  const mrrv2 = await prisma.mrrv
    .create({
      data: {
        mrrvNumber: 'MRRV-2026-0002',
        supplierId: suppliers['SUP-003'].id,
        poNumber: 'PO-2026-00456',
        warehouseId: warehouses['WH-003'].id,
        projectId: projects['PRJ-003'].id,
        receivedById: empAhmed.id,
        receiveDate: new Date('2026-02-03T10:30:00Z'),
        invoiceNumber: 'INV-GE-2026-1102',
        deliveryNote: 'DN-GE-3350',
        status: 'pending_qc',
        rfimRequired: true,
        qcInspectorId: empSaad.id,
        notes: 'Electrical supplies for Riyadh Metro Line 3 – pending QC inspection',
      },
    })
    .catch(() => prisma.mrrv.findFirst({ where: { mrrvNumber: 'MRRV-2026-0002' } }).then(r => r!));

  await prisma.mrrvLine
    .create({
      data: {
        mrrvId: mrrv2.id,
        itemId: items['ELC-001'].id,
        uomId: uomM.id,
        qtyOrdered: 500,
        qtyReceived: 500,
        unitCost: 28.0,
        condition: 'good',
        storageLocation: 'D1-02',
      },
    })
    .catch(() => null);
  await prisma.mrrvLine
    .create({
      data: {
        mrrvId: mrrv2.id,
        itemId: items['ELC-002'].id,
        uomId: uomEA.id,
        qtyOrdered: 50,
        qtyReceived: 48,
        unitCost: 185.0,
        condition: 'good',
        storageLocation: 'D2-01',
      },
    })
    .catch(() => null);

  // MRRV-3: Stored, Saudi Cement -> Jubail WH
  const mrrv3 = await prisma.mrrv
    .create({
      data: {
        mrrvNumber: 'MRRV-2026-0003',
        supplierId: suppliers['SUP-002'].id,
        poNumber: 'PO-2026-00789',
        warehouseId: warehouses['WH-002'].id,
        projectId: projects['PRJ-002'].id,
        receivedById: empAhmed.id,
        receiveDate: new Date('2026-01-20T07:00:00Z'),
        invoiceNumber: 'INV-SC-2026-0087',
        deliveryNote: 'DN-SC-5501',
        status: 'stored',
        qcInspectorId: empSaad.id,
        qcApprovedDate: new Date('2026-01-21T14:00:00Z'),
        totalValue: 54000,
        notes: 'Cement delivery for Jubail Industrial Expansion – QC passed, stored',
      },
    })
    .catch(() => prisma.mrrv.findFirst({ where: { mrrvNumber: 'MRRV-2026-0003' } }).then(r => r!));

  await prisma.mrrvLine
    .create({
      data: {
        mrrvId: mrrv3.id,
        itemId: items['CEM-001'].id,
        uomId: uomBAG.id,
        qtyOrdered: 3000,
        qtyReceived: 3000,
        unitCost: 18.0,
        condition: 'good',
        storageLocation: 'B1-01',
      },
    })
    .catch(() => null);

  console.log('    3 MRRV documents with lines');

  // ── 7. MIRV Documents (2) ─────────────────────────────────────────────
  console.log('  Creating MIRV documents ...');

  // MIRV-1: Draft, NEOM Bay -> Dammam WH
  const mirv1 = await prisma.mirv
    .create({
      data: {
        mirvNumber: 'MIRV-2026-0001',
        projectId: projects['PRJ-001'].id,
        warehouseId: warehouses['WH-001'].id,
        requestedById: empKhalid.id,
        requestDate: new Date('2026-02-05T09:00:00Z'),
        requiredDate: new Date('2026-02-10'),
        priority: 'urgent',
        status: 'draft',
        locationOfWork: 'NEOM Bay – Sector A1, Foundation Zone',
        notes: 'Urgent steel and safety materials for NEOM Bay foundation works',
      },
    })
    .catch(() => prisma.mirv.findFirst({ where: { mirvNumber: 'MIRV-2026-0001' } }).then(r => r!));

  await prisma.mirvLine
    .create({
      data: {
        mirvId: mirv1.id,
        itemId: items['STL-001'].id,
        qtyRequested: 2000,
        unitCost: 4.5,
        storageLocation: 'A1-01',
      },
    })
    .catch(() => null);
  await prisma.mirvLine
    .create({
      data: {
        mirvId: mirv1.id,
        itemId: items['SAF-001'].id,
        qtyRequested: 100,
        unitCost: 45.0,
        storageLocation: 'E1-01',
      },
    })
    .catch(() => null);
  await prisma.mirvLine
    .create({
      data: {
        mirvId: mirv1.id,
        itemId: items['SAF-003'].id,
        qtyRequested: 50,
        unitCost: 180.0,
        storageLocation: 'E2-01',
      },
    })
    .catch(() => null);

  // MIRV-2: Approved, Jubail Industrial -> Jubail WH
  const mirv2 = await prisma.mirv
    .create({
      data: {
        mirvNumber: 'MIRV-2026-0002',
        projectId: projects['PRJ-002'].id,
        warehouseId: warehouses['WH-002'].id,
        requestedById: empKhalid.id,
        requestDate: new Date('2026-01-28T11:00:00Z'),
        requiredDate: new Date('2026-02-02'),
        priority: 'normal',
        status: 'approved',
        approvedById: empAbdulrahman.id,
        approvedDate: new Date('2026-01-29T09:00:00Z'),
        estimatedValue: 9750,
        locationOfWork: 'Jubail Industrial City – Sector C Pipeline Corridor',
        notes: 'Piping and welding materials for pipeline extension',
      },
    })
    .catch(() => prisma.mirv.findFirst({ where: { mirvNumber: 'MIRV-2026-0002' } }).then(r => r!));

  await prisma.mirvLine
    .create({
      data: {
        mirvId: mirv2.id,
        itemId: items['PIP-001'].id,
        qtyRequested: 50,
        qtyApproved: 50,
        unitCost: 145.0,
        storageLocation: 'C1-02',
      },
    })
    .catch(() => null);
  await prisma.mirvLine
    .create({
      data: {
        mirvId: mirv2.id,
        itemId: items['CON-003'].id,
        qtyRequested: 100,
        qtyApproved: 100,
        unitCost: 12.5,
        storageLocation: 'G3-02',
      },
    })
    .catch(() => null);

  console.log('    2 MIRV documents with lines');

  // ── 8. Job Order (1) ──────────────────────────────────────────────────
  console.log('  Creating job order ...');

  const jo1 = await prisma.jobOrder
    .create({
      data: {
        joNumber: 'JO-2026-0001',
        joType: 'transport',
        entityId: entity.id,
        projectId: projects['PRJ-001'].id,
        supplierId: suppliers['SUP-008'].id,
        requestedById: empMohammed.id,
        requestDate: new Date('2026-02-04T07:30:00Z'),
        requiredDate: new Date('2026-02-08'),
        status: 'approved',
        priority: 'high',
        description:
          'Transport steel rebar and cement from Dammam Main Warehouse to NEOM Project Yard for Phase 1 foundation works',
        totalAmount: 12500,
        startDate: new Date('2026-02-06T06:00:00Z'),
      },
    })
    .catch(() => prisma.jobOrder.findFirst({ where: { joNumber: 'JO-2026-0001' } }).then(r => r!));

  // Transport details
  await prisma.joTransportDetail
    .create({
      data: {
        jobOrderId: jo1.id,
        pickupLocation: 'Dammam Main Warehouse, Industrial Area 2, Dammam',
        pickupContactName: 'Ahmed Hassan',
        pickupContactPhone: '+966138200100',
        deliveryLocation: 'NEOM Bay Logistics Zone, Sector A1, NEOM',
        deliveryContactName: 'Mohammed Ali',
        deliveryContactPhone: '+966144100300',
        cargoType: 'Steel Rebar & Cement Bags',
        cargoWeightTons: 42.5,
        numberOfTrailers: 3,
        numberOfTrips: 1,
        insuranceRequired: true,
        materialPriceSar: 78500,
      },
    })
    .catch(() => null);

  console.log('    1 job order (transport) with details');

  // ── Done ───────────────────────────────────────────────────────────────
  console.log('\nOperational seed data completed successfully.');
}

main()
  .catch(e => {
    console.error('Seed-data failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
