'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemButton,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Pagination,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { debounce, formatDistanceToNow } from '@/lib/utils';

interface SearchResult {
  id: string;
  name: string;
  type: string;
  description?: string;
  domain?: string;
  tags: string[];
  updatedAt: string;
  score: number;
}

interface SearchResponse {
  data: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    types: Array<{ value: string; count: number }>;
    domains: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
  };
}

const ASSET_TYPES = ['TABLE', 'VIEW', 'DATASET', 'TOPIC', 'DASHBOARD', 'REPORT', 'API', 'FILE'];

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  useEffect(() => {
    const handler = debounce(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    handler();
  }, [query]);

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ['search', debouncedQuery, page, selectedTypes, selectedDomains],
    queryFn: async () => {
      if (!debouncedQuery) {
        return {
          data: [],
          total: 0,
          page: 1,
          pageSize: 20,
          facets: { types: [], domains: [], tags: [] },
        };
      }
      // In production: api.get(`/search?q=${debouncedQuery}&page=${page}&assetTypes=${selectedTypes.join(',')}`)
      return {
        data: [
          {
            id: '1',
            name: 'customers',
            type: 'TABLE',
            description: 'Customer master data including contact information',
            domain: 'Sales',
            tags: ['pii', 'master-data'],
            updatedAt: new Date(Date.now() - 3600000).toISOString(),
            score: 0.95,
          },
          {
            id: '2',
            name: 'customer_orders',
            type: 'VIEW',
            description: 'Customer orders with product details',
            domain: 'Sales',
            tags: ['transactional'],
            updatedAt: new Date(Date.now() - 7200000).toISOString(),
            score: 0.82,
          },
          {
            id: '3',
            name: 'customer_segments',
            type: 'TABLE',
            description: 'Marketing customer segmentation data',
            domain: 'Marketing',
            tags: ['analytics'],
            updatedAt: new Date(Date.now() - 86400000).toISOString(),
            score: 0.75,
          },
        ],
        total: 3,
        page: 1,
        pageSize: 20,
        facets: {
          types: [
            { value: 'TABLE', count: 45 },
            { value: 'VIEW', count: 32 },
            { value: 'DATASET', count: 18 },
            { value: 'TOPIC', count: 12 },
          ],
          domains: [
            { value: 'Sales', count: 28 },
            { value: 'Marketing', count: 22 },
            { value: 'Finance', count: 15 },
            { value: 'Operations', count: 10 },
          ],
          tags: [
            { value: 'pii', count: 35 },
            { value: 'master-data', count: 28 },
            { value: 'transactional', count: 45 },
          ],
        },
      };
    },
    enabled: true,
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      TABLE: '#0ea5e9',
      VIEW: '#8b5cf6',
      TOPIC: '#22c55e',
      DATASET: '#f59e0b',
      DASHBOARD: '#ec4899',
      REPORT: '#ef4444',
    };
    return colors[type] || '#64748b';
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Search
      </Typography>

      {/* Search Input */}
      <TextField
        fullWidth
        placeholder="Search for tables, views, dashboards..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 3 }}
      />

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Filters */}
        <Card sx={{ width: 280, flexShrink: 0, height: 'fit-content' }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
              Filters
            </Typography>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Asset Types</InputLabel>
              <Select
                multiple
                value={selectedTypes}
                onChange={(e) => setSelectedTypes(e.target.value as string[])}
                input={<OutlinedInput label="Asset Types" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {ASSET_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    <Checkbox checked={selectedTypes.includes(type)} size="small" />
                    <ListItemText primary={type} />
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({data?.facets.types.find((t) => t.value === type)?.count || 0})
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {data?.facets.domains && data.facets.domains.length > 0 && (
              <>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Domains
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {data.facets.domains.map((domain) => (
                    <Chip
                      key={domain.value}
                      label={`${domain.value} (${domain.count})`}
                      size="small"
                      variant={selectedDomains.includes(domain.value) ? 'filled' : 'outlined'}
                      onClick={() => {
                        setSelectedDomains((prev) =>
                          prev.includes(domain.value)
                            ? prev.filter((d) => d !== domain.value)
                            : [...prev, domain.value]
                        );
                      }}
                    />
                  ))}
                </Box>
              </>
            )}

            {data?.facets.tags && data.facets.tags.length > 0 && (
              <>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Popular Tags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {data.facets.tags.map((tag) => (
                    <Chip
                      key={tag.value}
                      label={`${tag.value} (${tag.count})`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </>
            )}
          </CardContent>
        </Card>

        {/* Search Results */}
        <Box sx={{ flex: 1 }}>
          {!debouncedQuery ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography color="text.secondary">
                  Enter a search term to find assets
                </Typography>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <Card>
              <List disablePadding>
                {Array.from({ length: 5 }).map((_, i) => (
                  <ListItem key={i} divider>
                    <Box sx={{ width: '100%' }}>
                      <Skeleton variant="text" width="40%" height={24} />
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="text" width="30%" />
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Card>
          ) : data?.data.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography color="text.secondary">
                  No results found for &quot;{debouncedQuery}&quot;
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {data?.total} results found
              </Typography>

              <Card>
                <List disablePadding>
                  {data?.data.map((result, index) => (
                    <ListItem key={result.id} divider={index < data.data.length - 1} disablePadding>
                      <ListItemButton
                        onClick={() => router.push(`/catalog/${result.id}`)}
                        sx={{ py: 2 }}
                      >
                        <Box sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip
                              label={result.type}
                              size="small"
                              sx={{ bgcolor: getTypeColor(result.type), color: 'white' }}
                            />
                            <Typography variant="subtitle1" fontWeight={600}>
                              {result.name}
                            </Typography>
                          </Box>
                          {result.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {result.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            {result.domain && (
                              <Typography variant="caption" color="text.secondary">
                                Domain: {result.domain}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Updated {formatDistanceToNow(result.updatedAt)}
                            </Typography>
                            {result.tags.length > 0 && (
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {result.tags.slice(0, 3).map((tag) => (
                                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Card>

              {data && data.total > data.pageSize && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={Math.ceil(data.total / data.pageSize)}
                    page={page}
                    onChange={(_, value) => setPage(value)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
