import { prisma } from '../lib/prisma.js';
import { Graph } from 'graphlib';
import { Parser, AST } from 'node-sql-parser';
import {
  ColumnLineageEdge,
  ColumnLineageGraph,
  ColumnLineageNode,
  ColumnLineageGraphEdge,
  ColumnImpactAnalysisResult,
  ImpactedColumn,
  CreateColumnLineageEdge,
  ColumnTransformationType,
  AssetType,
} from '../models/index.js';

class ColumnLineageService {
  private parser = new Parser();

  // =====================
  // Column Lineage Edge CRUD
  // =====================

  async createColumnLineageEdge(data: CreateColumnLineageEdge): Promise<ColumnLineageEdge> {
    // Validate source asset exists
    const sourceAsset = await prisma.asset.findUnique({
      where: { id: data.sourceAssetId },
    });
    if (!sourceAsset) {
      throw new Error('Source asset not found');
    }

    // Validate target asset exists
    const targetAsset = await prisma.asset.findUnique({
      where: { id: data.targetAssetId },
    });
    if (!targetAsset) {
      throw new Error('Target asset not found');
    }

    // Prevent self-references (same asset and column)
    if (data.sourceAssetId === data.targetAssetId && data.sourceColumn === data.targetColumn) {
      throw new Error('Column cannot have lineage to itself');
    }

    // Check if edge already exists
    const existingEdge = await prisma.columnLineageEdge.findUnique({
      where: {
        sourceAssetId_sourceColumn_targetAssetId_targetColumn: {
          sourceAssetId: data.sourceAssetId,
          sourceColumn: data.sourceColumn,
          targetAssetId: data.targetAssetId,
          targetColumn: data.targetColumn,
        },
      },
    });

    if (existingEdge) {
      // Update existing edge - build update object without undefined values
      const updateData: Record<string, unknown> = {
        transformationType: data.transformationType,
        confidence: data.confidence,
      };
      if (data.transformationExpression !== undefined) {
        updateData['transformationExpression'] = data.transformationExpression;
      }
      if (data.metadata !== undefined) {
        updateData['metadata'] = data.metadata;
      }
      const updated = await prisma.columnLineageEdge.update({
        where: { id: existingEdge.id },
        data: updateData as Record<string, unknown>,
      });
      return this.mapColumnLineageEdge(updated);
    }

    // Create new edge - build create object without undefined values
    const createData: Record<string, unknown> = {
      sourceAssetId: data.sourceAssetId,
      sourceColumn: data.sourceColumn,
      targetAssetId: data.targetAssetId,
      targetColumn: data.targetColumn,
      transformationType: data.transformationType,
      confidence: data.confidence ?? 1.0,
    };
    if (data.transformationExpression !== undefined) {
      createData['transformationExpression'] = data.transformationExpression;
    }
    if (data.lineageEdgeId !== undefined) {
      createData['lineageEdgeId'] = data.lineageEdgeId;
    }
    if (data.metadata !== undefined) {
      createData['metadata'] = data.metadata;
    }
    const edge = await prisma.columnLineageEdge.create({
      data: createData as Record<string, unknown>,
    });

    return this.mapColumnLineageEdge(edge);
  }

  async getColumnLineageEdge(id: string): Promise<ColumnLineageEdge | null> {
    const edge = await prisma.columnLineageEdge.findUnique({
      where: { id },
    });
    return edge ? this.mapColumnLineageEdge(edge) : null;
  }

  async deleteColumnLineageEdge(id: string): Promise<void> {
    await prisma.columnLineageEdge.delete({
      where: { id },
    });
  }

