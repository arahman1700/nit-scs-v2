# Phase 1: Critical Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 critical issues: SSRF vulnerability, JSON validation gaps, race conditions, migration setup, CHECK constraints, and Prisma enums.

**Architecture:** All fixes are backend-only. C5/C6 are additive (new validation code). C4 modifies the document factory pattern. C1-C3 are database/schema changes.

**Tech Stack:** Express 5, Prisma 6, Zod, PostgreSQL

---

## Task 1: C5 - Fix SSRF Vulnerability in Webhook Handler

**Files:**
- Create: `packages/backend/src/utils/url-validator.ts`
- Modify: `packages/backend/src/events/action-handlers.ts:407-428`
- Test: `packages/backend/src/utils/url-validator.test.ts`

### Implementation

Create URL validation utility that blocks private IPs and restricts schemes, then integrate into webhook handler.

---

## Task 2: C6 - Add Zod Validation for Critical JSON Fields

**Files:**
- Create: `packages/backend/src/schemas/json-field-schemas.ts`
- Modify: `packages/backend/src/domains/workflow/schemas/workflow.schema.ts:37` (add conditional_branch)
- Modify: `packages/backend/src/domains/auth/routes/permissions.routes.ts` (replace Array.isArray with Zod)
- Modify: `packages/backend/src/events/rule-engine.ts` (add runtime validation)

### Implementation

Create centralized Zod schemas for all JSON fields, add validation to routes and rule engine.

---

## Task 3: C4 - Race Condition Protection in Document Status Transitions

**Files:**
- Modify: `packages/backend/src/utils/document-factory.ts:233-265`

### Implementation

Use Prisma `updateMany` with WHERE status clause to ensure atomic status transitions.

---

## Task 4: C1 - Switch to Prisma Migrations

**Files:**
- Modify: `packages/backend/prisma/schema/00-generators.prisma` (add prismaSchemaFolder)
- Create: `packages/backend/prisma/migrations/` (baseline migration)
- Modify: `packages/backend/start.sh`
- Modify: `packages/backend/package.json`

### Implementation

Baseline existing schema, switch deployment from `db push` to `migrate deploy`.

---

## Task 5: C2 - Add CHECK Constraints via SQL Migration

**Files:**
- Create: migration SQL file with 103 CHECK constraints across 56 tables

---

## Task 6: C3 - Convert Critical Fields to Prisma Enums

**Files:**
- Modify: Multiple `.prisma` schema files
- Create: Migration for data conversion

---
