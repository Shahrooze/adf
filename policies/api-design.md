# API Design Policy

## Style

Prefer REST. Keep endpoints resource-oriented, not action-oriented.

Use nouns for resources, not verbs.

Example: `POST /orders`, not `POST /createOrder`.

---

# Naming

Use plural nouns for collections: `/orders`, `/orders/{id}`.

Use kebab-case for multi-word path segments: `/order-items`.

Use camelCase for JSON field names, consistently.

---

# Versioning

Version the API explicitly (e.g. URL segment `/v1/...` or a version header).

Never make a breaking change to a published version. Introduce a new
version instead.

---

# Pagination

Any endpoint returning a collection that can grow unbounded must paginate.

Use consistent pagination parameters and response metadata across all
endpoints (e.g. `page`, `pageSize`, `totalCount`).

---

# Filtering and Sorting

Use query parameters for filtering and sorting. Document the allowed fields
explicitly; never allow arbitrary field injection into a query.

---

# Status Codes

Use standard HTTP status codes consistently:

- 200 for successful reads
- 201 for successful creation, with a Location header
- 204 for successful actions with no response body
- 400 for validation errors
- 401 for missing/invalid authentication
- 403 for authorization failures
- 404 for missing resources
- 409 for conflicts
- 422 for semantically invalid requests
- 500 only for unexpected server errors

---

# Error Format

Use a single, consistent error response shape across every endpoint.

Include a machine-readable error code and a human-readable message. Never
include stack traces or internal exception details in the response.

---

# Idempotency

State-changing operations that may be retried (payments, order creation)
must be idempotent, typically via an idempotency key.

---

# Backward Compatibility

Adding an optional field is safe. Removing or renaming a field, or changing
a field's type or semantics, is a breaking change and requires a new
version.

---

# Documentation

Every endpoint must be documented (OpenAPI/Swagger), including request and
response schemas and possible error responses.

---

# AI Rules

Agents must never

- Invent an endpoint, field, or response shape not documented in the architecture
- Return internal implementation details (stack traces, entity internals) in a response
- Introduce a breaking change to a published API version without explicit instruction
