'use client';

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface QualityMetric {
  name: string;
  score: number;
  color: string;
}

interface QualityOverviewResponse {
  overallScore: number;
  dimensions: QualityMetric[];
  statusBreakdown: { healthy: number; warning: number; critical: number; unknown: number };
  totalRules: number;
  totalEvaluations: number;
}

export function QualityOverview() {
  const { data: overview, isLoading } = useQuery<QualityOverviewResponse>({
    queryKey: ['quality-overview'],
    queryFn: async () => api.get<QualityOverviewResponse>('/quality/overview'),
  });
  const overallScore = overview?.overallScore ?? 0;
  const statusBreakdown = overview?.statusBreakdown ?? {
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
  };

  const totalAssets =
    statusBreakdown.healthy +
    statusBreakdown.warning +
    statusBreakdown.critical +
    statusBreakdown.unknown;

  const statusItems = [
    { key: 'healthy', label: 'Healthy', count: statusBreakdown.healthy, color: 'success.main' },
    { key: 'warning', label: 'Warning', count: statusBreakdown.warning, color: 'warning.main' },
    { key: 'critical', label: 'Critical', count: statusBreakdown.critical, color: 'error.main' },
    { key: 'unknown', label: 'Unknown', count: statusBreakdown.unknown, color: 'grey.500' },
  ] as const;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Data Quality"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        subheader={isLoading ? 'Loading quality summary...' : `${totalAssets} assets evaluated`}
      />
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h4" fontWeight={700}>
            {isLoading ? '-' : `${overallScore}%`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overall score
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              height: 16,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'grey.200',
            }}
          >
            {statusItems.map((item) => {
              const width = totalAssets > 0 ? (item.count / totalAssets) * 100 : 0;
              return (
                <Box
                  key={item.key}
                  sx={{
                    width: `${width}%`,
                    bgcolor: item.color,
                    minWidth: item.count > 0 ? 6 : 0,
                  }}
                />
              );
            })}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 1.5,
              mt: 1.5,
            }}
          >
            {statusItems.map((item) => {
              const percent = totalAssets > 0 ? Math.round((item.count / totalAssets) * 100) : 0;
              return (
                <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                  <Typography variant="caption" color="text.secondary">
                    {item.label}: {isLoading ? '-' : `${item.count} (${percent}%)`}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
