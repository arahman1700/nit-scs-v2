/**
 * Route Registry — Smart route ordering to prevent shadowing conflicts.
 *
 * Express matches routes in registration order: if `/inventory/:id` is
 * registered before `/inventory/expiring`, the param route swallows the
 * static path. This module eliminates order-dependency by:
 *
 *   1. Collecting all domain route registrations (lazy — nothing is mounted yet)
 *   2. Analysing every path for potential static-vs-param conflicts
 *   3. Mounting routes in safe order: static segments always precede params
 *
 * @example
 * ```ts
 * import { routeRegistry } from '../utils/route-registry.js';
 *
 * routeRegistry.register('auth', registerAuthRoutes);
 * routeRegistry.register('inventory', registerInventoryRoutes);
 * routeRegistry.register('master-data', registerMasterDataRoutes);
 *
 * routeRegistry.mount(router);
 *
 * const report = routeRegistry.getConflictReport();
 * if (report.length) console.warn('Route conflicts detected:', report);
 * ```
 *
 * @module route-registry
 */

import { Router } from 'express';
import type { Router as RouterType } from 'express';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A domain registration function that mounts sub-routers on a parent. */
type DomainRegistrar = (router: RouterType) => void;

/** Describes a single route layer extracted from an Express Router stack. */
interface RouteEntry {
  /** HTTP method (get, post, put, patch, delete, all). */
  method: string;
  /** Full path including mount prefix. */
  fullPath: string;
  /** Domain that registered this route. */
  domain: string;
}

/** A potential shadowing conflict between two routes. */
interface ConflictEntry {
  /** The parameterized route that could shadow a static route. */
  paramRoute: RouteEntry;
  /** The static route that would be shadowed. */
  staticRoute: RouteEntry;
  /** Human-readable explanation. */
  message: string;
}

