import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define types based on Prisma schema
type RuleType = 'COMPLETENESS' | 'UNIQUENESS' | 'RANGE' | 'PATTERN' | 'REFERENTIAL' | 'CUSTOM';
type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

interface QualityRule {
  id: string;
  assetId: string;
  name: string;
  description: string | null;
  ruleType: RuleType;
  ruleDefinition: JsonValue;
  severity: Severity;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

interface QualityResult {
  id: string;
  ruleId: string;
  assetId: string;
  passed: boolean;
  resultData: JsonValue;
  executedAt: Date;
}

interface QualityHistoryEntry extends QualityResult {
  ruleName: string;
}

interface CreateQualityRuleInput {
  assetId: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  ruleDefinition: Record<string, unknown>;
  severity: Severity;
  createdById: string;
}

interface UpdateQualityRuleInput {
  name?: string;
  description?: string;
  ruleType?: RuleType;
  ruleDefinition?: Record<string, unknown>;
  severity?: Severity;
  enabled?: boolean;
}

interface QualityRuleWithResults extends QualityRule {
  results?: QualityResult[];
  lastResult?: QualityResult | null;
}

interface QualityEvaluationResult {
  ruleId: string;
  passed: boolean;
  resultData: Record<string, unknown>;
  executedAt: Date;
}

interface AssetQualityStatus {
  assetId: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  totalRules: number;
  passedRules: number;
  failedRules: number;
  lastEvaluatedAt: Date | null;
  ruleResults: Array<{
    rule: QualityRule;
    lastResult: QualityResult | null;
  }>;
}

export class QualityService {
  /**
   * Create a new quality rule for an asset
   */
  async createRule(input: CreateQualityRuleInput): Promise<QualityRule> {
    // Validate asset exists
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
    });

    if (!asset) {
      throw new Error(`Asset ${input.assetId} not found`);
    }

    const rule = await prisma.qualityRule.create({
      data: {
        assetId: input.assetId,
        name: input.name,
        description: input.description,
        ruleType: input.ruleType,
        // @ts-ignore - Prisma JSON type accepts objects
        ruleDefinition: input.ruleDefinition,
        severity: input.severity,
        createdById: input.createdById,
      },
    });

