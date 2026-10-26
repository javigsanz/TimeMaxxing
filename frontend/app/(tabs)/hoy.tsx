import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AgendaCard } from "@/src/components/agenda-card";
import { PlanModal } from "@/src/components/plan-modal";
import { useAgenda, usePlan, useProgress, useSessionAction } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useToast } from "@/src/toast";
import { longDate, ymd } from "@/src/time";
import { Btn, Empty, Header, Loading, ProgressBar, Screen } from "@/src/ui";
import { useAuth } from "@/src/auth";

export default function Hoy() {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const today = new Date();
  const agenda = useAgenda(ymd(today));
  const progress = useProgress();
  const plan = usePlan();
  const action = useSessionAction();
  const [open, setOpen] = useState(false);

  const runPlan = () => {
    setOpen(true);
    plan.mutate();
  };

  const act = (id: string, kind: "done" | "postpone" | "undo") =>
    action.mutate(
      { id, action: kind },
      {
        onSuccess: (r) => toast(kind === "done" ? "¡Hecho! Un paso más en tu racha" : kind === "postpone" ? r.message : "Marcado como pendiente", kind === "postpone" && !r.new_session ? "info" : "success"),
        onError: (e: any) => toast(e.message, "error"),
      },
    );

  const p = progress.data;
  const items = agenda.data?.items || [];
  const pending = items.filter((i) => i.type === "session" && i.status === "planned").length;

  return (
    <Screen testID="hoy-tab-content" header={<Header eyebrow={longDate(today)} title={`Hola, ${user?.name || ""}`} right={<StreakChip days={p?.day_streak ?? 0} />} />}>
      <View style={s.hero} testID="hoy-hero">
        <View style={s.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel}>Esta semana</Text>
            <Text style={s.heroValue} testID="week-progress-value">
              {p ? `${p.week_done}/${p.week_target}` : "–"}
              <Text style={s.heroUnit}> sesiones</Text>
            </Text>
          </View>
          <Text style={s.heroPct}>{p?.week_pct ?? 0}%</Text>
        </View>
        <ProgressBar pct={p?.week_pct ?? 0} />
        <Text style={s.heroText}>Tú pones las rutinas fijas y tus objetivos. La IA busca los huecos y los mete en tu agenda.</Text>
        <Btn label="Planificar con IA" icon="sparkles" variant="ai" onPress={runPlan} loading={plan.isPending} testID="plan-with-ai-btn" />
      </View>

      <View style={{ gap: 12 }}>
        <View style={s.rowBetween}>
          <Text style={s.section}>Hoy</Text>
          {pending > 0 && <Text style={s.pending}>{pending} pendiente{pending > 1 ? "s" : ""}</Text>}
        </View>
        {agenda.isLoading ? (
          <Loading />
        ) : agenda.isError ? (
          <Empty icon="cloud-offline-outline" title="No se pudo cargar" text={(agenda.error as Error).message}>
            <Btn small variant="soft" label="Reintentar" onPress={() => agenda.refetch()} testID="hoy-retry-btn" />
          </Empty>
        ) : items.length === 0 ? (
          <Empty icon="sunny-outline" title="Día libre" text="No hay rutinas ni hábitos hoy. Pulsa «Planificar con IA» para llenar tus huecos." />
        ) : (
          <View style={{ gap: 12 }} testID="hoy-timeline">
            {items.map((it) => (
              <AgendaCard key={it.id} item={it} busy={action.isPending} onDone={() => act(it.id, "done")} onPostpone={() => act(it.id, "postpone")} onUndo={() => act(it.id, "undo")} />
            ))}
          </View>
        )}
      </View>

      <View style={s.legend}>
        {[
          [colors.routine, "Rutina fija"],
          [colors.event, "Tu calendario"],
          [colors.habit, "Hábito"],
          [colors.travel, "Desplazamiento"],
        ].map(([c, l]) => (
          <View key={l} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: c }]} />
            <Text style={s.legendText}>{l}</Text>
          </View>
        ))}
      </View>

      <PlanModal visible={open} loading={plan.isPending} result={plan.data} error={plan.error ? (plan.error as Error).message : null} onClose={() => setOpen(false)} />
    </Screen>
  );
}

function StreakChip({ days }: { days: number }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={s.streak} testID="streak-chip">
      <Ionicons name="flame" size={16} color={days ? colors.travel : colors.subtle} />
      <Text style={[s.streakText, !days && { color: colors.subtle }]}>{days}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { backgroundColor: c.surfaceSecondary, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 18, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-end" },
  heroLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: c.muted },
  heroValue: { fontFamily: fonts.heading, fontSize: 34, color: c.onSurface, letterSpacing: -1 },
  heroUnit: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.muted, letterSpacing: 0 },
  heroPct: { fontFamily: fonts.heading, fontSize: 22, color: c.habit },
  heroText: { fontFamily: fonts.body, fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 20 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { fontFamily: fonts.headingSemi, fontSize: 18, color: c.onSurface },
  pending: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.habit },
  streak: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surfaceTertiary, borderRadius: 12, paddingHorizontal: 10, height: 36, borderWidth: 1, borderColor: c.border },
  streakText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
}));
