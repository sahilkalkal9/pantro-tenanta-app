import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Bell, CheckCircle } from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { formatDateTime } from '../../../lib/format';
import {
  Screen, TenantPageHeader, Card, EmptyState, LoadingState, CardSkeleton, Button,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

export default function NotificationsScreen() {
  const toast = useToast();

  const cachedNotifs = tenantService.getCachedNotifications({ page: 1, limit: 50 });
  const [notifications, setNotifications] = useState(cachedNotifs || []);
  const [loading, setLoading] = useState(!cachedNotifs);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedNotifications({ page: 1, limit: 50 })) setLoading(true);
      try {
        const res = await tenantService.getNotifications({ page: 1, limit: 50 }, { bypassCache: refresh });
        setNotifications(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!tenantService.getCachedNotifications({ page: 1, limit: 50 })) {
          toast.error(getErrorMessage(e));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkRead = async (id) => {
    const item = notifications.find((n) => n._id === id || n.id === id);
    if (!item || item.read) return;
    try {
      await tenantService.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id || n.id === id ? { ...n, read: true } : n))
      );
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await tenantService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setMarkingAll(false);
    }
  };

  const hasUnread = notifications.some((n) => !n.read);

  if (loading && notifications.length === 0) {
    return (
      <Screen>
        <TenantPageHeader
          title="Notifications"
          subtitle="Your recent notifications"
          icon={Bell}
          iconTone="blue"
        />
        <CardSkeleton count={3} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchNotifications({ refresh: true })}>
      <TenantPageHeader
        title="Notifications"
        subtitle="Your recent notifications"
        icon={Bell}
        iconTone="blue"
        right={
          hasUnread ? (
            <Button
              title="Mark all read"
              variant="light"
              size="sm"
              onPress={handleMarkAll}
              loading={markingAll}
              icon={CheckCircle}
            />
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" message="You're all caught up. No new notifications." />
      ) : (
        notifications.map((n) => <NotificationItem key={n._id || n.id} notification={n} onPress={handleMarkRead} />)
      )}
    </Screen>
  );
}

function NotificationItem({ notification, onPress }) {
  const { colors, isDark } = useTheme();
  const read = notification.read;
  const title = notification.title || notification.type || 'Notification';
  const message = notification.message || notification.body || '';
  const link = notification.link;

  const handlePress = () => {
    onPress && onPress(notification._id || notification.id);
    if (link) {
      try {
        router.push(link);
      } catch {
        // ignore navigation errors
      }
    }
  };

  const unreadCardStyle = !read
    ? {
        borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : `${COLORS.primary}60`,
        backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : `${COLORS.primary}06`,
      }
    : null;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Card style={[styles.card, unreadCardStyle]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: !read ? `${COLORS.primary}15` : isDark ? colors.cardSecondary : `${COLORS.gray200}50` }]}>
            <Bell size={18} color={!read ? COLORS.primary : colors.textTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: !read ? colors.textPrimary : colors.textSecondary },
                  !read && styles.titleUnread,
                ]}
                numberOfLines={2}
              >
                {title}
              </Text>
              {!read && <View style={styles.dot} />}
            </View>
            {!!message && <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={3}>{message}</Text>}
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: colors.textTertiary }]}>{formatDateTime(notification.createdAt)}</Text>
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.sm },
  cardUnread: { borderColor: `${COLORS.primary}60`, backgroundColor: `${COLORS.primary}06` },
  row: { flexDirection: 'row', gap: SPACING.md },
  icon: { width: 38, height: 38, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { flexShrink: 1, fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textSecondary },
  titleUnread: { color: COLORS.textPrimary, fontWeight: FONT_WEIGHTS.bold },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  message: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  meta: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary },
});
