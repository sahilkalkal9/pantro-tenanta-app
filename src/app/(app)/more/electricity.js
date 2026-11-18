import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import {
  Zap,
  ArrowRight,
  Calendar,
  X,
} from 'lucide-react-native';
import tenantService from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { formatCurrency } from '../../../lib/format';
import {
  Screen,
  TenantPageHeader,
  Card,
  Button,
  EmptyState,
  PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ElectricityBillsScreen() {
  const { colors } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchBills = useCallback(async () => {
    try {
      const res = await tenantService.getMyElectricityBills();
      setData(res || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load electricity bills');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBills();
  };

  const meter = data?.meter || {};
  const property = data?.property || {};
  const bills = data?.bills || [];

  return (
    <Screen>
      <TenantPageHeader
        title="Electricity Bills"
        subtitle="Meter readings, units consumed & payment proofs"
        icon={Zap}
        iconTone="amber"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Meter Info Card */}
        <Card style={styles.meterCard}>
          <View style={styles.meterHeader}>
            <View style={styles.meterIconBox}>
              <Zap size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.meterTitle, { color: colors.textPrimary }]}>
                {property.name || 'Property Meter'}
              </Text>
              <Text style={[styles.meterSub, { color: colors.textSecondary }]}>
                System: {property.meterType === 'prepaid' ? 'Prepaid Smart Meter' : 'Postpaid Cumulative Sub-meter'}
              </Text>
            </View>
            <View style={styles.rateBadge}>
              <Text style={styles.rateText}>₹{property.ratePerUnit || 10}/unit</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.meterGrid}>
            <View style={styles.meterCol}>
              <Text style={[styles.colLabel, { color: colors.textSecondary }]}>METER SERIAL NO.</Text>
              <Text style={[styles.colValue, { color: colors.textPrimary }]}>
                {meter.meterSerialNumber || 'Not Assigned'}
              </Text>
            </View>
            <View style={styles.meterCol}>
              <Text style={[styles.colLabel, { color: colors.textSecondary }]}>CURRENT READING</Text>
              <Text style={[styles.colValue, { color: colors.textPrimary }]}>
                {meter.lastReading ?? meter.initialReading ?? 0} kWh
              </Text>
            </View>
          </View>
        </Card>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Monthly Consumption Bills ({bills.length})
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <PantroLoader />
          </View>
        ) : bills.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No Electricity Bills Yet"
            description="Your monthly electricity consumption bills and meter reading photos will appear here."
          />
        ) : (
          bills.map((b) => {
            const isPaid = b.pendingPaymentId?.status === 'paid' || b.status === 'paid';
            const monthLabel = MONTH_NAMES[b.billingMonth - 1] || 'Month';

            return (
              <Card key={b._id} style={styles.billCard}>
                <View style={styles.billTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.calendarBadge}>
                      <Calendar size={14} color="#2563eb" />
                    </View>
                    <View style={{ marginLeft: 8 }}>
                      <Text style={[styles.billMonth, { color: colors.textPrimary }]}>
                        {monthLabel} {b.billingYear}
                      </Text>
                      <Text style={[styles.billUnits, { color: colors.textSecondary }]}>
                        {b.unitsConsumed} units @ ₹{b.ratePerUnit}/unit
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.billAmount, { color: colors.textPrimary }]}>
                      {formatCurrency(b.amount)}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: isPaid ? '#059669' : '#D97706' },
                        ]}
                      >
                        {isPaid ? 'PAID' : 'PENDING'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Reading difference bar */}
                <View style={styles.readingDiffBox}>
                  <View style={styles.readingStep}>
                    <Text style={styles.readingStepLabel}>PREVIOUS</Text>
                    <Text style={[styles.readingStepValue, { color: colors.textPrimary }]}>
                      {b.previousReading} kWh
                    </Text>
                  </View>
                  <ArrowRight size={16} color={colors.textSecondary} style={{ marginHorizontal: 8 }} />
                  <View style={styles.readingStep}>
                    <Text style={styles.readingStepLabel}>CURRENT</Text>
                    <Text style={[styles.readingStepValue, { color: colors.textPrimary }]}>
                      {b.currentReading} kWh
                    </Text>
                  </View>
                  <View style={[styles.unitsBadge, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <Text style={styles.unitsBadgeText}>+{b.unitsConsumed} kWh</Text>
                  </View>
                </View>

                {/* Meter Photo Thumbnail & Actions */}
                <View style={styles.billFooterRow}>
                  {b.currentReadingImage ? (
                    <TouchableOpacity
                      onPress={() =>
                        setPreviewImage({
                          url: b.currentReadingImage,
                          title: `Meter Photo - ${monthLabel} ${b.billingYear}`,
                        })
                      }
                      style={styles.photoProofBtn}
                    >
                      <Image source={{ uri: b.currentReadingImage }} style={styles.photoThumb} />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.photoProofText, { color: colors.textPrimary }]}>
                          Meter Photo Proof
                        </Text>
                        <Text style={styles.tapToView}>Tap to inspect meter dial</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}

                  {!isPaid && (
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => router.push('/more/dues')}
                    >
                      Pay Due
                    </Button>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* FULL SCREEN METER PHOTO MODAL */}
      <Modal visible={Boolean(previewImage)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{previewImage?.title || 'Meter Proof'}</Text>
            <TouchableOpacity onPress={() => setPreviewImage(null)} style={styles.modalCloseBtn}>
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalImageContainer}>
            {previewImage?.url ? (
              <Image source={{ uri: previewImage.url }} style={styles.modalImage} resizeMode="contain" />
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  meterCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meterIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  meterSub: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  rateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  rateText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#D97706',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: SPACING.sm,
  },
  meterGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meterCol: {
    flex: 1,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.5,
  },
  colValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: 2,
  },
  sectionHeaderRow: {
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  billCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  billTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  calendarBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billMonth: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  billUnits: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  billAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
  },
  readingDiffBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
  },
  readingStep: {
    flex: 1,
  },
  readingStepLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '700',
  },
  readingStepValue: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: 1,
  },
  unitsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  billFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  photoProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  photoProofText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tapToView: {
    fontSize: 10,
    color: '#2563eb',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  modalTitle: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});
