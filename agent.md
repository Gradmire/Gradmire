# Gradmire Agent Instructions

These instructions guide future coding work in this repository. They remain subordinate to the active session’s security rules, user permissions, and repository policies.

## Working on the codebase

- Inspect the relevant pages, shared assets, project documentation, and existing conventions before editing. Keep changes scoped to the user’s request; preserve unrelated work.
- Gradmire includes a static frontend. Prefer its existing HTML, CSS, and JavaScript patterns; do not introduce a framework, dependency, or build step unless the user asks for it or the change clearly requires it.
- Preserve responsive behavior, semantic markup, keyboard access, visible focus, and readable contrast. Respect `prefers-reduced-motion`; keep essential content available if optional JavaScript fails.
- Do not invent university partnerships, student outcomes, scholarship facts, visa rules, prices, or other factual claims. Use approved project content or cite/flag information that needs owner verification.

## Validate before delivery

For frontend changes, run the checks relevant to the edits, including:

1. `node scripts/check-frontend-links.mjs`
2. JavaScript syntax checks for changed shared and inline scripts
3. `git diff --check`
4. Desktop and mobile visual checks; check reduced-motion behavior when motion is changed

Report any checks that could not be run. Do not mark unrelated roadmap work complete.

## Git workflow

- For implementation requests, finish the requested change and validation, then commit only the relevant files to a descriptive feature-branch commit.
- When the user asks for the change to be pushed—or has established that implementation changes should be pushed—push the feature branch to the configured `origin` using the authenticated GitHub CLI/session credentials. Do not push directly to the default branch unless the user explicitly asks and repository permissions allow it.
- Do not create a pull request unless requested. After Git operations, verify and report the branch, commit, push result, and any remaining working-tree changes.
- If push is rejected or the account lacks repository permission, stop and report the failure. Do not try alternate accounts, bypass controls, or use a credential pasted into chat; ask the user to grant access or securely configure an authorized integration.

## Credential and secret handling

- Never use, copy, log, commit, or repeat access tokens, passwords, private keys, or other secrets pasted into conversation text.
- Use only credentials supplied through the approved, configured integration or secret store. Keep credentials out of source files, logs, screenshots, commits, and generated artifacts.
- If a secret is exposed in chat, treat it as compromised and advise the user to revoke it and securely configure a replacement; do not use it.
