/**
 * Job Registry — shared registry for scheduled background jobs.
 *
 * Domain modules import `registerJob` and call it at module load time.
 * The scheduler orchestrator imports these domain modules, then iterates
 * `getAllJobs()` to start each job loop.
 */

import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';

export interface ScheduledJob {
  name: string;
  intervalMs: number;
  lockTtlSec: number;
  handler: (ctx: JobContext) => Promise<void>;
}

export interface JobContext {
  prisma: PrismaClient;
  io: SocketIOServer | null;
  log: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) => void;
  notifySla: (params: {
    recipientIds: string[];
    title: string;
    body: string;
    notificationType: string;
    referenceTable: string;
    referenceId: string;
    socketEvent: string;
    socketRoles: string[];
  }) => Promise<void>;
  getAdminIds: () => Promise<string[]>;
  getEmployeeIdsByRole: (role: string) => Promise<string[]>;
  getRecentNotificationRefs: (
    referenceTable: string,
    referenceIds: string[],
    titleFragment: string,
    now: Date,
  ) => Promise<Set<string>>;
  hasRecentNotification: (
    referenceTable: string,
    referenceId: string,
    titleFragment: string,
    now: Date,
  ) => Promise<boolean>;
  refreshSlaConfig: () => Promise<void>;
  getDelegate: (modelName: string) => PrismaDelegate;
  slaHoursToMs: (hours: number) => number;
  _computeSlaDeadline: (referenceDate: Date | string, slaKey: string) => Date | null;
  getSlaConfig: () => Record<string, number>;
  createNotification: (
    data: {
      recipientId: string;
      title: string;
      body: string;
      notificationType: string;
      referenceTable?: string;
      referenceId?: string;
    },
    io?: SocketIOServer,
  ) => Promise<unknown>;
}

/** Prisma delegate type for dynamic model access */
export type PrismaDelegate = {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
};

const jobs: ScheduledJob[] = [];

export function registerJob(job: ScheduledJob): void {
  jobs.push(job);
}

export function getAllJobs(): ScheduledJob[] {
  return [...jobs];
}

/**
 * Clear all registered jobs. Used primarily in tests to reset state
 * between test runs when using vi.resetModules().
 */
export function clearJobs(): void {
  jobs.length = 0;
}
