# Nexa Product Roadmap

This roadmap prioritizes capabilities that can differentiate Nexa against enterprise data intelligence platforms by emphasizing automation, developer experience, and active governance.

## Roadmap Goals

- Move from passive metadata cataloging to active, enforceable governance
- Reduce stewardship effort through AI-assisted metadata operations
- Improve trust and adoption through measurable reliability and self-service UX
- Strengthen enterprise readiness for regulated environments

## Phase 1 (0–90 Days) — Differentiation MVP

### 1) Active Metadata Policy Enforcement
- Add policy-as-code definitions for sensitive data and quality thresholds
- Enforce policy checks in ingestion/transformation flows with block/warn modes
- Surface policy violations in asset detail and workflow queues

### 2) Unified Trust Score
- Compute trust score per asset from freshness, quality, incidents, and schema drift
- Expose trust score in catalog cards, search ranking, and lineage nodes
- Add confidence trends and top risk drivers per asset

### 3) Workflow Automation Studio (MVP)
- Introduce configurable no-code workflows for approvals and exception handling
- Add SLA timers, escalation rules, and notification hooks
- Connect workflow outcomes to asset governance status

### 4) Enterprise Access Intelligence (MVP)
- Track column-level access events for sensitive fields
- Add anomaly alerts for unusual access patterns
- Provide least-privilege recommendations for high-risk assets

## Phase 2 (3–6 Months) — Governance Depth

### 5) Semantic Layer + Metrics Governance
- Add governed business metrics with ownership and versioning
- Link metrics to upstream transformations and downstream BI assets
- Introduce impact simulation before metric definition changes

### 5.5) Rich Relationship Tracking
- Enable fine-grained relationships between assets, glossary terms, metrics, and stakeholders
- Support relationship types: depends_on, produces, consumes, owns, certifies, validates
- Relationship versioning and change tracking (who related what, when, why)
- Relationship impact analysis (change propagation through relationship graph)
- Relationship governance (approval workflows for sensitive relationships)
- Metadata enrichment via relationships (inherit tags, classifications, trust scores)

### 7) AI Governance Copilot
- Suggest glossary terms, classifications, and owners from lineage/query patterns
- Auto-draft quality rules and remediation workflows
- Provide explainable recommendations with human approval gates

### 8) Data Product Operating Model
- Support data product contracts (inputs/outputs, SLOs, ownership)
- Add lifecycle states (draft, certified, deprecated, retired)
- Enable consumer onboarding and deprecation notices

### 9) OpenLineage + dbt + BI Deep Synchronization
- Expand transformation sync fidelity for SQL and model-level changes
- Add SQL diff-based blast-radius simulation for planned changes
- Improve cross-system lineage fidelity for BI dashboards and semantic entities

## Phase 3 (6–12 Months) — Enterprise Scale

### 10) Marketplace + Governed Data Sharing
- Build request/access marketplace with entitlement automation
- Add approved sample data sandbox workflows
- Enable governed one-click sharing with auditability

### 11) Enterprise Security & Compliance Packs
- Add advanced RBAC/ABAC policy controls and delegated administration
- Add SCIM lifecycle automation and identity governance hooks
- Provide compliance accelerators for GDPR, HIPAA, and SOX evidence workflows

### 12) Multi-Region / Multi-Tenant Controls
- Add region-aware data residency controls
- Support tenant-level policy inheritance and override
- Provide centralized audit export and operational observability

## Success Metrics

Track roadmap outcomes with platform-level KPIs:

- Policy enforcement coverage across critical data assets
- Mean time to detect and resolve data quality/governance incidents
- Percentage of certified assets and certified metrics
- Reduction in manual stewardship hours per month
- Search-to-consumption conversion and marketplace adoption

## Current-to-Roadmap Mapping

Existing Nexa capabilities that this roadmap builds on:

- Metadata catalog with versioning and profiling
- Asset, column, and business lineage with OpenLineage ingestion
- Business glossary and semantic mapping
- Data quality rules and overview dashboards
- Workflow and SSO administration modules

This roadmap focuses on turning those foundations into an active governance and data product platform with stronger enterprise differentiation.
