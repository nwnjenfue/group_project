# eFOT — Financial & Economic Monitoring Platform

eFOT is a client-server analytics platform for financial-labour indicators, company profiles, anomaly detection and report generation.

## Architecture

- Frontend: React + TypeScript + Material UI + Recharts
- Backend: Node.js + Express
- Authentication: JWT + bcrypt
- Database: PostgreSQL
- Import: XLSX/XLS with automatic structure detection
- Reporting: PDFKit

## What changed in the hardened version

1. One protected API surface. Legacy public analytics endpoints were removed from the active route chain.
2. Server-side pagination and filtering. The browser no longer has to load the whole dataset just to search it.
3. Automatic Excel classification. The importer detects summary vs detailed datasets from column semantics instead of relying on a hard-coded row number.
4. Import validation and audit trail. Every import receives an ID, detected columns, period/territory metadata, row counts and status.
5. Historical snapshots. Imported datasets are preserved in `data_snapshots`, allowing company history and future period-over-period analysis.
6. Company profile endpoint by BIN with changes and explainable risk factors.
7. Smart analytical scenarios: high payroll, high/low salary, low workforce, payroll without taxes.
8. Anomaly signals are rule-based and explainable. They are not presented as a legal or compliance conclusion.
9. PDF export uses the normalized analytical dataset.
10. Password change is implemented through the authenticated API. Password reset no longer leaks a reset token in the HTTP response.
11. Upload size/type limits, security headers, CORS allowlist and login rate limiting were added.
12. Database startup uses `sequelize.sync()` only for missing core tables; destructive `alter: true` synchronization was removed.

## Setup

1. Install PostgreSQL and create the database.
2. Copy `server/.env.example` to `server/.env` and fill in real credentials and a long random `SECRET_KEY`.
3. Install dependencies:

```bash
npm install
cd client && npm install
```

4. Start both applications:

```bash
npm run dev:full
```

Backend: `http://localhost:5000`
Frontend: `http://localhost:3000`

## Data import

The preferred workflow is a single admin action: **Загрузить Excel**.

The importer inspects the workbook, finds the header row, normalizes column names and automatically classifies the file:

- `summary` — aggregated OKED/activity/payroll data;
- `detail` — company-level records containing BIN/name and payroll data.

The same importer can be used from CLI:

```bash
npm run import-excel path/to/file.xlsx
npm run import-detail path/to/file.xlsx
```

The CLI wrapper now uses the same detection and validation service as the web application.

## Product logic

The product is intentionally positioned around a decision workflow rather than charts alone:

**data → validation → normalized snapshot → filtering → comparison → anomaly signal → company/detail drill-down → report**

This follows the product materials: the target is to reduce manual reporting, provide one consistent source of figures, move from aggregate indicators to the reason behind a change, and support concrete scenarios such as economic monitoring and counterparty analysis. The presentation explicitly describes selection by period and conditions, drill-down from aggregate to territory/activity/organization, validation before reporting, and an audit trail. These capabilities are represented in the current architecture where the available source data supports them.

## Important data limitation

### Periods and calculation rules

- Select an imported year, quarter or month on the dashboard; the table, company drill-down and full exports use that selected import.
- Both summary and company-level Excel imports appear in the dataset selector, including files without a known period. A successful upload selects the returned import ID immediately; company-level files do not require a separate summary upload. Historical comparisons stay within the same dataset type.
- When uploading, specify a period such as `2026`, `2026-03` or `2026, 1 квартал`, and a territory. Unknown periods remain visible but cannot participate in historical comparisons.
- An import is a complete replacement of its dataset type / territory / reporting period, not an incremental batch. For repeated imports, only the newest completed revision participates in analytics; older records remain stored. Imports with no identifiable period are kept separate.
- History follows reporting dates, not upload dates. Comparisons use the same territory and period duration; zero baselines have an absolute difference but no percentage.
- Summary organization counts sum the source `Количество НП` values. They are not a count of OKED rows or a guaranteed unique BIN count across industries. If those source counts are missing, the KPI is unavailable.
- Monthly average salary uses payroll divided by employee-month exposure when duration and payroll are available. Otherwise, source salaries are weighted by workforce. Missing inputs are shown as unavailable rather than zero. Source monetary units must be tenge; the importer does not infer thousands/millions.
- For company records repeated across OKED rows, workforce uses the maximum (the existing company-level convention). Salary is unavailable until workforce allocation is unambiguous; payroll and taxes sum the source rows.
- No quarterly or monthly values are synthesized from annual reports. Load actual reports for the required periods. The first historical comparison requires at least two comparable reporting periods.

Validation:

```bash
node --test tests/analytics.test.js tests/analytics.integration.test.js
npm --prefix client run build
```

The integration test requires the configured PostgreSQL database and existing analytics tables. It uses session-local temporary tables and rolls back its records.

Historical trends, territorial comparisons and full counterparty risk analysis require corresponding historical, territorial and company-level source data. The system stores snapshots and metadata for this purpose, but it does not fabricate missing history or external government data. An anomaly is a signal for review, not a statement that a company violated a law.
