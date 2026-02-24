import { Graph } from 'graphlib';
import { Parser } from 'node-sql-parser';
import { prisma } from '../lib/prisma.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import type {
  LineageEdge,
  CreateLineageEdge,
  LineageGraph,
  LineageNode,
  LineageGraphEdge,
  ImpactAnalysisResult,
  ImpactedAsset,
  ImpactPathStep,
  OpenLineageEvent,
  AssetType,
} from '../models/index.js';

interface UpdateLineageEdgeInput {
  transformationType?: string;
  transformationLogic?: string;
  metadata?: Record<string, unknown>;
}

const logger = createChildLogger('LineageService');

export class LineageService {
  private sqlParser: Parser;

  constructor() {
    this.sqlParser = new Parser();
  }

  /**
   * Ingest an OpenLineage event
   */
  async ingestLineageEvent(event: OpenLineageEvent): Promise<void> {
    logger.debug({ eventType: event.eventType, job: event.job.name }, 'Processing lineage event');

    if (event.eventType !== 'COMPLETE') {
      logger.debug('Skipping non-complete event');
      return;
    }

    const inputs = event.inputs ?? [];
    const outputs = event.outputs ?? [];

    for (const output of outputs) {
      // Find or create output asset
      let targetAsset = await this.findOrCreateAssetFromDataset(output);

      for (const input of inputs) {
        // Find or create input asset
        let sourceAsset = await this.findOrCreateAssetFromDataset(input);

        // Create lineage edge
        await this.createLineageEdge({
          sourceAssetId: sourceAsset.id,
          targetAssetId: targetAsset.id,
          transformationType: 'OPENLINEAGE',
          metadata: {
            jobNamespace: event.job.namespace,
            jobName: event.job.name,
            runId: event.run.runId,
          },
        });
      }
    }

    logger.info({ inputs: inputs.length, outputs: outputs.length }, 'Lineage event processed');
  }

  /**
   * Parse SQL query to extract lineage relationships
   */
  async parseSqlLineage(
    sql: string,
    dialect: string = 'postgresql'
  ): Promise<{ inputs: string[]; outputs: string[] }> {
    try {
      const ast = this.sqlParser.astify(sql, { database: dialect });
      const tables = this.sqlParser.tableList(sql, { database: dialect });

      const inputs: string[] = [];
      const outputs: string[] = [];

      for (const table of tables) {
        const [operation, , fullName] = table.split('::');
        
        if (operation === 'select') {
          inputs.push(fullName ?? table);
        } else if (operation === 'insert' || operation === 'update' || operation === 'create') {
          outputs.push(fullName ?? table);
        }
      }

      logger.debug({ inputs, outputs }, 'SQL lineage parsed');

      return { inputs, outputs };
    } catch (error) {
      logger.error({ error, sql }, 'Failed to parse SQL');
      throw new ValidationError(`Failed to parse SQL: ${(error as Error).message}`);
    }
  }

  /**
   * Create a lineage edge between two assets
   */
  async createLineageEdge(data: CreateLineageEdge): Promise<LineageEdge> {
    // Verify both assets exist
    const [sourceAsset, targetAsset] = await Promise.all([
      prisma.asset.findUnique({ where: { id: data.sourceAssetId } }),
      prisma.asset.findUnique({ where: { id: data.targetAssetId } }),
    ]);

    if (!sourceAsset) {
      throw new NotFoundError('Source asset', data.sourceAssetId);
    }
    if (!targetAsset) {
      throw new NotFoundError('Target asset', data.targetAssetId);
    }

    // Prevent self-referencing lineage
    if (data.sourceAssetId === data.targetAssetId) {
      throw new ValidationError('Source and target assets cannot be the same');
    }

    // Check for duplicate edges
    const existingEdge = await prisma.lineageEdge.findUnique({
      where: {
        sourceAssetId_targetAssetId: {
          sourceAssetId: data.sourceAssetId,
          targetAssetId: data.targetAssetId,
        },
      },
    });

    if (existingEdge) {
      // Update existing edge
      const edge = await prisma.lineageEdge.update({
        where: { id: existingEdge.id },
        data: {
          transformationType: data.transformationType,
          transformationLogic: data.transformationLogic,
          metadata: data.metadata,
        },
      });
      return this.mapLineageEdge(edge);
    }

    const edge = await prisma.lineageEdge.create({
      data: {
        sourceAssetId: data.sourceAssetId,
        targetAssetId: data.targetAssetId,
        transformationType: data.transformationType,
        transformationLogic: data.transformationLogic,
        metadata: data.metadata ?? {},
      },
    });

    logger.info(
      { sourceAssetId: data.sourceAssetId, targetAssetId: data.targetAssetId },
      'Lineage edge created'
    );

    return this.mapLineageEdge(edge);
  }

