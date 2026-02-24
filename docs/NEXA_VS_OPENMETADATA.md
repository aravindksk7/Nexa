# Nexa vs OpenMetadata: Feature Comparison

This document compares Nexa's current and planned capabilities with OpenMetadata, two open-source metadata and data governance platforms.

## Overview

| Aspect | Nexa | OpenMetadata |
|--------|------|--------------|
| **Focus** | Active governance, data stewardship, semantic mapping | Metadata ingestion, discovery, collaboration |
| **Primary Use Case** | Enforce metadata policies, manage data lineage, business glossary mapping | Catalog discovery, multi-source metadata centralization |
| **Architecture** | Node.js + Next.js, lightweight | Java-based, containerized |
| **Database** | PostgreSQL/SQL Server | Postgres (MySQL in roadmap) |

## Core Features

### 1. Metadata Catalog

| Feature | Nexa | OpenMetadata |
|---------|------|--------------|
| Asset versioning | ✅ Yes | ✅ Yes |
| Asset profiling | ✅ Yes | ✅ Yes (extensive) |
| Custom properties | ✅ Yes | ✅ Yes |
| Schema exploration | ✅ Yes | ✅ Yes (20+ connectors) |
| Owner/steward assignment | ✅ Yes | ✅ Yes |
| Tags/classification | ✅ Yes | ✅ Yes (business glossary terms) |

**Differentiation:**
- **Nexa**: Simplified, focus on precise ownership and manual validation
- **OpenMetadata**: Extensive connector ecosystem for auto-ingestion from 20+ platforms (Snowflake, BigQuery, Redshift, Databricks, etc.)

### 2. Lineage Tracking

| Feature | Nexa | OpenMetadata |
|---------|------|--------------|
| Asset-level lineage | ✅ Yes | ✅ Yes |
| Column-level lineage | ✅ Yes | ✅ Yes |
| SQL parsing for lineage | ✅ Yes | ✅ Yes (better fidelity) |
| OpenLineage support | ✅ Yes (ingestion) | ✅ Yes (ingestion + serving) |
| Manual lineage creation | ✅ Yes | ❌ No (auto-ingestion only) |
| Impact analysis | ✅ Yes | ✅ Yes |
| Upstream/downstream traversal | ✅ Yes | ✅ Yes |

**Differentiation:**
- **Nexa**: Allows manual lineage definition for non-standard pipelines; planned SQL diff-based blast-radius simulation
- **OpenMetadata**: Powerful auto-ingestion from dbt, Airflow, Spark; better production-grade parsing

### 3. Business Glossary

| Feature | Nexa | OpenMetadata |
|---------|------|--------------|
| Business terms | ✅ Yes | ✅ Yes |
| Domain/hierarchy | ✅ Yes | ✅ Yes |
| Synonyms | ✅ Yes | ✅ Yes |
| Semantic mapping (term → asset) | ✅ Yes | ✅ Yes (table/column tags) |
| Term lineage | ✅ Planned | ✅ Yes (via business lineage) |
| Relationship tracking | ⚠️ Basic | ✅ Rich |

**Differentiation:**
- **Nexa**: Explicit semantic mappings show which assets consume/produce business concepts
- **OpenMetadata**: Glossary terms auto-linked to lineage; stronger collaboration features

### 4. Data Quality

| Feature | Nexa | OpenMetadata |
|---------|------|--------------|
| Quality rules definition | ✅ Yes | ✅ Yes |
| Quality dashboards | ✅ Yes | ✅ Yes |
| Alert/SLA tracking | ⚠️ Planned | ✅ Yes |
| Quality incident management | ❌ No | ✅ Yes |

**Differentiation:**
- **OpenMetadata**: Purpose-built SLA/incident workflows; integration with quality tools

### 5. Collaboration & Governance

| Feature | Nexa | OpenMetadata |
|---------|------|--------------|
| Announcements | ❌ No | ✅ Yes |
| Teams (shared ownership) | ❌ No | ✅ Yes |
| Request/approval workflows | ⚠️ Planned | ✅ Yes |
| Data product certification | ⚠️ Planned | ✅ Yes |
| Activity feed | ❌ No | ✅ Yes |
| Comments/discussion | ❌ No | ✅ Yes |

**Differentiation:**
- **OpenMetadata**: Rich social collaboration and team features
- **Nexa (Planned)**: Workflow automation studio with approvals, SLA timers, escalation rules

### 6. Access Control & Security

| Feature | Nexa | OpenMetadata |
|---------|------|--------------|
| RBAC (Admin/Steward/Engineer) | ✅ Yes | ✅ Yes (more granular) |
| LDAP/SSO | ✅ Yes | ✅ Yes |
| OAuth2 | ⚠️ Planned | ✅ Yes |
| Column-level access tracking | ❌ No | ⚠️ Planned |
| ABAC policies | ❌ No | ⚠️ Planned |
| Data lineage access control | ❌ No | ⚠️ Planned |

### 7. Data Connectors

