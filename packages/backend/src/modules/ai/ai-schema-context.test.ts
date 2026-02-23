import { describe, it, expect } from 'vitest';
import { ALLOWED_TABLES, BLOCKED_TABLES, buildSchemaPrompt, validateQuery } from './ai-schema-context.js';

/* ------------------------------------------------------------------ */
/*  ALLOWED_TABLES registry                                           */
/* ------------------------------------------------------------------ */
describe('ALLOWED_TABLES', () => {
  it('includes original core tables', () => {
    const names = ALLOWED_TABLES.map(t => t.table);
    expect(names).toContain('projects');
    expect(names).toContain('items');
    expect(names).toContain('mrrv');
    expect(names).toContain('inventory_levels');
  });

  it('includes the 4 newly added tables', () => {
    const names = ALLOWED_TABLES.map(t => t.table);
    expect(names).toContain('stock_transfers');
    expect(names).toContain('gate_passes');
    expect(names).toContain('imsf');
    expect(names).toContain('surplus_items');
  });

  it('every entry has table, description, and non-empty columns', () => {
    for (const t of ALLOWED_TABLES) {
      expect(t.table).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  BLOCKED_TABLES set                                                */
/* ------------------------------------------------------------------ */
describe('BLOCKED_TABLES', () => {
  it('contains information_schema', () => {
    expect(BLOCKED_TABLES.has('information_schema')).toBe(true);
  });

  it('contains pg_catalog', () => {
    expect(BLOCKED_TABLES.has('pg_catalog')).toBe(true);
  });

  it('contains pg_roles, pg_user, pg_shadow', () => {
    expect(BLOCKED_TABLES.has('pg_roles')).toBe(true);
    expect(BLOCKED_TABLES.has('pg_user')).toBe(true);
    expect(BLOCKED_TABLES.has('pg_shadow')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  buildSchemaPrompt                                                 */
/* ------------------------------------------------------------------ */
describe('buildSchemaPrompt', () => {
  it('produces a non-empty string mentioning SELECT', () => {
    const prompt = buildSchemaPrompt();
    expect(prompt).toContain('SELECT only');
  });

  it('includes all allowed table names in the prompt', () => {
    const prompt = buildSchemaPrompt();
    for (const t of ALLOWED_TABLES) {
      expect(prompt).toContain(t.table);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — valid queries                                     */
/* ------------------------------------------------------------------ */
describe('validateQuery — valid queries', () => {
  it('accepts a simple SELECT with LIMIT', () => {
    const result = validateQuery('SELECT id, project_name FROM projects LIMIT 10');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a SELECT with JOIN on allowed tables', () => {
    const sql =
      'SELECT m.id, i.item_name FROM mrrv_lines ml JOIN items i ON ml.item_id = i.id JOIN mrrv m ON ml.mrrv_id = m.id LIMIT 50';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on newly added stock_transfers table', () => {
    const sql = 'SELECT id, transfer_number, status FROM stock_transfers LIMIT 20';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on newly added gate_passes table', () => {
    const sql = 'SELECT id, gate_pass_number FROM gate_passes LIMIT 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on newly added imsf table', () => {
    const sql = 'SELECT id, imsf_number, status FROM imsf LIMIT 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on newly added surplus_items table', () => {
    const sql = 'SELECT id, surplus_number FROM surplus_items LIMIT 5';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query with WHERE clause and ORDER BY', () => {
    const sql = "SELECT id, status FROM projects WHERE status = 'active' ORDER BY created_at LIMIT 100";
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts aggregate queries on allowed tables', () => {
    const sql = 'SELECT warehouse_id, COUNT(*) as cnt FROM inventory_levels GROUP BY warehouse_id LIMIT 50';
    expect(validateQuery(sql).valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — must start with SELECT                            */
/* ------------------------------------------------------------------ */
describe('validateQuery — non-SELECT rejection', () => {
  it('rejects INSERT statement', () => {
    const result = validateQuery("INSERT INTO projects (id) VALUES ('x')");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Only SELECT');
  });

  it('rejects UPDATE statement', () => {
    const result = validateQuery("UPDATE projects SET status = 'deleted'");
    expect(result.valid).toBe(false);
  });

  it('rejects DELETE statement', () => {
    const result = validateQuery('DELETE FROM projects');
    expect(result.valid).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — multi-statement rejection                         */
/* ------------------------------------------------------------------ */
describe('validateQuery — multi-statement', () => {
  it('rejects queries containing semicolons', () => {
    const sql = 'SELECT id FROM projects LIMIT 10; DROP TABLE projects';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Multiple statements');
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — forbidden keywords                                */
/* ------------------------------------------------------------------ */
describe('validateQuery — forbidden keywords', () => {
  const forbiddenWords = [
    'insert',
    'update',
    'delete',
    'drop',
    'alter',
    'create',
    'truncate',
    'grant',
    'revoke',
    'exec',
    'execute',
    'union',
    'copy',
    'set',
    'pg_read_file',
    'pg_sleep',
    'lo_import',
    // Newly added
    'with',
    'into',
    'call',
    'do',
    'handler',
    'load',
    'replace',
    'lock',
    'unlock',
  ];

  for (const keyword of forbiddenWords) {
    it(`rejects queries containing "${keyword}"`, () => {
      // Build a query that starts with SELECT but smuggles in the keyword
      const sql = `SELECT id FROM projects WHERE 1=1 LIMIT 10 ${keyword} something`;
      const result = validateQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Forbidden keyword');
    });
  }

  it('rejects CTE (WITH ... AS)', () => {
    const sql = 'WITH cte AS (SELECT id FROM projects) SELECT * FROM cte LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    // WITH is forbidden, and also does not start with SELECT
    expect(result.reason).toBeDefined();
  });

  it('rejects SELECT ... INTO (data exfiltration)', () => {
    const sql = 'SELECT id INTO temp_table FROM projects LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Forbidden keyword');
    expect(result.reason).toContain('into');
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — subquery in FROM clause                           */
/* ------------------------------------------------------------------ */
describe('validateQuery — subquery in FROM', () => {
  it('rejects subquery in FROM clause', () => {
    const sql = 'SELECT * FROM (SELECT id FROM projects) sub LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Subqueries in FROM');
  });

  it('rejects subquery in FROM with extra whitespace', () => {
    const sql = 'SELECT * FROM  (  SELECT id FROM projects ) sub LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Subqueries in FROM');
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — LIMIT enforcement                                 */
/* ------------------------------------------------------------------ */
describe('validateQuery — LIMIT enforcement', () => {
  it('rejects queries without a LIMIT clause', () => {
    const sql = 'SELECT id FROM projects';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('LIMIT');
  });

  it('rejects LIMIT exceeding 1000', () => {
    const sql = 'SELECT id FROM projects LIMIT 5000';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('LIMIT must not exceed 1000');
  });

  it('accepts LIMIT of exactly 1000', () => {
    const sql = 'SELECT id FROM projects LIMIT 1000';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts LIMIT of 1', () => {
    const sql = 'SELECT id FROM projects LIMIT 1';
    expect(validateQuery(sql).valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — system catalog table blocking                     */
/* ------------------------------------------------------------------ */
describe('validateQuery — system catalog tables', () => {
  it('rejects SELECT from information_schema', () => {
    const sql = 'SELECT table_name FROM information_schema LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_catalog', () => {
    const sql = 'SELECT * FROM pg_catalog LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_tables', () => {
    const sql = 'SELECT tablename FROM pg_tables LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_roles', () => {
    const sql = 'SELECT rolname FROM pg_roles LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_user', () => {
    const sql = 'SELECT usename FROM pg_user LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_shadow', () => {
    const sql = 'SELECT usename, passwd FROM pg_shadow LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_stat_activity', () => {
    const sql = 'SELECT pid, query FROM pg_stat_activity LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_stat_user_tables', () => {
    const sql = 'SELECT relname FROM pg_stat_user_tables LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects SELECT from pg_settings', () => {
    const sql = 'SELECT name, setting FROM pg_settings LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects any pg_ prefixed table not explicitly listed', () => {
    const sql = 'SELECT * FROM pg_some_new_table LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });

  it('rejects pg_ table in a JOIN', () => {
    const sql = 'SELECT p.id FROM projects p JOIN pg_roles r ON p.manager = r.rolname LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('System catalog table not allowed');
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — table allowlist enforcement                       */
/* ------------------------------------------------------------------ */
describe('validateQuery — table allowlist', () => {
  it('rejects query on an unknown table', () => {
    const sql = 'SELECT id FROM users LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Table not allowed');
  });

  it('rejects query with unknown table in JOIN', () => {
    const sql = 'SELECT p.id FROM projects p JOIN secret_data s ON p.id = s.project_id LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Table not allowed');
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — case insensitivity                                */
/* ------------------------------------------------------------------ */
describe('validateQuery — case insensitivity', () => {
  it('accepts uppercase SELECT', () => {
    const sql = 'SELECT id FROM projects LIMIT 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts mixed-case select', () => {
    const sql = 'Select id From projects Limit 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('detects forbidden keywords regardless of case', () => {
    const sql = 'SELECT id FROM projects LIMIT 10 UNION SELECT id FROM items LIMIT 10';
    expect(validateQuery(sql).valid).toBe(false);
  });

  it('detects system catalog tables in mixed case', () => {
    const sql = 'SELECT * FROM PG_ROLES LIMIT 10';
    // Normalized to lowercase — should be caught
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
  });
});
