# `feature.json` Schema

Every feature directory (`features/<id>-<slug>/` and `_archive/<id>-<slug>/`)
has exactly one `feature.json` — the Feature Registry entry for that feature.
It is the single structured-metadata file agents read to answer "what is
this feature, who owns it, what does it depend on" without opening every
narrative artifact.

`feature.json` has two parts. Keep them mentally separate:

## Hand-authored fields (written once, edited rarely)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must match the directory's `FEAT-NNN` (or `BUG-...`) prefix exactly. |
| `name` | string | yes | Human-readable feature name. Should match specification.md's Metadata → Feature Name. |
| `priority` | string | yes | One of `Critical`, `High`, `Medium`, `Low` — the same severity vocabulary used everywhere else in ADF (findings, business rules), so there is only one priority scale to learn. |
| `owner` | string | yes | Person or team accountable for the feature. |
| `dependencies` | string[] | no (default `[]`) | Feature IDs this feature cannot ship without (upstream). Validated to exist and to be acyclic. |
| `related_features` | string[] | no (default `[]`) | Feature IDs that are related but not a hard dependency (e.g. shares a screen, competes for the same navigation slot). |
| `supplementary_documents` | string[] | no (default `[]`) | Filenames of extra documents in the feature directory beyond the eleven standard pipeline artifacts (e.g. a product-discovery brief, a carried-forward constraints doc). Declaring them here stops the Validation Engine from flagging them as orphan files. |
| `created_at` | string (YYYY-MM-DD) | yes | Set once when the feature is registered. |
| `backfilled` | boolean | no | Present and `true` only on entries created by `node adf-core/cli.mjs backfill` for pre-ADF-Core features, so it's obvious the data was reconstructed rather than authored live. |

These fields are created by `node adf-core/cli.mjs new` (see
`agents/feature/instructions.md`) and are otherwise edited directly, by
hand, only when a dependency/relationship/priority genuinely changes.

## Generated fields (`generated` key — never hand-edit)

Rewritten in full every time `node adf-core/cli.mjs generate` (or `sync`)
runs. Never edit this block directly — your edit is overwritten on the next
run. It is derived entirely from the feature directory's own artifact files,
specifically each artifact's own final `STATUS:` line (see
`workflows/feature-development.yaml` for the canonical stage→status table).

| Field | Meaning |
|---|---|
| `generated.stage` | The id of the last stage whose gate was actually satisfied (its artifact's STATUS line matches that stage's required ready-value). `null` if none yet. |
| `generated.status` | Human-readable completion status: `Release Ready`, `In Progress (past <stage>)`, `Blocked at <stage> (<status>)`, or `Not Started`. |
| `generated.gates` | Map of stage id → that stage's artifact's own terminal STATUS value (or `null` if the artifact doesn't exist or has no parseable status). |
| `generated.documents` | Map of stage id → `{ file, status, recommendation }` — `recommendation` is a best-effort read of the artifact's "# Overall Result" section, informational only. |
| `generated.status_summary` | The mission-defined named views: `architecture_status`, `backend_status`, `frontend_status`, `qa_status`, `review_status`, `completion_status`. |
| `generated.orphan_files` | Files present in the directory that are neither a standard artifact nor declared in `supplementary_documents`. |
| `generated.last_synced` | Date `generate`/`sync` last ran. |

## Why split it this way

The narrative artifacts (`specification.md`, `design.md`, ...) are
stage-owned and frozen once handed off — no later stage may rewrite an
earlier stage's artifact (see a consuming project's own `AGENTS.md` →
"Hard rules"). `feature.json`'s
generated block is not owned by any stage: it is always fully recomputed
from the artifacts, so there's nothing to "own" or accidentally overwrite.
The hand-authored block holds exactly the metadata that cannot be derived
from any existing document (cross-feature relationships, ownership,
priority) — the minimum necessary to avoid re-deriving it by hand every time
an agent needs it.

## Example

```json
{
  "id": "FEAT-001",
  "name": "User Authentication",
  "priority": "High",
  "owner": "Engineering",
  "dependencies": [],
  "related_features": [],
  "supplementary_documents": [],
  "created_at": "2026-07-05",
  "generated": {
    "stage": "code-review",
    "status": "Release Ready",
    "gates": { "feature": "READY_FOR_PRODUCT_REVIEW", "...": "..." },
    "documents": { "feature": { "file": "specification.md", "status": "READY_FOR_PRODUCT_REVIEW", "recommendation": null } },
    "status_summary": {
      "completion_status": "Release Ready",
      "architecture_status": "READY_FOR_BACKEND",
      "backend_status": "READY_FOR_FRONTEND",
      "frontend_status": "READY_FOR_QA",
      "qa_status": "READY_FOR_SECURITY_REVIEW",
      "review_status": "RELEASE_READY"
    },
    "orphan_files": [],
    "last_synced": "2026-07-17"
  }
}
```
