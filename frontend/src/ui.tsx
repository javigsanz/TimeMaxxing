import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, useTheme } from "@/src/theme";

export type IconName = keyof typeof Ionicons.glyphMap;

export function Screen({ children, testID, header }: { children: ReactNode; testID?: string; header?: ReactNode }) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={s.screen} testID={testID}>
      {header}
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 110 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.inner}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function Header({ eyebrow, title, right, onBack }: { eyebrow?: string; title: string; right?: ReactNode; onBack?: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 14 }]} testID="app-header">
      <View style={s.headerRow}>
        {onBack && (
          <Pressable onPress={onBack} style={s.back} testID="header-back-btn" hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right}
      </View>
    </View>
  );
}

type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ai" | "ghost" | "danger" | "soft";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  small?: boolean;
  style?: ViewStyle;
};

export function Btn({ label, onPress, variant = "primary", icon, loading, disabled, testID, small, style }: BtnProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const bg = { primary: colors.brandPrimary, ai: colors.brandSecondary, ghost: "transparent", danger: "rgba(244,63,94,0.12)", soft: colors.surfaceTertiary }[variant];
  const fg = { primary: colors.onBrandPrimary, ai: colors.onBrandSecondary, ghost: colors.onSurface, danger: colors.error, soft: colors.onSurface }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        variant === "ghost" && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: ViewStyle | ViewStyle[]; testID?: string }) {
  const s = useStyles();
  return (
    <View style={[s.card, style as ViewStyle]} testID={testID}>
      {children}
    </View>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const s = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const s = useStyles();
  return (
    <View style={{ gap: 12 }}>
      <View style={s.sectionRow}>
        <Text style={s.section}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6, flex: props.style ? undefined : 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.subtle} {...props} style={[s.input, props.style]} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Empty({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.habit} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {children}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />;
}

export function ProgressBar({ pct, color, height = 8 }: { pct: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.surfaceTertiary, overflow: "hidden" }}>
      <View style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", borderRadius: height, backgroundColor: color || colors.brandPrimary }} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1 },
  inner: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, paddingTop: 16, gap: 22 },
  header: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: 14, paddingHorizontal: 18 },
  headerRow: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: c.habit, marginBottom: 2 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: c.onSurface, letterSpacing: -0.5 },
  btn: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnSmall: { minHeight: 38, borderRadius: 11, paddingHorizontal: 12 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16 },
  chip: { minHeight: 38, minWidth: 38, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.muted },
  chipTextActive: { color: c.habit },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { fontFamily: fonts.headingSemi, fontSize: 18, color: c.onSurface },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: c.muted },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, paddingHorizontal: 14, color: c.onSurface, fontFamily: fonts.bodySemi, fontSize: 16 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: c.subtle },
  empty: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, gap: 8, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: c.border },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: c.habitBg, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: fonts.headingSemi, fontSize: 17, color: c.onSurface, textAlign: "center" },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 20 },
}));
