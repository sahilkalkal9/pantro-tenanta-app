import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { User, Shield, LogOut, CheckCircle2, Moon, Sun, Settings, Radio, RefreshCw } from 'lucide-react-native';
import { logout } from '../../../slices/authSlice';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { useOtaUpdates } from '../../../hooks/useOtaUpdates';
import { getErrorMessage } from '../../../lib/normalize';
import {
  Screen, TenantPageHeader, Card, Button, TextField, KeyValue, ConfirmModal,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const toast = useToast();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useSelector((state) => state.auth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const {
    isChecking,
    checkForUpdates,
    installedInfo,
  } = useOtaUpdates({ autoCheck: false });

  const handleManualCheck = async () => {
    const res = await checkForUpdates();
    if (res?.updateAvailable) {
      toast.info(`Update v${res.update?.version} available! Follow the on-screen prompt.`);
    } else {
      toast.success(res?.message || 'You are on the latest version!');
    }
  };

  const changePassword = async () => {
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChanging(true);
    try {
      await tenantService.changePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setChanging(false);
    }
  };

  return (
    <Screen>
      <TenantPageHeader title="Settings" subtitle="Manage your account & preferences" icon={Settings} iconTone="slate" />

      <Card style={styles.card}>
        <View style={styles.head}>
          <Moon size={16} color={colors.textSecondary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Appearance</Text>
        </View>
        <View style={styles.themeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Text style={[styles.note, { color: colors.textSecondary }]}>Toggle between dark and light theme</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
            thumbColor={isDark ? '#ffffff' : '#f8fafc'}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.head}>
          <Radio size={16} color={colors.textSecondary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>App Updates</Text>
        </View>
        <KeyValue label="Installed Version" value={installedInfo?.displayVersion || 'v1.0.2'} />
        <KeyValue label="Build Number" value={String(installedInfo?.buildNumber || 4)} />
        <KeyValue label="Update Channel" value="Production (OTA)" />
        <View style={{ marginTop: SPACING.sm }}>
          <Button
            title={isChecking ? 'Checking for updates...' : 'Check for Updates'}
            icon={RefreshCw}
            variant="outline"
            size="sm"
            onPress={handleManualCheck}
            loading={isChecking}
            fullWidth
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.head}>
          <User size={16} color={colors.textSecondary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Account Info</Text>
        </View>
        <KeyValue label="Name" value={user?.name || user?.fullName || '—'} />
        <KeyValue label="Email" value={user?.email || '—'} />
        <KeyValue label="Phone" value={user?.phone || '—'} />
        <KeyValue label="Role" value={(user?.role || 'tenant').replace('_', ' ')} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.head}>
          <Shield size={16} color={colors.textSecondary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Change Password</Text>
        </View>
        <TextField
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="Enter current password"
          autoCapitalize="none"
        />
        <TextField
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Enter new password"
          autoCapitalize="none"
        />
        <TextField
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Confirm new password"
          autoCapitalize="none"
        />
        <Button title="Update Password" icon={CheckCircle2} onPress={changePassword} loading={changing} fullWidth />
      </Card>

      <Card style={styles.card}>
        <View style={styles.logoutRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Sign Out</Text>
            <Text style={[styles.note, { color: colors.textSecondary }]}>Log out of your account</Text>
          </View>
          <Button title="Logout" variant="danger" size="sm" icon={LogOut} onPress={() => setConfirmLogout(true)} />
        </View>
      </Card>

      <ConfirmModal
        visible={confirmLogout}
        title="Sign Out?"
        message="You will need to log in again to access your account."
        confirmLabel="Sign Out"
        onConfirm={() => {
          setConfirmLogout(false);
          dispatch(logout());
        }}
        onCancel={() => setConfirmLogout(false)}
        destructive
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  note: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  themeLabel: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.medium },
});
