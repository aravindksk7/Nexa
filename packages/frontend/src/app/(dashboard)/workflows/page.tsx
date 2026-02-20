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
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Tab,
  Tabs,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as TriggerIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Stop as CancelIcon,
  Refresh as RefreshIcon,
  AccountTree as WorkflowIcon,
  Timeline as InstanceIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/utils';

type WorkflowStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type StepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
type StepType = 'APPROVAL' | 'NOTIFICATION' | 'ACTION';

interface WorkflowDefinitionStep {
  name: string;
  type: StepType;
  assigneeId?: string;
  config?: Record<string, unknown>;
}

interface WorkflowDefinition {
  steps: WorkflowDefinitionStep[];
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  isActive: boolean;
  createdAt: string;
  _count?: { instances: number };
}

interface WorkflowStep {
  id: string;
  stepNumber: number;
  stepName: string;
  status: StepStatus;
  approverId: string | null;
  comment: string | null;
  executedAt: string | null;
}

interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentStep: number;
  startedAt: string;
  completedAt: string | null;
  context: Record<string, unknown>;
  workflow?: { name: string };
  steps: WorkflowStep[];
}

interface WorkflowForm {
  name: string;
  description: string;
  definition: string;
}

const STATUS_COLORS: Record<WorkflowStatus, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  PENDING: 'default',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  FAILED: 'error',
  CANCELLED: 'warning',
};

