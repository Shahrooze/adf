Design Document

Status: Ready for Architecture

⸻

Metadata

* Feature Name: Archive a Project
* Feature ID: FEAT-001
* Author: Design Agent
* Created At: 2026-09-17
* Updated At: 2026-09-17
* Status: Ready for Architecture

⸻

Summary

Adds an Archive/Unarchive section to Project Settings, an Active/Archived filter to the Project List, and a read-only mode with an "Archived" banner to Project Detail. Covers US-001 to US-004 and FR-001 to FR-006. Resolves product-review PR-001 (date format) and PR-002 (refusal copy).

⸻

User Journey

* Project Owner: finishes a project, opens Project Settings, archives it, returns to a shorter Project List. Later opens the Archived filter, opens the project and unarchives it from the banner.
* Project Member: notices a project missing from the list, switches to the Archived filter, opens the project and reads its tasks and comments in read-only mode.

⸻

User Flow

* Flow A (US-001, FR-001, FR-003): SCR-001 Project List → project row → SCR-002 Project Detail → Settings → SCR-003 → "Archive project" → SCR-004 dialog → Confirm → SCR-002 in read-only mode with banner, toast "Project archived".
* Flow B (US-002, FR-002): SCR-001 with Archived filter → project row → SCR-002 (read-only) → banner "Unarchive" (Owner only) → SCR-002 editable, toast "Project restored". The same action is also available on SCR-003.
* Flow C (US-003, US-004, FR-004, FR-005, FR-006): SCR-001 → Archived filter → project row → SCR-002 read-only with banner.

⸻

Screen List

* SCR-001 Project List (modified). Purpose: list projects with an Active/Archived filter. FRs: FR-003, FR-004. Entry: main navigation "Projects", deep link /projects?status=archived. Exit: SCR-002.
* SCR-002 Project Detail (modified). Purpose: show project, tasks and comments; read-only with banner when archived. FRs: FR-002, FR-005, FR-006. Entry: SCR-001, deep link /projects/{id}. Exit: SCR-001, SCR-003.
* SCR-003 Project Settings (modified). Purpose: new "Archive" section with Archive or Unarchive action (Owner only). FRs: FR-001, FR-002. Entry: SCR-002 "Settings". Exit: SCR-004, SCR-002.
* SCR-004 Archive Confirmation Dialog (new, modal). Purpose: confirm archiving. FRs: FR-001. Entry: SCR-003. Exit: SCR-002 (confirm) or SCR-003 (cancel).

⸻

Navigation

* Primary: existing sidebar "Projects" → SCR-001 (defaults to Active).
* Secondary: filter state is kept in the URL query (?status=archived) so Back and bookmarks restore it; the Active filter uses no query parameter.
* Deep links: /projects/{id} works for archived projects and opens read-only (EC-005).
* For non-owners, SCR-003 shows no Archive section (AC-006); for archived projects, settings fields are read-only.

⸻

Component Hierarchy

* SCR-001: PageHeader > ProjectStatusFilter (NEW, shadcn Tabs: "Active", "Archived") > ProjectTable (existing) > ProjectRow (existing) + ArchivedBadge (NEW, shadcn Badge variant "secondary") > Pagination (existing).
* SCR-002: ArchivedBanner (NEW, shadcn Alert with Lucide `Archive` icon, text + Owner-only "Unarchive" Button) > ProjectHeader (existing, edit controls hidden when archived) > TaskList (existing, `readOnly` prop) > CommentThread (existing, composer hidden when archived).
* SCR-003: existing settings sections > ArchiveProjectSection (NEW, Card with description and Button "Archive project" or "Unarchive project").
* SCR-004: ArchiveProjectDialog (NEW, shadcn AlertDialog: title, body, "Cancel", "Archive project").

⸻

Forms

* FORM-001 Project Status Filter (SCR-001). Fields: status. Field Type: tab selection (single choice). Required. Default: Active.
* FORM-002 Archive Confirmation (SCR-004). Fields: none; confirmation buttons only. Default focus: "Cancel".

⸻

Validation Rules

* DV-001: The status filter accepts only Active or Archived; any other URL value falls back to Active (VR-002).
* DV-002: The "Archive project" and "Unarchive" buttons are disabled with a spinner while the request is pending, preventing duplicate submission (EC-002). A repeated request still succeeds per BR-004.

