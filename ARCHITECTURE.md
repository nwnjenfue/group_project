# eFOT architecture — production-oriented demo baseline

## Request flow

```text
Browser
  |
  | JWT / REST
  v
Express API
  |
  +--> Auth / RBAC / rate limiting / audit
  |
  +--> Analytics controller
  |      +--> server-side filters
  |      +--> pagination
  |      +--> KPI aggregation
  |      +--> scenarios
  |      +--> anomaly signals
  |      +--> company profile/history
  |
  +--> Import controller
  |      +--> XLSX parser
  |      +--> header detection
  |      +--> semantic column mapping
  |      +--> validation
  |      +--> snapshot transaction
  |
  +--> PDF controller
  |
  v
PostgreSQL
  +-- Users
  +-- Сводная              current aggregate slice / compatibility
  +-- otchety_full         legacy compatibility table
  +-- data_imports         import metadata and status
  +-- data_snapshots       normalized historical analytical layer
  +-- audit_logs            security and operational trail
```

## Why `data_snapshots` exists

The original project treated `Сводная` as the entire analytical database. That prevents reliable historical analysis because a new import replaces the current slice and the system cannot answer questions such as “what changed since the previous period?”.

The revised design keeps `Сводная` as a compatibility/current table and stores every accepted import in `data_imports` + `data_snapshots`. This gives the backend a stable place for period-over-period analytics without inventing data that was never supplied.

## Automatic Excel selection logic

The importer does not assume “row 3 is always the header”. It scans the first 25 rows, normalizes header spelling, whitespace, punctuation and `ё/е`, then maps semantic aliases to canonical fields.

Classification:

- `summary`: OKED + activity + payroll and aggregate indicators.
- `detail`: OKED + BIN/IIN + company name + payroll.
- unknown: rejected with an explicit explanation.

The same importer is used by the browser and CLI. This prevents the common failure mode where the web upload path and command-line import script implement different parsing rules.

## Analytical rules

Rules are intentionally explainable:

- payroll exists while tax value is zero;
- salary is materially above/below the dataset median;
- payroll materially disagrees with an implied payroll calculated from employees × salary × 12;
- company history shows a large payroll increase with little workforce movement;
- company history shows a material workforce drop;
- company history shows a material salary change.

These are review signals, not legal conclusions or proof of wrongdoing.

## What remains data-dependent

Territory, period and historical analytics become reliable only when the source files actually contain those fields or clear metadata. The importer records detected metadata and leaves it null when it cannot be established. It does not fabricate a region, period or historical value.

External government registries and tax systems are not silently mocked as “integrated”. Integration points can be added later with documented legal basis, credentials and data contracts.
