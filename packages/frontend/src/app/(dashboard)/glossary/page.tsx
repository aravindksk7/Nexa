'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as DomainIcon,
  Description as TermIcon,
  Link as LinkIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';

interface BusinessDomain {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: BusinessDomain;
  _count?: { terms: number; children: number };
  createdAt: string;
  updatedAt: string;
}

interface BusinessTerm {
  id: string;
  name: string;
  definition: string;
  domainId: string;
  domain?: BusinessDomain;
  ownerId?: string;
  owner?: { username: string };
  status: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
  _count?: { mappings: number };
  createdAt: string;
  updatedAt: string;
}

interface Asset {
  id: string;
  name: string;
  assetType: string;
}

interface TermAssetMapping {
  id: string;
  name: string;
  assetType: string;
  columnName?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function GlossaryPage() {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dialog states
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [termDialogOpen, setTermDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingViewOpen, setMappingViewOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<BusinessDomain | null>(null);
  const [editingTerm, setEditingTerm] = useState<BusinessTerm | null>(null);
  const [selectedTermForMapping, setSelectedTermForMapping] = useState<BusinessTerm | null>(null);
  const [selectedTermForMappings, setSelectedTermForMappings] = useState<BusinessTerm | null>(null);

  // Forms
  const domainForm = useForm({
    defaultValues: { name: '', description: '', parentId: '' },
  });
  const termForm = useForm({
    defaultValues: { name: '', definition: '', domainId: '', status: 'ACTIVE' as const },
  });
  const mappingForm = useForm({
    defaultValues: { assetId: '', columnName: '' },
  });

  // Queries
  const { data: domains, isLoading: domainsLoading } = useQuery<BusinessDomain[]>({
    queryKey: ['glossary-domains'],
    queryFn: async () => {
      const result = await api.get<{ domains: BusinessDomain[] }>('/glossary/domains');
      return result.domains;
    },
  });

  const { data: terms, isLoading: termsLoading } = useQuery<BusinessTerm[]>({
    queryKey: ['glossary-terms', searchQuery],
    queryFn: async () => {
      const url = searchQuery ? `/glossary/terms?search=${encodeURIComponent(searchQuery)}` : '/glossary/terms';
      const result = await api.get<{ terms: BusinessTerm[] }>(url);
      return result.terms;
    },
  });

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['assets-for-mapping'],
    queryFn: async () => {
      const result = await api.get<{ data: Asset[]; pagination: unknown }>('/assets');
      return result.data ?? [];
    },
  });

  const { data: termAssets, isLoading: termAssetsLoading } = useQuery<TermAssetMapping[]>({
    queryKey: ['glossary-term-assets', selectedTermForMappings?.id],
    queryFn: async () => {
      if (!selectedTermForMappings) return [];
      const result = await api.get<{ assets: TermAssetMapping[] }>(
        `/glossary/terms/${selectedTermForMappings.id}/assets`
      );
      return result.assets;
    },
    enabled: !!selectedTermForMappings,
  });

