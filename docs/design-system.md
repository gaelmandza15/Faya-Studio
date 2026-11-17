# Design systems

Faya-Studio uses a `design.md` file as the visual contract for generated
applications. It is written for an AI agent: YAML frontmatter holds the tokens,
the body explains how to apply them, and the Do's/Don'ts section forbids the
most common drift.

## Current model

`design/clean-soft.md` is the only model exposed for now.

- Canvas `#F5F6F8`, white surfaces, near-invisible borders and very soft
  shadows.
- Deep black pill buttons and active navigation.
- A vivid accent for contextual links and highlight cards.
- Pastel semantic pairs for statuses.
- Plus Jakarta Sans / Inter, tabular numbers, strict type scale.
- Fixed App Shell: 64px topbar, 228px sidebar, scrollable content.
- 16px panels, 12px inputs/nested cards, pill buttons.

The engine reads this file for every new generation, copies it to the project
workspace as `design.md`, and appends its full content to the system prompt as
the authoritative design contract.

## Why a file

- One source of truth for tokens and component rules.
- Easy to version and review independently from the engine code.
- The same contract can be read by a human, an agent, or a future design tool.
- Prevents each generated app from inventing its own palette, radii and layout.

## Rules

- A design file must be self-contained: tokens, typography, spacing, layout,
  shapes, elevation and component guidance.
- It must not depend on external assets; generated apps are offline.
- It should allow branding through a small number of tokens (for example the
  accent and the logo), not through structural changes.
- The frontmatter is parsed by humans and agents today; a strict parser can be
  added later without changing the format.

## Future variants

Additional files can be added under `design/` (for example `soft-dark.md`,
`editorial.md`, `industrial.md`). The user-facing selector will map a project
to one of these files. Until then, `clean-soft.md` is always used for new
projects.

Existing projects keep their current visual identity until they are
regenerated or explicitly migrated to a design system.
