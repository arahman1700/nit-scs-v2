# Redis Monitoring Guide

## Overview

Redis powers BullMQ job queues, rate limiting, token blacklisting, and caching in NIT SCS V2. This guide covers monitoring, alerting thresholds, and maintenance procedures.

## Health Check

The backend performs automatic health monitoring:
- **PING every 30s** — alerts if latency > 100ms
- **Memory check** — warns if usage > 85% of `maxmemory`
- **Connection events** — logged on connect, ready, close, error, reconnect

### Manual health check
```bash
redis-cli PING               # Should return PONG
redis-cli INFO server         # Version, uptime, connections
redis-cli INFO memory         # Memory usage breakdown
redis-cli INFO clients        # Active client connections
redis-cli INFO keyspace       # Database key counts
```

## Key Metrics to Monitor

| Metric | Command | Warning Threshold | Critical Threshold |
|--------|---------|-------------------|-------------------|
| Memory usage | `INFO memory` → `used_memory` | > 75% of maxmemory | > 90% |
| Connected clients | `INFO clients` → `connected_clients` | > 100 | > 200 |
| PING latency | Manual or automated | > 50ms | > 200ms |
| Evicted keys | `INFO stats` → `evicted_keys` | > 0 | > 100/min |
| Rejected connections | `INFO stats` → `rejected_connections` | > 0 | > 10 |

## Connection Configuration

```
Host:        Parsed from REDIS_URL (default: localhost)
Port:        Parsed from REDIS_URL (default: 6379)
TLS:         Auto-detected from rediss:// protocol
Timeout:     10s connection, 5s per-command
Retry:       Exponential backoff with jitter, max 20 attempts, cap 30s
Reconnect:   Auto on READONLY, ECONNRESET, ETIMEDOUT errors
```

## Redis Key Namespaces

| Prefix | Purpose | TTL |
|--------|---------|-----|
| `bull:SCM_QUEUE:*` | SCM job queue data | Managed by BullMQ |
| `bull:INV_QUEUE:*` | Inventory job queue data | Managed by BullMQ |
| `bull:HR_QUEUE:*` | HR job queue data | Managed by BullMQ |
| `bull:EAM_QUEUE:*` | Asset management job data | Managed by BullMQ |
| `bull:ONT_QUEUE:*` | Notification job data | Managed by BullMQ |
| `bull:DEAD_LETTER_QUEUE:*` | Failed jobs | No auto-expire |
| `rl:*` | Rate limiter counters | 60s sliding window |
| `token:blacklist:*` | Revoked JWT tokens | Matches token expiry |

## Maintenance Procedures

### Memory pressure relief
```bash
# Check what's using memory
redis-cli --bigkeys

# Clear completed BullMQ jobs (keep last 100)
# Best done via Bull Board UI or application restart

# Clear rate limiter keys (safe, auto-regenerated)
redis-cli KEYS "rl:*" | xargs redis-cli DEL
```

### Backup
```bash
# Trigger RDB snapshot
redis-cli BGSAVE

# Check last save time
redis-cli LASTSAVE
```

### Connection issues
1. Check max connections: `redis-cli CONFIG GET maxclients`
2. Review connected clients: `redis-cli CLIENT LIST`
3. Kill idle connections: `redis-cli CLIENT KILL IDLE 300`

## Alerting Rules

For production monitoring (Grafana/Datadog/etc.):

```yaml
- alert: RedisHighMemory
  condition: used_memory_pct > 85
  severity: warning

- alert: RedisHighLatency
  condition: ping_latency_ms > 100
  severity: warning

- alert: RedisDown
  condition: redis_up == 0
  severity: critical
  action: Scheduler falls back to setInterval automatically

- alert: DLQGrowing
  condition: bull:DEAD_LETTER_QUEUE:waiting length > 10
  severity: warning
  action: Investigate failed jobs via Bull Board
```

## Graceful Degradation

When Redis becomes unavailable:
1. BullMQ workers stop processing (automatic)
2. Scheduler falls back to `setInterval` mode (automatic)
3. Rate limiting degrades (allows all requests)
4. Token blacklist degrades (tokens not revoked until Redis returns)
5. All features resume automatically when Redis reconnects
