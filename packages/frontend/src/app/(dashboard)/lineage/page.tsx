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

export default function LineagePage() {
  const searchParams = useSearchParams();
  const initialAssetId = searchParams.get('asset');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<string | null>(initialAssetId);
  const [direction, setDirection] = useState<'both' | 'upstream' | 'downstream'>('both');
  const [depth, setDepth] = useState(3);
  const [lineageView, setLineageView] = useState<'asset' | 'column'>('asset');
  const [showBusinessTerms, setShowBusinessTerms] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [termDrawerOpen, setTermDrawerOpen] = useState(false);
  const [selectedNodeTerms, setSelectedNodeTerms] = useState<BusinessTerm[]>([]);
  const [impactDrawerOpen, setImpactDrawerOpen] = useState(false);
  const [impactAssetId, setImpactAssetId] = useState<string | null>(null);

  // Impact Analysis Query
  const { data: impactData, isLoading: impactLoading } = useQuery<ImpactAnalysisResult>({
    queryKey: ['impact-analysis', impactAssetId],
    queryFn: () => api.get<ImpactAnalysisResult>(`/lineage/${impactAssetId}/impact?maxDepth=5`),
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
      // In production: api.get(`/lineage/${direction}/${selectedAsset}?depth=${depth}`)
      return {
        nodes: [
          { id: '1', name: 'raw_customers', type: 'TABLE', namespace: 'raw' },
          { id: '2', name: 'raw_orders', type: 'TABLE', namespace: 'raw' },
          { id: '3', name: 'stg_customers', type: 'VIEW', namespace: 'staging' },
          { id: '4', name: 'stg_orders', type: 'VIEW', namespace: 'staging' },
          { id: '5', name: 'fact_sales', type: 'TABLE', namespace: 'analytics' },
          { id: '6', name: 'dim_customers', type: 'TABLE', namespace: 'analytics' },
          { id: '7', name: 'sales_dashboard', type: 'DASHBOARD', namespace: 'reporting' },
        ],
        edges: [
          { source: '1', target: '3', type: 'TRANSFORMS' },
          { source: '2', target: '4', type: 'TRANSFORMS' },
          { source: '3', target: '6', type: 'TRANSFORMS' },
          { source: '3', target: '5', type: 'TRANSFORMS' },
          { source: '4', target: '5', type: 'TRANSFORMS' },
          { source: '5', target: '7', type: 'CONSUMES' },
          { source: '6', target: '7', type: 'CONSUMES' },
        ],
      };
    },
    enabled: !!selectedAsset,
  });

  const { data: searchResults } = useQuery<LineageNode[]>({
    queryKey: ['lineage-search'],
    queryFn: async () => {
      // In production: api.get('/assets?limit=100')
      return [
        { id: '1', name: 'raw_customers', type: 'TABLE', namespace: 'raw' },
        { id: '2', name: 'raw_orders', type: 'TABLE', namespace: 'raw' },
        { id: '5', name: 'fact_sales', type: 'TABLE', namespace: 'analytics' },
        { id: '7', name: 'sales_dashboard', type: 'DASHBOARD', namespace: 'reporting' },
      ];
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
        return await api.get<ColumnLineageGraph>(`${endpoint}?depth=${depth}`);
      } catch {
        // Fallback to mock data if API not available
        return {
          nodes: [
            { assetId: selectedAsset, column: selectedColumn, assetName: 'fact_sales', assetType: 'TABLE' },
            { assetId: '3', column: 'customer_id', assetName: 'stg_customers', assetType: 'VIEW' },
            { assetId: '1', column: 'id', assetName: 'raw_customers', assetType: 'TABLE' },
          ],
          edges: [
            { id: '1', sourceAssetId: '1', sourceColumn: 'id', targetAssetId: '3', targetColumn: 'customer_id', transformationType: 'DIRECT', confidence: 1.0 },
            { id: '2', sourceAssetId: '3', sourceColumn: 'customer_id', targetAssetId: selectedAsset, targetColumn: selectedColumn, transformationType: 'DERIVED', confidence: 0.95 },
          ],
          rootNode: { assetId: selectedAsset, column: selectedColumn },
        };
      }
    },
    enabled: lineageView === 'column' && !!selectedAsset && !!selectedColumn,
  });

  // Query for business terms mappings for an asset
  const { data: assetBusinessTerms } = useQuery<{ mappings: SemanticMapping[] }>({
    queryKey: ['asset-business-terms', selectedAsset],
    queryFn: async () => {
      if (!selectedAsset) return { mappings: [] };
      try {
        return await api.get<{ mappings: SemanticMapping[] }>(`/glossary/mappings/asset/${selectedAsset}`);
      } catch {
        // Fallback for demo
        return { mappings: [] };
      }
    },
    enabled: showBusinessTerms && !!selectedAsset,
  });

  // Available columns for an asset (mock for now, would come from asset metadata)
  const availableColumns = selectedAsset ? [
    'customer_id', 'order_id', 'amount', 'revenue', 'created_at', 'updated_at'
  ] : [];

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
    if (lineageView !== 'asset' || !svgRef.current || !containerRef.current || !lineageData) return;

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
      .attr('fill', '#94a3b8');

    // Prepare data
    const nodes: D3Node[] = lineageData.nodes.map((n) => ({ ...n }));
    const links: D3Link[] = lineageData.edges.map((e) => ({
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
      .attr('stroke', '#94a3b8')
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
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('font-weight', 500);

    // Type labels
    node
      .append('text')
      .text((d) => d.type)
      .attr('text-anchor', 'middle')
      .attr('dy', 12)
      .attr('fill', 'rgba(255,255,255,0.8)')
      .attr('font-size', '10px');

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
  }, [lineageView, lineageData, getNodeColor, handleNodeClick, showBusinessTerms, assetBusinessTerms]);

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
      .attr('fill', '#64748b');

    // Prepare data
    const nodes: D3ColumnNode[] = columnLineageData.nodes.map((n, idx) => ({
      ...n,
      id: `${n.assetId}:${n.column}`,
      index: idx,
    }));

    const links: D3ColumnLink[] = columnLineageData.edges.map((e) => ({
      source: `${e.sourceAssetId}:${e.sourceColumn}`,
      target: `${e.targetAssetId}:${e.targetColumn}`,
      transformationType: e.transformationType,
      confidence: e.confidence,
    }));

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
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('font-weight', 400);

    // Column name label (main label)
    node
      .append('text')
      .text((d) => d.column)
      .attr('text-anchor', 'middle')
      .attr('dy', 8)
      .attr('fill', 'white')
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
  }, [lineageView, columnLineageData, getNodeColor, getTransformationColor, selectedAsset, selectedColumn]);

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
        </Tabs>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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

            {/* Column selector for column lineage view */}
            {lineageView === 'column' && selectedAsset && (
              <Autocomplete
                options={availableColumns}
                value={selectedColumn}
                onChange={(_, value) => setSelectedColumn(value)}
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

            {/* Business Terms Toggle */}
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
            bgcolor: '#f8fafc',
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
        {showBusinessTerms && assetBusinessTerms?.mappings && assetBusinessTerms.mappings.length > 0 && (
          <Alert 
            severity="info" 
            sx={{ m: 2 }}
            icon={<BusinessIcon />}
          >
            <Typography variant="body2">
              {assetBusinessTerms.mappings.length} business term(s) mapped to this asset. 
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
