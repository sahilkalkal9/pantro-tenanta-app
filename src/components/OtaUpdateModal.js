import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Radio, Download, CheckCircle2, AlertCircle, X, Sparkles, RefreshCw } from 'lucide-react-native';
import { useOtaUpdates } from '../hooks/useOtaUpdates';
import { useTheme } from '../hooks/useTheme';
import { SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../constants/colors';

export default function OtaUpdateModal() {
  const { colors, isDark } = useTheme();
  const {
    updateAvailable,
    update,
    isMandatory,
    isDownloading,
    downloadProgress,
    progressText,
    downloadAndInstall,
    dismissUpdate,
  } = useOtaUpdates({ autoCheck: true, checkDelayMs: 3000 });

  const [installError, setInstallError] = useState(null);

  if (!updateAvailable || !update) {
    return null;
  }

  const handleInstall = async () => {
    setInstallError(null);
    try {
      await downloadAndInstall();
    } catch (e) {
      setInstallError(e?.message || 'Download failed. Please check internet connection.');
    }
  };

  // -------------------------------------------------------------------------
  // MANDATORY UPDATE MODAL (Full block)
  // -------------------------------------------------------------------------
  if (isMandatory) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={[styles.dialogCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
            {/* Header Icon */}
            <View style={[styles.iconWrap, { backgroundColor: '#eff6ff' }]}>
              <Radio size={32} color="#2563eb" />
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.mandatoryBadge}>
                <Text style={styles.mandatoryBadgeText}>REQUIRED UPDATE</Text>
              </View>
              <Text style={[styles.versionText, { color: colors.textSecondary }]}>v{update.version}</Text>
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {update.title || 'App Update Required'}
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              A critical update is required to continue using Pantro safely and securely.
            </Text>

            {update.releaseNotes ? (
              <View style={[styles.notesBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Text style={[styles.notesHeader, { color: colors.textPrimary }]}>What&apos;s New:</Text>
                <Text style={[styles.notesContent, { color: colors.textSecondary }]}>{update.releaseNotes}</Text>
              </View>
            ) : null}

            {installError ? (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color="#ef4444" />
                <Text style={styles.errorText}>{installError}</Text>
              </View>
            ) : null}

            {isDownloading ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
                </View>
                <View style={styles.progressTextRow}>
                  <Text style={[styles.progressStatus, { color: colors.textSecondary }]}>
                    {progressText || 'Updating Pantro...'}
                  </Text>
                  <Text style={styles.progressPercent}>{Math.round(downloadProgress * 100)}%</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleInstall}
                activeOpacity={0.85}
              >
                <Download size={18} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Update Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // -------------------------------------------------------------------------
  // FLEXIBLE UPDATE PROMPT (Floating Bottom Banner)
  // -------------------------------------------------------------------------
  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <View style={[styles.bannerCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
        <View style={styles.bannerRow}>
          <View style={styles.bannerIconWrap}>
            <Sparkles size={20} color="#2563eb" />
          </View>

          <View style={styles.bannerTextCol}>
            <View style={styles.bannerTitleRow}>
              <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>Update Available</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>v{update.version}</Text>
              </View>
            </View>
            <Text style={[styles.bannerDesc, { color: colors.textSecondary }]} numberOfLines={1}>
              {update.title || update.releaseNotes || 'New improvements are ready to install.'}
            </Text>
          </View>

          {!isDownloading && (
            <TouchableOpacity onPress={dismissUpdate} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {isDownloading ? (
          <View style={{ marginTop: SPACING.sm }}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
            </View>
            <Text style={[styles.progressStatus, { color: colors.textSecondary, marginTop: 4 }]}>
              {progressText || 'Downloading update...'} ({Math.round(downloadProgress * 100)}%)
            </Text>
          </View>
        ) : (
          <View style={styles.bannerBtnRow}>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: isDark ? '#334155' : '#cbd5e1' }]}
              onPress={dismissUpdate}
            >
              <Text style={[styles.outlineBtnText, { color: colors.textSecondary }]}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bannerInstallBtn}
              onPress={handleInstall}
            >
              <RefreshCw size={14} color="#ffffff" />
              <Text style={styles.bannerInstallBtnText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 11, 20, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  mandatoryBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  mandatoryBadgeText: {
    color: '#b91c1c',
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  notesBox: {
    width: '100%',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  notesHeader: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: 2,
  },
  notesContent: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#fef2f2',
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
    width: '100%',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: FONT_SIZES.xs,
    flex: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: '#2563eb',
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  progressContainer: {
    width: '100%',
    marginTop: SPACING.sm,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  progressStatus: {
    fontSize: FONT_SIZES.xs,
  },
  progressPercent: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#2563eb',
  },

  // Floating banner styles
  floatingContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 16,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
  },
  bannerCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    ...SHADOWS.lg,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  bannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  versionBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.sm,
  },
  versionBadgeText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
  },
  bannerDesc: {
    fontSize: FONT_SIZES.xs,
    marginTop: 1,
  },
  bannerBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  outlineBtn: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  bannerInstallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  bannerInstallBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
