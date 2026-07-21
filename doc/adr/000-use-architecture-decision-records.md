# 000. Use Architecture Decision Records

Date: 2026-07-22

## Status

Accepted

## Context

As the `opencode-qwencloud-provider` project grows — adding new models, plugins, custom tools, and CI workflows — architectural decisions accumulate without a lightweight, discoverable record. Without ADRs, future contributors must dig through commit history or ask around to understand _why_ something was built a certain way.

## Decision

We will use Architecture Decision Records (ADRs) for all significant architectural decisions in this project. ADRs are short Markdown files stored in `doc/adr/`, numbered sequentially, and follow the lifecycle: **Proposed → Accepted → Deprecated / Superseded**.

We will write the first ADR as a bootstrap record (this file) so that future decisions have a baseline to reference.

## Consequences

### Positive

- Decisions become self-documenting and discoverable in-repo
- New contributors gain project context quickly
- Settled decisions are clearly marked, reducing revisitation

### Negative

- Minor overhead to write an ADR for each significant decision
- Discipline required to keep ADRs up to date when decisions change
