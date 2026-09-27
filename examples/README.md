# Examples

Worked examples of features taken through the full ADF pipeline.

## features/archive-project

One small but realistic feature — "Archive a project" in a project-management
app (.NET 10 / C# API, Next.js 16 + TypeScript frontend, PostgreSQL, JWT,
REST) — carried through every stage of `workflows/feature-development.yaml`.
Owners can archive and unarchive a project; archived projects are hidden from
the default list, read-only, and shown under an "Archived" filter.

Each file is the artifact one agent produces, following its template in
`templates/`. IDs (US, FR, BR, AC, EC, SCR, finding IDs) cross-reference
consistently across documents. Implementation reports list plausible file
paths only; no source code is included.

Documents, in pipeline order, with the status each one ends with:

| # | File | Agent | Final status |
|---|------|-------|--------------|
| 1 | specification.md | Feature | READY_FOR_PRODUCT_REVIEW |
| 2 | product-review.md | Product Review | READY_FOR_DESIGN |
| 3 | design.md | Design | READY_FOR_ARCHITECTURE |
| 4 | architecture.md | Architecture | READY_FOR_ARCHITECTURE_REVIEW |
| 5 | architecture-review.md | Architecture Review | READY_FOR_BACKEND |
| 6 | backend-implementation-report.md | Backend | READY_FOR_FRONTEND |
| 7 | frontend-implementation-report.md | Frontend | READY_FOR_QA |
| 8 | qa-report.md | QA | READY_FOR_SECURITY_REVIEW |
| 9 | security-review.md | Security Review | READY_FOR_OPERATIONS_REVIEW |
| 10 | operations-readiness-report.md | Operations Readiness | READY_FOR_CODE_REVIEW |
| 11 | code-review-report.md | Code Review | RELEASE_READY |

## Use in tests

The test suite uses this folder as a gate-level end-to-end fixture: every
document's last non-blank line is its `STATUS:` line (read by
`extractStatusLine` in `adf-core/lib/fs-utils.mjs`), so the full set should
pass every gate through to the Release Gate. If you edit a document, keep the
status line as the final non-blank line.
