'use client';

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface QualityOverviewResponse {
  statusBreakdown: { healthy: number; warning: number; critical: number; unknown: number };
}

const statusMeta = [
  { key: 'healthy', label: 'Healthy', color: '#22c55e' },
  { key: 'warning', label: 'Warning', color: '#f59e0b' },
  { key: 'critical', label: 'Critical', color: '#ef4444' },
  { key: 'unknown', label: 'Unknown', color: '#94a3b8' },
] as const;

export function QualityStatusBreakdown() {
  const { data: overview, isLoading } = useQuery<QualityOverviewResponse>({
    queryKey: ['quality-overview'],
    queryFn: async () => api.get<QualityOverviewResponse>('/quality/overview'),
  });

  const breakdown = overview?.statusBreakdown ?? { healthy: 0, warning: 0, critical: 0, unknown: 0 };
  const total = breakdown.healthy + breakdown.warning + breakdown.critical + breakdown.unknown;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Quality Status"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        subheader={total > 0 ? `${total} assets` : undefined}
      />
      <CardContent>
        {statusMeta.map((status) => {
          const count = breakdown[status.key];
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <Box key={status.key} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">{status.label}</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {isLoading ? '-' : `${count} (${percent}%)`}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={isLoading ? 0 : percent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#e2e8f0',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: status.color,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          );
        })}
        {total === 0 && !isLoading && (
          <Typography variant="body2" color="text.secondary">
            No quality status data available yet.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
