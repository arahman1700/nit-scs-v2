import { describe, it, expect } from 'vitest';
import { ALLOWED_TABLES, BLOCKED_TABLES, buildSchemaPrompt, validateQuery } from './ai-schema-context.js';

/* ------------------------------------------------------------------ */
/*  ALLOWED_TABLES registry                                           */
/* ------------------------------------------------------------------ */
describe('ALLOWED_TABLES', () => {
  it('includes core Oracle WMS tables', () => {
    const names = ALLOWED_TABLES.map(t => t.table);
    expect(names).toContain('FND_PROJECTS');
    expect(names).toContain('MTL_SYSTEM_ITEMS');
    expect(names).toContain('RCV_RECEIPT_HEADERS');
    expect(names).toContain('MTL_ONHAND_QUANTITIES');
  });

  it('includes transfer and logistics tables', () => {
    const names = ALLOWED_TABLES.map(t => t.table);
    expect(names).toContain('MTL_TRANSFER_HEADERS');
    expect(names).toContain('WMS_GATE_PASSES');
    expect(names).toContain('MTL_INTERNAL_TRANSFERS');
    expect(names).toContain('MTL_SURPLUS_ITEMS');
  });

  it('every entry has table, description, and non-empty columns', () => {
    for (const t of ALLOWED_TABLES) {
      expect(t.table).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
    }
  });

  it('all table names use Oracle WMS naming convention (UPPER_CASE with prefix)', () => {
    const validPrefixes = ['FND_', 'MTL_', 'WMS_', 'ONT_', 'RCV_', 'WSH_', 'CUST_', 'AP_'];
    for (const t of ALLOWED_TABLES) {
      const hasValidPrefix = validPrefixes.some(p => t.table.startsWith(p));
      expect(hasValidPrefix).toBe(true);
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
    const result = validateQuery('SELECT id, project_name FROM FND_PROJECTS LIMIT 10');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a SELECT with JOIN on allowed tables', () => {
    const sql =
      'SELECT m.id, i.item_name FROM RCV_RECEIPT_LINES ml JOIN MTL_SYSTEM_ITEMS i ON ml.item_id = i.id JOIN RCV_RECEIPT_HEADERS m ON ml.mrrv_id = m.id LIMIT 50';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on MTL_TRANSFER_HEADERS table', () => {
    const sql = 'SELECT id, transfer_number, status FROM MTL_TRANSFER_HEADERS LIMIT 20';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on WMS_GATE_PASSES table', () => {
    const sql = 'SELECT id, gate_pass_number FROM WMS_GATE_PASSES LIMIT 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on MTL_INTERNAL_TRANSFERS table', () => {
    const sql = 'SELECT id, imsf_number, status FROM MTL_INTERNAL_TRANSFERS LIMIT 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query on MTL_SURPLUS_ITEMS table', () => {
    const sql = 'SELECT id, surplus_number FROM MTL_SURPLUS_ITEMS LIMIT 5';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts a query with WHERE clause and ORDER BY', () => {
    const sql = "SELECT id, status FROM FND_PROJECTS WHERE status = 'active' ORDER BY created_at LIMIT 100";
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts aggregate queries on allowed tables', () => {
    const sql = 'SELECT warehouse_id, COUNT(*) as cnt FROM MTL_ONHAND_QUANTITIES GROUP BY warehouse_id LIMIT 50';
    expect(validateQuery(sql).valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — must start with SELECT                            */
/* ------------------------------------------------------------------ */
describe('validateQuery — non-SELECT rejection', () => {
  it('rejects INSERT statement', () => {
    const result = validateQuery("INSERT INTO FND_PROJECTS (id) VALUES ('x')");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Only SELECT');
  });

  it('rejects UPDATE statement', () => {
    const result = validateQuery("UPDATE FND_PROJECTS SET status = 'deleted'");
    expect(result.valid).toBe(false);
  });

  it('rejects DELETE statement', () => {
    const result = validateQuery('DELETE FROM FND_PROJECTS');
    expect(result.valid).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  validateQuery — multi-statement rejection                         */
/* ------------------------------------------------------------------ */
describe('validateQuery — multi-statement', () => {
  it('rejects queries containing semicolons', () => {
    const sql = 'SELECT id FROM FND_PROJECTS LIMIT 10; DROP TABLE FND_PROJECTS';
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
      const sql = `SELECT id FROM FND_PROJECTS WHERE 1=1 LIMIT 10 ${keyword} something`;
      const result = validateQuery(sql);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Forbidden keyword');
    });
  }

  it('rejects CTE (WITH ... AS)', () => {
    const sql = 'WITH cte AS (SELECT id FROM FND_PROJECTS) SELECT * FROM cte LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    // WITH is forbidden, and also does not start with SELECT
    expect(result.reason).toBeDefined();
  });

  it('rejects SELECT ... INTO (data exfiltration)', () => {
    const sql = 'SELECT id INTO temp_table FROM FND_PROJECTS LIMIT 10';
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
    const sql = 'SELECT * FROM (SELECT id FROM FND_PROJECTS) sub LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Subqueries in FROM');
  });

  it('rejects subquery in FROM with extra whitespace', () => {
    const sql = 'SELECT * FROM  (  SELECT id FROM FND_PROJECTS ) sub LIMIT 10';
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
    const sql = 'SELECT id FROM FND_PROJECTS';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('LIMIT');
  });

  it('rejects LIMIT exceeding 1000', () => {
    const sql = 'SELECT id FROM FND_PROJECTS LIMIT 5000';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('LIMIT must not exceed 1000');
  });

  it('accepts LIMIT of exactly 1000', () => {
    const sql = 'SELECT id FROM FND_PROJECTS LIMIT 1000';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts LIMIT of 1', () => {
    const sql = 'SELECT id FROM FND_PROJECTS LIMIT 1';
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
    const sql = 'SELECT p.id FROM FND_PROJECTS p JOIN pg_roles r ON p.manager = r.rolname LIMIT 10';
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
    const sql = 'SELECT p.id FROM FND_PROJECTS p JOIN secret_data s ON p.id = s.project_id LIMIT 10';
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
    const sql = 'SELECT id FROM FND_PROJECTS LIMIT 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('accepts mixed-case select', () => {
    const sql = 'Select id From fnd_projects Limit 10';
    expect(validateQuery(sql).valid).toBe(true);
  });

  it('detects forbidden keywords regardless of case', () => {
    const sql = 'SELECT id FROM FND_PROJECTS LIMIT 10 UNION SELECT id FROM MTL_SYSTEM_ITEMS LIMIT 10';
    expect(validateQuery(sql).valid).toBe(false);
  });

  it('detects system catalog tables in mixed case', () => {
    const sql = 'SELECT * FROM PG_ROLES LIMIT 10';
    // Normalized to lowercase — should be caught
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
  });
});

/*  validateQuery — sensitive column blocking                             */

describe('validateQuery — sensitive columns', () => {
  it('blocks queries selecting password_hash', () => {
    const sql = 'SELECT id, password_hash FROM FND_EMPLOYEES LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('sensitive column');
  });

  it('blocks queries referencing refresh_token', () => {
    const sql = 'SELECT id, refresh_token FROM FND_EMPLOYEES LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
  });

  it('blocks queries with api_key column', () => {
    const sql = 'SELECT api_key FROM FND_SYSTEM_SETTINGS LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(false);
  });

  it('allows queries without sensitive columns', () => {
    const sql = 'SELECT id, full_name, email FROM FND_EMPLOYEES LIMIT 10';
    const result = validateQuery(sql);
    expect(result.valid).toBe(true);
  });
});
