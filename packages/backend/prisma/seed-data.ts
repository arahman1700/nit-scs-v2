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
      supplierNameAr: 'صناعات الراجحي للحديد',
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
      supplierNameAr: 'الشركة السعودية للأسمنت',
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
      supplierNameAr: 'مستلزمات الخليج الكهربائية',
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
      supplierNameAr: 'شركة الأنابيب الوطنية',
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
      supplierNameAr: 'المراعي للمستلزمات الصناعية',
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
      supplierNameAr: 'شركة حسن لمعدات السلامة',
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
      supplierNameAr: 'بن لادن لمواد البناء',
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
      supplierNameAr: 'شركة نسمة التجارية',
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
      projectNameAr: 'خليج نيوم المرحلة الأولى',
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
      projectNameAr: 'توسعة الجبيل الصناعية',
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
      projectNameAr: 'مترو الرياض الخط الثالث',
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
      projectNameAr: 'أعمال أساسات برج جدة',
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
      projectNameAr: 'مزرعة تبوك الشمسية',
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
      warehouseNameAr: 'المستودع الرئيسي بالدمام',
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
      warehouseNameAr: 'مخزن موقع الجبيل',
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
      warehouseNameAr: 'مركز التوزيع بالرياض',
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
      warehouseNameAr: 'ساحة مشروع نيوم',
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
      descAr: 'حديد تسليح ١٢ مم',
      cat: 'construction',
      uomId: uomKG.id,
      cost: 4.5,
      barcode: '6280001000011',
      reorder: 1000,
    },
    {
      code: 'STL-002',
      desc: 'Steel Plate 10mm',
      descAr: 'لوح حديد ١٠ مم',
      cat: 'construction',
      uomId: uomKG.id,
      cost: 6.8,
      barcode: '6280001000028',
      reorder: 500,
    },
    {
      code: 'CEM-001',
      desc: 'Portland Cement 50kg Bag',
      descAr: 'أسمنت بورتلاندي ٥٠ كجم',
      cat: 'construction',
      uomId: uomBAG.id,
      cost: 18.0,
      barcode: '6280001000035',
      reorder: 200,
    },
    {
      code: 'PIP-001',
      desc: 'GRP Pipe 200mm',
      descAr: 'أنبوب GRP ٢٠٠ مم',
      cat: 'mechanical',
      uomId: uomM.id,
      cost: 145.0,
      barcode: '6280001000042',
      reorder: 50,
    },
    {
      code: 'PIP-002',
      desc: 'PVC Pipe 110mm',
      descAr: 'أنبوب PVC ١١٠ مم',
      cat: 'mechanical',
      uomId: uomM.id,
      cost: 32.5,
      barcode: '6280001000059',
      reorder: 100,
    },
    {
      code: 'ELC-001',
      desc: 'Cable 4x16mm2 XLPE',
      descAr: 'كابل ٤×١٦ مم مربع',
      cat: 'electrical',
      uomId: uomM.id,
      cost: 28.0,
      barcode: '6280001000066',
      reorder: 200,
    },
    {
      code: 'ELC-002',
      desc: 'Circuit Breaker 63A 3P',
      descAr: 'قاطع دائرة ٦٣ أمبير',
      cat: 'electrical',
      uomId: uomEA.id,
      cost: 185.0,
      barcode: '6280001000073',
      reorder: 30,
    },
    {
      code: 'ELC-003',
      desc: 'LED Flood Light 200W IP65',
      descAr: 'كشاف LED ٢٠٠ واط',
      cat: 'electrical',
      uomId: uomEA.id,
      cost: 320.0,
      barcode: '6280001000080',
      reorder: 25,
    },
    {
      code: 'SAF-001',
      desc: 'Safety Helmet EN397',
      descAr: 'خوذة سلامة EN397',
      cat: 'safety',
      uomId: uomEA.id,
      cost: 45.0,
      barcode: '6280001000097',
      reorder: 100,
    },
    {
      code: 'SAF-002',
      desc: 'Safety Vest Hi-Vis',
      descAr: 'سترة سلامة عاكسة',
      cat: 'safety',
      uomId: uomEA.id,
      cost: 25.0,
      barcode: '6280001000103',
      reorder: 150,
    },
    {
      code: 'SAF-003',
      desc: 'Safety Boots Steel-Toe',
      descAr: 'حذاء سلامة برأس حديد',
      cat: 'safety',
      uomId: uomEA.id,
      cost: 180.0,
      barcode: '6280001000110',
      reorder: 80,
    },
    {
      code: 'TOL-001',
      desc: 'Drill Machine Bosch GBH 2-26',
      descAr: 'مثقاب بوش GBH 2-26',
      cat: 'tools',
      uomId: uomEA.id,
      cost: 850.0,
      barcode: '6280001000127',
      reorder: 10,
    },
    {
      code: 'TOL-002',
      desc: 'Welding Machine 300A MIG',
      descAr: 'ماكينة لحام ٣٠٠ أمبير',
      cat: 'tools',
      uomId: uomEA.id,
      cost: 2500.0,
      barcode: '6280001000134',
      reorder: 5,
    },
    {
      code: 'CON-001',
      desc: 'Diesel Fuel (EN 590)',
      descAr: 'وقود ديزل',
      cat: 'consumables',
      uomId: uomL.id,
      cost: 2.18,
      barcode: '6280001000141',
      reorder: 2000,
    },
    {
      code: 'CON-002',
      desc: 'Lubricant Oil 20L Drum',
      descAr: 'زيت تشحيم ٢٠ لتر',
      cat: 'consumables',
      uomId: uomDRUM.id,
      cost: 145.0,
      barcode: '6280001000158',
      reorder: 20,
    },
    {
      code: 'SPR-001',
      desc: 'Bearing SKF 6205-2RS',
      descAr: 'محمل SKF 6205',
      cat: 'spare_parts',
      uomId: uomEA.id,
      cost: 38.0,
      barcode: '6280001000165',
      reorder: 50,
    },
    {
      code: 'SPR-002',
      desc: 'V-Belt B65',
      descAr: 'سير V مقاس B65',
      cat: 'spare_parts',
      uomId: uomEA.id,
      cost: 22.0,
      barcode: '6280001000172',
      reorder: 60,
    },
    {
      code: 'CON-003',
      desc: 'Welding Rod E6013 2.5mm',
      descAr: 'سلك لحام ٢.٥ مم',
      cat: 'consumables',
      uomId: uomKG.id,
      cost: 12.5,
      barcode: '6280001000189',
      reorder: 100,
    },
    {
      code: 'STL-003',
      desc: 'Wire Mesh 4mm 2x3m',
      descAr: 'شبك حديد ٤ مم',
      cat: 'construction',
      uomId: uomM2.id,
      cost: 35.0,
      barcode: '6280001000196',
      reorder: 200,
    },
    {
      code: 'ELC-004',
      desc: 'Distribution Panel 12-Way',
      descAr: 'لوحة توزيع ١٢ مخرج',
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
          itemDescriptionAr: i.descAr,
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

  // ── 9. RFIM / QCI Documents (3) ─────────────────────────────────────
  console.log('  Creating RFIM (QCI) documents ...');

  // QCI-1: Completed pass for MRRV-3 (cement delivery)
  await prisma.rfim
    .create({
      data: {
        rfimNumber: 'RFIM-2026-0001',
        mrrvId: mrrv3.id,
        inspectorId: empSaad.id,
        requestDate: new Date('2026-01-20T10:00:00Z'),
        inspectionDate: new Date('2026-01-21T09:00:00Z'),
        result: 'pass',
        comments: 'Cement bags in good condition, moisture level within acceptable range. All 3,000 bags verified.',
        status: 'completed',
      },
    })
    .catch(() => null);

  // QCI-2: In progress for MRRV-2 (electrical supplies)
  await prisma.rfim
    .create({
      data: {
        rfimNumber: 'RFIM-2026-0002',
        mrrvId: mrrv2.id,
        inspectorId: empSaad.id,
        requestDate: new Date('2026-02-03T14:00:00Z'),
        status: 'in_progress',
        comments: 'Inspecting cable insulation resistance and breaker specifications',
      },
    })
    .catch(() => null);

  // QCI-3: Completed conditional for MRRV-1 (steel delivery)
  await prisma.rfim
    .create({
      data: {
        rfimNumber: 'RFIM-2026-0003',
        mrrvId: mrrv1.id,
        inspectorId: empSaad.id,
        requestDate: new Date('2026-02-01T14:00:00Z'),
        inspectionDate: new Date('2026-02-02T11:00:00Z'),
        result: 'conditional',
        comments: 'Steel rebar passed. Steel plate batch has 50 KG damaged – surface rust. Recommend partial acceptance.',
        status: 'completed',
        pmApprovalRequired: true,
        pmApprovalById: empAbdulrahman.id,
        pmApprovalDate: new Date('2026-02-02T15:00:00Z'),
      },
    })
    .catch(() => null);

  console.log('    3 RFIM (QCI) documents');

  // ── 10. OSD / DR Documents (2) ──────────────────────────────────────
  console.log('  Creating OSD (DR) documents ...');

  // DR-1: Short shipment for MRRV-2
  const osd1 = await prisma.osdReport
    .create({
      data: {
        osdNumber: 'OSD-2026-0001',
        mrrvId: mrrv2.id,
        poNumber: 'PO-2026-00456',
        supplierId: suppliers['SUP-003'].id,
        warehouseId: warehouses['WH-003'].id,
        reportDate: new Date('2026-02-03'),
        reportTypes: ['short'],
        status: 'claim_sent',
        totalShortValue: 370,
        claimSentDate: new Date('2026-02-04'),
        claimReference: 'CLM-GE-2026-0012',
      },
    })
    .catch(() => prisma.osdReport.findFirst({ where: { osdNumber: 'OSD-2026-0001' } }).then(r => r!));

  await prisma.osdLine
    .create({
      data: {
        osdId: osd1.id,
        itemId: items['ELC-002'].id,
        uomId: uomEA.id,
        qtyInvoice: 50,
        qtyReceived: 48,
        unitCost: 185,
        notes: '2 circuit breakers missing from shipment',
      },
    })
    .catch(() => null);

  // DR-2: Damage report for MRRV-1
  const osd2 = await prisma.osdReport
    .create({
      data: {
        osdNumber: 'OSD-2026-0002',
        mrrvId: mrrv1.id,
        poNumber: 'PO-2026-00123',
        supplierId: suppliers['SUP-001'].id,
        warehouseId: warehouses['WH-001'].id,
        reportDate: new Date('2026-02-01'),
        reportTypes: ['damage'],
        status: 'resolved',
        totalDamageValue: 340,
        claimSentDate: new Date('2026-02-02'),
        claimReference: 'CLM-ARS-2026-0055',
        supplierResponse: 'Accepted. Credit note CN-ARS-2026-0078 issued for damaged steel plates.',
        responseDate: new Date('2026-02-05'),
        resolutionType: 'credit_note',
        resolutionAmount: 340,
        resolutionDate: new Date('2026-02-06'),
        resolvedById: empAbdulrahman.id,
      },
    })
    .catch(() => prisma.osdReport.findFirst({ where: { osdNumber: 'OSD-2026-0002' } }).then(r => r!));

  await prisma.osdLine
    .create({
      data: {
        osdId: osd2.id,
        itemId: items['STL-002'].id,
        uomId: uomKG.id,
        qtyInvoice: 3000,
        qtyReceived: 2950,
        qtyDamaged: 50,
        damageType: 'physical',
        unitCost: 6.8,
        notes: 'Surface rust on 50 KG of steel plates – transport moisture damage',
      },
    })
    .catch(() => null);

  console.log('    2 OSD (DR) documents with lines');

  // ── 11. MRV / MRN Documents (2) ─────────────────────────────────────
  console.log('  Creating MRV (MRN) documents ...');

  // MRN-1: Return to warehouse (good condition)
  const mrv1 = await prisma.mrv
    .create({
      data: {
        mrvNumber: 'MRV-2026-0001',
        returnType: 'return_to_warehouse',
        projectId: projects['PRJ-002'].id,
        fromWarehouseId: warehouses['WH-002'].id,
        toWarehouseId: warehouses['WH-001'].id,
        returnedById: empKhalid.id,
        returnDate: new Date('2026-02-06T08:00:00Z'),
        reason: 'Excess piping material after pipeline installation complete in Sector C',
        status: 'completed',
        receivedById: empAhmed.id,
        receivedDate: new Date('2026-02-06T14:00:00Z'),
        notes: 'Material in good condition, returned to main warehouse stock',
      },
    })
    .catch(() => prisma.mrv.findFirst({ where: { mrvNumber: 'MRV-2026-0001' } }).then(r => r!));

  await prisma.mrvLine
    .create({
      data: {
        mrvId: mrv1.id,
        itemId: items['PIP-001'].id,
        qtyReturned: 25,
        uomId: uomM.id,
        condition: 'good',
        notes: 'Unused GRP pipe sections – original packaging intact',
      },
    })
    .catch(() => null);
  await prisma.mrvLine
    .create({
      data: {
        mrvId: mrv1.id,
        itemId: items['CON-003'].id,
        qtyReturned: 40,
        uomId: uomKG.id,
        condition: 'good',
        notes: 'Sealed welding rod boxes',
      },
    })
    .catch(() => null);

  // MRN-2: Return used tools (damaged condition)
  const mrv2 = await prisma.mrv
    .create({
      data: {
        mrvNumber: 'MRV-2026-0002',
        returnType: 'return_to_warehouse',
        projectId: projects['PRJ-003'].id,
        toWarehouseId: warehouses['WH-003'].id,
        returnedById: empKhalid.id,
        returnDate: new Date('2026-02-08T10:00:00Z'),
        reason: 'Safety equipment replacement cycle – returning used items for inspection',
        status: 'pending',
        notes: 'Used PPE from metro construction site – needs QC inspection before re-issue',
      },
    })
    .catch(() => prisma.mrv.findFirst({ where: { mrvNumber: 'MRV-2026-0002' } }).then(r => r!));

  await prisma.mrvLine
    .create({
      data: {
        mrvId: mrv2.id,
        itemId: items['SAF-001'].id,
        qtyReturned: 30,
        uomId: uomEA.id,
        condition: 'used',
        notes: 'Helmets with minor scratches – still serviceable',
      },
    })
    .catch(() => null);
  await prisma.mrvLine
    .create({
      data: {
        mrvId: mrv2.id,
        itemId: items['SAF-003'].id,
        qtyReturned: 15,
        uomId: uomEA.id,
        condition: 'damaged',
        notes: 'Steel-toe boots with worn soles – recommend disposal',
      },
    })
    .catch(() => null);

  console.log('    2 MRV (MRN) documents with lines');

  // ── 12. MRF / MR Documents (2) ──────────────────────────────────────
  console.log('  Creating MRF (MR) documents ...');

  // MR-1: Approved, from stock
  const mrf1 = await prisma.materialRequisition
    .create({
      data: {
        mrfNumber: 'MRF-2026-0001',
        requestDate: new Date('2026-02-07T08:00:00Z'),
        requiredDate: new Date('2026-02-12'),
        projectId: projects['PRJ-001'].id,
        department: 'civil',
        requestedById: empKhalid.id,
        deliveryPoint: 'NEOM Bay Sector A1 – Foundation Area',
        workOrder: 'WO-NEOM-FND-001',
        priority: 'high',
        status: 'approved',
        totalEstimatedValue: 82500,
        reviewedById: empAhmed.id,
        reviewDate: new Date('2026-02-07T14:00:00Z'),
        approvedById: empAbdulrahman.id,
        approvalDate: new Date('2026-02-08T09:00:00Z'),
        notes: 'Materials for NEOM Bay foundation concrete pour scheduled Feb 15',
      },
    })
    .catch(() => prisma.materialRequisition.findFirst({ where: { mrfNumber: 'MRF-2026-0001' } }).then(r => r!));

  await prisma.mrfLine
    .create({
      data: {
        mrfId: mrf1.id,
        itemId: items['STL-001'].id,
        qtyRequested: 10000,
        uomId: uomKG.id,
        source: 'from_stock',
        qtyFromStock: 10000,
        unitCost: 4.5,
        notes: 'For rebar cage assembly – foundation zone',
      },
    })
    .catch(() => null);
  await prisma.mrfLine
    .create({
      data: {
        mrfId: mrf1.id,
        itemId: items['CEM-001'].id,
        qtyRequested: 2000,
        uomId: uomBAG.id,
        source: 'from_stock',
        qtyFromStock: 2000,
        unitCost: 18,
        notes: 'Portland cement for concrete mix',
      },
    })
    .catch(() => null);

  // MR-2: Under review, needs purchase
  const mrf2 = await prisma.materialRequisition
    .create({
      data: {
        mrfNumber: 'MRF-2026-0002',
        requestDate: new Date('2026-02-10T09:00:00Z'),
        requiredDate: new Date('2026-02-20'),
        projectId: projects['PRJ-003'].id,
        department: 'electrical',
        requestedById: empKhalid.id,
        deliveryPoint: 'Riyadh Metro – Station 7 Electrical Room',
        drawingReference: 'DWG-RM-ELC-S7-001',
        priority: 'medium',
        status: 'under_review',
        totalEstimatedValue: 38500,
        reviewedById: empAhmed.id,
        reviewDate: new Date('2026-02-10T16:00:00Z'),
        notes: 'Electrical materials for Station 7 fit-out – partially from stock',
      },
    })
    .catch(() => prisma.materialRequisition.findFirst({ where: { mrfNumber: 'MRF-2026-0002' } }).then(r => r!));

  await prisma.mrfLine
    .create({
      data: {
        mrfId: mrf2.id,
        itemId: items['ELC-001'].id,
        qtyRequested: 800,
        uomId: uomM.id,
        source: 'both',
        qtyFromStock: 260,
        qtyFromPurchase: 540,
        unitCost: 28,
        notes: 'XLPE cable for main distribution',
      },
    })
    .catch(() => null);
  await prisma.mrfLine
    .create({
      data: {
        mrfId: mrf2.id,
        itemId: items['ELC-004'].id,
        qtyRequested: 12,
        uomId: uomEA.id,
        source: 'purchase_required',
        qtyFromPurchase: 12,
        unitCost: 750,
        notes: '12-way distribution panels for each sub-station',
      },
    })
    .catch(() => null);

  console.log('    2 MRF (MR) documents with lines');

  // ── 13. Gate Passes (3) ─────────────────────────────────────────────
  console.log('  Creating gate passes ...');

  await prisma.gatePass
    .create({
      data: {
        gatePassNumber: 'GP-2026-0001',
        passType: 'outbound',
        mirvId: mirv2.id,
        projectId: projects['PRJ-002'].id,
        warehouseId: warehouses['WH-002'].id,
        vehicleNumber: 'أ ب ج 1234',
        driverName: 'عبدالله سعيد',
        driverIdNumber: '1098765432',
        destination: 'Jubail Industrial City – Sector C Pipeline Corridor',
        purpose: 'Material delivery for approved MI – piping and welding materials',
        issueDate: new Date('2026-01-30T06:00:00Z'),
        validUntil: new Date('2026-01-30T18:00:00Z'),
        status: 'released',
        issuedById: empAhmed.id,
        securityOfficer: 'Hassan Al-Zahrani',
        exitTime: new Date('2026-01-30T06:30:00Z'),
        vehicleType: 'Flatbed Truck',
        notes: 'Carrying 50 M GRP pipe and 100 KG welding rods',
      },
    })
    .catch(() => null);

  await prisma.gatePass
    .create({
      data: {
        gatePassNumber: 'GP-2026-0002',
        passType: 'inbound',
        warehouseId: warehouses['WH-001'].id,
        vehicleNumber: 'ه و ز 5678',
        driverName: 'فيصل الحربي',
        driverIdNumber: '1087654321',
        destination: 'Dammam Main Warehouse – Receiving Bay',
        purpose: 'Steel delivery from Al-Rajhi Steel Industries – PO-2026-00123',
        issueDate: new Date('2026-02-01T07:00:00Z'),
        validUntil: new Date('2026-02-01T12:00:00Z'),
        status: 'returned',
        issuedById: empAhmed.id,
        securityOfficer: 'Mohammed Al-Qahtani',
        exitTime: new Date('2026-02-01T07:15:00Z'),
        returnTime: new Date('2026-02-01T11:00:00Z'),
        vehicleType: 'Heavy Trailer',
        notes: 'Delivered 8 tons steel – MRRV-2026-0001',
      },
    })
    .catch(() => null);

  await prisma.gatePass
    .create({
      data: {
        gatePassNumber: 'GP-2026-0003',
        passType: 'outbound',
        projectId: projects['PRJ-001'].id,
        warehouseId: warehouses['WH-001'].id,
        vehicleNumber: 'د ر س 9012',
        driverName: 'سالم العتيبي',
        destination: 'NEOM Bay Logistics Zone – Sector A1',
        purpose: 'Transport JO-2026-0001 – Steel and cement to NEOM site',
        issueDate: new Date('2026-02-06T05:30:00Z'),
        validUntil: new Date('2026-02-07T23:59:00Z'),
        status: 'approved',
        issuedById: empAhmed.id,
        vehicleType: 'Heavy Trailer',
        notes: '42.5 tons cargo – 3 trailers convoy',
      },
    })
    .catch(() => null);

  console.log('    3 gate passes');

  // ── 14. Stock Transfers / WT (2) ────────────────────────────────────
  console.log('  Creating stock transfers ...');

  const st1 = await prisma.stockTransfer
    .create({
      data: {
        transferNumber: 'ST-2026-0001',
        transferType: 'warehouse_to_warehouse',
        fromWarehouseId: warehouses['WH-001'].id,
        toWarehouseId: warehouses['WH-003'].id,
        requestedById: empAbdulrahman.id,
        transferDate: new Date('2026-02-09T08:00:00Z'),
        status: 'completed',
        shippedDate: new Date('2026-02-09T10:00:00Z'),
        receivedDate: new Date('2026-02-10T09:00:00Z'),
        notes: 'Replenishment of Riyadh Distribution Center – safety equipment stock low',
      },
    })
    .catch(() => prisma.stockTransfer.findFirst({ where: { transferNumber: 'ST-2026-0001' } }).then(r => r!));

  await prisma.stockTransferLine.create({ data: { transferId: st1.id, itemId: items['SAF-001'].id, quantity: 100, uomId: uomEA.id, condition: 'good' } }).catch(() => null);
  await prisma.stockTransferLine.create({ data: { transferId: st1.id, itemId: items['SAF-002'].id, quantity: 200, uomId: uomEA.id, condition: 'good' } }).catch(() => null);
  await prisma.stockTransferLine.create({ data: { transferId: st1.id, itemId: items['SAF-003'].id, quantity: 50, uomId: uomEA.id, condition: 'good' } }).catch(() => null);

  const st2 = await prisma.stockTransfer
    .create({
      data: {
        transferNumber: 'ST-2026-0002',
        transferType: 'warehouse_to_project',
        fromWarehouseId: warehouses['WH-001'].id,
        toWarehouseId: warehouses['WH-004'].id,
        toProjectId: projects['PRJ-001'].id,
        requestedById: empMohammed.id,
        transferDate: new Date('2026-02-11T07:00:00Z'),
        status: 'shipped',
        shippedDate: new Date('2026-02-11T09:00:00Z'),
        transportJoId: jo1.id,
        notes: 'Consumables for NEOM site – diesel and lubricants',
      },
    })
    .catch(() => prisma.stockTransfer.findFirst({ where: { transferNumber: 'ST-2026-0002' } }).then(r => r!));

  await prisma.stockTransferLine.create({ data: { transferId: st2.id, itemId: items['CON-001'].id, quantity: 5000, uomId: uomL.id, condition: 'good' } }).catch(() => null);
  await prisma.stockTransferLine.create({ data: { transferId: st2.id, itemId: items['CON-002'].id, quantity: 10, uomId: uomDRUM.id, condition: 'good' } }).catch(() => null);

  console.log('    2 stock transfers with lines');

  // ── 15. Shipments (2) ───────────────────────────────────────────────
  console.log('  Creating shipments ...');

  const ship1 = await prisma.shipment
    .create({
      data: {
        shipmentNumber: 'SH-2026-0001',
        poNumber: 'PO-2026-01200',
        supplierId: suppliers['SUP-004'].id,
        projectId: projects['PRJ-002'].id,
        originCountry: 'Germany',
        modeOfShipment: 'sea_fcl',
        portOfLoading: 'Hamburg Port, Germany',
        destinationWarehouseId: warehouses['WH-001'].id,
        orderDate: new Date('2025-12-15'),
        expectedShipDate: new Date('2026-01-10'),
        actualShipDate: new Date('2026-01-12'),
        etaPort: new Date('2026-02-15'),
        status: 'in_transit',
        awbBlNumber: 'MAEU-2026-4578901',
        containerNumber: 'MAEU5678901',
        vesselFlight: 'MSC Gulsun – Voyage 2026-W05',
        commercialValue: 285000,
        freightCost: 12500,
        insuranceCost: 2850,
        dutiesEstimated: 14250,
        description: 'Specialized GRP fittings and valves from German manufacturer for Jubail pipeline',
        notes: 'Cargo insured – expected arrival Dammam port mid-Feb',
      },
    })
    .catch(() => prisma.shipment.findFirst({ where: { shipmentNumber: 'SH-2026-0001' } }).then(r => r!));

  await prisma.shipmentLine.create({ data: { shipmentId: ship1.id, itemId: items['PIP-001'].id, description: 'GRP Pipe 200mm (specialized fittings)', quantity: 500, uomId: uomM.id, unitValue: 180, hsCode: '3917.39' } }).catch(() => null);

  const ship2 = await prisma.shipment
    .create({
      data: {
        shipmentNumber: 'SH-2026-0002',
        poNumber: 'PO-2026-01350',
        supplierId: suppliers['SUP-003'].id,
        projectId: projects['PRJ-003'].id,
        originCountry: 'China',
        modeOfShipment: 'air',
        portOfLoading: 'Shanghai Pudong Airport',
        destinationWarehouseId: warehouses['WH-003'].id,
        orderDate: new Date('2026-01-20'),
        expectedShipDate: new Date('2026-02-01'),
        actualShipDate: new Date('2026-02-02'),
        etaPort: new Date('2026-02-04'),
        actualArrivalDate: new Date('2026-02-04'),
        deliveryDate: new Date('2026-02-06'),
        status: 'delivered',
        awbBlNumber: 'SV-2026-8901234',
        vesselFlight: 'SV-869 PVG-RUH',
        commercialValue: 92000,
        freightCost: 4500,
        insuranceCost: 920,
        description: 'LED flood lights and distribution panels for Riyadh Metro stations',
        mrrvId: mrrv2.id,
        notes: 'Air freight – urgent order for metro station electrical fit-out',
      },
    })
    .catch(() => prisma.shipment.findFirst({ where: { shipmentNumber: 'SH-2026-0002' } }).then(r => r!));

  await prisma.shipmentLine.create({ data: { shipmentId: ship2.id, itemId: items['ELC-003'].id, description: 'LED Flood Light 200W IP65', quantity: 120, uomId: uomEA.id, unitValue: 320, hsCode: '9405.42' } }).catch(() => null);
  await prisma.shipmentLine.create({ data: { shipmentId: ship2.id, itemId: items['ELC-004'].id, description: 'Distribution Panel 12-Way 400V', quantity: 40, uomId: uomEA.id, unitValue: 750, hsCode: '8537.10' } }).catch(() => null);

  console.log('    2 shipments with lines');

  // ── 16. More Job Orders (2) ─────────────────────────────────────────
  console.log('  Creating additional job orders ...');

  const empFahad = await employee('fahad@nit.sa');

  // JO-2: Equipment rental
  await prisma.jobOrder
    .create({
      data: {
        joNumber: 'JO-2026-0002',
        joType: 'equipment',
        entityId: entity.id,
        projectId: projects['PRJ-001'].id,
        supplierId: suppliers['SUP-007'].id,
        requestedById: empMohammed.id,
        requestDate: new Date('2026-02-08T08:00:00Z'),
        requiredDate: new Date('2026-02-15'),
        status: 'in_progress',
        priority: 'high',
        description: 'Crane rental for NEOM Bay foundation steel erection – 200T crawler crane with operator',
        totalAmount: 45000,
        startDate: new Date('2026-02-12T06:00:00Z'),
        notes: 'Bin Laden supplying Liebherr LR 1200 crawler crane – 30 day rental',
      },
    })
    .catch(() => null);

  // JO-3: Generator maintenance
  await prisma.jobOrder
    .create({
      data: {
        joNumber: 'JO-2026-0003',
        joType: 'generator_maintenance',
        entityId: entity.id,
        projectId: projects['PRJ-002'].id,
        supplierId: suppliers['SUP-005'].id,
        requestedById: empFahad.id,
        requestDate: new Date('2026-02-10T07:00:00Z'),
        requiredDate: new Date('2026-02-14'),
        status: 'completed',
        priority: 'normal',
        description: 'Scheduled 500-hour maintenance for Jubail site generators – oil change, filter replacement, load test',
        totalAmount: 3500,
        startDate: new Date('2026-02-12T08:00:00Z'),
        completionDate: new Date('2026-02-13T16:00:00Z'),
        notes: 'All 3 generators serviced and load-tested successfully',
      },
    })
    .catch(() => null);

  console.log('    2 additional job orders');

  // ── 17. Generators (3) ──────────────────────────────────────────────
  console.log('  Creating generators ...');

  const gen1 = await prisma.generator
    .create({
      data: {
        generatorCode: 'GEN-001',
        generatorName: 'Caterpillar C15 – 500 KVA',
        capacityKva: 500,
        currentProjectId: projects['PRJ-001'].id,
        currentWarehouseId: warehouses['WH-004'].id,
        status: 'assigned',
        purchaseDate: new Date('2023-06-15'),
        purchaseValue: 185000,
        salvageValue: 25000,
        usefulLifeMonths: 120,
        depreciationMethod: 'straight_line',
        inServiceDate: new Date('2023-07-01'),
        hoursTotal: 4520,
      },
    })
    .catch(() => prisma.generator.findFirst({ where: { generatorCode: 'GEN-001' } }).then(r => r!));

  const gen2 = await prisma.generator
    .create({
      data: {
        generatorCode: 'GEN-002',
        generatorName: 'Cummins QSX15 – 350 KVA',
        capacityKva: 350,
        currentProjectId: projects['PRJ-002'].id,
        currentWarehouseId: warehouses['WH-002'].id,
        status: 'assigned',
        purchaseDate: new Date('2024-01-10'),
        purchaseValue: 145000,
        salvageValue: 20000,
        usefulLifeMonths: 120,
        depreciationMethod: 'straight_line',
        inServiceDate: new Date('2024-02-01'),
        hoursTotal: 2800,
      },
    })
    .catch(() => prisma.generator.findFirst({ where: { generatorCode: 'GEN-002' } }).then(r => r!));

  const gen3 = await prisma.generator
    .create({
      data: {
        generatorCode: 'GEN-003',
        generatorName: 'Perkins 1106 – 150 KVA',
        capacityKva: 150,
        currentWarehouseId: warehouses['WH-001'].id,
        status: 'available',
        purchaseDate: new Date('2024-09-01'),
        purchaseValue: 65000,
        salvageValue: 10000,
        usefulLifeMonths: 120,
        depreciationMethod: 'straight_line',
        inServiceDate: new Date('2024-09-15'),
        hoursTotal: 980,
      },
    })
    .catch(() => prisma.generator.findFirst({ where: { generatorCode: 'GEN-003' } }).then(r => r!));

  console.log('    3 generators');

  // ── 18. Generator Fuel Logs (4) ─────────────────────────────────────
  console.log('  Creating generator fuel logs ...');

  await prisma.generatorFuelLog.create({ data: { generatorId: gen1.id, fuelDate: new Date('2026-02-01'), fuelQtyLiters: 450, meterReading: 4420, fuelSupplier: 'Saudi Aramco', costPerLiter: 2.18, totalCost: 981, loggedById: empMohammed.id } }).catch(() => null);
  await prisma.generatorFuelLog.create({ data: { generatorId: gen1.id, fuelDate: new Date('2026-02-08'), fuelQtyLiters: 480, meterReading: 4520, fuelSupplier: 'Saudi Aramco', costPerLiter: 2.18, totalCost: 1046.4, loggedById: empMohammed.id } }).catch(() => null);
  await prisma.generatorFuelLog.create({ data: { generatorId: gen2.id, fuelDate: new Date('2026-02-03'), fuelQtyLiters: 320, meterReading: 2720, fuelSupplier: 'Saudi Aramco', costPerLiter: 2.18, totalCost: 697.6, loggedById: empAhmed.id } }).catch(() => null);
  await prisma.generatorFuelLog.create({ data: { generatorId: gen2.id, fuelDate: new Date('2026-02-10'), fuelQtyLiters: 350, meterReading: 2800, fuelSupplier: 'Saudi Aramco', costPerLiter: 2.18, totalCost: 763, loggedById: empAhmed.id } }).catch(() => null);

  console.log('    4 fuel logs');

  // ── 19. Generator Maintenance (3) ───────────────────────────────────
  console.log('  Creating generator maintenance records ...');

  await prisma.generatorMaintenance.create({ data: { generatorId: gen1.id, maintenanceType: 'weekly', scheduledDate: new Date('2026-02-05'), completedDate: new Date('2026-02-05T10:00:00Z'), performedById: empFahad.id, status: 'completed', findings: 'Oil level normal, coolant topped up, belts in good condition', cost: 150 } }).catch(() => null);
  await prisma.generatorMaintenance.create({ data: { generatorId: gen2.id, maintenanceType: 'monthly', scheduledDate: new Date('2026-02-12'), completedDate: new Date('2026-02-12T14:00:00Z'), performedById: empFahad.id, status: 'completed', findings: 'Oil and filters changed, air filter replaced, load test passed at 100%', partsReplaced: 'Oil filter, fuel filter, air filter, engine oil 15W-40 (20L)', cost: 1200 } }).catch(() => null);
  await prisma.generatorMaintenance.create({ data: { generatorId: gen3.id, maintenanceType: 'annual', scheduledDate: new Date('2026-03-01'), status: 'scheduled', findings: null, cost: 5000 } }).catch(() => null);

  console.log('    3 maintenance records');

  // ── 20. Tools (5) ───────────────────────────────────────────────────
  console.log('  Creating tools ...');

  const tools: Record<string, { id: string }> = {};
  const toolDefs = [
    { code: 'TL-001', name: 'Bosch GBH 2-26 DFR Rotary Hammer', cat: 'Power Tools', serial: 'BSH-2026-001', whId: warehouses['WH-001'].id },
    { code: 'TL-002', name: 'Hilti TE 60-ATC Hammer Drill', cat: 'Power Tools', serial: 'HLT-2026-002', whId: warehouses['WH-003'].id },
    { code: 'TL-003', name: 'Fluke 376 FC Clamp Meter', cat: 'Testing Equipment', serial: 'FLK-2026-003', whId: warehouses['WH-003'].id },
    { code: 'TL-004', name: 'Topcon RL-H5A Laser Level', cat: 'Survey Equipment', serial: 'TOP-2026-004', whId: warehouses['WH-001'].id },
    { code: 'TL-005', name: 'Lincoln MIG 300i Welder', cat: 'Welding Equipment', serial: 'LNC-2026-005', whId: warehouses['WH-002'].id },
  ];

  for (const t of toolDefs) {
    const created = await prisma.tool
      .create({
        data: {
          toolCode: t.code,
          toolName: t.name,
          category: t.cat,
          serialNumber: t.serial,
          condition: 'good',
          warehouseId: t.whId,
          purchaseDate: new Date('2025-06-15'),
          warrantyExpiry: new Date('2027-06-15'),
        },
      })
      .catch(() => prisma.tool.findFirst({ where: { toolCode: t.code } }).then(r => r!));
    tools[t.code] = created;
  }

  console.log('    5 tools');

  // ── 21. Tool Issues (3) ─────────────────────────────────────────────
  console.log('  Creating tool issues ...');

  await prisma.toolIssue.create({ data: { toolId: tools['TL-001'].id, issuedToId: empKhalid.id, issuedById: empAhmed.id, issuedDate: new Date('2026-02-01T07:00:00Z'), expectedReturnDate: new Date('2026-02-15'), status: 'issued' } }).catch(() => null);
  await prisma.toolIssue.create({ data: { toolId: tools['TL-003'].id, issuedToId: empSaad.id, issuedById: empAhmed.id, issuedDate: new Date('2026-01-25T08:00:00Z'), expectedReturnDate: new Date('2026-02-01'), actualReturnDate: new Date('2026-02-01T16:00:00Z'), returnCondition: 'good', returnVerifiedById: empAhmed.id, status: 'returned' } }).catch(() => null);
  await prisma.toolIssue.create({ data: { toolId: tools['TL-005'].id, issuedToId: empKhalid.id, issuedById: empAhmed.id, issuedDate: new Date('2026-01-20T07:00:00Z'), expectedReturnDate: new Date('2026-02-05'), status: 'overdue' } }).catch(() => null);

  console.log('    3 tool issues');

  // ── 22. Scrap Items (3) ─────────────────────────────────────────────
  console.log('  Creating scrap items ...');

  const empNasser = await employee('nasser@nit.sa');

  await prisma.scrapItem.create({ data: { scrapNumber: 'SCR-2026-0001', projectId: projects['PRJ-004'].id, warehouseId: warehouses['WH-001'].id, materialType: 'steel', description: 'Offcut steel rebar pieces 12mm – various lengths 30cm to 1.5m', qty: 2500, packaging: 'Loose on pallet', condition: 'Rusty surface, structurally sound', estimatedValue: 5000, status: 'in_ssc', siteManagerApproval: true, qcApproval: true, storekeeperApproval: true, createdById: empNasser.id } }).catch(() => null);
  await prisma.scrapItem.create({ data: { scrapNumber: 'SCR-2026-0002', projectId: projects['PRJ-003'].id, warehouseId: warehouses['WH-003'].id, materialType: 'cable', description: 'Damaged XLPE cable 4x16mm2 – water ingress damage', qty: 180, packaging: 'Cable drum', condition: 'Water damaged insulation – not reusable', estimatedValue: 1800, status: 'approved', siteManagerApproval: true, qcApproval: true, createdById: empSaad.id } }).catch(() => null);
  await prisma.scrapItem.create({ data: { scrapNumber: 'SCR-2026-0003', projectId: projects['PRJ-002'].id, materialType: 'wood', description: 'Used formwork timber – multiple uses, split and warped', qty: 4000, packaging: 'Stacked on pallets', condition: 'End of life – 3+ pour cycles', estimatedValue: 2000, status: 'identified', createdById: empAhmed.id } }).catch(() => null);

  console.log('    3 scrap items');

  // ── 23. Surplus Items (2) ───────────────────────────────────────────
  console.log('  Creating surplus items ...');

  await prisma.surplusItem.create({ data: { surplusNumber: 'SUR-2026-0001', itemId: items['PIP-002'].id, warehouseId: warehouses['WH-001'].id, projectId: projects['PRJ-004'].id, qty: 150, condition: 'New – unused', estimatedValue: 4875, disposition: 'transfer', status: 'approved', createdById: empAhmed.id } }).catch(() => null);
  await prisma.surplusItem.create({ data: { surplusNumber: 'SUR-2026-0002', itemId: items['ELC-003'].id, warehouseId: warehouses['WH-003'].id, projectId: projects['PRJ-003'].id, qty: 20, condition: 'New in box', estimatedValue: 6400, disposition: 'retain', status: 'evaluated', createdById: empAbdulrahman.id } }).catch(() => null);

  console.log('    2 surplus items');

  // ── 24. Tasks (6) ───────────────────────────────────────────────────
  console.log('  Creating tasks ...');

  await prisma.task.create({ data: { title: 'Inspect NEOM Bay foundation rebar cages', description: 'Verify rebar spacing and tie-wire connections per DWG-NEOM-FND-RC-001 before concrete pour', status: 'in_progress', priority: 'high', dueDate: new Date('2026-02-14'), assigneeId: empSaad.id, creatorId: empAbdulrahman.id, projectId: projects['PRJ-001'].id, tags: ['quality', 'inspection', 'critical-path'], startedAt: new Date('2026-02-10T08:00:00Z') } }).catch(() => null);
  await prisma.task.create({ data: { title: 'Complete GRN for electrical supplies', description: 'Process MRRV-2026-0002 – circuit breakers and cables for Metro Line 3. QC pending.', status: 'open', priority: 'medium', dueDate: new Date('2026-02-12'), assigneeId: empAhmed.id, creatorId: empAbdulrahman.id, projectId: projects['PRJ-003'].id, tags: ['receiving', 'grn'] } }).catch(() => null);
  await prisma.task.create({ data: { title: 'Arrange transport for NEOM steel delivery', description: 'Coordinate 3-trailer convoy from Dammam to NEOM – JO-2026-0001. Confirm driver assignments.', status: 'completed', priority: 'high', dueDate: new Date('2026-02-06'), assigneeId: empMohammed.id, creatorId: empAbdulrahman.id, projectId: projects['PRJ-001'].id, tags: ['transport', 'logistics'], startedAt: new Date('2026-02-04T07:00:00Z'), completedAt: new Date('2026-02-06T06:00:00Z') } }).catch(() => null);
  await prisma.task.create({ data: { title: 'Perform cycle count – Zone A (Construction)', description: 'Monthly physical inventory count for construction materials in WH-001, Zone A', status: 'open', priority: 'medium', dueDate: new Date('2026-02-15'), assigneeId: empAhmed.id, creatorId: empAbdulrahman.id, tags: ['inventory', 'cycle-count'] } }).catch(() => null);
  await prisma.task.create({ data: { title: 'Follow up DR claim – Gulf Electrical', description: 'OSD-2026-0001 claim sent Feb 4. Follow up on 2 missing circuit breakers.', status: 'in_progress', priority: 'low', dueDate: new Date('2026-02-18'), assigneeId: empAbdulrahman.id, creatorId: empSaad.id, projectId: projects['PRJ-003'].id, tags: ['procurement', 'claim'], startedAt: new Date('2026-02-10T09:00:00Z') } }).catch(() => null);
  await prisma.task.create({ data: { title: 'Process surplus PVC pipes for Tabuk Solar Farm', description: 'Transfer 150 M PVC pipes from WH-001 to Tabuk project – SUR-2026-0001 approved', status: 'open', priority: 'low', dueDate: new Date('2026-02-20'), assigneeId: empMohammed.id, creatorId: empAhmed.id, projectId: projects['PRJ-005'].id, tags: ['surplus', 'transfer'] } }).catch(() => null);

  console.log('    6 tasks');

  // ── 25. Bin Cards & Transactions ────────────────────────────────────
  console.log('  Creating bin cards and transactions ...');

  const binCardDefs: Array<{ itemCode: string; whCode: string; bin: string; qty: number }> = [
    { itemCode: 'STL-001', whCode: 'WH-001', bin: 'A-01-01', qty: 4500 },
    { itemCode: 'STL-002', whCode: 'WH-001', bin: 'A-01-03', qty: 3200 },
    { itemCode: 'CEM-001', whCode: 'WH-001', bin: 'B-01-01', qty: 1800 },
    { itemCode: 'ELC-001', whCode: 'WH-003', bin: 'D-01-02', qty: 260 },
    { itemCode: 'ELC-002', whCode: 'WH-003', bin: 'D-02-01', qty: 120 },
    { itemCode: 'SAF-001', whCode: 'WH-001', bin: 'E-01-01', qty: 450 },
    { itemCode: 'CON-001', whCode: 'WH-001', bin: 'G-01-01', qty: 8500 },
    { itemCode: 'PIP-001', whCode: 'WH-002', bin: 'C-01-02', qty: 180 },
  ];

  for (const bc of binCardDefs) {
    const created = await prisma.binCard
      .create({
        data: {
          itemId: items[bc.itemCode].id,
          warehouseId: warehouses[bc.whCode].id,
          binNumber: bc.bin,
          currentQty: bc.qty,
          lastVerifiedAt: new Date('2026-02-01T08:00:00Z'),
          lastVerifiedById: empAhmed.id,
        },
      })
      .catch(() => prisma.binCard.findFirst({ where: { itemId: items[bc.itemCode].id, warehouseId: warehouses[bc.whCode].id, binNumber: bc.bin } }).then(r => r!));

    // Add a receipt and issue transaction for each bin card
    if (created) {
      await prisma.binCardTransaction.create({
        data: {
          binCardId: created.id,
          transactionType: 'receipt',
          referenceType: 'grn',
          referenceId: mrrv1.id,
          referenceNumber: 'MRRV-2026-0001',
          qtyIn: Math.round(bc.qty * 0.3),
          runningBalance: bc.qty,
          performedById: empAhmed.id,
          performedAt: new Date('2026-02-01T09:00:00Z'),
        },
      }).catch(() => null);

      await prisma.binCardTransaction.create({
        data: {
          binCardId: created.id,
          transactionType: 'issue',
          referenceType: 'mi',
          referenceId: mirv1.id,
          referenceNumber: 'MIRV-2026-0001',
          qtyOut: Math.round(bc.qty * 0.05),
          runningBalance: bc.qty,
          performedById: empAhmed.id,
          performedAt: new Date('2026-02-05T11:00:00Z'),
        },
      }).catch(() => null);
    }
  }

  console.log('    8 bin cards with 16 transactions');

  // ── 26. MIRV-3: Issued (adds a complete cycle for dashboards) ───────
  console.log('  Creating additional MIRV for complete flow ...');

  await prisma.mirv
    .create({
      data: {
        mirvNumber: 'MIRV-2026-0003',
        projectId: projects['PRJ-003'].id,
        warehouseId: warehouses['WH-003'].id,
        requestedById: empKhalid.id,
        requestDate: new Date('2026-02-08T10:00:00Z'),
        requiredDate: new Date('2026-02-10'),
        priority: 'normal',
        status: 'issued',
        approvedById: empAbdulrahman.id,
        approvedDate: new Date('2026-02-08T14:00:00Z'),
        issuedById: empAhmed.id,
        issuedDate: new Date('2026-02-09T08:00:00Z'),
        estimatedValue: 22500,
        locationOfWork: 'Riyadh Metro – Station 7 Construction Zone',
        notes: 'Safety and consumable materials for metro station crew',
      },
    })
    .catch(() => null);

  // Additional MRRV-4 and MRRV-5 for variety
  await prisma.mrrv
    .create({
      data: {
        mrrvNumber: 'MRRV-2026-0004',
        supplierId: suppliers['SUP-006'].id,
        poNumber: 'PO-2026-01100',
        warehouseId: warehouses['WH-003'].id,
        projectId: projects['PRJ-003'].id,
        receivedById: empAhmed.id,
        receiveDate: new Date('2026-02-10T08:00:00Z'),
        invoiceNumber: 'INV-HSE-2026-0220',
        deliveryNote: 'DN-HSE-1150',
        status: 'stored',
        qcInspectorId: empSaad.id,
        qcApprovedDate: new Date('2026-02-10T14:00:00Z'),
        totalValue: 22500,
        notes: 'Safety equipment delivery for Riyadh Metro crew – QC passed',
      },
    })
    .catch(() => null);

  await prisma.mrrv
    .create({
      data: {
        mrrvNumber: 'MRRV-2026-0005',
        supplierId: suppliers['SUP-005'].id,
        poNumber: 'PO-2026-01250',
        warehouseId: warehouses['WH-004'].id,
        projectId: projects['PRJ-001'].id,
        receivedById: empMohammed.id,
        receiveDate: new Date('2026-02-12T07:00:00Z'),
        invoiceNumber: 'INV-MAI-2026-0089',
        deliveryNote: 'DN-MAI-2260',
        status: 'pending_qc',
        rfimRequired: true,
        qcInspectorId: empSaad.id,
        notes: 'Consumables and spare parts for NEOM site equipment maintenance',
      },
    })
    .catch(() => null);

  console.log('    1 additional MIRV + 2 additional MRRV documents');

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
