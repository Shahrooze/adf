// Mirrors workflows/feature-development.yaml — the two must be kept in sync.
// This table exists because the CLI has no YAML parser (zero dependencies by
// design, see adf-core/README.md). If you change a stage, artifact filename,
// or gate status in workflows/feature-development.yaml, update this table in
// the same commit.

export const STAGES = [
  {
    id: "feature",
    agent: "feature-agent",
    artifact: "specification.md",
    readyStatus: "READY_FOR_PRODUCT_REVIEW",
  },
  {
    id: "product-review",
    agent: "product-review-agent",
    artifact: "product-review.md",
    readyStatus: "READY_FOR_DESIGN",
  },
  {
    id: "design",
    agent: "design-agent",
    artifact: "design.md",
    readyStatus: "READY_FOR_ARCHITECTURE",
  },
  {
    id: "architecture",
    agent: "architecture-agent",
    artifact: "architecture.md",
    readyStatus: "READY_FOR_ARCHITECTURE_REVIEW",
  },
  {
    id: "architecture-review",
    agent: "architecture-review-agent",
    artifact: "architecture-review.md",
    readyStatus: "READY_FOR_BACKEND",
  },
  {
    id: "backend-implementation",
    agent: "backend-agent",
    artifact: "backend-implementation-report.md",
    readyStatus: "READY_FOR_FRONTEND",
  },
  {
    id: "frontend-implementation",
    agent: "frontend-agent",
    artifact: "frontend-implementation-report.md",
    readyStatus: "READY_FOR_QA",
  },
  {
    id: "qa",
    agent: "qa-agent",
    artifact: "qa-report.md",
    readyStatus: "READY_FOR_SECURITY_REVIEW",
  },
  {
    id: "security-review",
    agent: "security-review-agent",
    artifact: "security-review.md",
    readyStatus: "READY_FOR_OPERATIONS_REVIEW",
  },
  {
    id: "operations-readiness",
    agent: "operations-readiness-agent",
    artifact: "operations-readiness-report.md",
    readyStatus: "READY_FOR_CODE_REVIEW",
  },
  {
    id: "code-review",
    agent: "code-review-agent",
    artifact: "code-review-report.md",
    readyStatus: "RELEASE_READY",
  },
];

export const ARTIFACT_FILENAMES = STAGES.map((s) => s.artifact);

// Non-blocking terminal recommendation values a review-type artifact may
// carry in its "# Overall Result" section. Used only for informational
// severity roll-ups in the registry — never to hard-fail validation (that is
// each stage agent's own job per policies/quality-gates.md).
export const RECOMMENDATIONS = [
  "APPROVED",
  "APPROVED_WITH_COMMENTS",
  "CHANGES_REQUIRED",
  "REJECTED",
];

// The mission-defined convenience view: one named status per stage grouping.
// Maps registry consumers' expectations (Architecture Status, Backend
// Status, ...) onto the stage table above.
export const STATUS_SUMMARY_FIELDS = {
  architecture_status: ["architecture-review", "architecture"],
  backend_status: ["backend-implementation"],
  frontend_status: ["frontend-implementation"],
  qa_status: ["qa"],
  review_status: ["code-review", "operations-readiness", "security-review"],
};

export function stageIndex(stageId) {
  return STAGES.findIndex((s) => s.id === stageId);
}

export function stageById(stageId) {
  return STAGES.find((s) => s.id === stageId) ?? null;
}
