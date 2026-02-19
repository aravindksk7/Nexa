'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  CircularProgress,
  ClickAwayListener,
  Popper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Storage as StorageIcon,
  TableChart as TableIcon,
  ViewColumn as ColumnIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';

interface SearchResult {
  id: string;
  name: string;
  assetType: 'DATABASE' | 'SCHEMA' | 'TABLE' | 'VIEW' | 'COLUMN';
  description?: string;
  path?: string;
}

interface SearchResponse {
  data: SearchResult[];
  pagination: {
    total: number;
  };
}

const assetIcons: Record<string, React.ElementType> = {
  DATABASE: StorageIcon,
  SCHEMA: StorageIcon,
  TABLE: TableIcon,
  VIEW: TableIcon,
  COLUMN: ColumnIcon,
};

const assetColors: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning'> = {
  DATABASE: 'primary',
  SCHEMA: 'secondary',
  TABLE: 'success',
  VIEW: 'info',
  COLUMN: 'warning',
};

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading, isFetching } = useQuery<SearchResponse>({
    queryKey: ['globalSearch', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return { data: [], pagination: { total: 0 } };
      }
      return api.get<SearchResponse>(`/assets?search=${encodeURIComponent(debouncedQuery)}&limit=8`);
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, []);

  const handleSelect = (result: SearchResult) => {
    setQuery('');
    setOpen(false);
    router.push(`/catalog/${result.id}`);
  };

  const handleViewAll = () => {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      handleViewAll();
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (debouncedQuery.length >= 2 && results?.data && results.data.length > 0) {
      setOpen(true);
    }
  }, [debouncedQuery, results]);

  const showLoading = isLoading || isFetching;
  const hasResults = results?.data && results.data.length > 0;

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', width: { xs: 200, sm: 300, md: 400 } }} ref={anchorRef}>
        <TextField
          size="small"
          placeholder="Search assets..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim().length >= 2 && hasResults) {
              setOpen(true);
            }
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: showLoading ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{
            width: '100%',
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'action.hover',
              '&:hover': {
                bgcolor: 'action.selected',
              },
            },
          }}
        />
        <Popper
          open={open && query.length >= 2}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1300, width: anchorRef.current?.offsetWidth }}
        >
          <Paper
            elevation={8}
            sx={{
              mt: 0.5,
              maxHeight: 400,
              overflow: 'auto',
              borderRadius: 2,
            }}
          >
            {showLoading && !hasResults ? (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : hasResults ? (
              <>
                <List dense>
                  {results.data.map((result) => {
                    const Icon = assetIcons[result.assetType] || StorageIcon;
                    return (
                      <ListItem key={result.id} disablePadding>
                        <ListItemButton onClick={() => handleSelect(result)}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Icon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={result.name}
                            secondary={result.description || result.path}
                            primaryTypographyProps={{ noWrap: true }}
                            secondaryTypographyProps={{ noWrap: true }}
                          />
                          <Chip
                            label={result.assetType}
                            size="small"
                            color={assetColors[result.assetType] || 'default'}
                            variant="outlined"
                            sx={{ ml: 1, fontSize: '0.7rem' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
                {results.pagination.total > results.data.length && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderTop: 1,
                      borderColor: 'divider',
                      textAlign: 'center',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="primary"
                      sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={handleViewAll}
                    >
                      View all {results.pagination.total} results
                    </Typography>
                  </Box>
                )}
              </>
            ) : query.length >= 2 && !showLoading ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No results found for &quot;{query}&quot;
                </Typography>
              </Box>
            ) : null}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
