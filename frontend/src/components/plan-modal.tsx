import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, useTheme } from "@/src/theme";
import { DAYS_LONG, hhmm, mondayIndex } from "@/src/time";
import { Btn } from "@/src/ui";

const STEPS = ["Leyendo tus rutinas fijas…", "Revisando tu calendario…", "Sumando ida y vuelta…", "Evitando tus franjas prohibidas…", "Repartiendo sesiones en la semana…"];

type Props = { visible: boolean; loading: boolean; result: any; error?: string | null; onClose: () => void };

export function PlanModal({ visible, loading, result, error, onClose }: Props) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      return;
    }
    setStep(0);
    const t = setInterval(() => setStep((x) => Math.min(x + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, [loading]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]} testID="ai-planning-modal">
          <View style={s.handle} />
          <View style={s.head}>
            <View style={s.aiIcon}>
              <Ionicons name="sparkles" size={18} color={colors.onBrandSecondary} />
            </View>
            <Text style={s.title}>{loading ? "Buscando tus mejores huecos" : error ? "No se pudo planificar" : "Tu semana está planificada"}</Text>
          </View>

          {loading && (
            <View style={s.steps} testID="ai-planning-steps">
              {STEPS.map((t, i) => (
                <View key={t} style={s.stepRow}>
                  {i < step ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.habit} />
                  ) : i === step ? (
                    <ActivityIndicator size="small" color={colors.brandSecondary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={18} color={colors.subtle} />
                  )}
                  <Text style={[s.stepText, i > step && { color: colors.subtle }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {!loading && error && <Text style={s.error} testID="ai-planning-error">{error}</Text>}

          {!loading && result && (
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
              <Text style={s.summary} testID="ai-planning-summary">{result.summary}</Text>
              {result.sessions.map((x: any) => (
                <View key={x.id} style={s.item} testID={`ai-planned-session-${x.id}`}>
                  <Text style={s.itemWhen}>
                    {DAYS_LONG[mondayIndex(new Date(x.start))]} · {hhmm(x.start)}–{hhmm(x.end)}
                  </Text>
                  <Text style={s.itemName}>{x.habit_name}</Text>
                  <Text style={s.itemReason}>{x.reason}</Text>
                </View>
              ))}
              {result.unplaced?.map((u: any) => (
                <View key={u.habit} style={s.warn} testID="ai-unplaced-warning">
                  <Ionicons name="alert-circle-outline" size={16} color={colors.travel} />
                  <Text style={s.warnText}>
                    {u.habit}: faltan {u.missing} {u.missing === 1 ? "sesión" : "sesiones"} sin hueco válido esta semana. Prueba a relajar alguna restricción.
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {!loading && (
            <Btn label={error ? "Cerrar" : "Ver mi semana"} onPress={onClose} testID="confirm-ai-schedule-btn" style={{ marginTop: 16 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(1,4,9,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: c.border, padding: 20, width: "100%", maxWidth: 640, alignSelf: "center" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  aiIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 21, color: c.onSurface },
  steps: { gap: 14, paddingVertical: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  summary: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface, lineHeight: 22, marginBottom: 4 },
  item: { backgroundColor: c.habitBg, borderRadius: 14, padding: 12, gap: 3, borderLeftWidth: 3, borderLeftColor: c.habit },
  itemWhen: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.habit, textTransform: "uppercase", letterSpacing: 0.8 },
  itemName: { fontFamily: fonts.headingSemi, fontSize: 16, color: c.onSurface },
  itemReason: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
  warn: { flexDirection: "row", gap: 8, backgroundColor: c.travelBg, borderRadius: 12, padding: 12 },
  warnText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: c.travel, lineHeight: 18 },
  error: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.error },
}));
