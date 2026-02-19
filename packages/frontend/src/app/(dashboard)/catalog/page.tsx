'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountTree as LineageIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/utils';

interface Asset {
  id: string;
  name: string;
  type: string;
  assetType?: string;
  description?: string;
  domain?: string;
  ownerId?: string;
  owner?: {
    id: string;
    username?: string;
    name?: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const ASSET_TYPES = [
  'TABLE',
  'VIEW',
  'DATASET',
  'TOPIC',
  'DASHBOARD',
  'REPORT',
  'API',
  'FILE',
];

export default function CatalogPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      type: 'TABLE',
      description: '',
      domain: '',
    },
  });

  const { data, isLoading } = useQuery<PaginatedResponse<Asset>>({
    queryKey: ['assets', { page, rowsPerPage, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      });
      if (search) params.append('search', search);
      
      const result = await api.get<{
        data: Asset[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/assets?${params.toString()}`);
      
      return {
        data: result.data.map(asset => ({
          ...asset,
          type: asset.type || (asset as unknown as { assetType: string }).assetType,
          owner: asset.owner || undefined,  
        })),
        total: result.pagination.total,
        page: result.pagination.page,
        pageSize: result.pagination.limit,
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: (formData: { name: string; type: string; description: string; domain: string }) =>
      api.post('/assets', {
        name: formData.name,
        assetType: formData.type,
        description: formData.description || undefined,
        domain: formData.domain || undefined,
        tags: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setCreateDialogOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setAnchorEl(null);
      setSelectedAsset(null);
    },
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, asset: Asset) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedAsset(asset);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAsset(null);
  };

  const onSubmit = (data: { name: string; type: string; description: string; domain: string }) => {
    createMutation.mutate(data);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error'> = {
      TABLE: 'primary',
      VIEW: 'secondary',
      TOPIC: 'success',
      DATASET: 'warning',
      DASHBOARD: 'info',
      REPORT: 'error',
    };
    return colors[type] || 'default';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          Data Catalog
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New Asset
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
            size="small"
          />
        </Box>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Box sx={{ height: 24, bgcolor: 'grey.100', borderRadius: 1 }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.data.map((asset) => (
                  <TableRow
                    key={asset.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/catalog/${asset.id}`)}
                  >
                    <TableCell>
                      <Box>
                        <Typography fontWeight={500}>{asset.name}</Typography>
                        {asset.description && (
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                            {asset.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={asset.type} size="small" color={getTypeColor(asset.type)} variant="outlined" />
                    </TableCell>
                    <TableCell>{asset.domain || '-'}</TableCell>
                    <TableCell>{asset.owner?.username || asset.owner?.name || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {asset.tags.slice(0, 2).map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                        {asset.tags.length > 2 && (
                          <Chip label={`+${asset.tags.length - 2}`} size="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDistanceToNow(asset.updatedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, asset)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={data?.total || 0}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Card>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            router.push(`/catalog/${selectedAsset?.id}/edit`);
            handleMenuClose();
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            router.push(`/lineage?asset=${selectedAsset?.id}`);
            handleMenuClose();
          }}
        >
          <LineageIcon fontSize="small" sx={{ mr: 1 }} />
          View Lineage
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedAsset) deleteMutation.mutate(selectedAsset.id);
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>Create New Asset</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Name is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Name"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
              <Controller
                name="type"
                control={control}
                rules={{ required: 'Type is required' }}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select {...field} label="Type">
                      {ASSET_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Description" fullWidth multiline rows={3} />
                )}
              />
              <Controller
                name="domain"
                control={control}
                render={({ field }) => <TextField {...field} label="Domain" fullWidth />}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              Create
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
