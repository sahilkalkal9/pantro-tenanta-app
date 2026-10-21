import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  AlertTriangle, Plus, Wrench, Clock, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import api from '../../../lib/api';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { unwrapList, getPagination, getErrorMessage } from '../../../lib/normalize';
import {
  Screen, TenantPageHeader, Card, Button, SearchBar, ModalSheet,
  TextField, SelectField, EmptyState, CardSkeleton, ComplaintCard, ImageKitUploader,
  PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../../../constants/colors';

const CATEGORIES = [
  { value: 'Electricity', label: '⚡ Electricity' },
  { value: 'Water', label: '💧 Water' },
  { value: 'Food', label: '🍽️ Food' },
  { value: 'Cleaning', label: '🧹 Cleaning' },
  { value: 'WiFi', label: '📶 WiFi' },
  { value: 'Room', label: '🛏️ Room' },
  { value: 'Bathroom', label: '🚿 Bathroom' },
  { value: 'Security', label: '🔒 Security' },
  { value: 'Furniture', label: '🪑 Furniture' },
  { value: 'Other', label: '📋 Other' },
];

const PRIORITIES = [
  { value: 'low', label: '🟢 Low' },
  { value: 'medium', label: '🔵 Medium' },
  { value: 'high', label: '🟠 High' },
  { value: 'urgent', label: '🔴 Urgent' },
];

const STATUS_CARDS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const PAGE_LIMIT = 10;

export default function ComplaintsScreen() {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedList =
    tenantService.getCachedComplaints({ page: 1, limit: PAGE_LIMIT }) ||
    tenantService.getCachedComplaints({});
  const cachedAll = tenantService.getCachedComplaints({ page: 1, limit: 200 });
  const hasCache = Array.isArray(cachedList) && cachedList.length > 0;

  const [complaints, setComplaints] = useState(cachedList || []);
  const [allComplaints, setAllComplaints] = useState(cachedAll || []);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(!hasCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', category: '', priority: 'medium', description: '', imageUrl: '' });
  const [errors, setErrors] = useState({});

  // Stats: one large fetch counting every complaint by status (matches web fetchStats).
  const fetchStats = useCallback(async ({ fresh = false } = {}) => {
    try {
      const all = await tenantService.getMyComplaints(
        { page: 1, limit: 200 },
        { bypassCache: fresh }
      );
      if (Array.isArray(all)) setAllComplaints(all);
    } catch {
      // web swallows stats errors silently
    }
  }, []);

  // List: page/limit/status/search params exactly like the web panel.
  const fetchComplaints = useCallback(
    async ({ fresh = false } = {}) => {
      if (fresh) setRefreshing(true);
      else if (!hasCache) setLoading(true);
      setError('');
      try {
        const params = { page, limit: PAGE_LIMIT };
        if (filter !== 'all') params.status = filter;
        if (search.trim()) params.search = search.trim();
        const res = await api.get('/tenant/my-complaints', { params });
        setComplaints(unwrapList(res, 'complaints', 'records', 'data'));
        setPagination(getPagination(res));
      } catch (e) {
        if (!hasCache) {
          setError(getErrorMessage(e));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, filter, search, hasCache]
  );

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch whenever page, filter or search changes (typing filters the list, like web).
  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, search]);

  const stats = useMemo(() => {
    const counts = { all: allComplaints.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    allComplaints.forEach((c) => {
      if (counts[c.status] !== undefined) counts[c.status] += 1;
    });
    return counts;
  }, [allComplaints]);

  const tabs = useMemo(
    () => [
      { key: 'all', label: 'All', count: stats.all },
      ...STATUS_CARDS.map((s) => ({ key: s.key, label: s.label, count: stats[s.key] })),
    ],
    [stats]
  );

  const refreshAll = () => {
    fetchStats({ fresh: true });
    fetchComplaints({ fresh: true });
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    else if (form.title.trim().length < 4) errs.title = 'Title must be at least 4 characters';
    if (!form.category) errs.category = 'Category is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    else if (form.description.trim().length < 10) errs.description = 'Please add more detail (min 10 characters)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openCreate = () => {
    setForm({ title: '', category: '', priority: 'medium', description: '', imageUrl: '' });
    setErrors({});
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setErrors({});
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await tenantService.createComplaint({
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
        ...(form.imageUrl ? { images: [form.imageUrl] } : {}),
      });
      toast.success('Complaint raised successfully');
      setCreateOpen(false);
      setForm({ title: '', category: '', priority: 'medium', description: '', imageUrl: '' });
      setErrors({});
      setPage(1);
      setFilter('all');
      fetchStats({ fresh: true });
      fetchComplaints({ fresh: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refreshAll}>
      <TenantPageHeader
        title="Complaints"
        subtitle="Raise and track your complaints"
        icon={Wrench}
        iconTone="amber"
        style={{ marginBottom: SPACING.xs }}
      />
      <View style={styles.headerActions}>
        <Button title="Refresh" size="sm" variant="light" icon={RefreshCw} onPress={refreshAll} />
        <Button title="Raise Complaint" size="sm" icon={Plus} onPress={openCreate} />
      </View>

      <View style={styles.statGrid}>
        {STATUS_CARDS.map((s) => (
          <Card key={s.key} style={styles.statCard}>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{s.label}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats[s.key]}</Text>
          </Card>
        ))}
      </View>

      <Card style={styles.filterCard}>
        <SearchBar
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by title, category, or description..."
          style={{ marginBottom: SPACING.sm }}
        />
        <PillTabs
          tabs={tabs}
          active={filter}
          onChange={(k) => {
            setFilter(k);
            setPage(1);
          }}
        />
      </Card>

      {loading && complaints.length === 0 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
            <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
              Loading complaints…
            </Text>
          </View>
          <CardSkeleton count={3} />
        </>
      ) : error && complaints.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load complaints"
          message={error}
          action="Retry"
          onAction={() => fetchComplaints()}
        />
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={filter === 'all' ? 'No complaints yet' : `No ${filter.replace('_', ' ')} complaints`}
          message={filter === 'all' ? "You haven't raised any complaints yet." : 'Try a different filter or search term.'}
          action={filter === 'all' ? 'Raise Your First Complaint' : undefined}
          onAction={openCreate}
        />
      ) : (
        <>
          {complaints.map((c) => (
            <ComplaintCard
              key={c._id || c.id}
              complaint={c}
              onClick={() => router.push(`/complaints/${c._id || c.id}`)}
            />
          ))}
          {pagination && pagination.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.totalItems || complaints.length}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <ModalSheet
        visible={createOpen}
        onClose={closeCreate}
        title="Raise a Complaint"
        actions={[
          <Button key="cancel" title="Cancel" variant="light" onPress={closeCreate} style={{ flex: 1 }} />,
          <Button key="submit" title="Submit Complaint" icon={Plus} onPress={submit} loading={submitting} style={{ flex: 1 }} />,
        ]}
      >
        <TextField
          label="Title"
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder="Brief title of your issue (e.g. 'Water not working in bathroom')"
          error={errors.title}
          required
        />
        <SelectField
          label="Category"
          value={form.category}
          options={CATEGORIES}
          onSelect={(v) => setForm((f) => ({ ...f, category: v }))}
          placeholder="Select category..."
          error={errors.category}
          required
        />
        <SelectField
          label="Priority"
          value={form.priority}
          options={PRIORITIES}
          onSelect={(v) => setForm((f) => ({ ...f, priority: v }))}
        />
        <TextField
          label="Description"
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder="Describe your issue in detail. Include when it started, what you've tried, and any other context."
          multiline
          error={errors.description}
          required
        />
        <ImageKitUploader
          folder="/tenants/complaints"
          label="Attach Photo Proof (Optional)"
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          helperText="Upload or take a photo showing the issue clearly"
        />
        <View style={[styles.infoNote, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : `${COLORS.info}14` }]}>
          <Clock size={15} color={COLORS.info} style={{ marginTop: 1 }} />
          <Text style={[styles.infoNoteText, { color: colors.textSecondary }]}>
            Your complaint will be reviewed by the management team. You'll be notified when there's an update.
          </Text>
        </View>
      </ModalSheet>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Pill tabs (matches web Tabs variant="pill" with separate badges)    */
/* ------------------------------------------------------------------ */
function PillTabs({ tabs, active, onChange }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.tabsShell,
        { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : COLORS.gray100 },
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              onPress={() => onChange(tab.key)}
              style={[
                styles.tab,
                isActive && {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : COLORS.white,
                  ...SHADOWS.small,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? (isDark ? '#bfdbfe' : '#1d4ed8') : isDark ? COLORS.gray400 : COLORS.gray500 },
                ]}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count !== null ? (
                <Text
                  style={[
                    styles.tabCount,
                    isActive
                      ? {
                          backgroundColor: isDark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.15)',
                          color: isDark ? '#dbeafe' : '#1d4ed8',
                        }
                      : {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.07)',
                          color: isDark ? COLORS.gray300 : COLORS.gray600,
                        },
                  ]}
                >
                  {String(tab.count)}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination (matches web Pagination: "Page X of Y · N total")        */
/* ------------------------------------------------------------------ */
function Pagination({ page, totalPages, total, onPageChange }) {
  const { colors, isDark } = useTheme();
  if (!total || totalPages <= 1) return null;

  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages = [];
  for (let p = start; p <= end; p += 1) pages.push(p);

  const mutedColor = isDark ? COLORS.gray500 : COLORS.gray400;
  const strongColor = isDark ? COLORS.gray300 : COLORS.gray700;

  return (
    <View style={styles.pagination}>
      <Text style={[styles.paginationText, { color: isDark ? COLORS.gray400 : COLORS.gray500 }]}>
        Page <Text style={[styles.paginationStrong, { color: strongColor }]}>{page}</Text>
        <Text style={{ color: mutedColor }}> of </Text>
        <Text style={[styles.paginationStrong, { color: strongColor }]}>{totalPages}</Text>
        <Text style={{ color: mutedColor }}> · {total} total</Text>
      </Text>

      <View style={styles.paginationBtns}>
        <PageButton
          kind="nav"
          icon={ChevronLeft}
          disabled={page <= 1}
          onPress={() => onPageChange(page - 1)}
        />

        {start > 1 ? (
          <>
            <PageButton kind="ghost" label={1} onPress={() => onPageChange(1)} />
            {start > 2 ? <Text style={[styles.paginationEllipsis, { color: mutedColor }]}>…</Text> : null}
          </>
        ) : null}

        {pages.map((p) => (
          <PageButton
            key={p}
            kind={p === page ? 'active' : 'ghost'}
            label={p}
            onPress={() => onPageChange(p)}
          />
        ))}

        {end < totalPages ? (
          <>
            {end < totalPages - 1 ? <Text style={[styles.paginationEllipsis, { color: mutedColor }]}>…</Text> : null}
            <PageButton kind="ghost" label={totalPages} onPress={() => onPageChange(totalPages)} />
          </>
        ) : null}

        <PageButton
          kind="nav"
          icon={ChevronRight}
          disabled={page >= totalPages}
          onPress={() => onPageChange(page + 1)}
        />
      </View>
    </View>
  );
}

function PageButton({ label, icon: Icon, kind = 'ghost', disabled, onPress }) {
  const { colors, isDark } = useTheme();
  const isActive = kind === 'active';
  const bg =
    isActive
      ? COLORS.primary
      : kind === 'nav'
      ? isDark
        ? colors.cardSecondary
        : COLORS.gray100
      : 'transparent';
  const fg = isActive ? COLORS.white : colors.textSecondary;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.pageBtn,
        { backgroundColor: bg, borderColor: isActive ? COLORS.primary : kind === 'nav' ? bg : 'transparent' },
        disabled && { opacity: 0.45 },
      ]}
    >
      {Icon ? (
        <Icon size={16} color={fg} strokeWidth={2.4} />
      ) : (
        <Text style={[styles.pageBtnText, { color: fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: { width: '48%', flexGrow: 1, padding: SPACING.md },
  statLabel: {
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.88,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
  },
  filterCard: { marginBottom: SPACING.md },
  tabsShell: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 4,
  },
  tabsRow: { gap: 4, flexDirection: 'row' },
  tab: {
    minWidth: 68,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabLabel: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, letterSpacing: -0.12 },
  tabCount: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: SPACING.md,
  },
  paginationText: { fontSize: FONT_SIZES.xs },
  paginationStrong: { fontWeight: FONT_WEIGHTS.semibold },
  paginationEllipsis: { paddingHorizontal: 4 },
  paginationBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageBtn: {
    minWidth: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pageBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold },
  infoNote: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginTop: SPACING.xs,
  },
  infoNoteText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
