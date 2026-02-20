'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Divider,
  Stack,
  Grid2 as Grid,
  IconButton,
  Skeleton,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  AccountTree as LineageIcon,
  Storage as StorageIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  TableChart as PreviewIcon,
  Assessment as ProfileIcon,
  Info as InfoIcon,
  History as HistoryIcon,
  Link as LinkIcon,
  Restore as RestoreIcon,
  Compare as CompareIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/utils';
import {
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, Select, MenuItem,
  TextField as MuiTextField,
} from '@mui/material';

interface Asset {
  id: string;
  name: string;
  assetType: string;
  description?: string;
  domain?: string;
  ownerId?: string;
  owner?: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  tags: string[];
  customProperties?: Record<string, unknown>;
  qualityStatus?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

interface AssetDetailPageProps {
  params: Promise<{ id: string }>;
}

interface DataPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

interface ColumnProfile {
  name: string;
  dataType: string;
  nullCount: number;
  nullPercentage: number;
  distinctCount: number;
  min?: string | number;
  max?: string | number;
  mean?: number;
  stdDev?: number;
  topValues?: { value: string; count: number }[];
}

interface DataProfile {
  assetId: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  lastProfiledAt: string;
}

interface AssetVersion {
  id: string;
  version: number;
  name: string;
  description: string | null;
  domain: string | null;
  tags: string[];
  changeType: string;
  changedById: string;
  createdAt: string;
}

interface VersionChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface AssetRelationship {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: string;
  sourceAsset?: { id: string; name: string; assetType: string };
  targetAsset?: { id: string; name: string; assetType: string };
  createdAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [compareV1, setCompareV1] = useState<number | ''>('');
  const [compareV2, setCompareV2] = useState<number | ''>('');
  const [doCompare, setDoCompare] = useState(false);
  const [relDialog, setRelDialog] = useState(false);
  const [relTarget, setRelTarget] = useState('');
  const [relType, setRelType] = useState('RELATED_TO');

