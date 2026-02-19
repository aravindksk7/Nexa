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
} from '@mui/material';
import {
  Search as SearchIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Fullscreen as FullscreenIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import * as d3 from 'd3';

interface LineageNode {
  id: string;
  name: string;
  type: string;
  namespace?: string;
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

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  namespace?: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  type: string;
}

export default function LineagePage() {
  const searchParams = useSearchParams();
  const initialAssetId = searchParams.get('asset');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedAsset, setSelectedAsset] = useState<string | null>(initialAssetId);
  const [direction, setDirection] = useState<'both' | 'upstream' | 'downstream'>('both');
  const [depth, setDepth] = useState(3);

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

  const getNodeColor = useCallback((type: string) => {
    const colors: Record<string, string> = {
      TABLE: '#0ea5e9',
      VIEW: '#8b5cf6',
      TOPIC: '#22c55e',
      DATASET: '#f59e0b',
      DASHBOARD: '#ec4899',
      REPORT: '#ef4444',
    };
    return colors[type] || '#64748b';
  }, []);

  // D3 visualization
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !lineageData) return;

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
  }, [lineageData, getNodeColor]);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Data Lineage
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Autocomplete
              options={searchResults || []}
              getOptionLabel={(option) => option.name}
              value={searchResults?.find((r) => r.id === selectedAsset) || null}
              onChange={(_, value) => setSelectedAsset(value?.id || null)}
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

            <ToggleButtonGroup
              value={direction}
              exclusive
              onChange={(_, value) => value && setDirection(value)}
              size="small"
            >
              <ToggleButton value="upstream">Upstream</ToggleButton>
              <ToggleButton value="both">Both</ToggleButton>
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

            <Box sx={{ flex: 1 }} />

            <Tooltip title="Zoom In">
              <IconButton size="small">
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <IconButton size="small">
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Center">
              <IconButton size="small">
                <CenterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <IconButton size="small">
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
          ) : (
            <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
          )}
        </Box>

        {/* Legend */}
        <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
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
        </Paper>
      </Card>
    </Box>
  );
}
