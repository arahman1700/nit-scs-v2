import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedSemanticLayer } from './seed-semantic-layer.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding NIT WMS database...\n');

  // ── Regions ──────────────────────────────────────────────────────────
  const regions = await Promise.all([
    prisma.region.upsert({
      where: { regionName: 'Riyadh' },
      update: {},
      create: { regionName: 'Riyadh' },
    }),
    prisma.region.upsert({
      where: { regionName: 'Makkah' },
      update: {},
      create: { regionName: 'Makkah' },
    }),
    prisma.region.upsert({
      where: { regionName: 'Eastern Province' },
      update: {},
      create: { regionName: 'Eastern Province' },
    }),
    prisma.region.upsert({
      where: { regionName: 'Madinah' },
      update: {},
      create: { regionName: 'Madinah' },
    }),
    prisma.region.upsert({
      where: { regionName: 'Asir' },
      update: {},
      create: { regionName: 'Asir' },
    }),
    prisma.region.upsert({
      where: { regionName: 'Tabuk' },
      update: {},
      create: { regionName: 'Tabuk' },
    }),
    prisma.region.upsert({
      where: { regionName: 'Jazan' },
      update: {},
      create: { regionName: 'Jazan' },
    }),
  ]);
  console.log(`  Regions: ${regions.length}`);

  // ── Cities ───────────────────────────────────────────────────────────
  const cityData = [
    { cityName: 'Riyadh', region: 'Riyadh' },
    { cityName: 'Jeddah', region: 'Makkah' },
    { cityName: 'Makkah', region: 'Makkah' },
    { cityName: 'Dammam', region: 'Eastern Province' },
    { cityName: 'Jubail', region: 'Eastern Province' },
    { cityName: 'Yanbu', region: 'Madinah' },
    { cityName: 'Tabuk', region: 'Tabuk' },
    { cityName: 'NEOM', region: 'Tabuk' },
    { cityName: 'Abha', region: 'Asir' },
  ];
  const cities = [];
  for (const c of cityData) {
    const region = regions.find(r => r.regionName === c.region)!;
    cities.push(
      await prisma.city
        .create({
          data: { cityName: c.cityName, regionId: region.id },
        })
        .catch(() => prisma.city.findFirst({ where: { cityName: c.cityName } }).then(r => r!)),
    );
  }
  console.log(`  Cities: ${cities.length}`);

  // ── Ports ────────────────────────────────────────────────────────────
  const portData = [
    { portName: 'Jeddah Islamic Port', portCode: 'SAJED', portType: 'sea', city: 'Jeddah' },
    { portName: 'King Abdulaziz Port - Dammam', portCode: 'SADMM', portType: 'sea', city: 'Dammam' },
    { portName: 'Jubail Commercial Port', portCode: 'SAJUB', portType: 'sea', city: 'Jubail' },
    { portName: 'Yanbu Commercial Port', portCode: 'SAYNB', portType: 'sea', city: 'Yanbu' },
    { portName: 'King Khalid International Airport', portCode: 'RUH', portType: 'air', city: 'Riyadh' },
    { portName: 'King Abdulaziz International Airport', portCode: 'JED', portType: 'air', city: 'Jeddah' },
  ];
  for (const p of portData) {
    const city = cities.find(c => c!.cityName === p.city);
    await prisma.port
      .create({
        data: { portName: p.portName, portCode: p.portCode, portType: p.portType, cityId: city?.id },
      })
      .catch(() => null);
  }
  console.log(`  Ports: ${portData.length}`);

  // ── Units of Measure ─────────────────────────────────────────────────
  const uoms = [
    { uomCode: 'EA', uomName: 'Each', category: 'count' },
    { uomCode: 'KG', uomName: 'Kilogram', category: 'weight' },
    { uomCode: 'TON', uomName: 'Metric Ton', category: 'weight' },
    { uomCode: 'M', uomName: 'Meter', category: 'length' },
    { uomCode: 'M2', uomName: 'Square Meter', category: 'area' },
    { uomCode: 'M3', uomName: 'Cubic Meter', category: 'volume' },
    { uomCode: 'L', uomName: 'Liter', category: 'volume' },
    { uomCode: 'BOX', uomName: 'Box', category: 'package' },
    { uomCode: 'SET', uomName: 'Set', category: 'count' },
    { uomCode: 'ROLL', uomName: 'Roll', category: 'count' },
    { uomCode: 'BAG', uomName: 'Bag', category: 'package' },
    { uomCode: 'SHEET', uomName: 'Sheet', category: 'count' },
    { uomCode: 'DRUM', uomName: 'Drum', category: 'package' },
    { uomCode: 'PALLET', uomName: 'Pallet', category: 'package' },
    { uomCode: 'FT', uomName: 'Foot', category: 'length' },
  ];
  for (const u of uoms) {
    await prisma.unitOfMeasure.upsert({ where: { uomCode: u.uomCode }, update: {}, create: u })
      .catch((e: unknown) => console.error(`  UOM ${u.uomCode} failed:`, e));
  }
  console.log(`  UOMs: ${uoms.length}`);

  // ── Warehouse Types ──────────────────────────────────────────────────
  const warehouseTypes = [
    { typeName: 'Main Warehouse', description: 'Central warehouse facility' },
    { typeName: 'Site Warehouse', description: 'Project site storage' },
    { typeName: 'Transit Warehouse', description: 'Temporary transit storage' },
    { typeName: 'Cold Storage', description: 'Temperature-controlled storage' },
    { typeName: 'Open Yard', description: 'Outdoor storage area' },
  ];
  for (const wt of warehouseTypes) {
    await prisma.warehouseType.create({ data: wt }).catch(() => null);
  }
  console.log(`  Warehouse Types: ${warehouseTypes.length}`);

  // ── Equipment Categories + Types ─────────────────────────────────────
  const equipCategories = [
    { categoryName: 'Heavy Equipment' },
    { categoryName: 'Vehicles' },
    { categoryName: 'Generators' },
    { categoryName: 'Small Tools' },
  ];
  const createdCategories = [];
  for (const ec of equipCategories) {
    createdCategories.push(
      await prisma.equipmentCategory
        .create({ data: ec })
        .catch(() => prisma.equipmentCategory.findFirst({ where: { categoryName: ec.categoryName } }).then(r => r!)),
    );
  }
  console.log(`  Equipment Categories: ${createdCategories.length}`);

  const equipTypes = [
    { typeName: 'Crane', category: 'Heavy Equipment' },
    { typeName: 'Excavator', category: 'Heavy Equipment' },
    { typeName: 'Forklift', category: 'Heavy Equipment' },
    { typeName: 'Flatbed Truck', category: 'Vehicles' },
    { typeName: 'Pickup Truck', category: 'Vehicles' },
    { typeName: 'Water Tanker', category: 'Vehicles' },
    { typeName: 'Diesel Generator', category: 'Generators' },
  ];
  for (const et of equipTypes) {
    const cat = createdCategories.find(c => c!.categoryName === et.category);
    await prisma.equipmentType
      .create({
        data: { typeName: et.typeName, categoryId: cat?.id },
      })
      .catch(() => null);
  }
  console.log(`  Equipment Types: ${equipTypes.length}`);

  // ── Approval Workflows ───────────────────────────────────────────────
  const approvalWorkflows = [
    { documentType: 'mirv', minAmount: 0, maxAmount: 10000, approverRole: 'warehouse_staff', slaHours: 4 },
    { documentType: 'mirv', minAmount: 10000, maxAmount: 50000, approverRole: 'logistics_coordinator', slaHours: 8 },
    { documentType: 'mirv', minAmount: 50000, maxAmount: 100000, approverRole: 'manager', slaHours: 24 },
    { documentType: 'mirv', minAmount: 100000, maxAmount: 500000, approverRole: 'manager', slaHours: 48 },
    { documentType: 'mirv', minAmount: 500000, maxAmount: 999999999, approverRole: 'admin', slaHours: 72 },
    { documentType: 'jo', minAmount: 0, maxAmount: 5000, approverRole: 'logistics_coordinator', slaHours: 4 },
    { documentType: 'jo', minAmount: 5000, maxAmount: 20000, approverRole: 'manager', slaHours: 8 },
    { documentType: 'jo', minAmount: 20000, maxAmount: 100000, approverRole: 'manager', slaHours: 24 },
    { documentType: 'jo', minAmount: 100000, maxAmount: 999999999, approverRole: 'admin', slaHours: 48 },
  ];
  for (const aw of approvalWorkflows) {
    await prisma.approvalWorkflow.create({ data: aw }).catch(() => null);
  }
  console.log(`  Approval Workflows: ${approvalWorkflows.length}`);

  // ── Entity ───────────────────────────────────────────────────────────
  const entity = await prisma.entity.upsert({
    where: { entityCode: 'NIT' },
    update: {},
    create: {
      entityCode: 'NIT',
      entityName: 'Nesma Infrastructure & Technology',
      status: 'active',
    },
  });
  console.log(`  Entity: ${entity.entityName}`);

  // ── Document Counters ────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const docTypes = ['mrrv', 'mirv', 'mrv', 'rfim', 'osd', 'jo', 'gp', 'mrf', 'st', 'sh', 'lot', 'lo'];
  const prefixes = ['MRRV', 'MIRV', 'MRV', 'RFIM', 'OSD', 'JO', 'GP', 'MRF', 'ST', 'SH', 'LOT', 'LO'];
  for (let i = 0; i < docTypes.length; i++) {
    await prisma.documentCounter
      .create({
        data: { documentType: docTypes[i], prefix: prefixes[i], year, lastNumber: 0 },
      })
      .catch(() => null);
  }
  console.log(`  Document Counters: ${docTypes.length}`);

  // ── Admin User ───────────────────────────────────────────────────────
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2026!';
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('  [WARN] No SEED_ADMIN_PASSWORD env var set — using default "Admin@2026!". Change after first login.');
  }
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const admin = await prisma.employee.upsert({
    where: { email: 'admin@nit.sa' },
    update: { passwordHash },
    create: {
      employeeIdNumber: 'EMP-001',
      fullName: 'System Administrator',
      email: 'admin@nit.sa',
      phone: '+966500000001',
      department: 'admin',
      role: 'Admin',
      systemRole: 'admin',
      isActive: true,
      passwordHash,
    },
  });
  console.log(`  Admin User: ${admin.email}`);

  // ── Sample Employees ─────────────────────────────────────────────────
  const sampleEmployees = [
    { id: 'EMP-002', name: 'Ahmed Hassan', email: 'ahmed@nit.sa', dept: 'warehouse', role: 'Warehouse Staff', sysRole: 'warehouse_staff' },
    { id: 'EMP-003', name: 'Mohammed Ali', email: 'mohammed@nit.sa', dept: 'transport', role: 'Transport Staff', sysRole: 'logistics_coordinator' },
    { id: 'EMP-004', name: 'Khalid Omar', email: 'khalid@nit.sa', dept: 'projects', role: 'Engineer', sysRole: 'site_engineer' },
    { id: 'EMP-005', name: 'Saad Ibrahim', email: 'saad@nit.sa', dept: 'quality', role: 'QC Officer', sysRole: 'qc_officer' },
    { id: 'EMP-006', name: 'Abdulrahman Hussein', email: 'abdulrahman@nit.sa', dept: 'logistics', role: 'Manager', sysRole: 'manager' },
    { id: 'EMP-007', name: 'Fahad Al-Otaibi', email: 'fahad@nit.sa', dept: 'transport', role: 'Transport Supervisor', sysRole: 'transport_supervisor' },
    { id: 'EMP-008', name: 'Nasser Al-Qahtani', email: 'nasser@nit.sa', dept: 'warehouse', role: 'Scrap Committee Member', sysRole: 'scrap_committee_member' },
  ];
  for (const emp of sampleEmployees) {
    await prisma.employee
      .create({
        data: {
          employeeIdNumber: emp.id,
          fullName: emp.name,
          email: emp.email,
          department: emp.dept,
          role: emp.role,
          systemRole: emp.sysRole,
          isActive: true,
          passwordHash,
        },
      })
      .catch(() => null);
  }
  console.log(`  Sample Employees: ${sampleEmployees.length}`);

  // ── Default Warehouse + Zones ─────────────────────────────────────────
  const mainWhType = await prisma.warehouseType.findFirst({ where: { typeName: 'Main Warehouse' } });
  const riyadhRegion = regions.find(r => r.regionName === 'Riyadh')!;

  if (mainWhType) {
    const warehouse = await prisma.warehouse
      .create({
        data: {
          warehouseCode: 'WH-MAIN',
          warehouseName: 'NIT Main Warehouse',
          warehouseTypeId: mainWhType.id,
          regionId: riyadhRegion.id,
          status: 'active',
        },
      })
      .catch(() => prisma.warehouse.findFirst({ where: { warehouseCode: 'WH-MAIN' } }).then(r => r!));

    if (warehouse) {
      const defaultZones = [
        { zoneCode: 'A', zoneName: 'Zone A - Civil', zoneType: 'civil' },
        { zoneCode: 'B', zoneName: 'Zone B - Mechanical', zoneType: 'mechanical' },
        { zoneCode: 'C', zoneName: 'Zone C - Electrical', zoneType: 'electrical' },
        { zoneCode: 'CONTAINER', zoneName: 'Container Storage', zoneType: 'container' },
        { zoneCode: 'OPEN_YARD', zoneName: 'Open Yard', zoneType: 'open_yard' },
        { zoneCode: 'HAZARDOUS', zoneName: 'Hazardous Materials', zoneType: 'hazardous' },
      ];
      for (const z of defaultZones) {
        await prisma.warehouseZone
          .create({
            data: {
              warehouseId: warehouse.id,
              zoneCode: z.zoneCode,
              zoneName: z.zoneName,
              zoneType: z.zoneType,
            },
          })
          .catch(() => null);
      }
      console.log(`  Warehouse Zones: ${defaultZones.length} (in ${warehouse.warehouseName})`);
    }
  }

  // ── Role Permissions (seed from ROLE_PERMISSIONS defaults) ──────────
  const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
    admin: {
      grn: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      mi: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      mrn: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      qci: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      dr: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      jo: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      gatepass: ['create', 'read', 'update', 'delete', 'export'],
      wt: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      mr: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      shipment: ['create', 'read', 'update', 'delete', 'export'],
      customs: ['create', 'read', 'update', 'delete', 'export'],
      inventory: ['read', 'update', 'export'],
      items: ['create', 'read', 'update', 'delete', 'export'],
      projects: ['create', 'read', 'update', 'delete', 'export'],
      suppliers: ['create', 'read', 'update', 'delete', 'export'],
      employees: ['create', 'read', 'update', 'delete', 'export'],
      warehouses: ['create', 'read', 'update', 'delete', 'export'],
      generators: ['create', 'read', 'update', 'delete', 'export'],
      fleet: ['create', 'read', 'update', 'delete', 'export'],
      reports: ['read', 'export'],
      'audit-log': ['read', 'export'],
      settings: ['read', 'update'],
      roles: ['read', 'update'],
      imsf: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      surplus: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      scrap: ['create', 'read', 'update', 'delete', 'approve', 'export'],
      ssc: ['create', 'read', 'update', 'approve'],
      rental_contract: ['create', 'read', 'update', 'delete', 'approve'],
      tool: ['create', 'read', 'update', 'delete'],
      tool_issue: ['create', 'read', 'update'],
      bin_card: ['read', 'update'],
      generator_fuel: ['create', 'read'],
      generator_maintenance: ['create', 'read', 'update'],
      warehouse_zone: ['create', 'read', 'update', 'delete'],
    },
    manager: {
      grn: ['read', 'approve', 'export'],
      mi: ['read', 'approve', 'export'],
      mrn: ['read', 'approve', 'export'],
      qci: ['read', 'approve', 'export'],
      dr: ['read', 'export'],
      jo: ['create', 'read', 'approve', 'export'],
      gatepass: ['read', 'export'],
      wt: ['read', 'approve', 'export'],
      mr: ['read', 'approve', 'export'],
      shipment: ['read', 'export'],
      customs: ['read', 'export'],
      inventory: ['read', 'export'],
      items: ['read', 'export'],
      projects: ['read', 'export'],
      suppliers: ['read', 'export'],
      employees: ['read', 'export'],
      warehouses: ['read', 'export'],
      reports: ['read', 'export'],
    },
    warehouse_supervisor: {
      grn: ['create', 'read', 'update', 'approve'],
      mi: ['read', 'update', 'approve'],
      mrn: ['create', 'read', 'update'],
      qci: ['create', 'read'],
      dr: ['create', 'read', 'update'],
      gatepass: ['create', 'read', 'update'],
      wt: ['create', 'read', 'update'],
      inventory: ['read', 'update', 'export'],
      items: ['read', 'update'],
      projects: ['read'],
      warehouses: ['read'],
      imsf: ['create', 'read', 'update'],
      surplus: ['create', 'read', 'update'],
      scrap: ['create', 'read'],
      bin_card: ['read', 'update'],
      warehouse_zone: ['read'],
      tool: ['read', 'update'],
      tool_issue: ['create', 'read', 'update'],
    },
    warehouse_staff: {
      grn: ['create', 'read', 'update'],
      mi: ['read', 'update'],
      mrn: ['create', 'read', 'update'],
      qci: ['create', 'read'],
      dr: ['create', 'read'],
      gatepass: ['create', 'read', 'update'],
      wt: ['create', 'read'],
      inventory: ['read', 'update'],
      items: ['read'],
      projects: ['read'],
      imsf: ['read'],
      bin_card: ['read', 'update'],
      tool_issue: ['create', 'read'],
    },
    logistics_coordinator: {
      grn: ['create', 'read', 'update'],
      mi: ['create', 'read', 'update', 'approve'],
      mrn: ['create', 'read', 'update'],
      jo: ['create', 'read', 'update', 'approve'],
      shipment: ['create', 'read', 'update'],
      customs: ['create', 'read', 'update'],
      gatepass: ['create', 'read', 'update'],
      wt: ['create', 'read', 'update'],
      inventory: ['read', 'export'],
      suppliers: ['read'],
      imsf: ['create', 'read', 'update'],
      rental_contract: ['read'],
      generator_fuel: ['create', 'read'],
      generator_maintenance: ['read'],
    },
    site_engineer: {
      mi: ['create', 'read'],
      mr: ['create', 'read'],
      jo: ['create', 'read'],
      inventory: ['read'],
      projects: ['read'],
    },
    qc_officer: {
      qci: ['create', 'read', 'update', 'approve'],
      dr: ['create', 'read', 'update'],
      grn: ['read'],
      inventory: ['read'],
      scrap: ['read', 'approve'],
      surplus: ['read'],
    },
    freight_forwarder: {
      shipment: ['read', 'update'],
      customs: ['read'],
      gatepass: ['read'],
    },
    transport_supervisor: {
      jo: ['create', 'read', 'update', 'approve'],
      gatepass: ['create', 'read', 'update'],
      wt: ['create', 'read', 'update', 'approve'],
      imsf: ['create', 'read', 'update'],
      mr: ['read'],
      mi: ['read'],
      grn: ['read'],
      inventory: ['read'],
      fleet: ['read', 'update'],
      generators: ['read'],
      shipment: ['read'],
    },
    scrap_committee_member: {
      scrap: ['read', 'approve'],
      ssc: ['create', 'read', 'update', 'approve'],
      surplus: ['read'],
      inventory: ['read'],
    },
  };

  let permCount = 0;
  for (const [role, resources] of Object.entries(ROLE_PERMISSIONS)) {
    for (const [resource, actions] of Object.entries(resources)) {
      await prisma.rolePermission
        .upsert({
          where: { role_resource: { role, resource } },
          update: { actions },
          create: { role, resource, actions },
        })
        .catch(() => null);
      permCount++;
    }
  }
  console.log(`  Role Permissions: ${permCount}`);

  // ── Build UOM ID lookup (UOMs already seeded above) ─────────────────
  const uomIdMap: Record<string, string> = {};
  const allUoms = await prisma.unitOfMeasure.findMany();
  for (const u of allUoms) {
    uomIdMap[u.uomCode] = u.id;
  }

  // ── Suppliers ───────────────────────────────────────────────────────
  const supplierData = [
    { supplierCode: 'SUP-001', supplierName: 'Al-Rajhi Steel', types: ['materials'], contactPerson: 'Faisal Al-Rajhi', phone: '+966501234567', email: 'faisal@alrajhisteel.sa', status: 'active' as const },
    { supplierCode: 'SUP-002', supplierName: 'Saudi Cables Co', types: ['electrical'], contactPerson: 'Omar Saudi', phone: '+966509876543', email: 'omar@saudicables.sa', status: 'active' as const },
    { supplierCode: 'SUP-003', supplierName: 'Gulf Safety Equipment', types: ['safety'], contactPerson: 'Tariq Gulf', phone: '+966507771234', email: 'tariq@gulfsafety.sa', status: 'active' as const },
  ];
  for (const s of supplierData) {
    await prisma.supplier.upsert({ where: { supplierCode: s.supplierCode }, update: {}, create: s });
  }
  console.log(`  Suppliers: ${supplierData.length}`);

  // ── Projects ────────────────────────────────────────────────────────
  const projectData = [
    { projectCode: 'PRJ-001', projectName: 'NEOM Infrastructure Phase 1', client: 'NEOM', status: 'active' as const, projectManagerId: admin.id },
    { projectCode: 'PRJ-002', projectName: 'Riyadh Metro Station 7', client: 'RDA', status: 'active' as const, projectManagerId: admin.id },
    { projectCode: 'PRJ-003', projectName: 'Jeddah Tower Utilities', client: 'JEC', status: 'active' as const, projectManagerId: admin.id },
  ];
  for (const p of projectData) {
    await prisma.project.upsert({ where: { projectCode: p.projectCode }, update: {}, create: p });
  }
  console.log(`  Projects: ${projectData.length}`);

  // ── Items ───────────────────────────────────────────────────────────
  const itemData = [
    { itemCode: 'STL-001', itemDescription: 'Steel Rebar 12mm', category: 'construction' as const, uomId: uomIdMap.KG, minStock: 500, standardCost: 3.5 },
    { itemCode: 'STL-002', itemDescription: 'Steel Plate 6mm', category: 'construction' as const, uomId: uomIdMap.KG, minStock: 200, standardCost: 4.2 },
    { itemCode: 'ELC-001', itemDescription: 'Power Cable 3x2.5mm', category: 'electrical' as const, uomId: uomIdMap.M, minStock: 1000, standardCost: 8.5 },
    { itemCode: 'ELC-002', itemDescription: 'Circuit Breaker 32A', category: 'electrical' as const, uomId: uomIdMap.EA, minStock: 50, standardCost: 45 },
    { itemCode: 'MEC-001', itemDescription: 'Pipe Fitting 2 inch', category: 'mechanical' as const, uomId: uomIdMap.EA, minStock: 100, standardCost: 12 },
    { itemCode: 'SAF-001', itemDescription: 'Safety Helmet', category: 'safety' as const, uomId: uomIdMap.EA, minStock: 200, standardCost: 25 },
    { itemCode: 'SAF-002', itemDescription: 'Safety Vest Hi-Vis', category: 'safety' as const, uomId: uomIdMap.EA, minStock: 150, standardCost: 18 },
    { itemCode: 'CON-001', itemDescription: 'Cement Portland 50kg', category: 'consumables' as const, uomId: uomIdMap.BAG, minStock: 300, standardCost: 22 },
    { itemCode: 'TOL-001', itemDescription: 'Drill Bit Set HSS', category: 'tools' as const, uomId: uomIdMap.SET, minStock: 20, standardCost: 85 },
    { itemCode: 'SPR-001', itemDescription: 'Generator Oil Filter', category: 'spare_parts' as const, uomId: uomIdMap.EA, minStock: 30, standardCost: 35 },
  ];
  for (const item of itemData) {
    if (!item.uomId) { console.warn(`  Skipping item ${item.itemCode}: no UOM ID`); continue; }
    await prisma.item.upsert({ where: { itemCode: item.itemCode }, update: {}, create: item })
      .catch((e: unknown) => console.error(`  Item ${item.itemCode} failed:`, e));
  }
  console.log(`  Items: ${itemData.length}`);

  // ── Semantic Analytics Layer ─────────────────────────────────────────
  await seedSemanticLayer(prisma);

  console.log('\nSeed completed successfully.');
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
