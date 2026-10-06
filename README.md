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

Historical trends, territorial comparisons and full counterparty risk analysis require corresponding historical, territorial and company-level source data. The system stores snapshots and metadata for this purpose, but it does not fabricate missing history or external government data. An anomaly is a signal for review, not a statement that a company violated a law.