  async updateColumnLineageEdge(
    id: string,
    data: {
      transformationType?: ColumnTransformationType;
      transformationExpression?: string;
      confidence?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ColumnLineageEdge> {
    const existing = await prisma.columnLineageEdge.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Column lineage edge not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.transformationType !== undefined) {
      updateData['transformationType'] = data.transformationType;
    }
    if (data.transformationExpression !== undefined) {
      updateData['transformationExpression'] = data.transformationExpression;
    }
    if (data.confidence !== undefined) {
      if (data.confidence < 0 || data.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
      }
      updateData['confidence'] = data.confidence;
    }
    if (data.metadata !== undefined) {
      updateData['metadata'] = data.metadata;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('At least one field is required for update');
    }

    const updated = await prisma.columnLineageEdge.update({
      where: { id },
      data: updateData as Record<string, unknown>,
    });

    return this.mapColumnLineageEdge(updated);
  }

  async getColumnLineageForAsset(assetId: string): Promise<ColumnLineageEdge[]> {
    const edges = await prisma.columnLineageEdge.findMany({
      where: {
        OR: [
          { sourceAssetId: assetId },
          { targetAssetId: assetId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return edges.map(this.mapColumnLineageEdge);
  }

  // =====================
  // Column Lineage Traversal
  // =====================

  async getColumnUpstreamLineage(
    assetId: string,
    columnName: string,
    depth: number = 5
  ): Promise<ColumnLineageGraph> {
    const graph = await this.buildColumnLineageGraph();
    const nodeKey = `${assetId}:${columnName}`;

    const nodes: Map<string, ColumnLineageNode> = new Map();
    const edges: ColumnLineageGraphEdge[] = [];

    // Get asset info for starting node
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, name: true, assetType: true },
    });

    if (asset) {
      nodes.set(nodeKey, {
        assetId: asset.id,
        assetName: asset.name,
        column: columnName,
        assetType: asset.assetType as AssetType,
        depth: 0,
      });
    }

    await this.traverseColumnUpstream(graph, nodeKey, nodes, edges, 0, depth);

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  async getColumnDownstreamLineage(
    assetId: string,
    columnName: string,
    depth: number = 5
  ): Promise<ColumnLineageGraph> {
    const graph = await this.buildColumnLineageGraph();
    const nodeKey = `${assetId}:${columnName}`;

    const nodes: Map<string, ColumnLineageNode> = new Map();
    const edges: ColumnLineageGraphEdge[] = [];

    // Get asset info for starting node
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, name: true, assetType: true },
    });

    if (asset) {
      nodes.set(nodeKey, {
        assetId: asset.id,
        assetName: asset.name,
        column: columnName,
        assetType: asset.assetType as AssetType,
        depth: 0,
      });
    }

    await this.traverseColumnDownstream(graph, nodeKey, nodes, edges, 0, depth);

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  async performColumnImpactAnalysis(
    assetId: string,
    columnName: string,
    maxDepth: number = 10
  ): Promise<ColumnImpactAnalysisResult> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, name: true, assetType: true },
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    const graph = await this.buildColumnLineageGraph();
    const nodeKey = `${assetId}:${columnName}`;
    const impactedColumns: ImpactedColumn[] = [];
    const visited = new Set<string>();

    await this.collectColumnDownstreamImpact(
      graph,
      nodeKey,
      impactedColumns,
      visited,
      [],
      0,
      maxDepth
    );

    return {
      sourceAsset: {
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType as AssetType,
      },
      sourceColumn: columnName,
      impactedColumns,
      totalCount: impactedColumns.length,
    };
  }

  // =====================
  // Enhanced SQL Parsing for Column Lineage
  // =====================

