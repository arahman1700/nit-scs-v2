import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface DockDoorCreateDto {
  warehouseId: string;
  doorNumber: string;
  doorType: 'inbound' | 'outbound' | 'both';
  status?: string;
}

export interface DockDoorUpdateDto {
  doorType?: string;
  status?: string;
}

export interface AppointmentCreateDto {
  warehouseId: string;
  dockDoorId?: string;
  appointmentType: 'delivery' | 'pickup' | 'transfer';
  scheduledStart: string;
  scheduledEnd: string;
  carrierName?: string;
  driverName?: string;
  vehiclePlate?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

export interface TruckCheckInDto {
  warehouseId: string;
  vehiclePlate: string;
  driverName?: string;
  carrierName?: string;
  purpose: 'delivery' | 'pickup' | 'transfer';
  notes?: string;
}

export interface ListParams {
  page: number;
  pageSize: number;
  warehouseId?: string;
  status?: string;
  search?: string;
}

// ── Includes ─────────────────────────────────────────────────────────────

const DOCK_DOOR_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
} as const;

const APPOINTMENT_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  dockDoor: { select: { id: true, doorNumber: true, doorType: true, status: true } },
} as const;

const TRUCK_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  dockDoor: { select: { id: true, doorNumber: true, doorType: true } },
} as const;

// ############################################################################
// DOCK DOORS
// ############################################################################

export async function listDockDoors(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.status) where.status = params.status;
  if (params.search) {
    where.doorNumber = { contains: params.search, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    prisma.dockDoor.findMany({
      where,
      orderBy: { doorNumber: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: DOCK_DOOR_INCLUDE,
    }),
    prisma.dockDoor.count({ where }),
  ]);

  return { data, total };
}

export async function getDockDoor(id: string) {
  return prisma.dockDoor.findUniqueOrThrow({
    where: { id },
    include: {
      ...DOCK_DOOR_INCLUDE,
      appointments: {
        where: { status: { in: ['scheduled', 'checked_in', 'loading'] } },
        orderBy: { scheduledStart: 'asc' },
        take: 5,
      },
      truckVisits: {
        where: { status: { in: ['in_yard', 'at_dock'] } },
        orderBy: { checkInAt: 'desc' },
        take: 5,
      },
    },
  });
}

export async function createDockDoor(data: DockDoorCreateDto) {
  const dockDoor = await prisma.dockDoor.create({
    data: {
      warehouseId: data.warehouseId,
      doorNumber: data.doorNumber,
      doorType: data.doorType,
      status: data.status ?? 'available',
    },
    include: DOCK_DOOR_INCLUDE,
  });

  log('info', `[Yard] Created dock door ${data.doorNumber} at warehouse ${data.warehouseId}`);
  return dockDoor;
}

export async function updateDockDoor(id: string, data: DockDoorUpdateDto) {
  const updated = await prisma.dockDoor.update({
    where: { id },
    data,
    include: DOCK_DOOR_INCLUDE,
  });

  log('info', `[Yard] Updated dock door ${id}`);
  return updated;
}

export async function deleteDockDoor(id: string) {
  await prisma.dockDoor.delete({ where: { id } });
  log('info', `[Yard] Deleted dock door ${id}`);
}

export async function getAvailableDockDoors(warehouseId: string, doorType?: string) {
  const where: Record<string, unknown> = {
    warehouseId,
    status: 'available',
  };
  if (doorType) where.doorType = { in: [doorType, 'both'] };

  return prisma.dockDoor.findMany({
    where,
    orderBy: { doorNumber: 'asc' },
  });
}

// ############################################################################
// YARD APPOINTMENTS
// ############################################################################

