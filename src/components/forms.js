import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
  FlatList,
} from 'react-native';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
} from '../constants/colors';
import { useTheme } from '../hooks/useTheme';

/* ------------------------------------------------------------------ */
/* TextField                                                           */
/* ------------------------------------------------------------------ */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  icon: Icon,
  secureTextEntry,
  keyboardType = 'default',
  multiline = false,
  editable = true,
  autoCapitalize = 'sentences',
  maxLength,
  required = false,
  style,
  inputStyle,
  right,
  onFocus,
  onBlur,
  prefix,
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
          {required ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
          },
          multiline && { height: 96, alignItems: 'flex-start', paddingTop: 10 },
          focused && styles.inputWrapperFocused,
          error && styles.inputWrapperError,
          !editable && { backgroundColor: colors.cardSecondary },
        ]}
      >
        {Icon ? <Icon size={18} color={colors.textTertiary} style={{ marginRight: 8 }} /> : null}
        {prefix ? <Text style={[styles.prefix, { color: colors.textSecondary }]}>{prefix}</Text> : null}
        <TextInput
          style={[styles.input, { color: colors.textPrimary }, multiline && { height: 76, textAlignVertical: 'top' }, inputStyle]}
          value={value === null || value === undefined ? '' : String(value)}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          onFocus={(e) => {
            setFocused(true);
            onFocus && onFocus(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur && onBlur(e);
          }}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={[styles.helperText, { color: colors.textTertiary }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SelectField                                                         */
/* ------------------------------------------------------------------ */
export function SelectField({
  label,
  value,
  options = [],
  onSelect,
  placeholder = 'Select...',
  error,
  required = false,
  style,
  disabled = false,
  displayKey,
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const getLabel = (opt) => {
    if (opt === null || opt === undefined) return '';
    if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
    return opt.label ?? opt.name ?? (displayKey ? opt[displayKey] : opt.value);
  };
  const getValue = (opt) =>
    typeof opt === 'string' || typeof opt === 'number' ? opt : opt.value ?? opt._id ?? opt.id;
  const selectedLabel = (() => {
    if (value === null || value === undefined || value === '') return '';
    const match = options.find((o) => String(getValue(o)) === String(value));
    return match ? getLabel(match) : String(value);
  })();

  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
          {required ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
          },
          error && styles.inputWrapperError,
          disabled && { backgroundColor: colors.cardSecondary },
        ]}
      >
        <Text
          style={[styles.input, { flex: 1, paddingTop: 12 }]}
          numberOfLines={1}
        >
          {selectedLabel ? (
            <Text style={{ color: colors.textPrimary, fontSize: FONT_SIZES.md }}>
              {selectedLabel}
            </Text>
          ) : (
            <Text style={{ color: colors.textTertiary, fontSize: FONT_SIZES.md }}>
              {placeholder}
            </Text>
          )}
        </Text>
        <Text style={{ color: colors.textTertiary }}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.selectBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={[styles.selectSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.selectTitle, { color: colors.textPrimary }]}>{label || placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={(item, idx) => String(getValue(item) ?? idx)}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const active = String(getValue(item)) === String(value);
                return (
                  <TouchableOpacity
                    style={[styles.selectOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      onSelect && onSelect(getValue(item), item);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        { color: colors.textPrimary },
                        active && { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semibold },
                      ]}
                    >
                      {getLabel(item)}
                    </Text>
                    {active ? <Text style={{ color: COLORS.primary }}>✓</Text> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.selectEmpty, { color: colors.textTertiary }]}>No options available</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SwitchRow                                                           */
/* ------------------------------------------------------------------ */
export function SwitchRow({ label, helper, value, onValueChange, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.switchRow, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>{label}</Text>
        {helper ? <Text style={[styles.helperText, { color: colors.textSecondary }]}>{helper}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.gray300, true: COLORS.primaryLight }}
        thumbColor={value ? COLORS.primary : COLORS.white}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* DateField (text based, avoids native picker dependency)             */
/* ------------------------------------------------------------------ */
export function DateField({ label, value, onChange, placeholder = 'YYYY-MM-DD', required, error, style }) {
  // value may be a Date or ISO string; normalise to YYYY-MM-DD for display.
  const display = (() => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  })();
  return (
    <TextField
      label={label}
      value={display}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType="numbers-and-punctuation"
      required={required}
      error={error}
      helper="Format: YYYY-MM-DD"
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: SPACING.md },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  inputWrapperFocused: { borderColor: COLORS.primary },
  inputWrapperError: { borderColor: COLORS.danger },
  input: {
    flex: 1,
    minHeight: 48,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  prefix: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  errorText: { fontSize: FONT_SIZES.xs, color: COLORS.danger, marginTop: 4 },
  helperText: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  switchLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textPrimary,
  },
  selectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  selectSheet: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  selectTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  selectOptionText: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  selectEmpty: {
    textAlign: 'center',
    color: COLORS.textTertiary,
    paddingVertical: SPACING.lg,
  },
});