  /**
   * Get lineage edge by ID
   */
  async getLineageEdge(edgeId: string): Promise<LineageEdge | null> {
    const edge = await prisma.lineageEdge.findUnique({ where: { id: edgeId } });
    return edge ? this.mapLineageEdge(edge) : null;
  }

  /**
   * Update lineage edge metadata/transformation
   */
  async updateLineageEdge(edgeId: string, data: UpdateLineageEdgeInput): Promise<LineageEdge> {
    const existingEdge = await prisma.lineageEdge.findUnique({ where: { id: edgeId } });
    if (!existingEdge) {
      throw new NotFoundError('Lineage edge', edgeId);
    }

    const updateData: Record<string, unknown> = {};
    if (data.transformationType !== undefined) {
      updateData['transformationType'] = data.transformationType;
    }
    if (data.transformationLogic !== undefined) {
      updateData['transformationLogic'] = data.transformationLogic;
    }
    if (data.metadata !== undefined) {
      updateData['metadata'] = data.metadata;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('At least one field is required for update');
    }

    const edge = await prisma.lineageEdge.update({
      where: { id: edgeId },
      data: updateData as Record<string, unknown>,
    });

    return this.mapLineageEdge(edge);
  }

  /**
   * Delete lineage edge by ID
   */
  async deleteLineageEdge(edgeId: string): Promise<void> {
    const existingEdge = await prisma.lineageEdge.findUnique({ where: { id: edgeId } });
    if (!existingEdge) {
      throw new NotFoundError('Lineage edge', edgeId);
    }

    await prisma.lineageEdge.delete({ where: { id: edgeId } });
  }

  /**
   * Get upstream lineage for an asset
   */
  async getUpstreamLineage(assetId: string, depth: number = 5): Promise<LineageGraph> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    const graph = await this.buildLineageGraph();
    const nodes: LineageNode[] = [];
    const edges: LineageGraphEdge[] = [];
    const visited = new Set<string>();

    await this.traverseUpstream(graph, assetId, 0, depth, nodes, edges, visited);

