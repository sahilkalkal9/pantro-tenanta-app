import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Upload, X, Check, Camera, Image as ImageIcon, AlertCircle, Link } from 'lucide-react-native';
import api from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../constants/colors';

/**
 * Safe native image picker loader:
 * Dynamic check so Hermes does NOT throw 'Cannot find native module ExponentImagePicker'
 * if the currently installed APK on the device was compiled without expo-image-picker.
 */
function getNativePicker() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-image-picker');
    if (mod && (mod.launchImageLibraryAsync || mod.launchCameraAsync)) {
      return mod;
    }
  } catch (err) {
    // ExponentImagePicker is not in the compiled native binary on this device
  }
  return null;
}

/**
 * ImageKitUploader — Safe photo uploader for Pantro:
 * - Directly uploads to ImageKit CDN using signed single-use auth parameters
 * - Transparent fallback to backend /api/upload/image
 * - Uses native Camera/Gallery when compiled into APK
 * - Graceful URL/Link fallback dialog when native module is not yet compiled
 * - Clean UI matching tenant web panel ImageKitUpload
 */
export default function ImageKitUploader({
  value,
  onChange,
  folder = '/tenants/payments',
  label = 'Screenshot / Photo',
  required = false,
  error,
}) {
  const { colors, isDark } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const pickImage = async (useCamera = false) => {
    const picker = getNativePicker();
    if (!picker) {
      setManualUrl(value || '');
      setUrlModalOpen(true);
      return;
    }

    try {
      setUploadError('');
      let permissionResult;
      if (useCamera) {
        permissionResult = await picker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await picker.requestMediaLibraryPermissionsAsync();
      }

      if (!permissionResult || !permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          `Please grant ${useCamera ? 'camera' : 'photo library'} access to upload photos.`
        );
        return;
      }

      const result = useCamera
        ? await picker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          })
        : await picker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      await performUpload(asset);
    } catch (err) {
      console.warn('[ImageKitUploader] pick error:', err);
      setUploadError(err?.message || 'Failed to select image');
      setManualUrl(value || '');
      setUrlModalOpen(true);
    }
  };

  const showPickOptions = () => {
    const picker = getNativePicker();
    if (!picker) {
      // Native picker not compiled in current APK -> open URL / Link modal directly
      setManualUrl(value || '');
      setUrlModalOpen(true);
      return;
    }

    Alert.alert('Upload Photo', 'Choose photo source', [
      { text: 'Take Photo', onPress: () => pickImage(true) },
      { text: 'Choose from Gallery', onPress: () => pickImage(false) },
      {
        text: 'Enter Image URL',
        onPress: () => {
          setManualUrl(value || '');
          setUrlModalOpen(true);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const performUpload = async (asset) => {
    setUploading(true);
    setUploadError('');

    try {
      const fileName = asset.fileName || `pantro_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      // 1. Fetch fresh single-use authentication parameters from backend
      let auth = null;
      try {
        const res = await api.get('/upload/auth');
        auth = res?.data?.data || res?.data || res;
      } catch (authErr) {
        console.warn('[ImageKitUploader] auth fetch error:', authErr?.message);
      }

      // 2. Direct upload to ImageKit CDN
      if (auth?.publicKey && auth?.signature && auth?.token) {
        try {
          const fd = new FormData();
          fd.append('file', {
            uri: asset.uri,
            name: fileName,
            type: mimeType,
          });
          fd.append('fileName', fileName);
          fd.append('publicKey', auth.publicKey);
          fd.append('signature', auth.signature);
          fd.append('expire', String(auth.expire));
          fd.append('token', auth.token);
          fd.append('folder', folder || '/tenants/payments');
          fd.append('useUniqueFileName', 'true');

          const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            body: fd,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData?.url) {
              onChange?.(uploadData.url);
              setUploading(false);
              return;
            }
          }
        } catch (directErr) {
          console.warn('[ImageKitUploader] Direct ImageKit fetch failed, attempting server fallback:', directErr?.message);
        }
      }

      // 3. Fallback: Server-side upload through backend /api/upload/image
      const fallbackFd = new FormData();
      fallbackFd.append('file', {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      });
      fallbackFd.append('folder', folder || '/tenants/payments');

      const fallbackRes = await api.post('/upload/image', fallbackFd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const fallbackData = fallbackRes?.data?.data || fallbackRes?.data || fallbackRes;
      if (fallbackData?.url) {
        onChange?.(fallbackData.url);
        setUploading(false);
        return;
      }

      throw new Error('Image upload failed. Please try again.');
    } catch (err) {
      console.error('[ImageKitUploader] Upload error:', err);
      setUploadError(err?.response?.data?.message || err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    onChange?.('');
    setUploadError('');
  };

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.labelText, { color: colors.textPrimary }]}>
            {label}
            {required && <Text style={{ color: COLORS.danger }}> *</Text>}
          </Text>
        </View>
      ) : null}

      {value ? (
        /* ── Uploaded State Card ─────────────────────── */
        <View
          style={[
            styles.uploadedCard,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
            },
          ]}
        >
          <Image source={{ uri: value }} style={styles.thumbImage} resizeMode="cover" />

          <View style={styles.uploadedInfo}>
            <View style={styles.uploadedSuccessRow}>
              <Check size={14} color="#059669" strokeWidth={2.5} />
              <Text style={[styles.uploadedSuccessText, { color: isDark ? '#34d399' : '#047857' }]}>
                Image Uploaded
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.uploadedUrlText, { color: colors.textSecondary }]}>
              {value}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.changeBtn}
            onPress={showPickOptions}
            activeOpacity={0.7}
          >
            <Text style={[styles.changeBtnText, { color: COLORS.primary }]}>Change</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.removeBtn}
            onPress={removeImage}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Upload Trigger Button ─────────────────────── */
        <TouchableOpacity
          style={[
            styles.triggerBox,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
            },
          ]}
          onPress={showPickOptions}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <View style={styles.uploadingWrap}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={[styles.uploadingText, { color: COLORS.primary }]}>
                Uploading to ImageKit…
              </Text>
            </View>
          ) : (
            <View style={styles.triggerContent}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff' }]}>
                <Upload size={20} color={COLORS.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.triggerTextWrap}>
                <Text style={[styles.triggerTitle, { color: colors.textPrimary }]}>
                  Upload Screenshot / Photo
                </Text>
                <Text style={[styles.triggerSub, { color: colors.textSecondary }]}>
                  Tap to upload or provide image
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}

      {(uploadError || error) ? (
        <View style={styles.errorRow}>
          <AlertCircle size={13} color="#ef4444" />
          <Text style={styles.errorText}>{uploadError || error}</Text>
        </View>
      ) : null}

      {/* ── Fallback URL / ImageKit Link Modal ──────────── */}
      <Modal
        visible={urlModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUrlModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? '#0b1329' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Image / Screenshot</Text>
              <TouchableOpacity onPress={() => setUrlModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              Enter or paste the direct URL to your screenshot or photo (ImageKit, Cloudinary, Imgur, etc.).
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.textPrimary,
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                },
              ]}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="https://ik.imagekit.io/... or https://..."
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0' }]}
                onPress={() => setUrlModalOpen(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => {
                  if (manualUrl.trim()) {
                    onChange?.(manualUrl.trim());
                    setUrlModalOpen(false);
                  }
                }}
              >
                <Text style={styles.modalSubmitText}>Set Image</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
    width: '100%',
  },
  labelRow: {
    marginBottom: 6,
  },
  labelText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  triggerBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 74,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerTextWrap: {
    flex: 1,
  },
  triggerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  triggerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  uploadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  uploadedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: 10,
    gap: 10,
  },
  thumbImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#000000',
  },
  uploadedInfo: {
    flex: 1,
    minWidth: 0,
  },
  uploadedSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploadedSuccessText: {
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.bold,
  },
  uploadedUrlText: {
    fontSize: 10.5,
    marginTop: 2,
  },
  changeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  removeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalHint: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  modalSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: BORDER_RADIUS.md,
  },
  modalSubmitText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