| Aspect | Nexa | OpenMetadata |
|--------|------|--------------|
| **Supported Sources** | PostgreSQL, SQL Server (via Docker), manual upload | 50+ connectors (Snowflake, Redshift, BigQuery, Databricks, dbt, Airflow, Kafka, etc.) |
| **Auto-ingestion** | Limited | Extensive |
| **Lineage Ingestion** | OpenLineage protocol | OpenLineage, dbt, Airflow, custom parsers |
| **Schema Sync** | Manual | Automated with versioning |

**Differentiation:**
- **OpenMetadata**: Enterprise connector library for auto-sync from all major platforms
- **Nexa**: Lightweight, focused on core functionality; extensible via custom connectors

## Roadmap Alignment

### Nexa Phase 1 (Active Governance MVP)

1. **Policy Enforcement** ✅
   - Policy-as-code for sensitive data  
   - Ingestion/transformation checks  
   - *OpenMetadata equivalent*: Access policies, data quality rules

2. **Unified Trust Score** ✅
   - Asset freshness, quality, incidents  
   - *OpenMetadata equivalent*: Building similar; currently has quality metrics

3. **Workflow Automation** ✅
   - Approvals, SLA timers, escalation  
   - *OpenMetadata equivalent*: Request/approval workflows (basic)

4. **Enterprise Access Intelligence** ✅
   - Column-level access events  
   - Anomaly alerts  
   - *OpenMetadata equivalent*: Roadmap item

### Nexa Phase 2 (Governance Depth)

- Semantic layer + metrics governance
- AI governance copilot (suggest glossary terms, auto-draft rules)
- Data product operating model (contracts, SLOs, lifecycle)
- Enhanced lineage sync (dbt, BI deep sync)

### OpenMetadata Strengths

- Mature open-source with active community (10K+ GitHub stars)
- Extensive pre-built connectors
- Rich collaboration UI (teams, announcements, discussions)
- Advanced job scheduling and orchestration for metadata tasks

## Positioning Matrix

```
                    ↑ Ease of Use / Light Weight
                    |
Nexa        ●●● ← Simple, focused, policy-first
            |     Active governance
            |
OpenMetadata     ● ← Feature-rich, connector-centric
            |       Discovery-focused
            |
            └─────────→ Number of Integrations / Catalog Scale
```

## When to Choose Nexa

- ✅ Need **active enforcement** of metadata policies
- ✅ Complex **semantic mappings** (glossary term → data asset relationships)
- ✅ Focus on **data stewardship** workflows and approval processes
- ✅ Want a **lightweight, developer-friendly** platform
- ✅ Using **OpenLineage** for upstream lineage ingestion
- ✅ Regulated environments needing **trust scores** and **incident tracking**
- ✅ Prefer **custom governance logic** over pre-built connectors

## When to Choose OpenMetadata

- ✅ Need **500+ assets** from multiple platforms (Snowflake, Redshift, BigQuery, etc.)
- ✅ Want **auto-ingestion** with minimal manual setup
- ✅ Require **rich collaboration** (teams, announcements, discussions)
- ✅ Have **dbt + Airflow** pipelines with native lineage tracking
- ✅ Need **mature feature set** (quality, certification, data products)
- ✅ Building **self-service data discovery** portal
- ✅ Want **community-driven** development (larger ecosystem)

## Complementary Use Cases

### Use Both

Some organizations adopt both in complementary roles:

1. **OpenMetadata** = Discovery layer
   - Ingest all metadata from data platforms
   - Enable self-service exploration
   - Track asset profiling and quality

2. **Nexa** = Governance layer
   - Define policies and stewardship rules
   - Map business glossary terms to OpenMetadata assets
   - Enforce approval workflows
   - Track trust scores and lineage impact

**Integration pattern:**
```
Data Sources ──→ OpenMetadata ──→ Catalog Discovery
                     ↓
                  Nexa API/webhooks
                     ↓
              Glossary Mapping + Policy Enforcement
```

## Technical Debt Comparison

| Area | Nexa | OpenMetadata |
|------|------|--------------|
| Test coverage | Medium | High |
| Production readiness | v3.0.2 (stable core) | v1.4+ (production-grade) |
| Documentation | Good | Excellent |
| Community size | Growing | Large |
| Enterprise support | ❌ No | ✅ Yes |

## Cost of Ownership

| Aspect | Nexa | OpenMetadata |
|--------|------|--------------|
| **Licensing** | MIT | SSPL (commercial exemption) / Community license |
| **Hosting** | Simple (Node.js + Postgres) | More resource-intensive (Java) |
| **Connectors** | Manual/custom | Pre-built (included) |
| **Operational Overhead** | Low | Medium |

## Recommendation Summary

| Scenario | Recommendation |
|----------|-----------------|
| Small team, strong governance focus | **Nexa** |
| Enterprise with multi-platform data | **OpenMetadata** |
| Need policy enforcement + discovery | **Both (complementary)** |
| Regulated industry (HIPAA, SOX, GDPR) | **Nexa** (policy-first) |
| Self-service data democratization | **OpenMetadata** |
| Custom lineage workflows | **Nexa** |

---

## References

- **Nexa**: https://github.com/aravindksk7/Nexa
- **OpenMetadata**: https://github.com/open-metadata/OpenMetadata
- **OpenLineage**: https://openlineage.io/

*Document last updated: Feb 24, 2026*
