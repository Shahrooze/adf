# Naming Policy

## Feature ID

Every feature gets a unique sequential ID.

Format: FEAT-<NNN>

NNN is zero-padded to 3 digits.

To assign the next ID, run `node adf-core/cli.mjs next-id` — it scans `features/**` and `_archive/**` for the highest `FEAT-<NNN>` prefix in use and prints the next one (`001` if none exist yet). This is the authoritative source; do not compute it by hand.

---

## Feature Folder Name

Format: FEAT-<NNN>-<slug>

slug is kebab-case, lowercase, 2-5 words, no articles.

slug describes the feature, not the screen or component.

Example: FEAT-014-custom-challenge-creation

---

## Forbidden

- Folder name without a FEAT-<NNN> prefix
- Non-sequential or reused IDs
- Uppercase or snake_case in the slug
- Renaming a feature folder after Architecture stage has started

---

## Scope

This policy governs new features only.

Do not rename existing features/** folders to satisfy this policy unless a migration is explicitly requested.

---

## AI Rules

Always read this file before creating a feature folder, even when other policies are skipped for that stage.

Never invent an ID. Derive it from the current contents of features/.