const STEP_STATUS_COLORS: Record<StepStatus, 'default' | 'success' | 'error' | 'warning'> = {
  PENDING: 'default',
  APPROVED: 'success',
  REJECTED: 'error',
  SKIPPED: 'warning',
};

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [createDialog, setCreateDialog] = useState(false);
  const [triggerDialog, setTriggerDialog] = useState<Workflow | null>(null);
  const [viewInstanceDialog, setViewInstanceDialog] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    instanceId: string;
    stepId: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [triggerContext, setTriggerContext] = useState('{}');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkflowForm>({
    defaultValues: {
      name: '',
      description: '',
      definition: JSON.stringify(
        {
          steps: [
            { name: 'Step 1', type: 'APPROVAL', config: {} },
            { name: 'Step 2', type: 'ACTION', config: {} },
          ],
        },
        null,
        2,
      ),
    },
  });

  // Fetch workflows list
  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<{ workflows: Workflow[]; total: number }>('/workflows'),
  });

  // Fetch workflow instances
  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['workflow-instances'],
    queryFn: () => api.get<{ instances: WorkflowInstance[]; total: number }>('/workflows/instances/list'),
  });

  // Fetch specific instance for detail view
  const { data: instanceDetailData } = useQuery({
    queryKey: ['workflow-instance', viewInstanceDialog],
    queryFn: () => api.get<{ instance: WorkflowInstance }>(`/workflows/instances/${viewInstanceDialog}`),
    enabled: !!viewInstanceDialog,
  });

  // Create workflow mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; definition: WorkflowDefinition }) =>
      api.post<{ workflow: Workflow }>('/workflows', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setCreateDialog(false);
      reset();
    },
  });

  // Trigger workflow mutation
  const triggerMutation = useMutation({
    mutationFn: ({ workflowId, context }: { workflowId: string; context: Record<string, unknown> }) =>
      api.post<{ instance: WorkflowInstance }>(`/workflows/${workflowId}/trigger`, { context }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      setTriggerDialog(null);
      setTriggerContext('{}');
      setActiveTab(1); // Switch to instances tab
    },
  });

  // Approve step mutation
  const approveStepMutation = useMutation({
    mutationFn: ({ instanceId, stepId, comment }: { instanceId: string; stepId: string; comment?: string }) =>
      api.post(`/workflows/instances/${instanceId}/steps/${stepId}/approve`, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-instance', actionDialog?.instanceId] });
      setActionDialog(null);
      setActionComment('');
    },
  });

  // Reject step mutation
  const rejectStepMutation = useMutation({
    mutationFn: ({ instanceId, stepId, comment }: { instanceId: string; stepId: string; comment?: string }) =>
      api.post(`/workflows/instances/${instanceId}/steps/${stepId}/reject`, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-instance', actionDialog?.instanceId] });
      setActionDialog(null);
      setActionComment('');
    },
  });

  // Cancel instance mutation
  const cancelInstanceMutation = useMutation({
    mutationFn: (instanceId: string) => api.post(`/workflows/instances/${instanceId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-instance', viewInstanceDialog] });
    },
  });

  const onSubmit = handleSubmit((data) => {
    let parsedDefinition: WorkflowDefinition;
    try {
      parsedDefinition = JSON.parse(data.definition);
      if (!parsedDefinition.steps || !Array.isArray(parsedDefinition.steps)) {
        throw new Error('Definition must have a steps array');
      }
    } catch (error) {
      alert('Invalid workflow definition JSON: ' + (error as Error).message);
      return;
    }
    createMutation.mutate({ name: data.name, description: data.description, definition: parsedDefinition });
  });

  const handleTrigger = () => {
    if (!triggerDialog) return;
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(triggerContext);
    } catch {
      alert('Invalid context JSON');
      return;
    }
    triggerMutation.mutate({ workflowId: triggerDialog.id, context: parsedContext });
  };

  const handleStepAction = () => {
    if (!actionDialog) return;
    const { instanceId, stepId, action } = actionDialog;
    if (action === 'approve') {
      approveStepMutation.mutate({ instanceId, stepId, comment: actionComment || undefined });
    } else {
      rejectStepMutation.mutate({ instanceId, stepId, comment: actionComment || undefined });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Workflows
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and execute governance workflows
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)}>
          Create Workflow
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab icon={<WorkflowIcon />} label="Workflows" iconPosition="start" />
          <Tab icon={<InstanceIcon />} label="Instances" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Workflows Tab */}
      {activeTab === 0 && (
        <Box>
          {workflowsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !workflowsData?.workflows.length ? (
            <Alert severity="info">
              No workflows found. Create your first workflow to get started.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="center">Steps</TableCell>
                    <TableCell align="center">Instances</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workflowsData?.workflows.map((workflow) => (
                    <TableRow key={workflow.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {workflow.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {workflow.description || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={workflow.definition.steps.length} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={workflow._count?.instances ?? 0}
                          size="small"
                          color={workflow._count?.instances ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={workflow.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={workflow.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(workflow.createdAt as string)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Trigger Workflow">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setTriggerDialog(workflow)}
                            disabled={!workflow.isActive}
                          >
                            <TriggerIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Instances Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['workflow-instances'] })}
            >
              Refresh
            </Button>
          </Box>

          {instancesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !instancesData?.instances.length ? (
            <Alert severity="info">No workflow instances found. Trigger a workflow to create an instance.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Workflow</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Current Step</TableCell>
                    <TableCell align="center">Total Steps</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {instancesData?.instances.map((instance) => (
                    <TableRow key={instance.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {instance.workflow?.name || instance.workflowId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={instance.status} size="small" color={STATUS_COLORS[instance.status]} />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{instance.currentStep + 1}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{instance.steps.length}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(instance.startedAt as string)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {instance.completedAt ? formatDistanceToNow(instance.completedAt as string) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => setViewInstanceDialog(instance.id)}>
                            <InfoIcon />
                          </IconButton>
                        </Tooltip>
                        {instance.status === 'IN_PROGRESS' && (
                          <Tooltip title="Cancel Instance">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                if (confirm('Cancel this workflow instance?')) {
                                  cancelInstanceMutation.mutate(instance.id);
                                }
                              }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Create Workflow Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Workflow</DialogTitle>
        <form onSubmit={onSubmit}>
          <DialogContent>
            <Stack spacing={2}>
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
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Description" fullWidth multiline rows={2} />
                )}
              />

              <Controller
                name="definition"
                control={control}
                rules={{ required: 'Definition is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Workflow Definition (JSON)"
                    fullWidth
                    multiline
                    rows={12}
                    error={!!errors.definition}
                    helperText={
                      errors.definition?.message ||
                      'Define steps with name, type (APPROVAL/NOTIFICATION/ACTION), and optional config'
                    }
                    sx={{ fontFamily: 'monospace' }}
                  />
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Trigger Workflow Dialog */}
      <Dialog open={!!triggerDialog} onClose={() => setTriggerDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Trigger Workflow: {triggerDialog?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {triggerDialog?.description || 'No description'}
            </Typography>
            <TextField
              label="Context (JSON)"
              fullWidth
              multiline
              rows={6}
              value={triggerContext}
              onChange={(e) => setTriggerContext(e.target.value)}
              helperText="Optional context data for the workflow execution"
              sx={{ fontFamily: 'monospace' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTriggerDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleTrigger} disabled={triggerMutation.isPending}>
            {triggerMutation.isPending ? 'Triggering...' : 'Trigger'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Instance Dialog */}
      <Dialog
        open={!!viewInstanceDialog}
        onClose={() => setViewInstanceDialog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Workflow Instance Details
          {instanceDetailData?.instance && (
            <Chip
              label={instanceDetailData.instance.status}
              size="small"
              color={STATUS_COLORS[instanceDetailData.instance.status]}
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {instanceDetailData?.instance && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Workflow
                  </Typography>
                  <Typography variant="body2">
                    {instanceDetailData.instance.workflow?.name || instanceDetailData.instance.workflowId}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Started
                  </Typography>
                  <Typography variant="body2">
                    {formatDistanceToNow(instanceDetailData.instance.startedAt as string)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Current Step
                  </Typography>
                  <Typography variant="body2">
                    {instanceDetailData.instance.currentStep + 1} of {instanceDetailData.instance.steps.length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Completed
                  </Typography>
                  <Typography variant="body2">
                    {instanceDetailData.instance.completedAt
                      ? formatDistanceToNow(instanceDetailData.instance.completedAt as string)
                      : '—'}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Steps
              </Typography>
              <Stepper orientation="vertical" activeStep={instanceDetailData.instance.currentStep}>
                {instanceDetailData.instance.steps.map((step, index) => (
                  <Step key={step.id} completed={step.status === 'APPROVED'}>
                    <StepLabel
                      error={step.status === 'REJECTED'}
                      optional={
                        <Chip label={step.status} size="small" color={STEP_STATUS_COLORS[step.status]} />
                      }
                    >
                      {step.stepName}
                    </StepLabel>
                    <StepContent>
                      <Box sx={{ mb: 2 }}>
                        {step.executedAt && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Executed: {formatDistanceToNow(step.executedAt as string)}
                          </Typography>
                        )}
                        {step.comment && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Comment: {step.comment}
                          </Typography>
                        )}
                        {step.status === 'PENDING' &&
                          instanceDetailData.instance.status === 'IN_PROGRESS' &&
                          index === instanceDetailData.instance.currentStep && (
                            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<ApproveIcon />}
                                onClick={() =>
                                  setActionDialog({
                                    instanceId: instanceDetailData.instance.id,
                                    stepId: step.id,
                                    action: 'approve',
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<RejectIcon />}
                                onClick={() =>
                                  setActionDialog({
                                    instanceId: instanceDetailData.instance.id,
                                    stepId: step.id,
                                    action: 'reject',
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </Stack>
                          )}
                      </Box>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewInstanceDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Step Action Dialog (Approve/Reject with Comment) */}
      <Dialog open={!!actionDialog} onClose={() => setActionDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog?.action === 'approve' ? 'Approve' : 'Reject'} Step
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Comment (Optional)"
            fullWidth
            multiline
            rows={4}
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={actionDialog?.action === 'approve' ? 'success' : 'error'}
            onClick={handleStepAction}
            disabled={approveStepMutation.isPending || rejectStepMutation.isPending}
          >
            {approveStepMutation.isPending || rejectStepMutation.isPending
              ? 'Processing...'
              : actionDialog?.action === 'approve'
                ? 'Approve'
                : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Messages */}
      {createMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Workflow created successfully!
        </Alert>
      )}
      {createMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error creating workflow: {(createMutation.error as Error).message}
        </Alert>
      )}
      {triggerMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Workflow triggered successfully!
        </Alert>
      )}
    </Box>
  );
}
