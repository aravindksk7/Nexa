'use client';

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
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
    queryFn: async () => {
      return api.get<QualityOverviewResponse>('/quality/overview');
    },
  });

  const metrics = overview?.dimensions ?? [];

  const overallScore = overview?.overallScore ?? 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Data Quality"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
      />
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: `conic-gradient(
                #22c55e ${overallScore * 3.6}deg,
                #e2e8f0 ${overallScore * 3.6}deg
              )`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
              }}
            >
              <Typography variant="h4" fontWeight={700}>
                {isLoading ? '-' : overallScore}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Overall
              </Typography>
            </Box>
          </Box>
        </Box>

        <List disablePadding>
          {metrics?.map((metric) => (
            <ListItem key={metric.name} disablePadding sx={{ mb: 2 }}>
              <ListItemText
                primary={
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="body2">{metric.name}</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {metric.score}%
                    </Typography>
                  </Box>
                }
                secondary={
                  <LinearProgress
                    variant="determinate"
                    value={metric.score}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: metric.color,
                        borderRadius: 3,
                      },
                    }}
                  />
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
