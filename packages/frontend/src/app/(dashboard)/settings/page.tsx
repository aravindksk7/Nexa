'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Avatar,
  Stack,
  Alert,
} from '@mui/material';
import {
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Palette as PaletteIcon,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profile settings state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');

  // Notification settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Security settings state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Appearance settings state
  const [darkMode, setDarkMode] = useState(false);
  const [compactView, setCompactView] = useState(false);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSaveError(null);
  };

  const profileMutation = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string }) =>
      api.put('/auth/profile', data),
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      refreshUser?.();
    },
    onError: (error: Error) => {
      setSaveError(error.message || 'Failed to save profile');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { oldPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', data),
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: Error) => {
      setSaveError(error.message || 'Failed to change password');
    },
  });

  const handleProfileSave = () => {
    setSaveError(null);
    profileMutation.mutate({ firstName, lastName });
  };

  const handlePasswordChange = () => {
    setSaveError(null);
    if (newPassword !== confirmPassword) {
      setSaveError('New passwords do not match');
      return;
    }
    passwordMutation.mutate({ oldPassword: currentPassword, newPassword });
  };

  // Placeholder for notifications/appearance settings (no API yet)
  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Settings
      </Typography>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}

      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="settings tabs"
          >
            <Tab icon={<PersonIcon />} label="Profile" iconPosition="start" />
            <Tab icon={<NotificationsIcon />} label="Notifications" iconPosition="start" />
            <Tab icon={<SecurityIcon />} label="Security" iconPosition="start" />
            <Tab icon={<PaletteIcon />} label="Appearance" iconPosition="start" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Profile Tab */}
          <TabPanel value={tabValue} index={0}>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Avatar
                  sx={{ width: 80, height: 80, fontSize: '2rem' }}
                >
                  {firstName?.[0]}{lastName?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {firstName} {lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.role || 'User'}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                />
              </Stack>

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              />

              <Box>
                <Button 
                  variant="contained" 
                  onClick={handleProfileSave}
                  disabled={profileMutation.isPending}
                >
                  {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Stack>
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel value={tabValue} index={1}>
            <Stack spacing={2}>
              <Typography variant="h6" gutterBottom>
                Email Notifications
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                  />
                }
                label="Receive email notifications for important updates"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={weeklyDigest}
                    onChange={(e) => setWeeklyDigest(e.target.checked)}
                  />
                }
                label="Weekly digest email"
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Push Notifications
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                  />
                }
                label="Enable browser push notifications"
              />

              <Box sx={{ mt: 2 }}>
                <Button variant="contained" onClick={handleSave}>
                  Save Preferences
                </Button>
              </Box>
            </Stack>
          </TabPanel>

          {/* Security Tab */}
          <TabPanel value={tabValue} index={2}>
            <Stack spacing={3}>
              <Typography variant="h6">
                Change Password
              </Typography>

              <TextField
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                fullWidth
              />

              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
              />

              <TextField
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
              />

              <Box>
                <Button
                  variant="contained"
                  disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || passwordMutation.isPending}
                  onClick={handlePasswordChange}
                >
                  {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6">
                Two-Factor Authentication
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                Add an extra layer of security to your account by enabling two-factor authentication.
              </Typography>

              <Box>
                <Button variant="outlined">
                  Enable 2FA
                </Button>
              </Box>
            </Stack>
          </TabPanel>

          {/* Appearance Tab */}
          <TabPanel value={tabValue} index={3}>
            <Stack spacing={2}>
              <Typography variant="h6" gutterBottom>
                Theme
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                  />
                }
                label="Dark mode"
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Display
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={compactView}
                    onChange={(e) => setCompactView(e.target.checked)}
                  />
                }
                label="Compact view"
              />

              <Box sx={{ mt: 2 }}>
                <Button variant="contained" onClick={handleSave}>
                  Save Preferences
                </Button>
              </Box>
            </Stack>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}
