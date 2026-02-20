'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Autocomplete,
  Chip,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  FormControlLabel,
  Switch,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  Badge,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Fullscreen as FullscreenIcon,
  AccountTree,
  AccountTree as ColumnIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Warning as ImpactIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import * as d3 from 'd3';
import { api } from '@/lib/api';

interface LineageNode {
  id: string;
  name: string;
  type: string;
  namespace?: string;
  businessTerms?: BusinessTerm[];
}

interface LineageEdge {
  source: string;
  target: string;
  type: string;
}

interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

interface ColumnLineageNode {
  assetId: string;
  column: string;
  assetName?: string;
  assetType?: string;
}

interface ColumnLineageEdge {
  id: string;
  sourceAssetId: string;
  sourceColumn: string;
  targetAssetId: string;
  targetColumn: string;
  transformationType: string;
  transformationExpression?: string;
  confidence: number;
}

interface ColumnLineageGraph {
  nodes: ColumnLineageNode[];
  edges: ColumnLineageEdge[];
  rootNode: ColumnLineageNode;
}

type ColumnLineageApiResponse =
  | ColumnLineageGraph
  | {
      lineage?: ColumnLineageGraph;
    };

interface BusinessTerm {
  id: string;
  name: string;
  definition: string;
  status: string;
  domain?: {
    id: string;
    name: string;
  };
}

interface SemanticMapping {
  id: string;
  businessTerm: BusinessTerm;
  columnName?: string;
  mappingType: string;
  confidence: number;
}

interface AssetBusinessTermsResponse {
  assetId: string;
  assetName: string;
  terms: Array<{
    term: BusinessTerm;
    mapping: {
      id: string;
      businessTermId: string;
      assetId: string;
      columnName?: string;
      mappingType: string;
      confidence: number;
      createdById: string;
      createdAt: string;
      updatedAt: string;
    };
  }>;
}

interface ImpactedAsset {
  assetId: string;
  assetName: string;
  assetType: string;
  depth: number;
  path: string[];
}

interface ImpactAnalysisResult {
  sourceAssetId: string;
  impactedAssets: ImpactedAsset[];
  totalCount: number;
  countByType: Record<string, number>;
}

type ImpactAnalysisApiResponse =
  | ImpactAnalysisResult
  | {
      impact?: ImpactAnalysisResult;
    };

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  namespace?: string;
  businessTerms?: BusinessTerm[];
}

interface D3ColumnNode extends d3.SimulationNodeDatum {
  id: string;
  assetId: string;
  column: string;
  assetName?: string;
  assetType?: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  type: string;
}

interface D3ColumnLink extends d3.SimulationLinkDatum<D3ColumnNode> {
  transformationType: string;
  confidence: number;
}

interface BusinessLineageNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  definition: string;
  domainId: string;
  status: 'DRAFT' | 'APPROVED' | 'DEPRECATED';
  assetCount: number;
}

interface BusinessLineageEdge {
  source: string;
  target: string;
  assetPath: Array<{
    assetId: string;
    assetName: string;
    assetType: string;
  }>;
  strength: number;
}

interface BusinessLineageGraph {
  nodes: BusinessLineageNode[];
  edges: BusinessLineageEdge[];
}

type BusinessLineageApiResponse =
  | BusinessLineageGraph
  | {
      lineage?: BusinessLineageGraph;
      graph?: BusinessLineageGraph;
    };

interface D3BusinessLink extends d3.SimulationLinkDatum<BusinessLineageNode> {
  assetPath: Array<{
    assetId: string;
    assetName: string;
    assetType: string;
  }>;
  strength: number;
}

