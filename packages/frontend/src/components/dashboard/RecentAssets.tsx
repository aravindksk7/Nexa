'use client';

import {
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Skeleton,
  Box,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from '@/lib/utils';

interface Asset {
  id: string;
  name: string;
  type: string;
  domain?: string;
  updatedAt: string;
}

export function RecentAssets() {
  const router = useRouter();

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['recent-assets'],
    queryFn: async () => {
      // In production, fetch from /api/v1/assets?sort=updatedAt&limit=5
      return [
        {
          id: '1',
          name: 'customers',
          type: 'TABLE',
          domain: 'Sales',
          updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          id: '2',
          name: 'orders',
          type: 'TABLE',
          domain: 'Sales',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        },
        {
          id: '3',
          name: 'daily_revenue',
          type: 'VIEW',
          domain: 'Finance',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          id: '4',
          name: 'user_events',
          type: 'TOPIC',
          domain: 'Analytics',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        },
        {
          id: '5',
          name: 'product_catalog',
          type: 'DATASET',
          domain: 'Products',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ];
    },
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info'> = {
      TABLE: 'primary',
      VIEW: 'secondary',
      TOPIC: 'success',
      DATASET: 'warning',
      DASHBOARD: 'info',
    };
    return colors[type] || 'default';
  };

  return (
    <Card>
      <CardHeader
        title="Recent Assets"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        action={
          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => router.push('/catalog')}
          >
            View All
          </Typography>
        }
      />
      <CardContent sx={{ p: 0 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton variant="text" width={120} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="rounded" width={60} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width={80} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width={100} />
                    </TableCell>
                  </TableRow>
                ))
              : assets?.map((asset) => (
                  <TableRow
                    key={asset.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/catalog/${asset.id}`)}
                  >
                    <TableCell>
                      <Typography fontWeight={500}>{asset.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={asset.type}
                        size="small"
                        color={getTypeColor(asset.type)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography color="text.secondary">
                        {asset.domain || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDistanceToNow(asset.updatedAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!isLoading && (!assets || assets.length === 0) && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No assets found</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
