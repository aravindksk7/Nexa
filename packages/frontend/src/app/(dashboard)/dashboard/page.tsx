'use client';

import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Skeleton,
} from '@mui/material';
import {
  Storage as StorageIcon,
  AccountTree as AccountTreeIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RecentAssets } from '@/components/dashboard/RecentAssets';
import { QualityOverview } from '@/components/dashboard/QualityOverview';

interface DashboardStats {
  totalAssets: number;
  totalConnections: number;
  recentUploads: number;
  qualityScore: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Fetch real counts from the assets API
      const assetsRes = await api.get<{
        data: unknown[];
        pagination: { total: number };
      }>('/assets?page=1&limit=1');

      const totalAssets = assetsRes.pagination?.total ?? 0;

      return {
        totalAssets,
        totalConnections: 0,
        recentUploads: 0,
        qualityScore: 0,
      };
    },
  });

  const statCards = [
    {
      title: 'Total Assets',
      value: stats?.totalAssets ?? 0,
      icon: StorageIcon,
      color: '#0ea5e9',
    },
    {
      title: 'Lineage Edges',
      value: stats?.totalConnections ?? 0,
      icon: AccountTreeIcon,
      color: '#8b5cf6',
    },
    {
      title: 'Recent Uploads',
      value: stats?.recentUploads ?? 0,
      icon: CloudUploadIcon,
      color: '#f59e0b',
    },
    {
      title: 'Quality Score',
      value: `${stats?.qualityScore ?? 0}%`,
      icon: CheckCircleIcon,
      color: '#22c55e',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={card.title}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: `${card.color}15`,
                      mr: 2,
                    }}
                  >
                    <card.icon sx={{ color: card.color }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {card.title}
                  </Typography>
                </Box>
                {isLoading ? (
                  <Skeleton variant="text" width={80} height={40} />
                ) : (
                  <Typography variant="h4" fontWeight={700}>
                    {card.value}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <RecentAssets />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <QualityOverview />
        </Grid>
      </Grid>
    </Box>
  );
}