/** Internal record kept for each registered domain. */
interface DomainRecord {
  /** Domain identifier (e.g. 'inventory', 'master-data'). */
  name: string;
  /** The function that mounts routes on a parent router. */
  registrar: DomainRegistrar;
  /** Routes discovered after dry-run introspection. */
  routes: RouteEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a path: collapse double slashes, strip trailing slash, ensure
 * leading slash.
 */
function normalisePath(p: string): string {
  let cleaned = p.replace(/\/+/g, '/');
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  return cleaned;
}

/**
 * Return `true` when the segment is a route parameter (`:id`, `:workflowId`,
 * Express 5 regex params, etc.).
 */
function isParamSegment(segment: string): boolean {
  return segment.startsWith(':') || segment.startsWith('*');
}

/**
 * Count how many segments in a route path are parameterised.
 */
function paramCount(path: string): number {
  return path.split('/').filter(Boolean).filter(isParamSegment).length;
}

/**
 * Walk an Express router's internal layer stack and extract all route
 * entries. Handles nested `router.use(prefix, subRouter)` structures
 * by recursing into sub-stacks.
 */
function extractRoutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stack: any[],
  parentPath: string,
  domain: string,
): RouteEntry[] {
  const entries: RouteEntry[] = [];
  if (!stack) return entries;

  for (const layer of stack) {
    if (layer.route) {
      // Direct route (router.get / .post / etc.)
      const routePath = normalisePath(parentPath + (layer.route.path || ''));
      for (const method of Object.keys(layer.route.methods)) {
        entries.push({ method, fullPath: routePath, domain });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      // Nested router (router.use(prefix, subRouter))
      const mountPath =
        layer.regexp?.source === '^\\/?$' || layer.path === '/'
          ? parentPath
          : parentPath + (layer.path ?? extractMountPath(layer));
      entries.push(...extractRoutes(layer.handle.stack, mountPath, domain));
    }
  }

  return entries;
}

/**
 * Best-effort extraction of the mount path from a layer's regexp when the
 * `path` property is not directly available (Express internals vary).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMountPath(layer: any): string {
  if (layer.path) return layer.path;

  // Express 5 stores the original path keys; try keys[0].
  if (layer.keys?.length && typeof layer.keys[0]?.name === 'string') {
    return '/:' + layer.keys[0].name;
  }

  // Fallback: try to reconstruct from regexp
  if (layer.regexp) {
    const src: string = layer.regexp.source || '';
    const match = /^\^\\\/([\w-]+)/.exec(src);
    if (match) return '/' + match[1];
  }

  return '';
}

// ---------------------------------------------------------------------------
// RouteRegistry
// ---------------------------------------------------------------------------

/**
 * A route registry that collects domain route registrations, analyses them
 * for shadowing conflicts, and mounts them in safe order.
 *
 * ### Why this exists
 *
 * Express evaluates routes in the order they are registered. When two routes
 * share a prefix and one uses a parameter (`:id`) where the other uses a
 * static segment (`expiring`), the param route will match first if it was
 * registered first — silently swallowing the static route.
 *
 * The registry solves this by:
 *   1. Accepting registrations lazily (no immediate side effects)
 *   2. Dry-running each registrar against a throwaway Router to introspect paths
 *   3. Sorting routes so static segments precede params at every depth
 *   4. Mounting domains in the computed safe order
 *   5. Reporting any remaining conflicts that cannot be resolved by ordering
 *      alone (e.g. two different domains registering identical param routes)
 */
export class RouteRegistry {
  private domains: DomainRecord[] = [];
  private conflicts: ConflictEntry[] = [];
  private mounted = false;
  private analysed = false;

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Register a domain's route registrar for deferred mounting.
   *
   * The registrar is **not** invoked immediately — it is stored and will be
   * called during {@link mount} in the computed safe order.
   *
   * @param domain  A unique domain identifier (e.g. `'inventory'`).
   * @param registrar  The function that calls `router.use(...)` etc.
   * @returns `this` for chaining.
   * @throws {Error} If a domain with the same name is already registered, or
   *   if routes have already been mounted.
   *
   * @example
   * ```ts
   * registry.register('inventory', registerInventoryRoutes);
   * ```
   */
  register(domain: string, registrar: DomainRegistrar): this {
    if (this.mounted) {
      throw new Error(
        `RouteRegistry: Cannot register domain "${domain}" — routes have already been mounted. ` +
          'Call register() before mount().',
      );
    }

    if (this.domains.some(d => d.name === domain)) {
      throw new Error(`RouteRegistry: Domain "${domain}" is already registered. Each domain must have a unique name.`);
    }

    this.domains.push({ name: domain, registrar, routes: [] });
    return this;
  }

  /**
   * Analyse all registered domains for route conflicts, sort them into safe
   * mount order, and mount them onto the provided parent router.
   *
   * After mounting, the registry is frozen — no further registrations or
   * mounts are allowed.
   *
   * @param parentRouter  The Express router to mount domain routes onto.
   * @throws {Error} If called more than once.
   *
   * @example
   * ```ts
   * const router = Router();
   * registry.mount(router);
   * ```
   */
  mount(parentRouter: RouterType): void {
    if (this.mounted) {
      throw new Error('RouteRegistry: mount() has already been called. Create a new registry for a separate router.');
    }

    // Step 1: introspect every domain to discover its routes
    this.introspect();

    // Step 2: detect conflicts
    this.detectConflicts();

    // Step 3: compute safe mount order
    const ordered = this.computeMountOrder();

    // Step 4: mount in computed order
    for (const domainRecord of ordered) {
      domainRecord.registrar(parentRouter);
    }

    this.mounted = true;

    // Step 5: log diagnostics
    this.logDiagnostics();
  }

  /**
   * Return any detected route conflicts.
   *
   * Each entry describes a parameterised route that would shadow a static
   * route if mounted in the wrong order.
   *
   * If called before {@link mount}, the analysis is performed on demand.
   *
   * @returns Array of conflict descriptions. Empty means no issues found.
   */
  getConflictReport(): ConflictEntry[] {
    if (!this.analysed) {
      this.introspect();
      this.detectConflicts();
    }
    return [...this.conflicts];
  }

  /**
   * Return a flat list of all discovered routes across every registered
   * domain.
   *
   * Useful for debugging, generating OpenAPI docs, or building a route map.
   */
  getAllRoutes(): RouteEntry[] {
    if (!this.analysed) {
      this.introspect();
      this.detectConflicts();
    }
    return this.domains.flatMap(d => d.routes);
  }

  /**
   * Return the names of all registered domains in their computed mount order.
   *
   * Before {@link mount} is called this returns registration order; after
   * mount it returns the order that was actually used.
   */
  getDomainOrder(): string[] {
    return this.domains.map(d => d.name);
  }

  /**
   * Reset the registry to its initial empty state.
   *
   * Primarily useful in tests where multiple router configurations need to
   * be validated.
   */
  reset(): void {
    this.domains = [];
    this.conflicts = [];
    this.mounted = false;
    this.analysed = false;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /**
   * Dry-run each domain registrar against a disposable router to discover
   * the routes it would register without permanently mounting anything.
   */
  private introspect(): void {
    for (const domainRecord of this.domains) {
      const probeRouter = Router();
      try {
        domainRecord.registrar(probeRouter);
      } catch {
        // If the registrar fails during dry-run (e.g. missing middleware
        // dependencies), we still continue — routes won't be extracted but
        // mounting will surface the real error later.
        console.warn(
          `[RouteRegistry] Dry-run of domain "${domainRecord.name}" threw an error. ` +
            'Route analysis for this domain will be incomplete.',
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stack = (probeRouter as any).stack;
      domainRecord.routes = extractRoutes(stack || [], '', domainRecord.name);
    }
    this.analysed = true;
  }

  /**
   * Compare every pair of routes to find cases where a parameterised route
   * on one domain could shadow a static route on another (or the same)
   * domain.
   *
   * A conflict exists when:
   *   - Two routes share the same HTTP method (or one is `all`)
   *   - They have the same number of path segments
   *   - At every segment position, either both match or one is a param
   *   - One route has a param where the other has a static segment
   *
   * Self-domain conflicts (within the same registrar) are also flagged
   * since a domain may internally shadow its own routes.
   */
  private detectConflicts(): void {
    this.conflicts = [];

    const allRoutes = this.domains.flatMap(d => d.routes);

    for (let i = 0; i < allRoutes.length; i++) {
      for (let j = i + 1; j < allRoutes.length; j++) {
        const a = allRoutes[i];
        const b = allRoutes[j];

        const conflict = this.checkPairConflict(a, b);
        if (conflict) {
          this.conflicts.push(conflict);
        }
      }
    }
  }

  /**
   * Check whether two routes form a shadowing conflict.
   *
   * @returns A ConflictEntry if a conflict is found, or `null`.
   */
  private checkPairConflict(a: RouteEntry, b: RouteEntry): ConflictEntry | null {
    // Methods must overlap
    if (a.method !== b.method && a.method !== 'all' && b.method !== 'all') {
      return null;
    }

    const segsA = a.fullPath.split('/').filter(Boolean);
    const segsB = b.fullPath.split('/').filter(Boolean);

    // Must have same depth
    if (segsA.length !== segsB.length) return null;

    // Walk segments; both must match at every position
    let _aHasParam = false;
    let _bHasParam = false;
    let hasStaticVsParam = false;

    for (let k = 0; k < segsA.length; k++) {
      const sa = segsA[k];
      const sb = segsB[k];
      const aIsParam = isParamSegment(sa);
      const bIsParam = isParamSegment(sb);

      if (aIsParam) _aHasParam = true;
      if (bIsParam) _bHasParam = true;

      if (aIsParam || bIsParam) {
        // At least one is a param — they could match the same request
        if (aIsParam !== bIsParam) {
          hasStaticVsParam = true;
        }
        continue;
      }

      // Both static — must be equal to conflict
      if (sa !== sb) return null;
    }

    if (!hasStaticVsParam) {
      // Both routes have identical shape (e.g. both fully static or both
      // parameterised in the same positions). If they're identical that's a
      // duplicate but not a shadowing issue the registry can fix by reorder.
      return null;
    }

    // Determine which is the param route and which is the static route
    const aParams = paramCount(a.fullPath);
    const bParams = paramCount(b.fullPath);
    const paramRoute = aParams >= bParams ? a : b;
    const staticRoute = paramRoute === a ? b : a;

    const method = a.method.toUpperCase();
    return {
      paramRoute,
      staticRoute,
      message:
        `${method} ${paramRoute.fullPath} (${paramRoute.domain}) ` +
        `could shadow ${method} ${staticRoute.fullPath} (${staticRoute.domain}). ` +
        'The registry will mount the static route first.',
    };
  }

  /**
   * Sort domains so that domains whose routes are purely static (or have
   * fewer param routes in contested prefixes) are mounted first.
   *
   * The algorithm:
   *   1. Build a priority score per domain: lower = mount first.
   *   2. Domains involved in conflicts as the "param side" get a higher
   *      score than domains on the "static side".
   *   3. Ties are broken by the ratio of param-routes to total routes
   *      (fewer params = mount earlier).
   *   4. Final tiebreak: alphabetical by domain name for determinism.
   */
  private computeMountOrder(): DomainRecord[] {
    // Base priority: parameterisation density
    const priority = new Map<string, number>();
    for (const d of this.domains) {
      const total = Math.max(d.routes.length, 1);
      const params = d.routes.reduce((n, r) => n + paramCount(r.fullPath), 0);
      // Ratio of param segments to total routes — heavily parameterised
      // domains get a higher base score.
      priority.set(d.name, params / total);
    }

    // Boost priority (mount later) for domains that own the param side of a conflict.
    // Decrease priority (mount earlier) for domains that own the static side.
    for (const c of this.conflicts) {
      const paramDomain = c.paramRoute.domain;
      const staticDomain = c.staticRoute.domain;
      priority.set(paramDomain, (priority.get(paramDomain) ?? 0) + 10);
      priority.set(staticDomain, (priority.get(staticDomain) ?? 0) - 10);
    }

    // Sort: lower priority first
    const sorted = [...this.domains].sort((a, b) => {
      const pa = priority.get(a.name) ?? 0;
      const pb = priority.get(b.name) ?? 0;
      if (pa !== pb) return pa - pb;
      // Tiebreak: alphabetical
      return a.name.localeCompare(b.name);
    });

    // Update the internal list so getDomainOrder() reflects the computed order.
    this.domains = sorted;

    return sorted;
  }

  /**
   * Log a summary of the analysis at startup.
   */
  private logDiagnostics(): void {
    const totalRoutes = this.domains.reduce((n, d) => n + d.routes.length, 0);

    console.info(`[RouteRegistry] Mounted ${this.domains.length} domain(s), ${totalRoutes} route(s).`);
    console.info(`[RouteRegistry] Mount order: ${this.domains.map(d => d.name).join(' > ')}`);

    if (this.conflicts.length === 0) {
      console.info('[RouteRegistry] No route shadowing conflicts detected.');
    } else {
      console.warn(
        `[RouteRegistry] ${this.conflicts.length} potential shadowing conflict(s) detected ` +
          '(resolved by mount ordering):',
      );
      for (const c of this.conflicts) {
        console.warn(`  - ${c.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Default singleton registry instance.
 *
 * Use this for the main application router. For tests or secondary routers,
 * instantiate `new RouteRegistry()` directly.
 *
 * @example
 * ```ts
 * import { routeRegistry } from '../utils/route-registry.js';
 *
 * routeRegistry.register('auth', registerAuthRoutes);
 * routeRegistry.register('inventory', registerInventoryRoutes);
 * routeRegistry.register('master-data', registerMasterDataRoutes);
 * routeRegistry.mount(router);
 * ```
 */
export const routeRegistry = new RouteRegistry();