  async parseSqlColumnLineage(
    sql: string,
    dialect: string = 'postgresql',
    sourceAssetMap?: Map<string, string> // table name -> asset ID
  ): Promise<{
    columnMappings: Array<{
      sourceTable: string;
      sourceColumn: string;
      targetColumn: string;
      transformationType: ColumnTransformationType;
      transformationExpression?: string;
    }>;
    errors: string[];
  }> {
    const columnMappings: Array<{
      sourceTable: string;
      sourceColumn: string;
      targetColumn: string;
      transformationType: ColumnTransformationType;
      transformationExpression?: string;
    }> = [];
    const errors: string[] = [];

    try {
      const ast = this.parser.astify(sql, { database: dialect as 'postgresql' | 'mysql' | 'mariadb' | 'transactsql' | 'flinksql' | 'bigquery' | 'db2' | 'hive' | 'redshift' | 'snowflake' | 'noql' | 'trino' | 'athena' | 'spark' | 'sqlite' }) as unknown as Record<string, unknown> | Array<Record<string, unknown>>;
      
      if (Array.isArray(ast)) {
        // Multiple statements
        for (const stmt of ast) {
          this.extractColumnLineageFromStatement(stmt, columnMappings, errors);
        }
      } else {
        this.extractColumnLineageFromStatement(ast, columnMappings, errors);
      }
    } catch (e) {
      errors.push(`SQL parsing error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return { columnMappings, errors };
  }

  private extractColumnLineageFromStatement(
    stmt: Record<string, unknown>,
    columnMappings: Array<{
      sourceTable: string;
      sourceColumn: string;
      targetColumn: string;
      transformationType: ColumnTransformationType;
      transformationExpression?: string;
    }>,
    errors: string[]
  ): void {
    const type = stmt['type'] as string | undefined;
    
    if (type === 'select' || type === 'create') {
      const columns = stmt['columns'] as Array<{
        expr?: { type?: string; column?: string; table?: string; args?: unknown };
        as?: string;
      }> | '*' | undefined;
      
      const from = stmt['from'] as Array<{
        table?: string;
        as?: string;
        join?: Array<{ table?: string; as?: string }>;
      }> | undefined;

      if (!columns || columns === '*' || !from) {
        return;
      }

      // Build table alias map
      const tableAliases = new Map<string, string>();
      for (const source of from) {
        if (source.table) {
          tableAliases.set(source.as ?? source.table, source.table);
        }
        if (source.join) {
          for (const j of source.join) {
            if (j.table) {
              tableAliases.set(j.as ?? j.table, j.table);
            }
          }
        }
      }

      for (const col of columns) {
        const targetColumn = col.as ?? (col.expr?.column as string | undefined) ?? 'unknown';
        
        if (col.expr) {
          const expr = col.expr;
          const exprType = expr.type as string | undefined;
          
          if (exprType === 'column_ref') {
            // Direct column reference
            const sourceTable = tableAliases.get(expr.table as string ?? '') ?? (expr.table as string | undefined) ?? 'unknown';
            const sourceColumn = expr.column as string ?? 'unknown';
            
            columnMappings.push({
              sourceTable,
              sourceColumn,
              targetColumn,
              transformationType: 'DIRECT',
            });
          } else if (exprType === 'aggr_func') {
            // Aggregation function (SUM, COUNT, AVG, etc.)
            const args = expr.args as { expr?: { column?: string; table?: string } } | undefined;
            if (args?.expr?.column) {
              const sourceTable = tableAliases.get(args.expr.table ?? '') ?? args.expr.table ?? 'unknown';
              columnMappings.push({
                sourceTable,
                sourceColumn: args.expr.column,
                targetColumn,
                transformationType: 'AGGREGATED',
                transformationExpression: this.reconstructExpression(expr),
              });
            }
          } else if (exprType === 'case') {
            // CASE expression
            columnMappings.push({
              sourceTable: 'multiple',
              sourceColumn: 'multiple',
              targetColumn,
              transformationType: 'CASE',
              transformationExpression: this.reconstructExpression(expr),
            });
          } else if (exprType === 'function') {
            // Function call (COALESCE, CONCAT, etc.)
            const funcName = (expr as { name?: string }).name?.toUpperCase() ?? '';
            if (funcName === 'COALESCE' || funcName === 'IFNULL' || funcName === 'NVL') {
              columnMappings.push({
                sourceTable: 'multiple',
                sourceColumn: 'multiple',
                targetColumn,
                transformationType: 'COALESCED',
                transformationExpression: this.reconstructExpression(expr),
              });
            } else {
              columnMappings.push({
                sourceTable: 'multiple',
                sourceColumn: 'multiple',
                targetColumn,
                transformationType: 'DERIVED',
                transformationExpression: this.reconstructExpression(expr),
              });
            }
          } else if (exprType === 'binary_expr') {
            // Binary expression (arithmetic, etc.)
            columnMappings.push({
              sourceTable: 'multiple',
              sourceColumn: 'multiple',
              targetColumn,
              transformationType: 'DERIVED',
              transformationExpression: this.reconstructExpression(expr),
            });
          }
        }
      }
    }
  }

  private reconstructExpression(expr: unknown): string {
    try {
      // Simplified expression reconstruction
      return JSON.stringify(expr);
    } catch {
      return 'complex_expression';
    }
  }

  // =====================
  // Private Helper Methods
  // =====================

  private async buildColumnLineageGraph(): Promise<Graph> {
    const edges = await prisma.columnLineageEdge.findMany({
      include: {
        sourceAsset: { select: { id: true, name: true, assetType: true } },
        targetAsset: { select: { id: true, name: true, assetType: true } },
      },
    });

    const graph = new Graph({ directed: true });

    for (const edge of edges) {
      const sourceKey = `${edge.sourceAssetId}:${edge.sourceColumn}`;
      const targetKey = `${edge.targetAssetId}:${edge.targetColumn}`;

      // Add nodes with metadata
      if (!graph.hasNode(sourceKey)) {
        graph.setNode(sourceKey, {
          assetId: edge.sourceAssetId,
          assetName: edge.sourceAsset.name,
          column: edge.sourceColumn,
          assetType: edge.sourceAsset.assetType,
        });
      }
      if (!graph.hasNode(targetKey)) {
        graph.setNode(targetKey, {
          assetId: edge.targetAssetId,
          assetName: edge.targetAsset.name,
          column: edge.targetColumn,
          assetType: edge.targetAsset.assetType,
        });
      }

      // Add edge with metadata
      graph.setEdge(sourceKey, targetKey, {
        transformationType: edge.transformationType,
        transformationExpression: edge.transformationExpression,
      });
    }

    return graph;
  }

  private async traverseColumnUpstream(
    graph: Graph,
    nodeKey: string,
    nodes: Map<string, ColumnLineageNode>,
    edges: ColumnLineageGraphEdge[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    const predecessors = graph.predecessors(nodeKey) as string[] | undefined;
    if (!predecessors) return;

    for (const predKey of predecessors) {
      const nodeData = graph.node(predKey) as {
        assetId: string;
        assetName: string;
        column: string;
        assetType: string;
      } | undefined;

      if (nodeData && !nodes.has(predKey)) {
        nodes.set(predKey, {
          assetId: nodeData.assetId,
          assetName: nodeData.assetName,
          column: nodeData.column,
          assetType: nodeData.assetType as AssetType,
          depth: currentDepth + 1,
        });

        const edgeData = graph.edge(predKey, nodeKey) as {
          transformationType: ColumnTransformationType;
          transformationExpression?: string;
        } | undefined;

        if (edgeData) {
          const edgeEntry: ColumnLineageGraphEdge = {
            sourceAssetId: nodeData.assetId,
            sourceColumn: nodeData.column,
            targetAssetId: nodes.get(nodeKey)!.assetId,
            targetColumn: nodes.get(nodeKey)!.column,
            transformationType: edgeData.transformationType,
          };
          if (edgeData.transformationExpression !== undefined) {
            edgeEntry.transformationExpression = edgeData.transformationExpression;
          }
          edges.push(edgeEntry);
        }

        await this.traverseColumnUpstream(graph, predKey, nodes, edges, currentDepth + 1, maxDepth);
      }
    }
  }

  private async traverseColumnDownstream(
    graph: Graph,
    nodeKey: string,
    nodes: Map<string, ColumnLineageNode>,
    edges: ColumnLineageGraphEdge[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    const successors = graph.successors(nodeKey) as string[] | undefined;
    if (!successors) return;

    for (const succKey of successors) {
      const nodeData = graph.node(succKey) as {
        assetId: string;
        assetName: string;
        column: string;
        assetType: string;
      } | undefined;

      if (nodeData && !nodes.has(succKey)) {
        nodes.set(succKey, {
          assetId: nodeData.assetId,
          assetName: nodeData.assetName,
          column: nodeData.column,
          assetType: nodeData.assetType as AssetType,
          depth: currentDepth + 1,
        });

        const edgeData = graph.edge(nodeKey, succKey) as {
          transformationType: ColumnTransformationType;
          transformationExpression?: string;
        } | undefined;

        if (edgeData) {
          const edgeEntry: ColumnLineageGraphEdge = {
            sourceAssetId: nodes.get(nodeKey)!.assetId,
            sourceColumn: nodes.get(nodeKey)!.column,
            targetAssetId: nodeData.assetId,
            targetColumn: nodeData.column,
            transformationType: edgeData.transformationType,
          };
          if (edgeData.transformationExpression !== undefined) {
            edgeEntry.transformationExpression = edgeData.transformationExpression;
          }
          edges.push(edgeEntry);
        }

        await this.traverseColumnDownstream(graph, succKey, nodes, edges, currentDepth + 1, maxDepth);
      }
    }
  }

  private async collectColumnDownstreamImpact(
    graph: Graph,
    nodeKey: string,
    impactedColumns: ImpactedColumn[],
    visited: Set<string>,
    currentPath: string[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(nodeKey)) return;
    visited.add(nodeKey);

    const successors = graph.successors(nodeKey) as string[] | undefined;
    if (!successors) return;

    for (const succKey of successors) {
      const nodeData = graph.node(succKey) as {
        assetId: string;
        assetName: string;
        column: string;
        assetType: string;
      } | undefined;

      if (nodeData && !visited.has(succKey)) {
        const path = [...currentPath, `${nodeData.assetName}.${nodeData.column}`];
        impactedColumns.push({
          assetId: nodeData.assetId,
          assetName: nodeData.assetName,
          column: nodeData.column,
          assetType: nodeData.assetType as AssetType,
          depth: currentDepth + 1,
          path,
        });

        await this.collectColumnDownstreamImpact(
          graph,
          succKey,
          impactedColumns,
          visited,
          path,
          currentDepth + 1,
          maxDepth
        );
      }
    }
  }

  private mapColumnLineageEdge(edge: {
    id: string;
    sourceAssetId: string;
    sourceColumn: string;
    targetAssetId: string;
    targetColumn: string;
    transformationType: string;
    transformationExpression: string | null;
    lineageEdgeId: string | null;
    confidence: number;
    metadata: unknown;
    createdAt: Date;
  }): ColumnLineageEdge {
    return {
      id: edge.id,
      sourceAssetId: edge.sourceAssetId,
      sourceColumn: edge.sourceColumn,
      targetAssetId: edge.targetAssetId,
      targetColumn: edge.targetColumn,
      transformationType: edge.transformationType as ColumnTransformationType,
      transformationExpression: edge.transformationExpression ?? undefined,
      lineageEdgeId: edge.lineageEdgeId ?? undefined,
      confidence: edge.confidence,
      metadata: edge.metadata as Record<string, unknown> | undefined,
      createdAt: edge.createdAt,
    };
  }
}

export const columnLineageService = new ColumnLineageService();