  // Mutations
  const createDomainMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; parentId?: string }) =>
      api.post('/glossary/domains', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-domains'] });
      setDomainDialogOpen(false);
      domainForm.reset();
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      api.put(`/glossary/domains/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-domains'] });
      setDomainDialogOpen(false);
      setEditingDomain(null);
      domainForm.reset();
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/glossary/domains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-domains'] });
    },
  });

  const createTermMutation = useMutation({
    mutationFn: (data: { name: string; definition: string; domainId: string }) =>
      api.post('/glossary/terms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-terms'] });
      setTermDialogOpen(false);
      termForm.reset();
    },
  });

  const updateTermMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BusinessTerm> }) =>
      api.put(`/glossary/terms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-terms'] });
      setTermDialogOpen(false);
      setEditingTerm(null);
      termForm.reset();
    },
  });

  const deprecateTermMutation = useMutation({
    mutationFn: (id: string) => api.post(`/glossary/terms/${id}/deprecate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-terms'] });
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: (data: { businessTermId: string; assetId: string; columnName?: string }) =>
      api.post('/glossary/mappings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-terms'] });
      queryClient.invalidateQueries({ queryKey: ['glossary-term-assets'] });
      setMappingDialogOpen(false);
      setSelectedTermForMapping(null);
      mappingForm.reset();
    },
  });

  // Handlers
  const handleEditDomain = (domain: BusinessDomain) => {
    setEditingDomain(domain);
    domainForm.reset({
      name: domain.name,
      description: domain.description || '',
      parentId: domain.parentId || '',
    });
    setDomainDialogOpen(true);
  };

  const handleEditTerm = (term: BusinessTerm) => {
    setEditingTerm(term);
    termForm.reset({
      name: term.name,
      definition: term.definition,
      domainId: term.domainId,
      status: term.status,
    });
    setTermDialogOpen(true);
  };

  const handleOpenMappingDialog = (term: BusinessTerm) => {
    setSelectedTermForMapping(term);
    mappingForm.reset({ assetId: '', columnName: '' });
    setMappingDialogOpen(true);
  };

  const handleOpenMappingView = (term: BusinessTerm) => {
    setSelectedTermForMappings(term);
    setMappingViewOpen(true);
  };

  const onDomainSubmit = domainForm.handleSubmit((data) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      parentId: data.parentId || undefined,
    };
    if (editingDomain) {
      updateDomainMutation.mutate({ id: editingDomain.id, data: payload });
    } else {
      createDomainMutation.mutate(payload);
    }
  });

  const onTermSubmit = termForm.handleSubmit((data) => {
    if (editingTerm) {
      updateTermMutation.mutate({ id: editingTerm.id, data });
    } else {
      createTermMutation.mutate(data);
    }
  });

  const onMappingSubmit = mappingForm.handleSubmit((data) => {
    if (selectedTermForMapping) {
      createMappingMutation.mutate({
        businessTermId: selectedTermForMapping.id,
        assetId: data.assetId,
        columnName: data.columnName || undefined,
      });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'DEPRECATED': return 'error';
      case 'DRAFT': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Business Glossary
        </Typography>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab icon={<TermIcon />} iconPosition="start" label="Business Terms" />
            <Tab icon={<DomainIcon />} iconPosition="start" label="Domains" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Business Terms Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <TextField
                placeholder="Search terms..."
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ width: 300 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingTerm(null);
                  termForm.reset({ name: '', definition: '', domainId: '', status: 'ACTIVE' });
                  setTermDialogOpen(true);
                }}
              >
                Add Term
              </Button>
            </Box>

            {termsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : terms && terms.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Definition</TableCell>
                      <TableCell>Domain</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Mappings</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {terms
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((term) => (
                        <TableRow key={term.id}>
                          <TableCell>
                            <Typography fontWeight={500}>{term.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                maxWidth: 300,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {term.definition}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={term.domain?.name || 'Unknown'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={term.status}
                              size="small"
                              color={getStatusColor(term.status) as 'success' | 'error' | 'warning' | 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={term._count?.mappings || 0}
                              size="small"
                              variant="outlined"
                              onClick={() => handleOpenMappingView(term)}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Add Mapping">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenMappingDialog(term)}
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEditTerm(term)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {term.status !== 'DEPRECATED' && (
                              <Tooltip title="Deprecate">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    if (confirm('Deprecate this term?')) {
                                      deprecateTermMutation.mutate(term.id);
                                    }
                                  }}
                                >
                                  <ArchiveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={terms.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                />
              </TableContainer>
            ) : (
              <Alert severity="info">
                No business terms found. Create your first term to get started.
              </Alert>
            )}
          </TabPanel>

          {/* Domains Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingDomain(null);
                  domainForm.reset({ name: '', description: '', parentId: '' });
                  setDomainDialogOpen(true);
                }}
              >
                Add Domain
              </Button>
            </Box>

            {domainsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : domains && domains.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Parent</TableCell>
                      <TableCell>Terms</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {domains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DomainIcon color="primary" fontSize="small" />
                            <Typography fontWeight={500}>{domain.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {domain.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {domain.parent?.name || '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={domain._count?.terms || 0}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleEditDomain(domain)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => {
                                if (confirm('Delete this domain?')) {
                                  deleteDomainMutation.mutate(domain.id);
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                No domains found. Create your first domain to organize business terms.
              </Alert>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Domain Dialog */}
      <Dialog open={domainDialogOpen} onClose={() => setDomainDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={onDomainSubmit}>
          <DialogTitle>
            {editingDomain ? 'Edit Domain' : 'Create Domain'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Controller
                name="name"
                control={domainForm.control}
                rules={{ required: 'Name is required' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Name"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="description"
                control={domainForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                  />
                )}
              />
              <Controller
                name="parentId"
                control={domainForm.control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Parent Domain</InputLabel>
                    <Select {...field} label="Parent Domain">
                      <MenuItem value="">None</MenuItem>
                      {domains
                        ?.filter((d) => d.id !== editingDomain?.id)
                        .map((d) => (
                          <MenuItem key={d.id} value={d.id}>
                            {d.name}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDomainDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createDomainMutation.isPending || updateDomainMutation.isPending}
            >
              {editingDomain ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Term Dialog */}
      <Dialog open={termDialogOpen} onClose={() => setTermDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={onTermSubmit}>
          <DialogTitle>
            {editingTerm ? 'Edit Business Term' : 'Create Business Term'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Controller
                name="name"
                control={termForm.control}
                rules={{ required: 'Name is required' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Name"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="definition"
                control={termForm.control}
                rules={{ required: 'Definition is required' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Definition"
                    fullWidth
                    multiline
                    rows={3}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="domainId"
                control={termForm.control}
                rules={{ required: 'Domain is required' }}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth error={!!fieldState.error}>
                    <InputLabel>Domain</InputLabel>
                    <Select {...field} label="Domain">
                      {domains?.map((d) => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
              {editingTerm && (
                <Controller
                  name="status"
                  control={termForm.control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="DRAFT">Draft</MenuItem>
                        <MenuItem value="DEPRECATED">Deprecated</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTermDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createTermMutation.isPending || updateTermMutation.isPending}
            >
              {editingTerm ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onClose={() => setMappingDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={onMappingSubmit}>
          <DialogTitle>
            Map Term to Asset
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Alert severity="info" sx={{ mb: 1 }}>
                Mapping &quot;{selectedTermForMapping?.name}&quot; to a data asset
              </Alert>
              <Controller
                name="assetId"
                control={mappingForm.control}
                rules={{ required: 'Asset is required' }}
                render={({ field, fieldState }) => (
                  <Autocomplete
                    options={assets || []}
                    getOptionLabel={(option) => option.name}
                    value={assets?.find((a) => a.id === field.value) || null}
                    onChange={(_, value) => field.onChange(value?.id || '')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Asset"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...rest } = props as { key: string };
                      return (
                        <li key={key} {...rest}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={option.assetType} size="small" />
                            <Typography>{option.name}</Typography>
                          </Box>
                        </li>
                      );
                    }}
                  />
                )}
              />
              <Controller
                name="columnName"
                control={mappingForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Column Name (optional)"
                    fullWidth
                    placeholder="Leave empty for table-level mapping"
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMappingDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMappingMutation.isPending}
            >
              Create Mapping
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Mapping View Dialog */}
      <Dialog
        open={mappingViewOpen}
        onClose={() => {
          setMappingViewOpen(false);
          setSelectedTermForMappings(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Mappings for {selectedTermForMappings?.name || 'Term'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {termAssetsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : termAssets && termAssets.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Asset</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Column</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {termAssets.map((mapping) => (
                      <TableRow key={`${mapping.id}-${mapping.columnName || 'table'}`}>
                        <TableCell>
                          <Typography fontWeight={500}>{mapping.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={mapping.assetType} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{mapping.columnName || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No mappings found for this term.</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMappingViewOpen(false);
              setSelectedTermForMappings(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
