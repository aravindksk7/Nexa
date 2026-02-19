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

interface QualityMetric {
  name: string;
  score: number;
  color: string;
}

export function QualityOverview() {
  const { data: metrics, isLoading } = useQuery<QualityMetric[]>({
    queryKey: ['quality-overview'],
    queryFn: async () => {
      // In production, fetch from /api/v1/quality/overview
      return [
        { name: 'Completeness', score: 96, color: '#22c55e' },
        { name: 'Accuracy', score: 92, color: '#0ea5e9' },
        { name: 'Timeliness', score: 88, color: '#f59e0b' },
        { name: 'Consistency', score: 94, color: '#8b5cf6' },
      ];
    },
  });

  const overallScore = metrics
    ? Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length)
    : 0;

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