  const { data, isLoading, error } = useQuery<{ asset: Asset }>({
    queryKey: ['asset', id],
    queryFn: () => api.get<{ asset: Asset }>(`/assets/${id}`),
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<DataPreview>({
    queryKey: ['asset-preview', id],
    queryFn: () => api.get<DataPreview>(`/assets/${id}/preview?limit=50`),
    enabled: tabValue === 1,
  });

  const { data: profileData, isLoading: profileLoading } = useQuery<DataProfile>({
    queryKey: ['asset-profile', id],
    queryFn: () => api.get<DataProfile>(`/assets/${id}/profile`),
    enabled: tabValue === 2,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ history: AssetVersion[] }>({
    queryKey: ['asset-history', id],
    queryFn: () => api.get<{ history: AssetVersion[] }>(`/assets/${id}/history`),
    enabled: tabValue === 3,
  });

  const { data: compareData, isLoading: compareLoading } = useQuery<{ 
    comparison: { changes: VersionChange[]; version1: AssetVersion; version2: AssetVersion } 
  }>({
    queryKey: ['asset-compare', id, compareV1, compareV2],
    queryFn: () => api.get(`/assets/${id}/versions/${compareV1}/compare/${compareV2}`),
    enabled: doCompare && compareV1 !== '' && compareV2 !== '',
  });

  const comparisonData = compareData?.comparison;

  const { data: relData, isLoading: relLoading } = useQuery<{ relationships: AssetRelationship[] }>({
    queryKey: ['asset-relationships', id],
    queryFn: () => api.get<{ relationships: AssetRelationship[] }>(`/relationships/asset/${id}`),
    enabled: tabValue === 4,
  });

  const { data: assetsData } = useQuery<{ data: { id: string; name: string; assetType: string }[]; pagination: unknown }>({
    queryKey: ['assets-list-mini'],
    queryFn: () => api.get<{ data: { id: string; name: string; assetType: string }[]; pagination: unknown }>('/assets?page=1&limit=100'),
    enabled: relDialog,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      router.push('/catalog');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) => api.post(`/assets/${id}/versions/${version}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      queryClient.invalidateQueries({ queryKey: ['asset-history', id] });
    },
  });

  const createRelMutation = useMutation({
    mutationFn: () => api.post('/relationships', {
      sourceAssetId: id,
      targetAssetId: relTarget,
      relationshipType: relType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-relationships', id] });
      setRelDialog(false);
      setRelTarget('');
      setRelType('RELATED_TO');
    },
  });

  const deleteRelMutation = useMutation({
    mutationFn: (relId: string) => api.delete(`/relationships/${relId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-relationships', id] }),
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this asset?')) {
      deleteMutation.mutate();
    }
  };

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">
          {error instanceof Error ? error.message : 'Failed to load asset'}
        </Typography>
        <Button onClick={() => router.push('/catalog')} sx={{ mt: 2 }}>
          Back to Catalog
        </Button>
      </Box>
    );
  }

  const asset = data?.asset;

  const getTypeColor = (type: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning'> = {
      DATABASE: 'primary',
      SCHEMA: 'secondary',
      TABLE: 'success',
      VIEW: 'info',
      COLUMN: 'warning',
    };
    return colors[type] || 'default';
  };

  const getQualityColor = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
      GOOD: 'success',
      WARNING: 'warning',
      CRITICAL: 'error',
    };
    return colors[status] || 'default';
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/catalog"
          onClick={(e) => {
            e.preventDefault();
            router.push('/catalog');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Catalog
        </Link>
        <Typography color="text.primary">
          {isLoading ? <Skeleton width={100} /> : asset?.name}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => router.push('/catalog')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight={700}>
            {isLoading ? <Skeleton width={200} /> : asset?.name}
          </Typography>
          {asset && (
            <Chip
              label={asset.assetType}
              color={getTypeColor(asset.assetType)}
              size="small"
            />
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<LineageIcon />}
            onClick={() => router.push(`/lineage?asset=${id}`)}
          >
            View Lineage
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => router.push(`/catalog/${id}/edit`)}
          >
            Edit
          </Button>
          <IconButton
            color="error"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <DeleteIcon />
          </IconButton>
        </Stack>
      </Box>

      {isLoading ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Skeleton height={200} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Skeleton height={300} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : asset ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
                  <Tab icon={<InfoIcon />} iconPosition="start" label="Overview" />
                  <Tab icon={<PreviewIcon />} iconPosition="start" label="Data Preview" />
                  <Tab icon={<ProfileIcon />} iconPosition="start" label="Data Profile" />
                  <Tab icon={<HistoryIcon />} iconPosition="start" label="History" />
                  <Tab icon={<LinkIcon />} iconPosition="start" label="Relationships" />
                </Tabs>
              </Box>
              <CardContent>
                {/* Overview Tab */}
                <TabPanel value={tabValue} index={0}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Description
                  </Typography>
                  <Typography color="text.secondary" sx={{ mb: 3 }}>
                    {asset.description || 'No description provided.'}
                  </Typography>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {asset.tags.length > 0 ? (
                      asset.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography color="text.secondary">No tags</Typography>
                    )}
                  </Box>

                  {asset.customProperties && Object.keys(asset.customProperties).length > 0 && (
                    <>
                      <Divider sx={{ my: 3 }} />
                      <Typography variant="h6" fontWeight={600} gutterBottom>
                        Custom Properties
                      </Typography>
                      <Box component="pre" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, overflow: 'auto' }}>
                        {JSON.stringify(asset.customProperties, null, 2)}
                      </Box>
                    </>
                  )}
                </TabPanel>

                {/* Data Preview Tab */}
                <TabPanel value={tabValue} index={1}>
                  {previewLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : previewData ? (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" color="text.secondary">
                          Showing {previewData.rows.length} of {previewData.totalRows} rows
                        </Typography>
                      </Box>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                        <Table stickyHeader size="small">
                          <TableHead>
                            <TableRow>
                              {previewData.columns.map((col) => (
                                <TableCell key={col} sx={{ fontWeight: 600 }}>
                                  {col}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {previewData.rows.map((row, idx) => (
                              <TableRow key={idx} hover>
                                {previewData.columns.map((col) => (
                                  <TableCell key={col}>
                                    {String(row[col] ?? '-')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  ) : (
                    <Alert severity="info">No preview data available for this asset.</Alert>
                  )}
                </TabPanel>

                {/* Data Profile Tab */}
                <TabPanel value={tabValue} index={2}>
                  {profileLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : profileData ? (
                    <>
                      <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Total Rows
                          </Typography>
                          <Typography variant="h5" fontWeight={600}>
                            {profileData.rowCount.toLocaleString()}
                          </Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Columns
                          </Typography>
                          <Typography variant="h5" fontWeight={600}>
                            {profileData.columnCount}
                          </Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Last Profiled
                          </Typography>
                          <Typography variant="body1" fontWeight={500}>
                            {formatDistanceToNow(profileData.lastProfiledAt)}
                          </Typography>
                        </Paper>
                      </Box>

                      <Typography variant="h6" fontWeight={600} gutterBottom>
                        Column Statistics
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Distinct</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Nulls</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Min/Max or Top Values</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {profileData.columns.map((col) => (
                              <TableRow key={col.name} hover>
                                <TableCell>
                                  <Typography fontWeight={500}>{col.name}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip label={col.dataType} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell>{col.distinctCount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={col.nullPercentage}
                                      sx={{ width: 60, height: 6, borderRadius: 1 }}
                                      color={col.nullPercentage > 10 ? 'warning' : 'primary'}
                                    />
                                    <Typography variant="body2">
                                      {col.nullPercentage.toFixed(1)}%
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  {col.min !== undefined && col.max !== undefined ? (
                                    <Tooltip title={`Mean: ${col.mean?.toFixed(2) ?? 'N/A'}, StdDev: ${col.stdDev?.toFixed(2) ?? 'N/A'}`}>
                                      <Typography variant="body2">
                                        {col.min} - {col.max}
                                      </Typography>
                                    </Tooltip>
                                  ) : col.topValues?.length ? (
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                      {col.topValues.slice(0, 3).map((tv) => (
                                        <Chip
                                          key={tv.value}
                                          label={`${tv.value} (${tv.count})`}
                                          size="small"
                                          variant="outlined"
                                        />
                                      ))}
                                    </Box>
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  ) : (
                    <Alert severity="info">No profiling data available. Run a profile job to generate statistics.</Alert>
                  )}
                </TabPanel>

                {/* History Tab */}
                <TabPanel value={tabValue} index={3}>
                  {historyLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <InputLabel>From Version</InputLabel>
                          <Select value={compareV1} label="From Version" onChange={e => { setCompareV1(Number(e.target.value)); setDoCompare(false); }}>
                            {historyData?.history.map(v => <MenuItem key={v.version} value={v.version}>v{v.version}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <InputLabel>To Version</InputLabel>
                          <Select value={compareV2} label="To Version" onChange={e => { setCompareV2(Number(e.target.value)); setDoCompare(false); }}>
                            {historyData?.history.map(v => <MenuItem key={v.version} value={v.version}>v{v.version}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <Button variant="outlined" startIcon={<CompareIcon />} size="small"
                          disabled={compareV1 === '' || compareV2 === '' || compareV1 === compareV2}
                          onClick={() => setDoCompare(true)}
                        >Compare</Button>
                        {doCompare && <Button size="small" onClick={() => { setDoCompare(false); setCompareV1(''); setCompareV2(''); }}>Clear</Button>}
                      </Box>

                      {doCompare && comparisonData && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Changes between v{compareV1} → v{compareV2}
                          </Typography>
                          {comparisonData.changes.length === 0 ? (
                            <Alert severity="info">No differences found between these versions.</Alert>
                          ) : (
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>Field</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Old (v{compareV1})</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>New (v{compareV2})</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {comparisonData.changes.map(c => (
                                    <TableRow key={c.field}>
                                      <TableCell><Typography fontWeight={500}>{c.field}</Typography></TableCell>
                                      <TableCell sx={{ color: 'error.main' }}><Box component="pre" sx={{ m: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(c.oldValue, null, 2)}</Box></TableCell>
                                      <TableCell sx={{ color: 'success.main' }}><Box component="pre" sx={{ m: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(c.newValue, null, 2)}</Box></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                          {compareLoading && <CircularProgress size={20} />}
                        </Box>
                      )}

                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Version</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Change Type</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {historyData?.history.map((v) => (
                              <TableRow key={v.id} hover>
                                <TableCell><Chip label={`v${v.version}`} size="small" /></TableCell>
                                <TableCell>
                                  <Chip label={v.changeType} size="small"
                                    color={v.changeType === 'CREATED' ? 'success' : v.changeType === 'RESTORED' ? 'info' : 'default'}
                                  />
                                </TableCell>
                                <TableCell>{formatDistanceToNow(v.createdAt)}</TableCell>
                                <TableCell>
                                  {v.version !== asset.version && (
                                    <Tooltip title={`Restore to v${v.version}`}>
                                      <IconButton size="small" color="primary"
                                        onClick={() => { if (confirm(`Restore asset to v${v.version}? This will create a new version.`)) restoreMutation.mutate(v.version); }}
                                        disabled={restoreMutation.isPending}
                                      >
                                        <RestoreIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </TabPanel>

                {/* Relationships Tab */}
                <TabPanel value={tabValue} index={4}>
                  {relLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setRelDialog(true)}>
                          Add Relationship
                        </Button>
                      </Box>
                      {!relData?.relationships.length ? (
                        <Alert severity="info">No relationships defined for this asset.</Alert>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Direction</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Related Asset</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Since</TableCell>
                                <TableCell />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {relData!.relationships.map((r) => {
                                const isSource = r.sourceAssetId === id;
                                const relatedAsset = isSource ? r.targetAsset : r.sourceAsset;
                                const relatedId = isSource ? r.targetAssetId : r.sourceAssetId;
                                return (
                                  <TableRow key={r.id} hover>
                                    <TableCell><Chip label={r.relationshipType.replace(/_/g, ' ')} size="small" variant="outlined" /></TableCell>
                                    <TableCell><Chip label={isSource ? '→ outgoing' : '← incoming'} size="small" color={isSource ? 'primary' : 'secondary'} /></TableCell>
                                    <TableCell>
                                      <Typography
                                        variant="body2" sx={{ cursor: 'pointer', color: 'primary.main' }}
                                        onClick={() => router.push(`/catalog/${relatedId}`)}
                                      >
                                        {relatedAsset?.name ?? relatedId}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{formatDistanceToNow(r.createdAt)}</TableCell>
                                    <TableCell>
                                      {isSource && (
                                        <IconButton size="small" color="error"
                                          onClick={() => { if (confirm('Delete this relationship?')) deleteRelMutation.mutate(r.id); }}
                                          disabled={deleteRelMutation.isPending}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </>
                  )}
                </TabPanel>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Details
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StorageIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Type
                        </Typography>
                        <Typography>{asset.assetType}</Typography>
                      </Box>
                    </Box>

                    {asset.domain && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StorageIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Domain
                          </Typography>
                          <Typography>{asset.domain}</Typography>
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Owner
                        </Typography>
                        <Typography>
                          {asset.owner
                            ? asset.owner.firstName && asset.owner.lastName
                              ? `${asset.owner.firstName} ${asset.owner.lastName}`
                              : asset.owner.username
                            : 'Unassigned'}
                        </Typography>
                      </Box>
                    </Box>

                    {asset.qualityStatus && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Quality Status
                        </Typography>
                        <Chip
                          label={asset.qualityStatus}
                          color={getQualityColor(asset.qualityStatus)}
                          size="small"
                        />
                      </Box>
                    )}

                    {asset.version && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Version
                        </Typography>
                        <Typography>v{asset.version}</Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Timestamps
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Created
                        </Typography>
                        <Typography>
                          {formatDistanceToNow(asset.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Last Updated
                        </Typography>
                        <Typography>
                          {formatDistanceToNow(asset.updatedAt)}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      ) : null}

      {/* Add Relationship Dialog */}
      <Dialog open={relDialog} onClose={() => setRelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Relationship</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Related Asset</InputLabel>
            <Select value={relTarget} label="Related Asset" onChange={e => setRelTarget(e.target.value as string)}>
              {assetsData?.data.filter(a => a.id !== id).map(a => (
                <MenuItem key={a.id} value={a.id}>{a.name} ({a.assetType})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Relationship Type</InputLabel>
            <Select value={relType} label="Relationship Type" onChange={e => setRelType(e.target.value as string)}>
              {['DERIVED_FROM', 'RELATED_TO', 'REPLACES', 'CONTAINS', 'DEPENDS_ON'].map(t => (
                <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!relTarget || createRelMutation.isPending}
            onClick={() => createRelMutation.mutate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
