'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Key as SecurityIcon,
  Settings as SettingsIcon,
  Security as LockIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'DATA_STEWARD' | 'DATA_ANALYST' | 'BUSINESS_ANALYST';
  isActive: boolean;
  createdAt: string;
}

interface SSOConfig {
  id: string;
  provider: string;
  name: string;
  clientId?: string;
  discoveryUrl?: string;
  ldapServer?: string;
  ldapPort?: number;
  ldapBaseDN?: string;
  samlMetadataUrl?: string;
  enabled: boolean;
  testResult?: any;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'DATA_STEWARD', label: 'Data Steward' },
  { value: 'DATA_ANALYST', label: 'Data Analyst' },
  { value: 'BUSINESS_ANALYST', label: 'Business Analyst' },
];

const getRoleColor = (role: string) => {
  const colors: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
    ADMIN: 'error',
    DATA_STEWARD: 'warning',
    DATA_ANALYST: 'info',
    BUSINESS_ANALYST: 'success',
  };
  return colors[role] || 'default';
};

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [editDialog, setEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [ssoDialog, setSsoDialog] = useState(false);
  const [ssoEditingId, setSsoEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, setValue } = useForm<Partial<User>>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      role: 'BUSINESS_ANALYST',
    },
  });

  // Redirect if not admin
  if (user?.role !== 'ADMIN') {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error">
          Access Denied. Only administrators can access this page.
        </Alert>
      </Box>
    );
  }

  const { data: usersData, isLoading, refetch } = useQuery<{ data: User[] }>({
    queryKey: ['admin-users'],
    queryFn: () => api.get<{ data: User[] }>('/auth/users'),
  });

  // Fetch SSO configurations
  const { data: ssoData, isLoading: ssoLoading, refetch: refetchSSO } = useQuery<{ configurations: SSOConfig[] }>({
    queryKey: ['sso-configurations'],
    queryFn: () => api.get<{ configurations: SSOConfig[] }>('/sso'),
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: Partial<User>) =>
      api.put(`/auth/admin/users/${editingUser?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditDialog(false);
      setEditingUser(null);
      reset();
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.put(`/auth/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/auth/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/auth/admin/users/${userId}/reactivate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // SSO Configuration mutations
  const createSSOConfigMutation = useMutation({
    mutationFn: (data: Partial<SSOConfig>) =>
      api.post('/sso', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      setSsoDialog(false);
      setSsoEditingId(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const updateSSOConfigMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SSOConfig> }) =>
      api.put(`/sso/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      setSsoDialog(false);
      setSsoEditingId(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const deleteSSOConfigMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sso/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const testSSOConfigMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sso/${id}/test`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleEditUser = (selectedUser: User) => {
    setEditingUser(selectedUser);
    setValue('firstName', selectedUser.firstName || '');
    setValue('lastName', selectedUser.lastName || '');
    setValue('email', selectedUser.email);
    setValue('username', selectedUser.username);
    setEditDialog(true);
  };

  const onEditSubmit = (data: Partial<User>) => {
    updateUserMutation.mutate({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      username: data.username,
    });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Admin Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            aria-label="admin tabs"
          >
            <Tab icon={<LockIcon />} label="User Management" iconPosition="start" />
            <Tab icon={<SecurityIcon />} label="SSO & LDAP" iconPosition="start" />
            <Tab icon={<SettingsIcon />} label="System Settings" iconPosition="start" />
          </Tabs>
        </Box>

        <CardContent>
          {/* User Management Tab */}
          <TabPanel value={tabValue} index={0}>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Users</Typography>
                <Button startIcon={<RefreshIcon />} onClick={() => refetch()}>
                  Refresh
                </Button>
              </Box>

              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : usersData?.data ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usersData.data.map((u) => (
                        <TableRow key={u.id} hover>
                          <TableCell>
                            {u.firstName} {u.lastName}
                          </TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.username}</TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <Select
                                value={u.role}
                                onChange={(e) =>
                                  changeRoleMutation.mutate({
                                    userId: u.id,
                                    role: e.target.value,
                                  })
                                }
                                disabled={changeRoleMutation.isPending}
                              >
                                {ROLES.map((r) => (
                                  <MenuItem key={r.value} value={r.value}>
                                    {r.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.isActive ? 'Active' : 'Inactive'}
                              color={u.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEditUser(u)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {u.isActive ? (
                              <Tooltip title="Deactivate">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    if (confirm(`Deactivate ${u.username}?`)) {
                                      deactivateMutation.mutate(u.id);
                                    }
                                  }}
                                  disabled={deactivateMutation.isPending}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Reactivate">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    if (confirm(`Reactivate ${u.username}?`)) {
                                      reactivateMutation.mutate(u.id);
                                    }
                                  }}
                                  disabled={reactivateMutation.isPending}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}
            </Stack>
          </TabPanel>

          {/* SSO & LDAP Tab */}
          <TabPanel value={tabValue} index={1}>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    SSO & LDAP Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure OAuth2, SAML, or LDAP authentication methods for your organization.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setSsoEditingId(null);
                    setSsoDialog(true);
                  }}
                >
                  Add Provider
                </Button>
              </Box>

              {ssoLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : ssoData?.configurations?.length ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 600 }}>Provider</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Last Tested</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ssoData.configurations.map((config) => (
                        <TableRow key={config.id} hover>
                          <TableCell sx={{ textTransform: 'uppercase', fontWeight: 500 }}>
                            {config.provider}
                          </TableCell>
                          <TableCell>{config.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={config.enabled ? 'Enabled' : 'Disabled'}
                              color={config.enabled ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {config.lastTestedAt ? (
                              <Typography variant="caption">
                                {new Date(config.lastTestedAt).toLocaleString()}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                Never
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSsoEditingId(config.id);
                                  setSsoDialog(true);
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Test Connection">
                              <IconButton
                                size="small"
                                onClick={() => testSSOConfigMutation.mutate(config.id)}
                                disabled={testSSOConfigMutation.isPending}
                              >
                                <RefreshIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => deleteSSOConfigMutation.mutate(config.id)}
                                disabled={deleteSSOConfigMutation.isPending}
                              >
                                <DeleteIcon />
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
                  No SSO/LDAP configurations yet. Click "Add Provider" to create one.
                </Alert>
              )}
            </Stack>
          </TabPanel>

          {/* System Settings Tab */}
          <TabPanel value={tabValue} index={2}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  System Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure system-wide settings and configurations.
                </Typography>
              </Box>

              <Alert severity="info">
                System settings configuration coming soon. Check back for updates.
              </Alert>
            </Stack>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Controller
              name="firstName"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="First Name" fullWidth />
              )}
            />
            <Controller
              name="lastName"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Last Name" fullWidth />
              )}
            />
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Email" type="email" fullWidth />
              )}
            />
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Username" fullWidth />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit(onEditSubmit)}
            disabled={updateUserMutation.isPending}
          >
            {updateUserMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SSO Configuration Dialog */}
      <Dialog open={ssoDialog} onClose={() => setSsoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {ssoEditingId ? 'Edit SSO Configuration' : 'Add SSO Configuration'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Provider Type</InputLabel>
              <Select label="Provider Type" defaultValue="oauth2">
                <MenuItem value="oauth2">OAuth 2.0</MenuItem>
                <MenuItem value="saml">SAML 2.0</MenuItem>
                <MenuItem value="ldap">LDAP</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Configuration Name" fullWidth placeholder="E.g., Google OAuth" />
            <TextField label="Client ID" fullWidth />
            <TextField label="Client Secret" fullWidth type="password" />
            <TextField label="Discovery URL" fullWidth />
            <Button variant="outlined" fullWidth>
              Save Configuration
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSsoDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>    </Box>
  );
}