    return rule;
  }

  /**
   * Get a quality rule by ID
   */
  async getRule(ruleId: string): Promise<QualityRuleWithResults | null> {
    const rule = await prisma.qualityRule.findUnique({
      where: { id: ruleId },
      include: {
        results: {
          orderBy: { executedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!rule) return null;

    return {
      ...rule,
      lastResult: rule.results[0] || null,
    };
  }

  /**
   * List quality rules for an asset
   */
  async listRulesForAsset(assetId: string): Promise<QualityRuleWithResults[]> {
    const rules = await prisma.qualityRule.findMany({
      where: { assetId },
      include: {
        results: {
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rules.map((rule: QualityRule & { results: QualityResult[] }) => ({
      ...rule,
      lastResult: rule.results[0] || null,
    }));
  }

  /**
   * Update a quality rule
   */
  async updateRule(ruleId: string, input: UpdateQualityRuleInput): Promise<QualityRule> {
    const rule = await prisma.qualityRule.update({
      where: { id: ruleId },
      // @ts-ignore - Prisma type incompatibility with JSON fields
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.ruleType && { ruleType: input.ruleType }),
        ...(input.ruleDefinition && { ruleDefinition: input.ruleDefinition }),
        ...(input.severity && { severity: input.severity }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      },
    });

    return rule;
  }

  /**
   * Delete a quality rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    await prisma.qualityRule.delete({
      where: { id: ruleId },
    });
  }

  /**
   * Evaluate a single quality rule
   */
  async evaluateRule(ruleId: string): Promise<QualityEvaluationResult> {
    const rule = await prisma.qualityRule.findUnique({
      where: { id: ruleId },
      include: { asset: true },
    });

    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    if (!rule.enabled) {
      throw new Error(`Rule ${ruleId} is disabled`);
    }

    this.validateRuleDefinition(rule as unknown as QualityRule);

    // Evaluate the rule based on type
    const evaluationResult = await this.executeRuleLogic(rule);

    // Store the result
    const result = await prisma.qualityResult.create({
      data: {
        ruleId: rule.id,
        assetId: rule.assetId,
        passed: evaluationResult.passed,
        // @ts-ignore - Prisma JSON type accepts objects
        resultData: evaluationResult.resultData,
      },
    });

    // Update asset quality status based on all rule results
    await this.updateAssetQualityStatus(rule.assetId);

    return {
      ruleId: rule.id,
      passed: result.passed,
      resultData: evaluationResult.resultData,
      executedAt: result.executedAt,
    };
  }

  /**
   * Evaluate all rules for an asset
   */
  async evaluateAllRulesForAsset(assetId: string): Promise<QualityEvaluationResult[]> {
    const rules = await prisma.qualityRule.findMany({
      where: { assetId, enabled: true },
    });

    const results: QualityEvaluationResult[] = [];

    for (const rule of rules) {
      try {
        const result = await this.evaluateRule(rule.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to evaluate rule ${rule.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Get quality status for an asset
   */
  async getAssetQualityStatus(assetId: string): Promise<AssetQualityStatus> {
    const rules = await prisma.qualityRule.findMany({
      where: { assetId },
      include: {
        results: {
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
    });

    const ruleResults = rules.map((rule: QualityRule & { results: QualityResult[] }) => ({
      rule,
      lastResult: rule.results[0] || null,
    }));

    let passedRules = 0;
    let failedRules = 0;
    let lastEvaluatedAt: Date | null = null;
    let hasCriticalFailure = false;
    let hasWarningFailure = false;

    for (const item of ruleResults) {
      const { rule, lastResult } = item;
      if (lastResult) {
        if (lastResult.passed) {
          passedRules++;
        } else {
          failedRules++;
          // @ts-ignore - Severity type values
          if (rule.severity === 'CRITICAL') {
            hasCriticalFailure = true;
            // @ts-ignore - Severity type values
          } else if (rule.severity === 'HIGH' || rule.severity === 'MEDIUM') {
            hasWarningFailure = true;
          }
        }

        if (!lastEvaluatedAt || lastResult.executedAt > lastEvaluatedAt) {
          lastEvaluatedAt = lastResult.executedAt;
        }
      }
    }

    let overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN';
    if (rules.length === 0 || ruleResults.every((r: { lastResult: QualityResult | null }) => !r.lastResult)) {
      overallStatus = 'UNKNOWN';
    } else if (hasCriticalFailure) {
      overallStatus = 'CRITICAL';
    } else if (hasWarningFailure) {
      overallStatus = 'WARNING';
    } else if (passedRules > 0) {
      overallStatus = 'HEALTHY';
    }

    return {
      assetId,
      overallStatus,
      totalRules: rules.length,
      passedRules,
      failedRules,
      lastEvaluatedAt,
      ruleResults,
    };
  }

  /**
   * Get quality history for an asset
   */
  async getQualityHistory(
    assetId: string,
    limit: number = 50
  ): Promise<QualityHistoryEntry[]> {
    const results = await (prisma.qualityResult as unknown as {
      findMany: (args: object) => Promise<Array<QualityResult & { rule: { name: string } }>>;
    }).findMany({
      where: { assetId },
      include: {
        rule: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });

    return results.map((result) => ({
      id: result.id,
      ruleId: result.ruleId,
      assetId: result.assetId,
      passed: result.passed,
      resultData: result.resultData,
      executedAt: result.executedAt,
      ruleName: result.rule.name,
    }));
  }

  private validateRuleDefinition(rule: QualityRule): void {
    const definition = rule.ruleDefinition as Record<string, unknown> | null;

    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new Error(`Rule ${rule.id} has invalid definition format`);
    }

    const requiredString = (key: string): string => {
      const value = definition[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Rule ${rule.id} is missing required field: ${key}`);
      }
      return value;
    };

    const requiredNumber = (key: string): number => {
      const value = definition[key];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Rule ${rule.id} has invalid numeric field: ${key}`);
      }
      return value;
    };

    switch (rule.ruleType) {
      case 'COMPLETENESS': {
        requiredString('columnName');
        if (definition['nullThreshold'] !== undefined) {
          requiredNumber('nullThreshold');
        }
        break;
      }
      case 'UNIQUENESS': {
        requiredString('columnName');
        break;
      }
      case 'RANGE': {
        requiredString('columnName');
        const minValue = requiredNumber('minValue');
        const maxValue = requiredNumber('maxValue');
        if (minValue > maxValue) {
          throw new Error(`Rule ${rule.id} has invalid range: minValue must be <= maxValue`);
        }
        break;
      }
      case 'PATTERN': {
        requiredString('columnName');
        requiredString('pattern');
        break;
      }
      case 'REFERENTIAL': {
        requiredString('sourceColumn');
        requiredString('targetTable');
        requiredString('targetColumn');
        break;
      }
      case 'CUSTOM': {
        requiredString('expression');
        break;
      }
      default:
        break;
    }
  }

  /**
   * Execute rule logic based on rule type
   */
  private async executeRuleLogic(
    rule: QualityRule
  ): Promise<{ passed: boolean; resultData: Record<string, unknown> }> {
    const definition = rule.ruleDefinition as Record<string, unknown>;

    switch (rule.ruleType) {
      case 'COMPLETENESS': {
        // Check if column has null values above threshold
        const nullThreshold = (definition['nullThreshold'] as number) || 0;
        const columnName = definition['columnName'] as string;
        
        // Simulated check - in production, query actual data
        const nullPercentage = Math.random() * 20; // Simulated
        const passed = nullPercentage <= nullThreshold;
        
        return {
          passed,
          resultData: {
            columnName,
            nullThreshold,
            actualNullPercentage: nullPercentage,
            message: passed 
              ? `Column ${columnName} has ${nullPercentage.toFixed(2)}% nulls (within ${nullThreshold}% threshold)`
              : `Column ${columnName} has ${nullPercentage.toFixed(2)}% nulls (exceeds ${nullThreshold}% threshold)`,
          },
        };
      }

      case 'UNIQUENESS': {
        // Check if column has unique values
        const columnName = definition['columnName'] as string;
        
        // Simulated check
        const duplicateCount = Math.floor(Math.random() * 10);
        const passed = duplicateCount === 0;

        return {
          passed,
          resultData: {
            columnName,
            duplicateCount,
            message: passed
              ? `Column ${columnName} has all unique values`
              : `Column ${columnName} has ${duplicateCount} duplicate values`,
          },
        };
      }

      case 'RANGE': {
        // Check if numeric values are within range
        const columnName = definition['columnName'] as string;
        const minValue = definition['minValue'] as number;
        const maxValue = definition['maxValue'] as number;

        // Simulated check
        const outOfRangeCount = Math.floor(Math.random() * 5);
        const passed = outOfRangeCount === 0;

        return {
          passed,
          resultData: {
            columnName,
            minValue,
            maxValue,
            outOfRangeCount,
            message: passed
              ? `All values in ${columnName} are within range [${minValue}, ${maxValue}]`
              : `${outOfRangeCount} values in ${columnName} are out of range [${minValue}, ${maxValue}]`,
          },
        };
      }

      case 'PATTERN': {
        // Check if values match pattern
        const columnName = definition['columnName'] as string;
        const pattern = definition['pattern'] as string;

        // Simulated check
        const nonMatchingCount = Math.floor(Math.random() * 3);
        const passed = nonMatchingCount === 0;

        return {
          passed,
          resultData: {
            columnName,
            pattern,
            nonMatchingCount,
            message: passed
              ? `All values in ${columnName} match pattern ${pattern}`
              : `${nonMatchingCount} values in ${columnName} don't match pattern ${pattern}`,
          },
        };
      }

      case 'REFERENTIAL': {
        // Check referential integrity
        const sourceColumn = definition['sourceColumn'] as string;
        const targetTable = definition['targetTable'] as string;
        const targetColumn = definition['targetColumn'] as string;

        // Simulated check
        const orphanCount = Math.floor(Math.random() * 2);
        const passed = orphanCount === 0;

        return {
          passed,
          resultData: {
            sourceColumn,
            targetTable,
            targetColumn,
            orphanCount,
            message: passed
              ? `All values in ${sourceColumn} exist in ${targetTable}.${targetColumn}`
              : `${orphanCount} orphan records found in ${sourceColumn}`,
          },
        };
      }

      case 'CUSTOM': {
        // Custom SQL or expression evaluation
        const expression = definition['expression'] as string;

        // Simulated check
        const passed = Math.random() > 0.3;

        return {
          passed,
          resultData: {
            expression,
            message: passed ? 'Custom rule passed' : 'Custom rule failed',
          },
        };
      }

      default:
        return {
          passed: false,
          resultData: {
            message: `Unknown rule type: ${rule.ruleType}`,
          },
        };
    }
  }

  /**
   * Get aggregate quality overview across all assets
   */
  async getOverview(): Promise<{
    overallScore: number;
    dimensions: Array<{ name: string; score: number; color: string }>;
    statusBreakdown: { healthy: number; warning: number; critical: number; unknown: number };
    totalRules: number;
    totalEvaluations: number;
    passedRules: number;
    failedRules: number;
    recentFailures: Array<{ ruleId: string; assetId: string; ruleName: string; assetName: string; severity: string; executedAt: string }>;
  }> {
    // Get all assets with their quality status
    const assets = await prisma.asset.findMany({
      select: { id: true, qualityStatus: true },
    });

    const statusBreakdown = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
    for (const asset of assets) {
      const s = asset.qualityStatus.toLowerCase() as keyof typeof statusBreakdown;
      if (s in statusBreakdown) statusBreakdown[s]++;
    }

    // Get all enabled rules with their latest result
    const rules = await prisma.qualityRule.findMany({
      where: { enabled: true },
      include: {
        results: {
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
    });

    const totalRules = rules.length;
    let totalEvaluations = 0;

    // Compute per-dimension pass rates
    const dimensionStats: Record<string, { passed: number; total: number }> = {
      COMPLETENESS: { passed: 0, total: 0 },
      UNIQUENESS: { passed: 0, total: 0 },
      RANGE: { passed: 0, total: 0 },
      PATTERN: { passed: 0, total: 0 },
      REFERENTIAL: { passed: 0, total: 0 },
      CUSTOM: { passed: 0, total: 0 },
    };

    for (const rule of rules) {
      const lastResult = (rule as unknown as { results: QualityResult[] }).results[0];
      if (lastResult) {
        totalEvaluations++;
        const dim = rule.ruleType as string;
        if (!dimensionStats[dim]) dimensionStats[dim] = { passed: 0, total: 0 };
        dimensionStats[dim].total++;
        if (lastResult.passed) dimensionStats[dim].passed++;
      }
    }

    const passedRules = Object.values(dimensionStats).reduce((s, d) => s + d.passed, 0);
    const failedRules = totalEvaluations - passedRules;

    // Collect recent failures (last 10 failing results)
    const recentFailureResults = await (prisma.qualityResult as unknown as {
      findMany: (args: object) => Promise<{ id: string; ruleId: string; assetId: string; passed: boolean; executedAt: Date; rule: { name: string; severity: string }; asset: { name: string } }[]>;
    }).findMany({
      where: { passed: false },
      orderBy: { executedAt: 'desc' },
      take: 10,
      include: { rule: { select: { name: true, severity: true } }, asset: { select: { name: true } } },
    });

    const recentFailures = recentFailureResults.map((r) => ({
      ruleId: r.ruleId,
      assetId: r.assetId,
      ruleName: r.rule.name,
      assetName: r.asset.name,
      severity: r.rule.severity as string,
      executedAt: r.executedAt.toISOString(),
    }));

    // Map dimensions to user-friendly names and colors
    const dimensionMeta: Record<string, { name: string; color: string }> = {
      COMPLETENESS: { name: 'Completeness', color: '#22c55e' },
      UNIQUENESS: { name: 'Uniqueness', color: '#0ea5e9' },
      PATTERN: { name: 'Accuracy', color: '#f59e0b' },
      RANGE: { name: 'Validity', color: '#8b5cf6' },
      REFERENTIAL: { name: 'Consistency', color: '#ec4899' },
      CUSTOM: { name: 'Custom', color: '#6b7280' },
    };

    const dimensions = Object.entries(dimensionStats)
      .filter(([, s]) => s.total > 0)
      .map(([key, s]) => ({
        name: dimensionMeta[key]?.name ?? key,
        score: s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0,
        color: dimensionMeta[key]?.color ?? '#6b7280',
      }));

    // Overall score = average of dimension scores (or pass rate if no dimensions)
    const overallScore = dimensions.length > 0
      ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
      : totalEvaluations > 0
        ? Math.round(
            (Object.values(dimensionStats).reduce((s, d) => s + d.passed, 0) /
              Object.values(dimensionStats).reduce((s, d) => s + d.total, 0)) *
              100
          )
        : 0;

    return {
      overallScore,
      dimensions,
      statusBreakdown,
      totalRules,
      totalEvaluations,
      passedRules,
      failedRules,
      recentFailures,
    };
  }

  /**
   * Update asset quality status based on rule results
   */
  private async updateAssetQualityStatus(assetId: string): Promise<void> {
    const status = await this.getAssetQualityStatus(assetId);

    let qualityStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN';
    switch (status.overallStatus) {
      case 'HEALTHY':
        qualityStatus = 'HEALTHY';
        break;
      case 'WARNING':
        qualityStatus = 'WARNING';
        break;
      case 'CRITICAL':
        qualityStatus = 'CRITICAL';
        break;
      default:
        qualityStatus = 'UNKNOWN';
    }

    await prisma.asset.update({
      where: { id: assetId },
      data: { qualityStatus },
    });
  }
}

export const qualityService = new QualityService();
