'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
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
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as RunIcon,
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  Rule as RuleIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/utils';

interface QualityRule {
  id: string;
  assetId: string;
  name: string;
  description: string | null;
  ruleType: string;
  ruleDefinition: Record<string, unknown>;
  severity: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
  asset?: { id: string; name: string; assetType: string };
}

interface Asset {
  id: string;
  name: string;
  assetType: string;
}

interface RuleForm {
  assetId: string;
  name: string;
  description: string;
  ruleType: string;
  ruleDefinition: string;
  severity: string;
}

const RULE_TYPES = ['NOT_NULL', 'UNIQUE', 'RANGE', 'REGEX', 'CUSTOM', 'REFERENTIAL_INTEGRITY'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const severityColor = (s: string) =>
  ({ LOW: 'success', MEDIUM: 'warning', HIGH: 'error', CRITICAL: 'error' } as const)[s] ?? 'default';

export default function QualityPage() {
  const queryClient = useQueryClient();
  const [createDialog, setCreateDialog] = useState(false);
  const [editRule, setEditRule] = useState<QualityRule | null>(null);
  const [runResult, setRunResult] = useState<{ ruleId: string; status: string; score?: number } | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RuleForm>({
    defaultValues: {
      assetId: '',
      name: '',
      description: '',
      ruleType: 'NOT_NULL',
      ruleDefinition: '{}',
      severity: 'MEDIUM',
    },
  });

  // Fetch all assets (for the dropdown)
  const { data: assetsData } = useQuery<{ data: Asset[]; pagination: unknown }>({
    queryKey: ['assets-list-mini'],
    queryFn: () => api.get<{ data: Asset[]; pagination: unknown }>('/assets?page=1&limit=200'),
  });

  // Fetch all quality rules by pulling per-asset rules — backend has no global list endpoint,
  // so we use the overview to list passed/failed then load rules per asset.
  // Alternatively a lightweight approach: load /quality/overview and show summary
  const { data: overviewData, isLoading: overviewLoading } = useQuery<{
    overallScore: number;
    totalRules: number;
    passedRules: number;
    failedRules: number;
    dimensions: { name: string; score: number; rules: number }[];
    recentFailures: { ruleId: string; assetId: string; ruleName: string; assetName: string; severity: string; score: number; evaluatedAt: string }[];
  }>({
    queryKey: ['quality-overview'],
    queryFn: () => api.get('/quality/overview'),
  });

  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  const { data: rulesData, isLoading: rulesLoading } = useQuery<{ rules: QualityRule[] }>({
    queryKey: ['quality-rules', selectedAssetId],
    queryFn: () => api.get<{ rules: QualityRule[] }>(`/quality/assets/${selectedAssetId}/rules`),
    enabled: !!selectedAssetId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<RuleForm, 'ruleDefinition'> & { ruleDefinition: Record<string, unknown> }) =>
      api.post('/quality/rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-rules', selectedAssetId] });
      queryClient.invalidateQueries({ queryKey: ['quality-overview'] });
      setCreateDialog(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<QualityRule> & { id: string }) =>
      api.put(`/quality/rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-rules', selectedAssetId] });
      queryClient.invalidateQueries({ queryKey: ['quality-overview'] });
      setEditRule(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quality/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-rules', selectedAssetId] });
      queryClient.invalidateQueries({ queryKey: ['quality-overview'] });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: (ruleId: string) => api.post<{ result: { status: string; score: number } }>(`/quality/rules/${ruleId}/evaluate`),
    onSuccess: (data, ruleId) => {
      setRunResult({ ruleId, status: data.result.status, score: data.result.score });
      queryClient.invalidateQueries({ queryKey: ['quality-rules', selectedAssetId] });
    },
  });

  const onSubmit = handleSubmit((data) => {
    let parsedDefinition: Record<string, unknown> = {};
    try {
      parsedDefinition = JSON.parse(data.ruleDefinition);
    } catch {
      parsedDefinition = {};
    }
    createMutation.mutate({ ...data, ruleDefinition: parsedDefinition });
  });

  const openEdit = (rule: QualityRule) => {
    setEditRule(rule);
    setValue('name', rule.name);
    setValue('description', rule.description ?? '');
    setValue('ruleType', rule.ruleType);
    setValue('ruleDefinition', JSON.stringify(rule.ruleDefinition, null, 2));
    setValue('severity', rule.severity);
  };

  const submitEdit = handleSubmit((data) => {
    if (!editRule) return;
    let parsedDefinition: Record<string, unknown> = {};
    try { parsedDefinition = JSON.parse(data.ruleDefinition); } catch { /* empty */ }
    updateMutation.mutate({ id: editRule.id, name: data.name, description: data.description, ruleType: data.ruleType, ruleDefinition: parsedDefinition, severity: data.severity });
  });

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Data Quality
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage quality rules, track scores and run evaluations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { reset(); setCreateDialog(true); }}
        >
          New Rule
        </Button>
      </Box>

      {/* Overview cards */}
      {overviewLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : overviewData && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
          {[
            { label: 'Overall Score', value: `${overviewData.overallScore}%`, color: overviewData.overallScore >= 80 ? 'success.main' : 'warning.main' },
            { label: 'Total Rules', value: overviewData.totalRules },
            { label: 'Passing', value: overviewData.passedRules, color: 'success.main' },
            { label: 'Failing', value: overviewData.failedRules, color: 'error.main' },
          ].map(card => (
            <Card key={card.label} variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color={card.color ?? 'text.primary'}>{card.value}</Typography>
                <Typography variant="body2" color="text.secondary">{card.label}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Recent failures */}
      {overviewData?.recentFailures?.length ? (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Recent Failures</Typography>
            <Divider sx={{ mb: 1 }} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Rule</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Asset</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Evaluated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overviewData.recentFailures.map(f => (
                    <TableRow key={f.ruleId} hover>
                      <TableCell>{f.ruleName}</TableCell>
                      <TableCell>{f.assetName}</TableCell>
                      <TableCell><Chip label={f.severity} size="small" color={severityColor(f.severity)} /></TableCell>
                      <TableCell>{f.score}%</TableCell>
                      <TableCell>{formatDistanceToNow(f.evaluatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* Rules per asset */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Rules by Asset</Typography>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Select Asset</InputLabel>
              <Select value={selectedAssetId} label="Select Asset" onChange={e => setSelectedAssetId(e.target.value as string)}>
                {assetsData?.data.map(a => (
                  <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {!selectedAssetId ? (
            <Alert severity="info">Select an asset above to view and manage its quality rules.</Alert>
          ) : rulesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
          ) : !rulesData?.rules.length ? (
            <Alert severity="info">No quality rules defined for this asset yet.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Run</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rulesData!.rules.map(rule => (
                    <TableRow key={rule.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>{rule.name}</Typography>
                          {rule.description && <Typography variant="caption" color="text.secondary">{rule.description}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell><Chip label={rule.ruleType.replace(/_/g, ' ')} size="small" variant="outlined" /></TableCell>
                      <TableCell><Chip label={rule.severity} size="small" color={severityColor(rule.severity)} /></TableCell>
                      <TableCell>
                        {rule.lastRunStatus ? (
                          <Chip
                            icon={rule.lastRunStatus === 'PASSED' ? <PassIcon /> : <FailIcon />}
                            label={rule.lastRunStatus}
                            size="small"
                            color={rule.lastRunStatus === 'PASSED' ? 'success' : 'error'}
                          />
                        ) : (
                          <Chip label="Never run" size="small" variant="outlined" />
                        )}
                        {runResult?.ruleId === rule.id && (
                          <Chip
                            label={`${runResult.status} (${runResult.score}%)`}
                            size="small"
                            color={runResult.status === 'PASSED' ? 'success' : 'error'}
                            sx={{ ml: 1 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>{rule.lastRunAt ? formatDistanceToNow(rule.lastRunAt) : '—'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Run now">
                            <IconButton size="small" color="success"
                              onClick={() => { setRunResult(null); evaluateMutation.mutate(rule.id); }}
                              disabled={evaluateMutation.isPending}
                            >
                              <RunIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit rule">
                            <IconButton size="small" onClick={() => openEdit(rule)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete rule">
                            <IconButton size="small" color="error"
                              onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) deleteMutation.mutate(rule.id); }}
                              disabled={deleteMutation.isPending}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Rule Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={onSubmit}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RuleIcon /> New Quality Rule
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Controller name="assetId" control={control} rules={{ required: true }} render={({ field }) => (
              <FormControl fullWidth size="small" error={!!errors.assetId}>
                <InputLabel>Asset *</InputLabel>
                <Select {...field} label="Asset *">
                  {assetsData?.data.map(a => <MenuItem key={a.id} value={a.id}>{a.name} ({a.assetType})</MenuItem>)}
                </Select>
              </FormControl>
            )} />
            <Controller name="name" control={control} rules={{ required: true }} render={({ field }) => (
              <TextField {...field} label="Rule Name *" size="small" error={!!errors.name} fullWidth />
            )} />
            <Controller name="description" control={control} render={({ field }) => (
              <TextField {...field} label="Description" size="small" multiline rows={2} fullWidth />
            )} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Controller name="ruleType" control={control} render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Rule Type</InputLabel>
                  <Select {...field} label="Rule Type">
                    {RULE_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
              <Controller name="severity" control={control} render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Severity</InputLabel>
                  <Select {...field} label="Severity">
                    {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
            </Box>
            <Controller name="ruleDefinition" control={control} render={({ field }) => (
              <TextField
                {...field} label="Rule Definition (JSON)" size="small"
                multiline rows={4} fullWidth
                helperText='e.g. {"column": "email", "pattern": ".*@.*"}'
              />
            )} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>Create</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={!!editRule} onClose={() => setEditRule(null)} maxWidth="sm" fullWidth>
        <form onSubmit={submitEdit}>
          <DialogTitle>Edit Rule — {editRule?.name}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Controller name="name" control={control} rules={{ required: true }} render={({ field }) => (
              <TextField {...field} label="Rule Name *" size="small" error={!!errors.name} fullWidth />
            )} />
            <Controller name="description" control={control} render={({ field }) => (
              <TextField {...field} label="Description" size="small" multiline rows={2} fullWidth />
            )} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Controller name="ruleType" control={control} render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Rule Type</InputLabel>
                  <Select {...field} label="Rule Type">
                    {RULE_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
              <Controller name="severity" control={control} render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Severity</InputLabel>
                  <Select {...field} label="Severity">
                    {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
            </Box>
            <Controller name="ruleDefinition" control={control} render={({ field }) => (
              <TextField {...field} label="Rule Definition (JSON)" size="small" multiline rows={4} fullWidth />
            )} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditRule(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
