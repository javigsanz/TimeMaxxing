import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { useProgress } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { shortMonth } from "@/src/time";
import { Card, Empty, Header, Loading, ProgressBar, Screen, Section } from "@/src/ui";

export default function Progreso() {
  const s = useStyles();
  const { colors } = useTheme();
  const { data: p, isLoading } = useProgress();

  return (
    <Screen testID="progreso-tab-content" header={<Header eyebrow="Constancia" title="Progreso" />}>
      {isLoading || !p ? <Loading /> : (
        <>
          <View style={s.top}>
            <Card style={s.big} testID="progress-week-card">
              <Text style={s.kicker}>Semana</Text>
              <Text style={s.pct} testID="progress-week-pct">{p.week_pct}%</Text>
              <ProgressBar pct={p.week_pct} />
              <Text style={s.small}>{p.week_done} de {p.week_target} sesiones</Text>
            </Card>
            <Card style={s.big} testID="progress-streak-card">
              <Text style={s.kicker}>Racha diaria</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="flame" size={30} color={p.day_streak ? colors.travel : colors.subtle} />
                <Text style={s.pct} testID="progress-day-streak">{p.day_streak}</Text>
              </View>
              <Text style={s.small}>días seguidos cumpliendo</Text>
            </Card>
          </View>

          <Section title="Tus hábitos">
            {p.habits.length === 0 ? <Empty icon="flag-outline" title="Sin hábitos" text="Crea uno en la pestaña Hábitos." /> : p.habits.map((h: any) => (
              <Card key={h.id} testID={`progress-habit-${h.id}`} style={{ gap: 10 }}>
                <View style={s.rowBetween}>
                  <Text style={s.name}>{h.name}</Text>
                  <View style={s.streakPill}>
                    <Ionicons name="flame" size={13} color={h.streak_weeks ? colors.travel : colors.subtle} />
                    <Text style={s.streakText}>{h.streak_weeks} {h.streak_weeks === 1 ? "semana" : "semanas"}</Text>
                  </View>
                </View>
                <View style={s.dots}>
                  {Array.from({ length: h.target }).map((_, i) => (
                    <View key={i} style={[s.slot, i < h.done ? s.slotDone : i < h.done + h.planned ? s.slotPlanned : null]}>
                      {i < h.done && <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} />}
                    </View>
                  ))}
                </View>
                <Text style={s.small}>{h.done}/{h.target} esta semana{h.done >= h.target ? " · ¡objetivo cumplido!" : ""}</Text>
              </Card>
            ))}
          </Section>

          <Section title="Últimas 4 semanas">
            <Card style={s.history} testID="progress-history">
              {p.history.map((w: any) => (
                <View key={w.week_start} style={s.col}>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { height: `${Math.max(4, w.pct)}%` }]} />
                  </View>
                  <Text style={s.colPct}>{w.pct}%</Text>
                  <Text style={s.colLabel}>{shortMonth(new Date(w.week_start + "T00:00:00"))}</Text>
                </View>
              ))}
            </Card>
          </Section>

          <Section title="Logros">
            <View style={s.badges}>
              {p.badges.map((b: any) => (
                <View key={b.id} style={[s.badge, !b.unlocked && { opacity: 0.45 }]} testID={`badge-${b.id}`}>
                  <Ionicons name={b.unlocked ? "trophy" : "lock-closed-outline"} size={20} color={b.unlocked ? colors.travel : colors.subtle} />
                  <Text style={s.badgeTitle}>{b.title}</Text>
                  <Text style={s.badgeDesc}>{b.desc}</Text>
                </View>
              ))}
            </View>
          </Section>

          <View style={s.totals} testID="progress-totals">
            <Total label="Hechas" value={p.totals.done} color={colors.habit} />
            <Total label="Aplazadas" value={p.totals.postponed} color={colors.travel} />
            <Total label="Sin marcar" value={p.totals.missed} color={colors.subtle} />
          </View>
        </>
      )}
    </Screen>
  );
}

function Total({ label, value, color }: { label: string; value: number; color: string }) {
  const s = useStyles();
  return (
    <View style={s.total}>
      <Text style={[s.totalV, { color }]}>{value}</Text>
      <Text style={s.small}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  top: { flexDirection: "row", gap: 12 },
  big: { flex: 1, gap: 8 },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: c.muted },
  pct: { fontFamily: fonts.heading, fontSize: 38, color: c.onSurface, letterSpacing: -1 },
  small: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.muted },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontFamily: fonts.headingSemi, fontSize: 17, color: c.onSurface },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.travelBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  streakText: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.travel },
  dots: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  slot: { width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, borderColor: c.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  slotDone: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary, borderStyle: "solid" },
  slotPlanned: { borderColor: c.habit },
  history: { flexDirection: "row", justifyContent: "space-between", height: 170, alignItems: "flex-end" },
  col: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barTrack: { flex: 1, width: 26, backgroundColor: c.surfaceTertiary, borderRadius: 8, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", backgroundColor: c.brandPrimary, borderRadius: 8 },
  colPct: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurface },
  colLabel: { fontFamily: fonts.body, fontSize: 11, color: c.subtle },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: { width: "47%", flexGrow: 1, backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, gap: 4 },
  badgeTitle: { fontFamily: fonts.headingSemi, fontSize: 14.5, color: c.onSurface, marginTop: 4 },
  badgeDesc: { fontFamily: fonts.body, fontSize: 12, color: c.muted, lineHeight: 17 },
  totals: { flexDirection: "row", gap: 10 },
  total: { flex: 1, alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 12 },
  totalV: { fontFamily: fonts.heading, fontSize: 24 },
}));
