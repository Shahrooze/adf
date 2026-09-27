Feature Specification

Status: Ready for Product Review

⸻

Metadata

* Feature Name: Archive a Project
* Feature ID: FEAT-001 (folder: FEAT-001-archive-project)
* Author: Feature Agent
* Created At: 2026-09-14
* Updated At: 2026-09-15
* Status: Ready for Product Review
* Priority: High
* Estimated Complexity: Small

⸻

Summary

Project Owners can archive a project they no longer actively work on, and unarchive it later. Archived projects disappear from the default project list, become read-only for everyone, and remain reachable under an "Archived" filter on the project list.

⸻

Business Goal

Users accumulate finished projects that clutter their project list, and today the only way to remove them is deletion, which destroys history. Support tickets tagged "cannot hide old project" averaged 14 per month over the last quarter.

Archiving lets users hide finished work without losing it.

Success is measured by:

* Support tickets tagged "cannot hide old project" drop from 14/month to 3/month or fewer within 60 days of release.
* Project deletions drop by at least 30% within 60 days of release (baseline: 210 deletions/month).
* At least 20% of Owners with 10+ projects archive at least one project within 60 days.

⸻

Personas

* Name: Project Owner
  * Goal: Keep the project list focused on current work without losing finished projects.
  * Permissions: Full control of the projects they own, including archive and unarchive.
  * Notes: Exactly one Owner per project (existing product rule).

* Name: Project Member
  * Goal: Find and reference past project content.
  * Permissions: View and edit content of projects they belong to; cannot archive or unarchive.
  * Notes: Includes Members with the existing "Editor" and "Viewer" roles.

⸻

User Stories

* US-001: As a Project Owner, I want to archive a finished project, so that it no longer clutters my project list.
* US-002: As a Project Owner, I want to unarchive a project, so that my team can resume work on it.
* US-003: As a Project Member, I want to browse archived projects, so that I can reference past work.
* US-004: As a Project Member, I want archived projects to be clearly marked and protected from changes, so that historical records stay accurate.

⸻

Functional Requirements

* FR-001: The Owner can archive an active project after confirming the action. Priority: Must. Related User Story: US-001.
* FR-002: The Owner can unarchive an archived project. Priority: Must. Related User Story: US-002.
* FR-003: The default project list shows only active projects. Priority: Must. Related User Story: US-001.
* FR-004: The project list offers an "Archived" filter that shows only the archived projects the user is a member of. Priority: Must. Related User Story: US-003.
* FR-005: An archived project is read-only: its details, tasks and comments cannot be created, changed or deleted. Priority: Must. Related User Story: US-004.
* FR-006: An archived project shows who archived it and when. Priority: Should. Related User Story: US-004.

⸻

Business Rules

* BR-001: Only the project's Owner may archive or unarchive it. Reason: Archiving affects every member's view of the project. Applies To: FR-001, FR-002.
* BR-002: No one, including the Owner, may change an archived project's content; the only allowed change is unarchiving. Reason: Archived projects are historical records. Applies To: FR-005.
* BR-003: Archiving never deletes or alters project content; unarchiving restores the project exactly as it was. Reason: Archiving must be a safe, reversible alternative to deletion. Applies To: FR-001, FR-002.
* BR-004: Archiving an already archived project, or unarchiving an active one, leaves the project in the requested state and does not change who archived it or when. Reason: Repeated clicks or two open tabs must not produce errors or misleading history. Applies To: FR-001, FR-002, FR-006.
* BR-005: Archiving does not change membership; every member keeps read access to the archived project. Reason: Members must still be able to reference past work. Applies To: FR-004, FR-005.

⸻

Non Functional Requirements

* NFR-001 (Performance): Archive and unarchive complete in under 500 ms at p95; the project list (either filter) loads in under 800 ms at p95 for a user with 1,000 projects.
* NFR-002 (Security): Rules BR-001 and BR-002 are enforced by the server, not only by hiding controls.
* NFR-003 (Availability): Releasing this feature requires no downtime.
* NFR-004 (Scalability): Supports users with up to 5,000 archived projects; the Archived list is paginated.
* NFR-005 (Accessibility): All new UI meets WCAG 2.2 AA (policies/accessibility.md).
* NFR-006 (Localization): All new user-facing text is translatable; dates are shown in the viewer's locale and time zone.
* NFR-007 (Observability): Every archive and unarchive is recorded in the audit log with actor, project and time.

⸻

Permissions