export async function listAppointments(params: ListParams & { date?: string }) {
  const where: Record<string, unknown> = {};
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.status) where.status = params.status;
  if (params.date) {
    const dayStart = new Date(params.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(params.date);
    dayEnd.setHours(23, 59, 59, 999);
    where.scheduledStart = { gte: dayStart, lte: dayEnd };
  }
  if (params.search) {
    where.OR = [
      { carrierName: { contains: params.search, mode: 'insensitive' } },
      { vehiclePlate: { contains: params.search, mode: 'insensitive' } },
      { driverName: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.yardAppointment.findMany({
      where,
      orderBy: { scheduledStart: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: APPOINTMENT_INCLUDE,
    }),
    prisma.yardAppointment.count({ where }),
  ]);

  return { data, total };
}

export async function getAppointment(id: string) {
  return prisma.yardAppointment.findUniqueOrThrow({
    where: { id },
    include: APPOINTMENT_INCLUDE,
  });
}

export async function createAppointment(data: AppointmentCreateDto) {
  // Check for scheduling conflicts on the same dock door
  if (data.dockDoorId) {
    const conflict = await prisma.yardAppointment.findFirst({
      where: {
        dockDoorId: data.dockDoorId,
        status: { in: ['scheduled', 'checked_in', 'loading'] },
        OR: [
          {
            scheduledStart: { lte: new Date(data.scheduledEnd) },
            scheduledEnd: { gte: new Date(data.scheduledStart) },
          },
        ],
      },
    });

    if (conflict) {
      throw new Error(
        `Dock door is already booked from ${conflict.scheduledStart.toISOString()} to ${conflict.scheduledEnd.toISOString()}`,
      );
    }
  }

  const appointment = await prisma.yardAppointment.create({
    data: {
      warehouseId: data.warehouseId,
      dockDoorId: data.dockDoorId ?? null,
      appointmentType: data.appointmentType,
      scheduledStart: new Date(data.scheduledStart),
      scheduledEnd: new Date(data.scheduledEnd),
      carrierName: data.carrierName ?? null,
      driverName: data.driverName ?? null,
      vehiclePlate: data.vehiclePlate ?? null,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      notes: data.notes ?? null,
    },
    include: APPOINTMENT_INCLUDE,
  });

  log(
    'info',
    `[Yard] Created appointment ${appointment.id} (${data.appointmentType}) at warehouse ${data.warehouseId}`,
  );
  return appointment;
}

export async function checkInAppointment(id: string) {
  const appt = await prisma.yardAppointment.findUniqueOrThrow({ where: { id } });

  if (appt.status !== 'scheduled') {
    throw new Error(`Cannot check in appointment with status: ${appt.status}`);
  }

  // If dock door is assigned, mark it occupied
  if (appt.dockDoorId) {
    await prisma.dockDoor.update({
      where: { id: appt.dockDoorId },
      data: { status: 'occupied' },
    });
  }

  const updated = await prisma.yardAppointment.update({
    where: { id },
    data: { status: 'checked_in' },
    include: APPOINTMENT_INCLUDE,
  });

  log('info', `[Yard] Appointment ${id} checked in`);
  return updated;
}

export async function completeAppointment(id: string) {
  const appt = await prisma.yardAppointment.findUniqueOrThrow({ where: { id } });

  const validStatuses = ['checked_in', 'loading'];
  if (!validStatuses.includes(appt.status)) {
    throw new Error(`Cannot complete appointment with status: ${appt.status}`);
  }

  // Free up the dock door
  if (appt.dockDoorId) {
    await prisma.dockDoor.update({
      where: { id: appt.dockDoorId },
      data: { status: 'available' },
    });
  }

  const updated = await prisma.yardAppointment.update({
    where: { id },
    data: { status: 'completed' },
    include: APPOINTMENT_INCLUDE,
  });

  log('info', `[Yard] Appointment ${id} completed`);
  return updated;
}

export async function cancelAppointment(id: string) {
  const appt = await prisma.yardAppointment.findUniqueOrThrow({ where: { id } });

  if (['completed', 'cancelled'].includes(appt.status)) {
    throw new Error(`Cannot cancel appointment with status: ${appt.status}`);
  }

  // Free dock door if assigned
  if (appt.dockDoorId && appt.status !== 'scheduled') {
    await prisma.dockDoor.update({
      where: { id: appt.dockDoorId },
      data: { status: 'available' },
    });
  }

  const updated = await prisma.yardAppointment.update({
    where: { id },
    data: { status: 'cancelled' },
    include: APPOINTMENT_INCLUDE,
  });

  log('info', `[Yard] Appointment ${id} cancelled`);
  return updated;
}

// ############################################################################
// TRUCK VISITS
// ############################################################################

export async function listTruckVisits(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.status) where.status = params.status;
  if (params.search) {
    where.OR = [
      { vehiclePlate: { contains: params.search, mode: 'insensitive' } },
      { driverName: { contains: params.search, mode: 'insensitive' } },
      { carrierName: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.truckVisit.findMany({
      where,
      orderBy: { checkInAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: TRUCK_INCLUDE,
    }),
    prisma.truckVisit.count({ where }),
  ]);

  return { data, total };
}

export async function checkInTruck(data: TruckCheckInDto) {
  const truck = await prisma.truckVisit.create({
    data: {
      warehouseId: data.warehouseId,
      vehiclePlate: data.vehiclePlate,
      driverName: data.driverName ?? null,
      carrierName: data.carrierName ?? null,
      purpose: data.purpose,
      notes: data.notes ?? null,
    },
    include: TRUCK_INCLUDE,
  });

  log('info', `[Yard] Truck ${data.vehiclePlate} checked in at warehouse ${data.warehouseId}`);
  return truck;
}

export async function assignDock(truckId: string, dockDoorId: string) {
  const truck = await prisma.truckVisit.findUniqueOrThrow({ where: { id: truckId } });

  if (truck.status !== 'in_yard') {
    throw new Error(`Cannot assign dock to truck with status: ${truck.status}`);
  }

  // Check dock is available
  const dockDoor = await prisma.dockDoor.findUniqueOrThrow({ where: { id: dockDoorId } });
  if (dockDoor.status !== 'available') {
    throw new Error(`Dock door ${dockDoor.doorNumber} is not available (status: ${dockDoor.status})`);
  }

  // Mark dock as occupied
  await prisma.dockDoor.update({
    where: { id: dockDoorId },
    data: { status: 'occupied' },
  });

  // Free previous dock if any
  if (truck.dockDoorId) {
    await prisma.dockDoor.update({
      where: { id: truck.dockDoorId },
      data: { status: 'available' },
    });
  }

  const updated = await prisma.truckVisit.update({
    where: { id: truckId },
    data: { dockDoorId, status: 'at_dock' },
    include: TRUCK_INCLUDE,
  });

  log('info', `[Yard] Truck ${truck.vehiclePlate} assigned to dock ${dockDoor.doorNumber}`);
  return updated;
}

export async function checkOutTruck(truckId: string) {
  const truck = await prisma.truckVisit.findUniqueOrThrow({ where: { id: truckId } });

  if (truck.status === 'departed') {
    throw new Error('Truck has already departed');
  }

  // Free dock door if assigned
  if (truck.dockDoorId) {
    await prisma.dockDoor.update({
      where: { id: truck.dockDoorId },
      data: { status: 'available' },
    });
  }

  const updated = await prisma.truckVisit.update({
    where: { id: truckId },
    data: { status: 'departed', checkOutAt: new Date() },
    include: TRUCK_INCLUDE,
  });

  log('info', `[Yard] Truck ${truck.vehiclePlate} checked out`);
  return updated;
}

// ############################################################################
// YARD STATUS & UTILIZATION
// ############################################################################

export async function getYardStatus(warehouseId: string) {
  const [dockDoors, activeTrucks, todayAppointments] = await Promise.all([
    prisma.dockDoor.findMany({
      where: { warehouseId },
      orderBy: { doorNumber: 'asc' },
      include: {
        truckVisits: {
          where: { status: 'at_dock' },
          take: 1,
          select: { id: true, vehiclePlate: true, driverName: true, checkInAt: true },
        },
      },
    }),
    prisma.truckVisit.findMany({
      where: { warehouseId, status: { in: ['in_yard', 'at_dock'] } },
      orderBy: { checkInAt: 'desc' },
      include: TRUCK_INCLUDE,
    }),
    (() => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      return prisma.yardAppointment.findMany({
        where: {
          warehouseId,
          scheduledStart: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { scheduledStart: 'asc' },
        include: APPOINTMENT_INCLUDE,
      });
    })(),
  ]);

  const totalDocks = dockDoors.length;
  const occupiedDocks = dockDoors.filter(d => d.status === 'occupied').length;
  const availableDocks = dockDoors.filter(d => d.status === 'available').length;
  const maintenanceDocks = dockDoors.filter(d => d.status === 'maintenance').length;

  return {
    dockDoors,
    activeTrucks,
    todayAppointments,
    summary: {
      totalDocks,
      occupiedDocks,
      availableDocks,
      maintenanceDocks,
      trucksInYard: activeTrucks.length,
      appointmentsToday: todayAppointments.length,
      upcomingAppointments: todayAppointments.filter(a => a.status === 'scheduled').length,
    },
  };
}

export async function getDockUtilization(warehouseId: string, date: string) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [dockDoors, appointments, truckVisits] = await Promise.all([
    prisma.dockDoor.findMany({
      where: { warehouseId },
      select: { id: true, doorNumber: true, doorType: true, status: true },
    }),
    prisma.yardAppointment.findMany({
      where: {
        warehouseId,
        scheduledStart: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        dockDoorId: true,
        appointmentType: true,
        scheduledStart: true,
        scheduledEnd: true,
        status: true,
      },
    }),
    prisma.truckVisit.findMany({
      where: {
        warehouseId,
        checkInAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        dockDoorId: true,
        checkInAt: true,
        checkOutAt: true,
        status: true,
        purpose: true,
      },
    }),
  ]);

  // Calculate per-dock metrics
  const dockMetrics = dockDoors.map(dock => {
    const dockAppointments = appointments.filter(a => a.dockDoorId === dock.id);
    const dockVisits = truckVisits.filter(v => v.dockDoorId === dock.id);
    const completedVisits = dockVisits.filter(v => v.checkOutAt);

    // Average dwell time in minutes
    const dwellTimes = completedVisits
      .map(v => (v.checkOutAt!.getTime() - v.checkInAt.getTime()) / 60000)
      .filter(t => t > 0);
    const avgDwellMinutes =
      dwellTimes.length > 0 ? Math.round(dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length) : 0;

    return {
      ...dock,
      appointmentCount: dockAppointments.length,
      visitCount: dockVisits.length,
      completedCount: completedVisits.length,
      avgDwellMinutes,
    };
  });

  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(a => a.status === 'completed').length;
  const cancelledAppointments = appointments.filter(a => a.status === 'cancelled').length;
  const noShowAppointments = appointments.filter(a => a.status === 'no_show').length;

  return {
    date,
    dockMetrics,
    summary: {
      totalDocks: dockDoors.length,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      totalTruckVisits: truckVisits.length,
      utilizationRate: dockDoors.length > 0 ? Math.round((appointments.length / (dockDoors.length * 8)) * 100) : 0,
    },
  };
}
