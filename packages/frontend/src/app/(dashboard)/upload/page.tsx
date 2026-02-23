'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Paper,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ParseResult {
  columns: Array<{
    name: string;
    inferredType: string;
    nullable: boolean;
    sampleValues: string[];
  }>;
  rowCount: number;
  sampleData: string[][];
  encoding: string;
}

interface UploadResponse {
  file: {
    id: string;
    originalName: string;
    size: number;
    type: string;
  };
  parseResult: ParseResult;
}

export default function UploadPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [createAssetMessage, setCreateAssetMessage] = useState<string | null>(null);
  const [createAssetError, setCreateAssetError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.upload<UploadResponse>('/files/upload', file),
    onSuccess: (result) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ['recent-assets'] });
    },
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: { fileId: string; assetName: string }) =>
      api.post<{ assetId: string }>(`/files/${data.fileId}/create-asset`, { assetName: data.assetName }),
    onSuccess: (result) => {
      setCreateAssetError(null);
      setCreateAssetMessage(`Asset created successfully (ID: ${result.assetId}).`);
      setUploadResult(null);
      setSelectedFile(null);
      router.push(`/catalog/${result.assetId}`);
    },
    onError: (error) => {
      setCreateAssetMessage(null);
      setCreateAssetError(error instanceof Error ? error.message : 'Failed to create asset');
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isValidFile(file)) {
        setSelectedFile(file);
        setUploadResult(null);
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (isValidFile(file)) {
        setSelectedFile(file);
        setUploadResult(null);
      }
    }
  };

  const isValidFile = (file: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    return validTypes.includes(file.type) || validExtensions.includes(ext);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info'> = {
      STRING: 'primary',
      INTEGER: 'success',
      NUMBER: 'info',
      BOOLEAN: 'warning',
      DATE: 'secondary',
    };
    return colors[type] || 'default';
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        File Upload
      </Typography>

      {createAssetMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {createAssetMessage}
        </Alert>
      )}

      {createAssetError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {createAssetError}
        </Alert>
      )}

      {/* Upload Area */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: dragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 6,
              textAlign: 'center',
              bgcolor: dragActive ? 'primary.50' : 'background.default',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drag and drop your file here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              or click to browse
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supports CSV, XLSX, and XLS files up to 100MB
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Selected File */}
      {selectedFile && !uploadResult && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <FileIcon color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={500}>{selectedFile.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatFileSize(selectedFile.size)}
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={() => uploadMutation.mutate(selectedFile)}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload & Parse'}
              </Button>
            </Box>

            {uploadMutation.isPending && <LinearProgress />}

            {uploadMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : 'Upload failed'}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parse Results */}
      {uploadResult && (
        <>
          <Alert
            icon={<SuccessIcon />}
            severity="success"
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  createAssetMutation.mutate({
                    fileId: uploadResult.file.id,
                    assetName: uploadResult.file.originalName.replace(/\.[^.]+$/, ''),
                  });
                }}
                disabled={createAssetMutation.isPending}
              >
                Create Asset
              </Button>
            }
          >
            Successfully parsed {uploadResult.parseResult.rowCount.toLocaleString()} rows with{' '}
            {uploadResult.parseResult.columns.length} columns
          </Alert>

          {/* Column Schema */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Detected Schema
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Column Name</TableCell>
                    <TableCell>Inferred Type</TableCell>
                    <TableCell>Nullable</TableCell>
                    <TableCell>Sample Values</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadResult.parseResult.columns.map((col) => (
                    <TableRow key={col.name}>
                      <TableCell>
                        <Typography fontWeight={500}>{col.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={col.inferredType}
                          size="small"
                          color={getTypeColor(col.inferredType)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={col.nullable ? 'Yes' : 'No'}
                          size="small"
                          color={col.nullable ? 'warning' : 'success'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                          {col.sampleValues.slice(0, 3).join(', ')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sample Data */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sample Data (first 5 rows)
              </Typography>
              <Paper sx={{ overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {uploadResult.parseResult.columns.map((col) => (
                        <TableCell key={col.name}>{col.name}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {uploadResult.parseResult.sampleData.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {Array.isArray(row)
                          ? row.map((cell, j) => (
                              <TableCell key={j}>
                                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                  {cell}
                                </Typography>
                              </TableCell>
                            ))
                          : uploadResult.parseResult.columns.map((col) => (
                              <TableCell key={col.name}>
                                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                  {String((row as Record<string, unknown>)[col.name] ?? '')}
                                </Typography>
                              </TableCell>
                            ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
