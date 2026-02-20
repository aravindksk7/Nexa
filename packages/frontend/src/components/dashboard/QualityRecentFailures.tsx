'use client';

import {
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  Chip,
  Typography,
  Box,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/utils';

interface QualityOverviewResponse {
  recentFailures: Array<{
    ruleId: string;
    assetId: string;
    ruleName: string;
    assetName: string;
    severity: string;
    executedAt: string;
  }>;
}

const severityColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  INFO: 'success',
  WARNING: 'warning',
  CRITICAL: 'error',
};

export function QualityRecentFailures() {
  const router = useRouter();
  const { data: overview, isLoading } = useQuery<QualityOverviewResponse>({
    queryKey: ['quality-overview'],
    queryFn: async () => api.get<QualityOverviewResponse>('/quality/overview'),
  });

  const failures = overview?.recentFailures ?? [];

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Recent Failures"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        action={
          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => router.push('/quality')}
          >
            View All
          </Typography>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading recent failures...
          </Typography>
        ) : failures.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No recent quality failures.
          </Typography>
        ) : (
          <List disablePadding>
            {failures.map((failure) => (
              <ListItem
                key={`${failure.ruleId}-${failure.assetId}-${failure.executedAt}`}
                disablePadding
                sx={{ mb: 1.5 }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {failure.ruleName}
                      </Typography>
                      <Chip
                        label={failure.severity}
                        size="small"
                        color={severityColor[failure.severity] ?? 'default'}
                      />
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {failure.assetName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(failure.executedAt)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
