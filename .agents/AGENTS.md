---
id: AG-LOADER-GLOBAL-001
version: 1.0.0
scope: global
status: active
supersedes: []
depends: []
last-updated: 2025-10-19
owner: team-admin
---

# Global AGENTS Loader — knue-event-harvester-cf

> Loader stub that enforces modular policy order for this repository.

## Load Order

1. .agents/00-foundations/**
2. .agents/10-policies/**
3. .agents/20-workflows/**
4. .agents/30-roles/**
5. .agents/40-templates/**
6. .agents/90-overrides/**

Follow lexicographic ordering within each folder. Later prefixes override earlier ones. Local `.agents/<folder>/AGENTS.md` files take precedence within their scope.
