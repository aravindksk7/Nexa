'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
  Badge,
  Popover,
  Paper,
  ListItemAvatar,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  AccountTree as AccountTreeIcon,
  CloudUpload as CloudUploadIcon,
  Link as LinkIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Business as GlossaryIcon,
  Notifications as NotificationsIcon,
  Circle as CircleIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as WorkflowIcon,
  VerifiedUser as QualityIcon,
} from '@mui/icons-material';
import { useAuth } from '@/providers/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDistanceToNow } from '@/lib/utils';

const DRAWER_WIDTH = 260;

const menuItems = [
  { label: 'Dashboard', icon: DashboardIcon, path: '/dashboard' },
  { label: 'Data Catalog', icon: StorageIcon, path: '/catalog' },
  { label: 'Lineage', icon: AccountTreeIcon, path: '/lineage' },
  { label: 'Quality', icon: QualityIcon, path: '/quality' },
  { label: 'Workflows', icon: WorkflowIcon, path: '/workflows' },
  { label: 'Glossary', icon: GlossaryIcon, path: '/glossary' },
  { label: 'Connections', icon: LinkIcon, path: '/connections' },
  { label: 'File Upload', icon: CloudUploadIcon, path: '/upload' },
  { label: 'Search', icon: SearchIcon, path: '/search' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unread notification count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: isAuthenticated,
  });

  // Fetch notifications when popover opens
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get<{
        notifications: Array<{
          id: string;
          type: string;
          title: string;
          message: string;
          isRead: boolean;
          createdAt: string;
        }>;
        total: number;
        unreadCount: number;
      }>('/notifications?limit=10'),
    enabled: isAuthenticated && Boolean(notifAnchorEl),
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const handleNotificationClick = (id: string, isRead: boolean) => {
    if (!isRead) {
      markAsReadMutation.mutate(id);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show nothing while loading or redirecting
  if (isLoading || !isAuthenticated) {
    return null;
  }

  const drawer = (
    <Box>
      <Toolbar sx={{ py: 2 }}>
        <Typography variant="h6" fontWeight={700} color="primary">
          Nexa
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={pathname === item.path}
              onClick={() => {
                router.push(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.50',
                  '&:hover': {
                    backgroundColor: 'primary.100',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <item.icon
                  color={pathname === item.path ? 'primary' : 'inherit'}
                />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: pathname === item.path ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />
      <List sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => router.push('/settings')}
            sx={{ borderRadius: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' }, color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Notification Bell */}
          <IconButton
            onClick={handleNotifOpen}
            sx={{ mr: 2, color: 'text.primary' }}
            aria-label="notifications"
          >
            <Badge badgeContent={unreadData?.count || 0} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>

          {/* Notifications Popover */}
          <Popover
            open={Boolean(notifAnchorEl)}
            anchorEl={notifAnchorEl}
            onClose={handleNotifClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <Paper sx={{ width: 360, maxHeight: 500 }}>
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight={600}>
                  Notifications
                </Typography>
                {(unreadData?.count || 0) > 0 && (
                  <Button
                    size="small"
                    onClick={() => markAllAsReadMutation.mutate()}
                    disabled={markAllAsReadMutation.isPending}
                  >
                    Mark all read
                  </Button>
                )}
              </Box>
              
              {notificationsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : !notificationsData?.notifications.length ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">No notifications</Typography>
                </Box>
              ) : (
                <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                  {notificationsData.notifications.map((notification) => (
                    <ListItem
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification.id, notification.isRead)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                        '&:hover': { bgcolor: 'action.selected' },
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemAvatar>
                        {notification.isRead ? (
                          <CheckCircleIcon color="action" />
                        ) : (
                          <CircleIcon color="primary" sx={{ fontSize: 12 }} />
                        )}
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={notification.isRead ? 400 : 600}>
                              {notification.title}
                            </Typography>
                            <Chip label={notification.type} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {formatDistanceToNow(notification.createdAt)}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Popover>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            onClick={handleMenuClose}
            slotProps={{
              paper: {
                sx: { width: 200, mt: 1 },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => router.push('/profile')}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