* View: All project members can view active and archived projects they belong to.
* Create: No member can create tasks or comments in an archived project.
* Update: No member can update an archived project or its content (BR-002).
* Delete: No member can delete content of an archived project. Deleting the project itself is unchanged and out of scope.
* Approve: Not applicable.
* Archive: Owner only (BR-001). Unarchive: Owner only (BR-001).

⸻

Validation Rules

* VR-001: Archive and unarchive apply only to a project that exists and that the requester is a member of; otherwise the project is reported as not found.
* VR-002: The project list filter accepts only "Active" or "Archived".

⸻

Edge Cases

* EC-001: The user has no archived projects: the Archived filter shows an empty state.
* EC-002: The Owner clicks Archive twice or archives from two tabs: BR-004 applies, no error.
* EC-003: A Member who is not the Owner attempts to archive by calling the API directly: the request is refused and the project is unchanged.
* EC-004: A Member is editing a task when the Owner archives the project: the Member's save is refused with a message that the project was archived; nothing is saved.
* EC-005: A user opens a bookmarked link to an archived project: the project opens in read-only mode.
* EC-006: A user tries to archive a project that was deleted: the project is reported as not found.
* EC-007: A user with thousands of archived projects opens the Archived filter: results are paginated.
* EC-008: The user who archived the project has since left the organization: the project shows "Archived by a former member".

⸻

Out of Scope

* Automatic archiving (e.g. after inactivity).
* Bulk archive / unarchive of several projects at once.
* Email or in-app notifications about archiving.
* Organization-admin override of BR-001.
* Changes to project deletion.
* Including archived projects in global search results.

⸻

Acceptance Criteria

* AC-001 (FR-001): Given an Owner on an active project's settings, when they choose Archive and confirm, then the project is shown as Archived and no longer appears in the default project list.
* AC-002 (FR-001): Given an Owner in the archive confirmation, when they cancel, then the project remains active and unchanged.
* AC-003 (FR-002): Given an Owner on an archived project, when they choose Unarchive, then the project appears in the default project list and can be edited again.
* AC-004 (FR-003): Given a user who belongs to both active and archived projects, when they open the project list, then only active projects are listed.
* AC-005 (FR-004): Given the same user, when they select the Archived filter, then only archived projects they are a member of are listed, each labeled "Archived".
* AC-006 (BR-001): Given a Member who is not the Owner, when they view an active or archived project, then no Archive or Unarchive control is shown, and a direct archive or unarchive request is refused with a permission error and the project is unchanged.
* AC-007 (FR-005, BR-002): Given any member on an archived project, then no edit, create or delete controls are shown, and any direct change request is refused with a "project is archived" error and no data changes.
* AC-008 (FR-006): Given an archived project, when any member opens it, then a banner shows "Archived by {name} on {date}".
* AC-009 (BR-003): Given a project with tasks and comments, when it is archived and then unarchived, then every task and comment is present and unchanged.
* AC-010 (BR-004): Given an archived project, when the Owner archives it again, then the request succeeds and the archived-by name and date are unchanged.
* AC-011 (BR-005): Given a Member of an archived project, when they open it from the Archived filter, then they can view all of its tasks and comments.

⸻

Risks

* User confusion: Members may think an archived project was deleted. Mitigated by the Archived filter and clear labeling.
* Business inconsistency: Owners may archive projects that others still use. Accepted; unarchive is one click and fully restorative (BR-003).
* Discoverability: Users may not notice the Archived filter.

⸻

Assumptions

* Each project has exactly one Owner (existing rule, confirmed by Product Owner 2026-09-15).
* Transferring ownership of an archived project is not allowed while archived; this follows from BR-002 (confirmed by Product Owner 2026-09-15).
* Existing roles Editor and Viewer are both "Members" for this feature.

⸻

Dependencies

Internal dependencies

* Existing project list, project detail and project settings screens.
* Existing project membership and roles.
* Existing audit log.

External dependencies

* None.

Third-party services

* None.

⸻

Open Questions

None. Both questions raised during discovery (ownership transfer while archived; archived projects in search) were answered by the Product Owner on 2026-09-15 and recorded under Assumptions and Out of Scope.

⸻

Definition of Ready

* [x] Business Goal completed
* [x] Personas identified
* [x] User Stories completed
* [x] Functional Requirements completed
* [x] Business Rules completed
* [x] Acceptance Criteria completed
* [x] Risks documented
* [x] No unresolved critical questions

⸻

Delivery Track

TRACK: FULL

Justification: adds database columns (a migration) and new API endpoints, so it does not qualify for the quick-change track.

⸻

Approval

Product Owner: Dana Whitfield

Status: Approved for Product Review

Approved At: 2026-09-15

⸻

STATUS: READY_FOR_PRODUCT_REVIEW