    return { nodes, edges };
  }

  /**
   * Get downstream lineage for an asset
   */
  async getDownstreamLineage(assetId: string, depth: number = 5): Promise<LineageGraph> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    const graph = await this.buildLineageGraph();
    const nodes: LineageNode[] = [];
    const edges: LineageGraphEdge[] = [];
    const visited = new Set<string>();

    await this.traverseDownstream(graph, assetId, 0, depth, nodes, edges, visited);

    return { nodes, edges };
  }

  /**
   * Perform impact analysis for an asset
   */
  async performImpactAnalysis(assetId: string, maxDepth: number = 10): Promise<ImpactAnalysisResult> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    const graph = await this.buildLineageGraph();
    const impactedAssets: ImpactedAsset[] = [];
    const visited = new Set<string>();
    const assetCache = new Map<string, { id: string; name: string; assetType: AssetType }>();

    assetCache.set(asset.id, {
      id: asset.id,
      name: asset.name,
      assetType: asset.assetType as AssetType,
    });

    await this.findImpactedAssets(graph, assetId, 0, maxDepth, [], impactedAssets, visited, assetCache);

    // Calculate counts by type
    const countByType: Record<AssetType, number> = {} as Record<AssetType, number>;
    for (const impacted of impactedAssets) {
      countByType[impacted.assetType] = (countByType[impacted.assetType] ?? 0) + 1;
    }

    return {
      sourceAsset: {
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType as AssetType,
      },
      impactedAssets,
      totalCount: impactedAssets.length,
      countByType,
    };
  }

  /**
   * Build a graphlib graph from lineage edges
   */
  private async buildLineageGraph(): Promise<Graph> {
    const edges = await prisma.lineageEdge.findMany();
    const graph = new Graph({ directed: true });

    for (const edge of edges) {
      graph.setNode(edge.sourceAssetId);
      graph.setNode(edge.targetAssetId);
      graph.setEdge(edge.sourceAssetId, edge.targetAssetId, {
        transformationType: edge.transformationType,
      });
    }

    return graph;
  }

  /**
   * Traverse upstream in the lineage graph
   */
  private async traverseUpstream(
    graph: Graph,
    nodeId: string,
    currentDepth: number,
    maxDepth: number,
    nodes: LineageNode[],
    edges: LineageGraphEdge[],
    visited: Set<string>
  ): Promise<void> {
    if (currentDepth > maxDepth || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    const asset = await prisma.asset.findUnique({ where: { id: nodeId } });
    if (asset) {
      nodes.push({
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType as AssetType,
        depth: currentDepth,
      });
    }

    const predecessors = graph.predecessors(nodeId) ?? [];
    // @ts-ignore - graphlib returns Iterator which is iterable
    for (const predId of predecessors) {
      const edgeData = graph.edge(predId, nodeId);
      edges.push({
        source: predId,
        target: nodeId,
        transformationType: edgeData?.transformationType ?? 'UNKNOWN',
      });

      await this.traverseUpstream(graph, predId, currentDepth + 1, maxDepth, nodes, edges, visited);
    }
  }

  /**
   * Traverse downstream in the lineage graph
   */
  private async traverseDownstream(
    graph: Graph,
    nodeId: string,
    currentDepth: number,
    maxDepth: number,
    nodes: LineageNode[],
    edges: LineageGraphEdge[],
    visited: Set<string>
  ): Promise<void> {
    if (currentDepth > maxDepth || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    const asset = await prisma.asset.findUnique({ where: { id: nodeId } });
    if (asset) {
      nodes.push({
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType as AssetType,
        depth: currentDepth,
      });
    }

    const successors = graph.successors(nodeId) ?? [];
    for (const succId of successors) {
      const edgeData = graph.edge(nodeId, succId);
      edges.push({
        source: nodeId,
        target: succId,
        transformationType: edgeData?.transformationType ?? 'UNKNOWN',
      });

      await this.traverseDownstream(graph, succId, currentDepth + 1, maxDepth, nodes, edges, visited);
    }
  }

  /**
   * Find all impacted assets downstream
   */
  private async findImpactedAssets(
    graph: Graph,
    nodeId: string,
    currentDepth: number,
    maxDepth: number,
    path: ImpactPathStep[],
    impacted: ImpactedAsset[],
    visited: Set<string>,
    assetCache: Map<string, { id: string; name: string; assetType: AssetType }>,
    incomingTransformationType?: string
  ): Promise<void> {
    if (currentDepth > maxDepth || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    let asset = assetCache.get(nodeId);
    if (!asset) {
      const dbAsset = await prisma.asset.findUnique({ where: { id: nodeId } });
      if (dbAsset) {
        asset = {
          id: dbAsset.id,
          name: dbAsset.name,
          assetType: dbAsset.assetType as AssetType,
        };
        assetCache.set(nodeId, asset);
      } else {
        asset = { id: nodeId, name: nodeId, assetType: 'OTHER' };
        assetCache.set(nodeId, asset);
      }
    }

    const currentPath = [
      ...path,
      {
        assetId: asset.id,
        assetName: asset.name,
        assetType: asset.assetType,
        ...(incomingTransformationType ? { transformationType: incomingTransformationType } : {}),
      },
    ];

    if (currentDepth > 0) {
      impacted.push({
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType,
        depth: currentDepth,
        path: currentPath,
      });
    }

    const successors = graph.successors(nodeId) ?? [];
    for (const succId of successors) {
      const edgeData = graph.edge(nodeId, succId);
      await this.findImpactedAssets(
        graph,
        succId,
        currentDepth + 1,
        maxDepth,
        currentPath,
        impacted,
        visited,
        assetCache,
        edgeData?.transformationType ?? 'UNKNOWN'
      );
    }
  }

  /**
   * Find or create an asset from an OpenLineage dataset
   */
  private async findOrCreateAssetFromDataset(
    dataset: { namespace: string; name: string }
  ): Promise<{ id: string }> {
    const fullName = `${dataset.namespace}.${dataset.name}`;

    let asset = await prisma.asset.findFirst({
      where: { name: fullName },
    });

    if (!asset) {
      // Get or create a system user for automated operations
      let systemUser = await prisma.user.findFirst({
        where: { username: 'system' },
      });

      if (!systemUser) {
        systemUser = await prisma.user.create({
          data: {
            email: 'system@localhost',
            username: 'system',
            passwordHash: 'SYSTEM_ACCOUNT_NO_LOGIN',
            role: 'ADMIN',
          },
        });
      }

      asset = await prisma.asset.create({
        data: {
          name: fullName,
          description: `Auto-discovered from OpenLineage: ${dataset.namespace}`,
          assetType: 'TABLE',
          ownerId: systemUser.id,
          createdById: systemUser.id,
          updatedById: systemUser.id,
        },
      });
    }

    return { id: asset.id };
  }

  /**
   * Map Prisma lineage edge to domain model
   */
  private mapLineageEdge(edge: {
    id: string;
    sourceAssetId: string;
    targetAssetId: string;
    transformationType: string;
    transformationLogic: string | null;
    metadata: unknown;
    createdAt: Date;
  }): LineageEdge {
    return {
      id: edge.id,
      sourceAssetId: edge.sourceAssetId,
      targetAssetId: edge.targetAssetId,
      transformationType: edge.transformationType,
      transformationLogic: edge.transformationLogic ?? undefined,
      metadata: edge.metadata as Record<string, unknown> | undefined,
      createdAt: edge.createdAt,
    };
  }
}

export const lineageService = new LineageService();