⸻

Loading States

* SCR-001: 5 skeleton table rows; the filter tabs stay interactive.
* SCR-002: existing page skeleton; banner area reserves its height to avoid layout shift.
* SCR-003: Archive section shows a skeleton button until project status is known.
* SCR-004: confirm button shows a spinner and "Archiving…"; Cancel is disabled.

⸻

Empty States

* SCR-001 Active: existing "No projects yet" state.
* SCR-001 Archived (EC-001): Lucide `Archive` icon, heading "No archived projects", text "Projects you archive will appear here."
* SCR-002: an archived project with no tasks shows the existing "No tasks" text without the "Add task" button.
* SCR-003 / SCR-004: not data-driven lists; no empty state.

⸻

Error States

* SCR-001: list load failure shows inline Alert "Couldn't load projects." with "Retry".
* SCR-002: any refused change on an archived project (EC-004) shows destructive toast "This project was archived. Your changes were not saved." and switches the page to read-only mode (resolves PR-002).
* SCR-003 / SCR-004: permission error shows toast "Only the project owner can archive this project."; system error shows toast "Something went wrong. Try again." and the dialog stays open.
* Not found (EC-006): existing 404 page.

⸻

Success States

* Archive (SCR-004 confirm): dialog closes, navigate to SCR-002, banner appears, toast "Project archived".
* Unarchive (SCR-002 banner or SCR-003): banner disappears, edit controls return, toast "Project restored".
* Banner text (AC-008, resolves PR-001): "Archived by {displayName} on {date}", date only, in the viewer's locale and time zone (e.g. "Sep 17, 2026"). Unknown user (EC-008): "Archived by a former member on {date}".

⸻

Responsive Behavior

* Mobile: filter tabs are full-width; ArchivedBadge moves under the project name; banner stacks text above a full-width Unarchive button; dialog becomes a bottom sheet width.
* Tablet: as desktop with a 2-column settings layout collapsed to 1 column.
* Desktop: filter tabs left-aligned above the table; banner is a single row with the button right-aligned.

⸻

Accessibility

* SCR-001: tabs use role="tablist" with arrow-key navigation; focus order Header → Filter → Table → Pagination; ArchivedBadge text "Archived" is read by screen readers (no icon-only badge).
* SCR-002: banner is role="status" and is the first focusable region after the header; Lucide icon is aria-hidden; read-only fields are rendered as text, not disabled inputs, so they remain readable.
* SCR-003: Archive button has aria-describedby pointing to the section description.
* SCR-004: AlertDialog traps focus, initial focus on "Cancel", Escape cancels, focus returns to "Archive project" button on close.
* All: text and badge contrast at least 4.5:1 using the tokens below; toasts announced via aria-live="polite" (destructive toasts "assertive").

⸻

Design Tokens

Reused from Tailwind/shadcn defaults (context/design-system.md is TBD); no new tokens.

* Color roles: `muted` / `muted-foreground` for banner and badge; `primary` for Unarchive; `destructive` for error toast only. Archive is reversible, so it is not styled as destructive.
* Typography scale: `text-sm` banner and badge, `text-lg` dialog title.
* Spacing scale: `gap-2`, `p-4` banner, `space-y-6` settings sections.
* Radius scale: `rounded-md` (shadcn default `--radius`).
* Elevation / shadow scale: dialog uses shadcn default `shadow-lg`; no other elevation changes.

⸻

Interaction Notes

* Tab switch updates the URL and refetches without full page reload.
* Toasts auto-dismiss after 5 s; destructive toasts persist until dismissed.
* Entering read-only mode fades in the banner (150 ms); respects prefers-reduced-motion.

⸻

Open UX Questions

* Should the Archived filter show a count badge? Non-Blocking; deferred to a future iteration.

⸻

Definition of Ready

* [x] Every Functional Requirement maps to at least one screen
* [x] Every data-driven screen documents Loading, Empty, Error and Success states
* [x] Accessibility is documented for every screen
* [x] Design Tokens are defined or reused
* [x] No Blocking Open UX Question remains

⸻

Approval

Design Lead: Priya Raman

Status: Approved

Approved At: 2026-09-17

⸻

STATUS: READY_FOR_ARCHITECTURE