export default function LineagePage() {
  const searchParams = useSearchParams();
  const theme = useTheme();
  const initialAssetId = searchParams.get('asset');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<string | null>(initialAssetId);
  const [direction, setDirection] = useState<'both' | 'upstream' | 'downstream'>('both');
  const [depth, setDepth] = useState(3);
  const [lineageView, setLineageView] = useState<'asset' | 'column' | 'business'>('asset');
  const [showBusinessTerms, setShowBusinessTerms] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [selectedBusinessTerm, setSelectedBusinessTerm] = useState<string | null>(null);
  const [termDrawerOpen, setTermDrawerOpen] = useState(false);
  const [selectedNodeTerms, setSelectedNodeTerms] = useState<BusinessTerm[]>([]);
  const [enrichedLineageData, setEnrichedLineageData] = useState<LineageGraph | null>(null);
  const [impactDrawerOpen, setImpactDrawerOpen] = useState(false);
  const [impactAssetId, setImpactAssetId] = useState<string | null>(null);

  // Impact Analysis Query
  const { data: impactData, isLoading: impactLoading } = useQuery<ImpactAnalysisResult>({
    queryKey: ['impact-analysis', impactAssetId],
    queryFn: async () => {
      const response = await api.get<ImpactAnalysisApiResponse>(`/lineage/${impactAssetId}/impact?maxDepth=5`);
      const impact: ImpactAnalysisResult = 'impact' in response
        ? (response.impact ?? { sourceAssetId: impactAssetId ?? '', impactedAssets: [], totalCount: 0, countByType: {} })
        : (response as ImpactAnalysisResult);
      return {
        sourceAssetId: impact.sourceAssetId,
        impactedAssets: impact.impactedAssets ?? [],
        totalCount: impact.totalCount ?? 0,
        countByType: impact.countByType ?? {},
      };
    },
    enabled: !!impactAssetId && impactDrawerOpen,
  });

  const handleShowImpact = useCallback((nodeId: string) => {
    setImpactAssetId(nodeId);
    setImpactDrawerOpen(true);
  }, []);

  const { data: lineageData, isLoading } = useQuery<LineageGraph>({
    queryKey: ['lineage', selectedAsset, direction, depth],
    queryFn: async () => {
      if (!selectedAsset) return { nodes: [], edges: [] };
      const fetchDirection = async (requestedDirection: 'upstream' | 'downstream'): Promise<LineageGraph> => {
        const response = await api.get<{
          lineage?: {
            nodes?: Array<{ id: string; name: string; assetType?: string; type?: string }>;
            edges?: Array<{ source: string; target: string; transformationType?: string; type?: string }>;
          };
        }>(`/lineage/${selectedAsset}/${requestedDirection}?depth=${depth}`);

        const graph = response.lineage ?? { nodes: [], edges: [] };

        return {
          nodes: (graph.nodes ?? []).map((node) => ({
            id: node.id,
            name: node.name,
            type: node.assetType ?? node.type ?? 'DATASET',
          })),
          edges: (graph.edges ?? []).map((edge) => ({
            source: edge.source,
            target: edge.target,
            type: edge.transformationType ?? edge.type ?? 'TRANSFORMS',
          })),
        };
      };

      if (direction === 'both') {
        const [upstream, downstream] = await Promise.all([
          fetchDirection('upstream'),
          fetchDirection('downstream'),
        ]);

        const nodesById = new Map<string, LineageNode>();
        for (const node of [...upstream.nodes, ...downstream.nodes]) {
          nodesById.set(node.id, node);
        }

        const edgesByKey = new Map<string, LineageEdge>();
        for (const edge of [...upstream.edges, ...downstream.edges]) {
          const key = `${edge.source}->${edge.target}->${edge.type}`;
          edgesByKey.set(key, edge);
        }

        return {
          nodes: Array.from(nodesById.values()),
          edges: Array.from(edgesByKey.values()),
        };
      }

      return fetchDirection(direction);
    },
    enabled: !!selectedAsset,
  });

  const { data: searchResults } = useQuery<LineageNode[]>({
    queryKey: ['lineage-search'],
    queryFn: async () => {
      const response = await api.get<{ assets?: Array<{ id: string; name: string; assetType: string }> }>(
        '/assets?limit=200'
      );

      return (response.assets ?? []).map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: asset.assetType,
      }));
    },
  });

  // Query for column lineage
  const { data: columnLineageData, isLoading: isColumnLineageLoading } = useQuery<ColumnLineageGraph>({
    queryKey: ['column-lineage', selectedAsset, selectedColumn, direction, depth],
    queryFn: async () => {
      if (!selectedAsset || !selectedColumn) {
        return { nodes: [], edges: [], rootNode: { assetId: '', column: '' } };
      }
      try {
        const endpoint = direction === 'upstream' 
          ? `/lineage/columns/${selectedAsset}/${selectedColumn}/upstream` 
          : `/lineage/columns/${selectedAsset}/${selectedColumn}/downstream`;
        const response = await api.get<ColumnLineageApiResponse>(`${endpoint}?depth=${depth}`);
        const graph: ColumnLineageGraph = 'lineage' in response
          ? (response.lineage ?? { nodes: [], edges: [], rootNode: { assetId: selectedAsset, column: selectedColumn } })
          : (response as ColumnLineageGraph);

        return {
          nodes: graph.nodes ?? [],
          edges: graph.edges ?? [],
          rootNode: graph.rootNode ?? { assetId: selectedAsset, column: selectedColumn },
        };
      } catch {
        // Fallback to mock data if API not available
        return {
          nodes: [
            { assetId: selectedAsset, column: selectedColumn, assetName: 'fact_sales', assetType: 'TABLE' },
            { assetId: 'stg_sales', column: selectedColumn, assetName: 'stg_sales', assetType: 'VIEW' },
            { assetId: 'stg_customers', column: 'customer_id', assetName: 'stg_customers', assetType: 'VIEW' },
            { assetId: 'raw_orders', column: 'order_id', assetName: 'raw_orders', assetType: 'TABLE' },
            { assetId: 'raw_orders', column: 'customer_id', assetName: 'raw_orders', assetType: 'TABLE' },
            { assetId: 'raw_customers', column: 'id', assetName: 'raw_customers', assetType: 'TABLE' },
            { assetId: 'raw_customers', column: 'email', assetName: 'raw_customers', assetType: 'TABLE' },
            { assetId: 'dim_customers', column: 'customer_id', assetName: 'dim_customers', assetType: 'TABLE' },
            { assetId: 'dim_customers', column: 'email', assetName: 'dim_customers', assetType: 'TABLE' },
          ],
          edges: [
            { id: '1', sourceAssetId: 'raw_customers', sourceColumn: 'id', targetAssetId: 'stg_customers', targetColumn: 'customer_id', transformationType: 'DIRECT', confidence: 1.0 },
            { id: '2', sourceAssetId: 'raw_customers', sourceColumn: 'email', targetAssetId: 'stg_customers', targetColumn: 'email', transformationType: 'DIRECT', confidence: 0.98 },
            { id: '3', sourceAssetId: 'stg_customers', sourceColumn: 'customer_id', targetAssetId: 'dim_customers', targetColumn: 'customer_id', transformationType: 'DERIVED', confidence: 0.92 },
            { id: '4', sourceAssetId: 'stg_customers', sourceColumn: 'email', targetAssetId: 'dim_customers', targetColumn: 'email', transformationType: 'DERIVED', confidence: 0.9 },
            { id: '5', sourceAssetId: 'raw_orders', sourceColumn: 'customer_id', targetAssetId: 'stg_sales', targetColumn: selectedColumn, transformationType: 'JOINED', confidence: 0.86 },
            { id: '6', sourceAssetId: 'raw_orders', sourceColumn: 'order_id', targetAssetId: 'stg_sales', targetColumn: selectedColumn, transformationType: 'FILTERED', confidence: 0.8 },
            { id: '7', sourceAssetId: 'stg_sales', sourceColumn: selectedColumn, targetAssetId: selectedAsset, targetColumn: selectedColumn, transformationType: 'AGGREGATED', confidence: 0.88 },
            { id: '8', sourceAssetId: 'dim_customers', sourceColumn: 'customer_id', targetAssetId: selectedAsset, targetColumn: selectedColumn, transformationType: 'JOINED', confidence: 0.83 },
          ],
          rootNode: { assetId: selectedAsset, column: selectedColumn },
        };
      }
    },
    enabled: lineageView === 'column' && !!selectedAsset && !!selectedColumn,
  });

  // Query for business terms mappings for all assets in lineage graph
  const { data: assetBusinessTerms, isLoading: businessTermsLoading } = useQuery<Map<string, BusinessTerm[]>>({
    queryKey: ['lineage-business-terms', lineageData?.nodes.map(n => n.id).sort().join(','), showBusinessTerms],
    queryFn: async () => {
      if (!lineageData || !showBusinessTerms) return new Map();

      const termsMap = new Map<string, BusinessTerm[]>();
      
      // Fetch business terms for all nodes in parallel
      const promises = lineageData.nodes.map(async (node) => {
        try {
          const response = await api.get<AssetBusinessTermsResponse>(`/glossary/mappings/asset/${node.id}`);
          if (response.terms && response.terms.length > 0) {
            const terms = response.terms.map(t => t.term);
            termsMap.set(node.id, terms);
          }
        } catch (error) {
          // Silently ignore errors for nodes without mappings
          console.debug(`No business terms for asset ${node.id}`);
        }
      });

      await Promise.all(promises);
      return termsMap;
    },
    enabled: showBusinessTerms && !!lineageData && lineageData.nodes.length > 0,
  });

  // Query for all business terms (for autocomplete selector)
  const { data: businessTermsListData } = useQuery<{ terms: BusinessTerm[] }>({
    queryKey: ['business-terms-list'],
    queryFn: async () => {
      return await api.get('/glossary/terms');
    },
  });

  const businessTermsList = businessTermsListData?.terms || [];

  const hasColumnLineageRelationships = (columnLineageData?.edges?.length ?? 0) > 0;
  const hasColumnLineageNodes = (columnLineageData?.nodes?.length ?? 0) > 0;

  // Query for business lineage graph
  const { data: businessLineageData, isLoading: isBusinessLineageLoading } = useQuery<BusinessLineageGraph>({
    queryKey: ['business-lineage', selectedBusinessTerm, depth],
    queryFn: async () => {
      if (!selectedBusinessTerm) return { nodes: [], edges: [] };
      const response = await api.get<BusinessLineageApiResponse>(`/glossary/business-lineage/${selectedBusinessTerm}?depth=${depth}`);
      const graph: BusinessLineageGraph = 'lineage' in response && response.lineage
        ? response.lineage
        : 'graph' in response && response.graph
          ? response.graph
          : (response as BusinessLineageGraph);
      return {
        nodes: graph.nodes ?? [],
        edges: graph.edges ?? [],
      };
    },
    enabled: lineageView === 'business' && !!selectedBusinessTerm,
  });

  const { data: availableColumnsData, isLoading: isColumnsLoading } = useQuery<string[]>({
    queryKey: ['lineage-asset-columns', selectedAsset],
    queryFn: async () => {
      if (!selectedAsset) return [];

      try {
        const schemasResponse = await api.get<{
          schemas?: Array<{ schemaDefinition?: Record<string, unknown> }>;
        }>(`/assets/${selectedAsset}/schemas`);

        const latestSchema = schemasResponse.schemas?.[0];
        const schemaDefinition = latestSchema?.schemaDefinition;
        const properties = schemaDefinition?.['properties'];

        if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
          const schemaColumns = Object.keys(properties as Record<string, unknown>);
          if (schemaColumns.length > 0) {
            return schemaColumns;
          }
        }
      } catch {
        // Fallback to profile endpoint if schema metadata is unavailable
      }

      try {
        const profileResponse = await api.get<{
          columns?: Array<{ name: string }>;
        }>(`/assets/${selectedAsset}/profile`);

        return (profileResponse.columns ?? [])
          .map((column) => column.name)
          .filter((name) => !!name);
      } catch {
        return [];
      }
    },
    enabled: lineageView === 'column' && !!selectedAsset,
  });

  const availableColumns = availableColumnsData ?? [];

  useEffect(() => {
    if (!selectedColumn || availableColumns.length === 0) return;
    if (!availableColumns.includes(selectedColumn)) {
      setSelectedColumn(null);
    }
  }, [availableColumns, selectedColumn]);

  const getNodeColor = useCallback((type: string) => {
    const colors: Record<string, string> = {
      TABLE: '#0ea5e9',
      VIEW: '#8b5cf6',
      TOPIC: '#22c55e',
      DATASET: '#f59e0b',
      DASHBOARD: '#ec4899',
      REPORT: '#ef4444',
      COLUMN: '#6366f1',
    };
    return colors[type] || '#64748b';
  }, []);

  const getTransformationColor = useCallback((type: string) => {
    const colors: Record<string, string> = {
      DIRECT: '#22c55e',
      DERIVED: '#f59e0b',
      AGGREGATED: '#ef4444',
      FILTERED: '#8b5cf6',
      JOINED: '#0ea5e9',
      CASE: '#ec4899',
      COALESCED: '#64748b',
    };
    return colors[type] || '#94a3b8';
  }, []);

  const handleNodeClick = useCallback((node: LineageNode) => {
    if (showBusinessTerms && node.businessTerms && node.businessTerms.length > 0) {
      setSelectedNodeTerms(node.businessTerms);
      setTermDrawerOpen(true);
    }
  }, [showBusinessTerms]);

  // Merge business terms into lineage nodes
  useEffect(() => {
    if (!lineageData) {
      setEnrichedLineageData(null);
      return;
    }

    if (!showBusinessTerms || !assetBusinessTerms || assetBusinessTerms.size === 0) {
      // Clear business terms from nodes when toggle is off
      const cleanNodes = lineageData.nodes.map((node) => ({
        ...node,
        businessTerms: [],
      }));
      setEnrichedLineageData({
        nodes: cleanNodes,
        edges: lineageData.edges,
      });
      return;
    }

    // Enrich nodes with business terms from the Map
    const enrichedNodes = lineageData.nodes.map((node) => ({
      ...node,
      businessTerms: assetBusinessTerms.get(node.id) || [],
    }));

    setEnrichedLineageData({
      nodes: enrichedNodes,
      edges: lineageData.edges,
    });
  }, [lineageData, showBusinessTerms, assetBusinessTerms]);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    if (zoomRef.current && svgSelectionRef.current) {
      svgSelectionRef.current.transition().duration(300).call(
        zoomRef.current.scaleBy, 1.3
      );
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (zoomRef.current && svgSelectionRef.current) {
      svgSelectionRef.current.transition().duration(300).call(
        zoomRef.current.scaleBy, 0.7
      );
    }
  }, []);

  const handleCenter = useCallback(() => {
    if (zoomRef.current && svgSelectionRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = 500;
      svgSelectionRef.current.transition().duration(300).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(width / 2 - 100, height / 2 - 50)
      );
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  }, []);

  // Asset-level D3 visualization
  useEffect(() => {
    if (lineageView !== 'asset' || !svgRef.current || !containerRef.current || !enrichedLineageData) return;

    const width = containerRef.current.clientWidth;
    const height = 500;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    
    // Store refs for external control
    zoomRef.current = zoom;
    svgSelectionRef.current = svg;

    const g = svg.append('g');

    // Arrow marker
    const strokeColor = theme.palette.mode === 'dark' ? '#cbd5e1' : '#94a3b8';
    const textColor = theme.palette.mode === 'dark' ? '#f8fafc' : '#ffffff';
    
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', strokeColor);

    // Prepare data
    const nodes: D3Node[] = enrichedLineageData.nodes.map((n) => ({ ...n }));
    const links: D3Link[] = enrichedLineageData.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
    }));

    // Force simulation
    const simulation = d3
      .forceSimulation<D3Node>(nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(150)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Draw links
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', strokeColor)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    // Draw nodes
    const node = g
      .append('g')
      .selectAll<SVGGElement, D3Node>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node rectangles
    node
      .append('rect')
      .attr('width', 120)
      .attr('height', 50)
      .attr('x', -60)
      .attr('y', -25)
      .attr('rx', 8)
      .attr('fill', (d) => getNodeColor(d.type))
      .attr('opacity', 0.9);

    // Node labels
    node
      .append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .attr('fill', textColor)
      .attr('font-size', '12px')
      .attr('font-weight', 500);

    // Type labels
    node
      .append('text')
      .text((d) => d.type)
      .attr('text-anchor', 'middle')
      .attr('dy', 12)
      .attr('fill', theme.palette.mode === 'dark' ? 'rgba(248,250,252,0.8)' : 'rgba(255,255,255,0.8)')
      .attr('font-size', '10px');

    // Business term badges (when showBusinessTerms is enabled)
    if (showBusinessTerms) {
      // Badge circle background
      node
        .filter((d) => (d.businessTerms?.length ?? 0) > 0)
        .append('circle')
        .attr('cx', 50)
        .attr('cy', -20)
        .attr('r', 10)
        .attr('fill', '#f59e0b')
        .attr('stroke', textColor)
        .attr('stroke-width', 2);

      // Badge count text
      node
        .filter((d) => (d.businessTerms?.length ?? 0) > 0)
        .append('text')
        .text((d) => d.businessTerms!.length)
        .attr('x', 50)
        .attr('y', -16)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '11px')
        .attr('font-weight', 700);
    }

    // Add click handlers to nodes
    node.on('click', (event, d) => {
      event.stopPropagation();
      handleNodeClick(d);
    });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x!)
        .attr('y1', (d) => (d.source as D3Node).y!)
        .attr('x2', (d) => (d.target as D3Node).x!)
        .attr('y2', (d) => (d.target as D3Node).y!);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [lineageView, enrichedLineageData, getNodeColor, handleNodeClick, showBusinessTerms, theme]);

  // Column-level D3 visualization
  useEffect(() => {
    if (lineageView !== 'column' || !svgRef.current || !containerRef.current || !columnLineageData) return;

    const width = containerRef.current.clientWidth;
    const height = 500;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    
    // Store refs for external control
    zoomRef.current = zoom;
    svgSelectionRef.current = svg;

    const g = svg.append('g');

    // Arrow marker for column lineage
    const strokeColor = theme.palette.mode === 'dark' ? '#cbd5e1' : '#64748b';
    const textColor = theme.palette.mode === 'dark' ? '#f8fafc' : '#ffffff';
    
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'column-arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', strokeColor);

    // Prepare data
    const safeNodes = columnLineageData.nodes ?? [];
    const safeEdges = columnLineageData.edges ?? [];

    if (safeNodes.length === 0) {
      return;
    }

    const nodes: D3ColumnNode[] = safeNodes.map((n, idx) => ({
      ...n,
      id: `${n.assetId}:${n.column}`,
      index: idx,
    }));

    const links: D3ColumnLink[] = safeEdges.map((e) => ({
      source: `${e.sourceAssetId}:${e.sourceColumn}`,
      target: `${e.targetAssetId}:${e.targetColumn}`,
      transformationType: e.transformationType,
      confidence: e.confidence,
    }));

    if (nodes.length === 1 && links.length === 0) {
      nodes[0].x = width / 2;
      nodes[0].y = height / 2;
      nodes[0].fx = width / 2;
      nodes[0].fy = height / 2;
    }

    // Force simulation
    const simulation = d3
      .forceSimulation<D3ColumnNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<D3ColumnNode, D3ColumnLink>(links)
          .id((d) => d.id)
          .distance(180)
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(70));

    // Draw links with transformation type colors
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => getTransformationColor(d.transformationType))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', (d) => d.confidence < 0.8 ? '5,5' : 'none')
      .attr('marker-end', 'url(#column-arrowhead)');

    // Draw nodes
    const node = g
      .append('g')
      .selectAll<SVGGElement, D3ColumnNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, D3ColumnNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node rectangles for columns
    node
      .append('rect')
      .attr('width', 140)
      .attr('height', 60)
      .attr('x', -70)
      .attr('y', -30)
      .attr('rx', 8)
      .attr('fill', (d) => getNodeColor(d.assetType || 'COLUMN'))
      .attr('opacity', 0.9)
      .attr('stroke', (d) => d.id === `${selectedAsset}:${selectedColumn}` ? '#fbbf24' : 'none')
      .attr('stroke-width', 3);

    // Asset name label
    node
      .append('text')
      .text((d) => d.assetName || 'Unknown')
      .attr('text-anchor', 'middle')
      .attr('dy', -10)
      .attr('fill', textColor)
      .attr('font-size', '10px')
      .attr('font-weight', 400);

    // Column name label (main label)
    node
      .append('text')
      .text((d) => d.column)
      .attr('text-anchor', 'middle')
      .attr('dy', 8)
      .attr('fill', textColor)
      .attr('font-size', '13px')
      .attr('font-weight', 600);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3ColumnNode).x!)
        .attr('y1', (d) => (d.source as D3ColumnNode).y!)
        .attr('x2', (d) => (d.target as D3ColumnNode).x!)
        .attr('y2', (d) => (d.target as D3ColumnNode).y!);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [lineageView, columnLineageData, getNodeColor, getTransformationColor, selectedAsset, selectedColumn, theme]);

  // Business lineage D3 visualization
  useEffect(() => {
    if (lineageView !== 'business' || !svgRef.current || !containerRef.current || !businessLineageData) return;

    const safeNodes = businessLineageData.nodes ?? [];
    const safeEdges = businessLineageData.edges ?? [];

    const svg = d3.select(svgRef.current);
    const container = d3.select(containerRef.current);
    const width = container.node()?.clientWidth || 800;
    const height = container.node()?.clientHeight || 600;

    // Clear previous content
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    // Setup zoom if not already created
    if (!zoomRef.current || !svgSelectionRef.current) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      zoomRef.current = zoom;
      svgSelectionRef.current = svg;
    } else {
      svg.call(zoomRef.current);
    }

    // Define arrow marker for directed edges
    const arrowColor = theme.palette.mode === 'dark' ? '#a78bfa' : '#7c3aed';
    const linkColor = theme.palette.mode === 'dark' ? '#a78bfa' : '#7c3aed';
    const textColor = theme.palette.mode === 'dark' ? '#f8fafc' : '#ffffff';
    
    svg.append('defs').append('marker')
      .attr('id', 'business-arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', arrowColor);

    // Create simulation
    const simulation = d3.forceSimulation(safeNodes as BusinessLineageNode[])
      .force('link', d3.forceLink<BusinessLineageNode, D3BusinessLink>(safeEdges as D3BusinessLink[])
        .id((d) => d.id)
        .distance(200))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(80));

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(safeEdges)
      .enter()
      .append('line')
      .attr('stroke', linkColor)
      .attr('stroke-width', (d) => 1 + d.strength * 3)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#business-arrowhead)');

    // Create a map for quick node lookup
    const nodeMap = new Map(safeNodes.map(n => [n.id, n]));

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(safeNodes)
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, BusinessLineageNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Node circles (larger for business terms)
    node.append('circle')
      .attr('r', 40)
      .attr('fill', (d) => {
        if (d.status === 'APPROVED') return '#10b981';
        if (d.status === 'DRAFT') return '#fbbf24';
        return '#ef4444'; // DEPRECATED
      })
      .attr('opacity', 0.9)
      .attr('stroke', textColor)
      .attr('stroke-width', 3);

    // Term names
    node.append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('fill', textColor)
      .attr('font-size', '14px')
      .attr('font-weight', 600);

    // Asset count badge
    node.append('circle')
      .attr('cx', 30)
      .attr('cy', -30)
      .attr('r', 12)
      .attr('fill', '#3b82f6')
      .attr('stroke', textColor)
      .attr('stroke-width', 2);

    node.append('text')
      .text((d) => d.assetCount)
      .attr('x', 30)
      .attr('y', -26)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('font-weight', 700);

    // Add tooltips showing definition and asset paths
    node.append('title')
      .text((d) => {
        const edge = safeEdges.find(e => e.source === d.id || e.target === d.id);
        const pathInfo = edge ? `\nConnected via: ${edge.assetPath.map(a => a.assetName).join(' → ')}` : '';
        return `${d.name}\n${d.definition}\nMapped to ${d.assetCount} asset(s)${pathInfo}`;
      });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => {
          const source = typeof d.source === 'string' ? nodeMap.get(d.source) : d.source;
          return source?.x ?? 0;
        })
        .attr('y1', (d) => {
          const source = typeof d.source === 'string' ? nodeMap.get(d.source) : d.source;
          return source?.y ?? 0;
        })
        .attr('x2', (d) => {
          const target = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
          return target?.x ?? 0;
        })
        .attr('y2', (d) => {
          const target = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
          return target?.y ?? 0;
        });

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [lineageView, businessLineageData, theme]);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Data Lineage
      </Typography>

      {/* View Tabs */}
      <Card sx={{ mb: 2 }}>
        <Tabs
          value={lineageView}
          onChange={(_, newValue) => {
            setLineageView(newValue);
            // Reset direction to 'downstream' when switching to column view if 'both' is selected
            if (newValue === 'column' && direction === 'both') {
              setDirection('downstream');
            }
          }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            value="asset"
            label="Asset Lineage"
            icon={<ColumnIcon />}
            iconPosition="start"
          />
          <Tab
            value="column"
            label="Column Lineage"
            icon={<AccountTree />}
            iconPosition="start"
          />
          <Tab
            value="business"
            label="Business Lineage"
            icon={<BusinessIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Asset selector for asset/column lineage */}
            {lineageView !== 'business' && (
              <Autocomplete
                options={searchResults || []}
                getOptionLabel={(option) => option.name}
                value={searchResults?.find((r) => r.id === selectedAsset) || null}
                onChange={(_, value) => {
                  setSelectedAsset(value?.id || null);
                  setSelectedColumn(null);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select an asset..."
                    size="small"
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...rest } = props as { key: string };
                  return (
                    <li key={key} {...rest}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={option.type}
                          size="small"
                          sx={{ bgcolor: getNodeColor(option.type), color: 'white' }}
                        />
                        <Typography>{option.name}</Typography>
                      </Box>
                    </li>
                  );
                }}
                sx={{ minWidth: 300 }}
              />
            )}

            {/* Business term selector for business lineage */}
            {lineageView === 'business' && (
              <Autocomplete
                options={businessTermsList}
                getOptionLabel={(option) => option.name}
                value={businessTermsList.find((t) => t.id === selectedBusinessTerm) || null}
                onChange={(_, value) => setSelectedBusinessTerm(value?.id || null)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select a business term..."
                    size="small"
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon color="action" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...rest } = props as { key: string };
                  const statusColor = option.status === 'APPROVED' ? '#10b981' : option.status === 'DRAFT' ? '#fbbf24' : '#ef4444';
                  return (
                    <li key={key} {...rest}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={option.status}
                          size="small"
                          sx={{ bgcolor: statusColor, color: 'white' }}
                        />
                        <Typography>{option.name}</Typography>
                      </Box>
                    </li>
                  );
                }}
                sx={{ minWidth: 300 }}
              />
            )}

            {/* Column selector for column lineage view */}
            {lineageView === 'column' && selectedAsset && (
              <Autocomplete
                options={availableColumns}
                value={selectedColumn}
                onChange={(_, value) => setSelectedColumn(value)}
                loading={isColumnsLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select column..."
                    size="small"
                    label="Column"
                  />
                )}
                sx={{ minWidth: 200 }}
              />
            )}

            {lineageView !== 'business' && (
              <ToggleButtonGroup
                value={direction}
                exclusive
                onChange={(_, value) => value && setDirection(value)}
                size="small"
              >
                <ToggleButton value="upstream">Upstream</ToggleButton>
                {lineageView === 'asset' && <ToggleButton value="both">Both</ToggleButton>}
                <ToggleButton value="downstream">Downstream</ToggleButton>
              </ToggleButtonGroup>
            )}

            <TextField
              label="Depth"
              type="number"
              value={depth}
              onChange={(e) => setDepth(parseInt(e.target.value) || 3)}
              size="small"
              sx={{ width: 80 }}
              slotProps={{
                htmlInput: { min: 1, max: 10 },
              }}
            />

            <Divider orientation="vertical" flexItem />

            {/* Business Terms Toggle (only for asset lineage) */}
            {lineageView === 'asset' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={showBusinessTerms}
                    onChange={(e) => setShowBusinessTerms(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <BusinessIcon fontSize="small" />
                    <Typography variant="body2">Business Terms</Typography>
                  </Box>
                }
              />
            )}

            <Box sx={{ flex: 1 }} />

            <Tooltip title="Zoom In">
              <IconButton size="small" onClick={handleZoomIn}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <IconButton size="small" onClick={handleZoomOut}>
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Center">
              <IconButton size="small" onClick={handleCenter}>
                <CenterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Impact Analysis">
              <IconButton 
                size="small" 
                onClick={() => selectedAsset && handleShowImpact(selectedAsset)}
                disabled={!selectedAsset}
                color="warning"
              >
                <ImpactIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <IconButton size="small" onClick={handleFullscreen}>
                <FullscreenIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <Box
          ref={containerRef}
          sx={{
            height: 500,
            bgcolor: 'background.default',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {isLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography color="text.secondary">Loading lineage...</Typography>
            </Box>
          ) : !selectedAsset ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography color="text.secondary">
                Select an asset to view its lineage
              </Typography>
            </Box>
          ) : lineageView === 'business' && !selectedBusinessTerm ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <BusinessIcon sx={{ fontSize: 48, color: 'action.disabled' }} />
              <Typography color="text.secondary">
                Select a business term to view its lineage
              </Typography>
            </Box>
          ) : lineageView === 'business' && isBusinessLineageLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
            </Box>
          ) : lineageView === 'column' && !selectedColumn ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <ColumnIcon sx={{ fontSize: 48, color: 'action.disabled' }} />
              <Typography color="text.secondary">
                Select a column to view its lineage
              </Typography>
            </Box>
          ) : lineageView === 'column' && isColumnLineageLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <CircularProgress size={24} sx={{ mr: 2 }} />
              <Typography color="text.secondary">Loading column lineage...</Typography>
            </Box>
          ) : lineageView === 'column' && !hasColumnLineageNodes ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <ColumnIcon sx={{ fontSize: 48, color: 'action.disabled' }} />
              <Typography color="text.secondary">
                No column lineage data found for this column.
              </Typography>
            </Box>
          ) : (
            <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
          )}
        </Box>

        {/* Legend */}
        <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          {lineageView === 'asset' ? (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {['TABLE', 'VIEW', 'TOPIC', 'DATASET', 'DASHBOARD', 'REPORT'].map((type) => (
                <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: 1,
                      bgcolor: getNodeColor(type),
                    }}
                  />
                  <Typography variant="body2">{type}</Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Transformation Types</Typography>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {['DIRECT', 'DERIVED', 'AGGREGATED', 'FILTERED', 'JOINED', 'CASE'].map((type) => (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 3,
                        bgcolor: getTransformationColor(type),
                      }}
                    />
                    <Typography variant="body2">{type}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Business Terms Info */}
        {showBusinessTerms && assetBusinessTerms && assetBusinessTerms.size > 0 && (
          <Alert 
            severity="info" 
            sx={{ m: 2 }}
            icon={<BusinessIcon />}
          >
            <Typography variant="body2">
              {Array.from(assetBusinessTerms.values()).reduce((sum, terms) => sum + terms.length, 0)} business term(s) mapped across {assetBusinessTerms.size} asset(s). 
              Click on nodes with badges to view details.
            </Typography>
          </Alert>
        )}
      </Card>

      {/* Business Term Detail Drawer */}
      <Drawer
        anchor="right"
        open={termDrawerOpen}
        onClose={() => setTermDrawerOpen(false)}
      >
        <Box sx={{ width: 350, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Business Terms</Typography>
            <IconButton onClick={() => setTermDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <List>
            {selectedNodeTerms.map((term) => (
              <ListItem key={term.id} sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip 
                    label={term.status} 
                    size="small" 
                    color={term.status === 'APPROVED' ? 'success' : term.status === 'DRAFT' ? 'warning' : 'default'}
                  />
                  <Typography variant="subtitle1" fontWeight={600}>{term.name}</Typography>
                </Box>
                <ListItemText
                  primary={term.definition}
                  secondary={term.domain ? `Domain: ${term.domain.name}` : undefined}
                />
                <Divider sx={{ mt: 1 }} />
              </ListItem>
            ))}
          </List>
          {selectedNodeTerms.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              No business terms associated with this node.
            </Typography>
          )}
        </Box>
      </Drawer>

      {/* Impact Analysis Drawer */}
      <Drawer
        anchor="right"
        open={impactDrawerOpen}
        onClose={() => setImpactDrawerOpen(false)}
      >
        <Box sx={{ width: 400, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ImpactIcon color="warning" />
              <Typography variant="h6">Impact Analysis</Typography>
            </Box>
            <IconButton onClick={() => setImpactDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          
          {impactLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : impactData ? (
            <>
              {/* Summary */}
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
                <Typography variant="h4" color="warning.dark" fontWeight={700}>
                  {impactData.totalCount}
                </Typography>
                <Typography variant="body2" color="warning.dark">
                  Downstream assets impacted
                </Typography>
              </Paper>

              {/* Impact by Type */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Impact by Asset Type</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {Object.entries(impactData.countByType).map(([type, count]) => (
                  <Chip
                    key={type}
                    label={`${type}: ${count}`}
                    size="small"
                    color="default"
                    variant="outlined"
                  />
                ))}
              </Box>

              {/* Impacted Assets List */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Impacted Assets</Typography>
              <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                {impactData.impactedAssets.map((asset) => (
                  <ListItem 
                    key={asset.assetId}
                    sx={{ 
                      borderLeft: 3, 
                      borderColor: asset.depth === 1 ? 'error.main' : asset.depth === 2 ? 'warning.main' : 'info.main',
                      mb: 1,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            {asset.assetName}
                          </Typography>
                          <Chip label={asset.assetType} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          Depth: {asset.depth} | Path: {asset.path.join(' → ')}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>

              {impactData.impactedAssets.length === 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  No downstream assets will be impacted by changes to this asset.
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="info">
              Select an asset to analyze its downstream impact.
            </Alert>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
