'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Menu,
  ListItemIcon,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
  Add as AddIcon,
  Storage as DatabaseIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  TableChart as TableIcon,
  ViewColumn as ColumnIcon,
  Folder as FolderIcon,
  AccountTree as ExploreIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/utils';

interface Connection {
  id: string;
  name: string;
  type: 'POSTGRESQL' | 'MYSQL' | 'SQLSERVER';
  connectionType?: 'POSTGRESQL' | 'MYSQL' | 'SQLSERVER';
  host: string;
  port: number;
  database?: string;
  username?: string;
  status: 'CONNECTED' | 'ERROR' | 'PENDING';
  isActive?: boolean;
  lastTestSuccess?: boolean;
  lastTestedAt?: string;
  lastSyncAt?: string;
  createdAt: string;
}

interface ColumnSchema {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: boolean;
}

interface TableSchema {
  name: string;
  schema?: string;
  type?: 'TABLE' | 'VIEW';
  columns: ColumnSchema[];
}

interface DatabaseSchema {
  name: string;
  tables: TableSchema[];
}

interface SourceSchema {
  databases: DatabaseSchema[];
}

const CONNECTION_TYPES = [
  { value: 'POSTGRESQL', label: 'PostgreSQL', icon: '🐘' },
  { value: 'MYSQL', label: 'MySQL', icon: '🐬' },
  { value: 'SQLSERVER', label: 'SQL Server', icon: '📊' },
];

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [exploreDialogOpen, setExploreDialogOpen] = useState(false);
  const [exploringConnection, setExploringConnection] = useState<Connection | null>(null);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      type: 'POSTGRESQL' as const,
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
    },
  });

  const connectionType = watch('type');

  const { data: connections, isLoading } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: async () => {
      const result = await api.get<{ connections: Connection[] }>('/connections');
      return result.connections.map(conn => ({
        ...conn,
        type: conn.type || conn.connectionType || 'POSTGRESQL',
        database: conn.database || '',
        username: conn.username || '',
        status: conn.lastTestSuccess === true ? 'CONNECTED' : conn.lastTestSuccess === false ? 'ERROR' : 'PENDING',
        lastSyncAt: conn.lastTestedAt,
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/connections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      handleMenuClose();
    },
  });

  const testMutation = useMutation({
    mutationFn: (data: object) => api.post<{ success: boolean; message: string }>('/connections/test', data),
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error) => {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Connection failed' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.post(`/connections/${id}/extract`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });

  // Schema exploration query
  const { data: schemaData, isLoading: schemaLoading } = useQuery<SourceSchema>({
    queryKey: ['connection-schema', exploringConnection?.id],
    queryFn: () => api.get<SourceSchema>(`/connections/${exploringConnection!.id}/explore`),
    enabled: !!exploringConnection && exploreDialogOpen,
  });

  const handleExploreSchema = (connection: Connection) => {
    setExploringConnection(connection);
    setExploreDialogOpen(true);
    handleMenuClose();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, connection: Connection) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedConnection(connection);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedConnection(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingConnection(null);
    setTestResult(null);
    reset();
  };

  const onSubmit = (data: Record<string, unknown>) => {
    // Backend expects connectionType instead of type
    const { type, ...rest } = data;
    createMutation.mutate({ ...rest, connectionType: type });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return 'success';
      case 'ERROR':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return <CheckIcon fontSize="small" />;
      case 'ERROR':
        return <ErrorIcon fontSize="small" />;
      default:
        return <CircularProgress size={16} />;
    }
  };

  const getDefaultPort = (type: string) => {
    switch (type) {
      case 'POSTGRESQL':
        return 5432;
      case 'MYSQL':
        return 3306;
      case 'SQLSERVER':
        return 1433;
      default:
        return 5432;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          Data Connections
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New Connection
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {connections?.map((connection) => (
            <Grid item xs={12} sm={6} lg={4} key={connection.id}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: 'primary.50',
                          display: 'flex',
                        }}
                      >
                        <DatabaseIcon color="primary" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {connection.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {CONNECTION_TYPES.find((t) => t.value === connection.type)?.label}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, connection)}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Host: {connection.host}:{connection.port}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Database: {connection.database}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip
                      icon={getStatusIcon(connection.status)}
                      label={connection.status}
                      size="small"
                      color={getStatusColor(connection.status) as 'success' | 'error' | 'warning'}
                      variant="outlined"
                    />
                    {connection.lastSyncAt && (
                      <Typography variant="caption" color="text.secondary">
                        Synced {formatDistanceToNow(connection.lastSyncAt)}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            if (selectedConnection) handleExploreSchema(selectedConnection);
          }}
        >
          <ListItemIcon>
            <ExploreIcon fontSize="small" />
          </ListItemIcon>
          Explore Schema
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedConnection) syncMutation.mutate(selectedConnection.id);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <SyncIcon fontSize="small" />
          </ListItemIcon>
          Sync Metadata
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditingConnection(selectedConnection);
            setDialogOpen(true);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedConnection) deleteMutation.mutate(selectedConnection.id);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Connection Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingConnection ? 'Edit Connection' : 'Create New Connection'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Name is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Connection Name"
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
                    <InputLabel>Database Type</InputLabel>
                    <Select {...field} label="Database Type">
                      {CONNECTION_TYPES.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="host"
                  control={control}
                  rules={{ required: 'Host is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Host"
                      fullWidth
                      error={!!errors.host}
                      helperText={errors.host?.message}
                    />
                  )}
                />
                <Controller
                  name="port"
                  control={control}
                  rules={{ required: 'Port is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Port"
                      type="number"
                      sx={{ width: 120 }}
                      error={!!errors.port}
                      value={field.value || getDefaultPort(connectionType)}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  )}
                />
              </Box>

              <Controller
                name="database"
                control={control}
                rules={{ required: 'Database is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Database"
                    fullWidth
                    error={!!errors.database}
                    helperText={errors.database?.message}
                  />
                )}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="username"
                  control={control}
                  rules={{ required: 'Username is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Username"
                      fullWidth
                      error={!!errors.username}
                      helperText={errors.username?.message}
                    />
                  )}
                />
                <Controller
                  name="password"
                  control={control}
                  rules={{ required: 'Password is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Password"
                      type="password"
                      fullWidth
                      error={!!errors.password}
                      helperText={errors.password?.message}
                    />
                  )}
                />
              </Box>

              {testResult && (
                <Alert severity={testResult.success ? 'success' : 'error'}>
                  {testResult.message}
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit((data) => {
                const { type, ...rest } = data;
                testMutation.mutate({ ...rest, connectionType: type });
              })}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Schema Exploration Dialog */}
      <Dialog
        open={exploreDialogOpen}
        onClose={() => setExploreDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ExploreIcon />
            Schema Explorer - {exploringConnection?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          {schemaLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Loading schema...</Typography>
            </Box>
          ) : schemaData ? (
            <Box sx={{ mt: 1 }}>
              <SimpleTreeView
                aria-label="schema explorer"
                sx={{ 
                  height: 400, 
                  flexGrow: 1, 
                  overflowY: 'auto',
                  '& .MuiTreeItem-content': {
                    py: 0.5,
                  }
                }}
              >
                {schemaData.databases.map((db: DatabaseSchema) => (
                  <TreeItem 
                    key={`db-${db.name}`} 
                    itemId={`db-${db.name}`} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <FolderIcon fontSize="small" color="primary" />
                        <Typography variant="body2" fontWeight={500}>{db.name}</Typography>
                        <Chip label={`${db.tables.length} tables`} size="small" variant="outlined" />
                      </Box>
                    }
                  >
                    {db.tables.map((table: TableSchema) => (
                      <TreeItem 
                        key={`table-${db.name}-${table.name}`} 
                        itemId={`table-${db.name}-${table.name}`}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                            <TableIcon fontSize="small" color="action" />
                            <Typography variant="body2">{table.name}</Typography>
                            {table.type && (
                              <Chip 
                                label={table.type} 
                                size="small" 
                                variant="outlined"
                                color={table.type === 'VIEW' ? 'info' : 'default'}
                              />
                            )}
                            <Typography variant="caption" color="text.secondary">
                              ({table.columns.length} columns)
                            </Typography>
                          </Box>
                        }
                      >
                        {table.columns.map((col: ColumnSchema) => (
                          <TreeItem 
                            key={`col-${db.name}-${table.name}-${col.name}`} 
                            itemId={`col-${db.name}-${table.name}-${col.name}`}
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                                <ColumnIcon fontSize="small" sx={{ color: 'grey.500' }} />
                                <Typography variant="body2">{col.name}</Typography>
                                <Chip 
                                  label={col.dataType} 
                                  size="small" 
                                  sx={{ fontSize: '0.7rem', height: 20 }}
                                />
                                {col.primaryKey && (
                                  <Chip label="PK" size="small" color="warning" sx={{ fontSize: '0.65rem', height: 18 }} />
                                )}
                                {col.foreignKey && (
                                  <Chip label="FK" size="small" color="secondary" sx={{ fontSize: '0.65rem', height: 18 }} />
                                )}
                                {!col.nullable && (
                                  <Chip label="NOT NULL" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                                )}
                              </Box>
                            }
                          />
                        ))}
                      </TreeItem>
                    ))}
                  </TreeItem>
                ))}
              </SimpleTreeView>
            </Box>
          ) : (
            <Alert severity="info">
              No schema information available. Try syncing the connection first.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExploreDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
