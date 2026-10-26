import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, useTheme } from "@/src/theme";

type Kind = "success" | "error" | "info";
const ToastContext = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; kind: Kind } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  const show = useCallback(
    (msg: string, kind: Kind = "success") => {
      clearTimeout(timer.current);
      setToast({ msg, kind });
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, 2800);
    },
    [anim],
  );

  const accent = toast?.kind === "error" ? colors.error : toast?.kind === "info" ? colors.brandSecondary : colors.brandPrimary;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + 12, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
          ]}
        >
          <View testID="toast" style={[styles.toast, { backgroundColor: colors.surfaceTertiary, borderColor: accent }]}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={[styles.text, { color: colors.onSurface }]}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 100 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, maxWidth: 480 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: fonts.bodySemi, fontSize: 14, flexShrink: 1 },
});
