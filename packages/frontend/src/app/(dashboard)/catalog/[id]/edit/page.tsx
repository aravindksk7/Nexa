'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Breadcrumbs,
  Link,
  Alert,
  Chip,
  IconButton,
  Skeleton,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Close as CloseIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';

interface Asset {
  id: string;
  name: string;
  assetType: string;
  description?: string;
  domain?: string;
  ownerId?: string;
  tags: string[];
  customProperties?: Record<string, unknown>;
}

interface User {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface AssetFormData {
  name: string;
  assetType: string;
  description: string;
  domain: string;
  ownerId: string;
  tags: string[];
}

interface AssetEditPageProps {
  params: Promise<{ id: string }>;
}

export default function AssetEditPage({ params }: AssetEditPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ asset: Asset }>({
    queryKey: ['asset', id],
    queryFn: () => api.get<{ asset: Asset }>(`/assets/${id}`),
  });

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users-list'],
    queryFn: () => api.get<{ data: User[] }>('/auth/users'),
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<AssetFormData>({
    defaultValues: {
      name: '',
      assetType: 'TABLE',
      description: '',
      domain: '',
      ownerId: '',
      tags: [],
    },
  });

  const tags = watch('tags', []);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const hasTagChanges = useMemo(() => {
    return JSON.stringify(tags ?? []) !== JSON.stringify(initialTags);
  }, [tags, initialTags]);

  // Populate form when asset data is loaded
  useEffect(() => {
    if (data?.asset) {
      reset({
        name: data.asset.name,
        assetType: data.asset.assetType,
        description: data.asset.description || '',
        domain: data.asset.domain || '',
        ownerId: data.asset.ownerId || '',
        tags: data.asset.tags || [],
      });
      setInitialTags(data.asset.tags || []);
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: (formData: AssetFormData) =>
      api.put(`/assets/${id}`, {
        name: formData.name,
        assetType: formData.assetType,
        description: formData.description || undefined,
        domain: formData.domain || undefined,
        ownerId: formData.ownerId || undefined,
        tags: tags ?? [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      router.push(`/catalog/${id}`);
    },
  });

  const onSubmit = (formData: AssetFormData) => {
    updateMutation.mutate(formData);
  };

  const handleAddTag = (event?: React.KeyboardEvent<HTMLDivElement|HTMLInputElement>) => {
    if (event && event.key !== 'Enter') {
      return;
    }
    if (event) {
      event.preventDefault();
    }
    const newTag = tagInput.trim();
    if (newTag && !tags.includes(newTag)) {
      setValue('tags', [...tags, newTag], { shouldDirty: true, shouldTouch: true });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setValue(
      'tags',
      tags.filter((tag) => tag !== tagToRemove),
      { shouldDirty: true, shouldTouch: true }
    );
  };

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : 'Failed to load asset'}
        </Alert>
        <Button onClick={() => router.push('/catalog')}>Back to Catalog</Button>
      </Box>
    );
  }

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
        <Link
          underline="hover"
          color="inherit"
          href={`/catalog/${id}`}
          onClick={(e) => {
            e.preventDefault();
            router.push(`/catalog/${id}`);
          }}
          sx={{ cursor: 'pointer' }}
        >
          {isLoading ? <Skeleton width={100} /> : data?.asset?.name}
        </Link>
        <Typography color="text.primary">Edit</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push(`/catalog/${id}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight={700}>
          Edit Asset
        </Typography>
      </Box>

      {updateMutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : 'Failed to update asset'}
        </Alert>
      )}

      {isLoading ? (
        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={120} />
              <Skeleton height={56} />
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={3}>
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
                  name="assetType"
                  control={control}
                  rules={{ required: 'Asset type is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.assetType}>
                      <InputLabel>Asset Type</InputLabel>
                      <Select {...field} label="Asset Type">
                        <MenuItem value="DATABASE">Database</MenuItem>
                        <MenuItem value="SCHEMA">Schema</MenuItem>
                        <MenuItem value="TABLE">Table</MenuItem>
                        <MenuItem value="VIEW">View</MenuItem>
                        <MenuItem value="COLUMN">Column</MenuItem>
                        <MenuItem value="TOPIC">Topic</MenuItem>
                        <MenuItem value="DATASET">Dataset</MenuItem>
                        <MenuItem value="DASHBOARD">Dashboard</MenuItem>
                        <MenuItem value="REPORT">Report</MenuItem>
                        <MenuItem value="PIPELINE">Pipeline</MenuItem>
                        <MenuItem value="JOB">Job</MenuItem>
                        <MenuItem value="API">API</MenuItem>
                        <MenuItem value="FILE">File</MenuItem>
                        <MenuItem value="OTHER">Other</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description"
                      multiline
                      rows={4}
                      fullWidth
                    />
                  )}
                />

                <Controller
                  name="domain"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Domain" fullWidth />
                  )}
                />

                <Controller
                  name="ownerId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Owner</InputLabel>
                      <Select {...field} label="Owner">
                        <MenuItem value="">No Owner</MenuItem>
                        {usersData?.data.map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName} (${user.username || user.email})`
                              : user.username || user.email}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      placeholder="Type a tag and press Enter"
                      fullWidth
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={handleAddTag}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => handleAddTag()}
                      disabled={!tagInput.trim()}
                    >
                      Add
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        onDelete={() => handleRemoveTag(tag)}
                        deleteIcon={<CloseIcon />}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => router.push(`/catalog/${id}`)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={updateMutation.isPending || (!isDirty && !hasTagChanges)}
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              </Stack>
            </form>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
