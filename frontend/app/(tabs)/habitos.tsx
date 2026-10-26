import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { api, type Habit, type Routine } from "@/src/api";
import { refreshAll, useHabits, useRoutines, useSettings } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { DAYS_SHORT, fmtDuration } from "@/src/time";
import { Btn, Empty, Header, Loading, Screen, Section } from "@/src/ui";

const PREF: Record<string, string> = { any: "Cualquier hora", morning: "Mañanas", afternoon: "Tardes", evening: "Noches" };

export default function Habitos() {
  const habits = useHabits();
  const routines = useRoutines();
  const settings = useSettings();
  const reorder = useMutation({ mutationFn: (ids: string[]) => api("/habits/reorder", { method: "POST", body: { ids } }), onSuccess: refreshAll });
  const list = habits.data || [];
  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((h) => h.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    reorder.mutate(ids);
  };
  const feeds = settings.data?.ical_feeds || [];

  return (
    <Screen testID="habitos-tab-content" header={<Header eyebrow="Lo que quieres conseguir" title="Hábitos y rutinas" />}>
      <Section title="Hábitos por prioridad" right={<Btn small label="Nuevo" icon="add" onPress={() => router.push("/habit-form")} testID="add-habit-btn" />}>
        {habits.isLoading ? <Loading /> : list.length === 0 ? (
          <Empty icon="flag-outline" title="Aún no tienes hábitos" text="Añade lo que siempre aplazas: gimnasio, leer, estudiar… y cuántas veces por semana." />
        ) : (
          list.map((h, i) => <HabitRow key={h.id} h={h} first={i === 0} last={i === list.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />)
        )}
      </Section>

      <Section title="Rutinas fijas" right={<Btn small variant="soft" label="Añadir" icon="add" onPress={() => router.push("/routine-form")} testID="add-routine-btn" />}>
        <Text style={useStyles().note}>Lo inamovible: trabajo, clases, academia… La IA nunca pondrá nada encima.</Text>
        {routines.isLoading ? <Loading /> : (routines.data || []).length === 0 ? (
          <Empty icon="briefcase-outline" title="Sin rutinas fijas" text="Añádelas aquí o conecta tu calendario en Ajustes." />
        ) : (
          (routines.data || []).map((r) => <RoutineRow key={r.id} r={r} />)
        )}
        {feeds.length > 0 && (
          <Pressable onPress={() => router.push("/ajustes")} testID="habitos-feeds-link">
            <Text style={useStyles().feedNote}>
              + {feeds.reduce((a: number, f: any) => a + (f.count || 0), 0)} eventos de {feeds.length} calendario{feeds.length > 1 ? "s" : ""} conectado{feeds.length > 1 ? "s" : ""}
            </Text>
          </Pressable>
        )}
      </Section>
    </Screen>
  );
}

function HabitRow({ h, first, last, onUp, onDown }: { h: Habit; first: boolean; last: boolean; onUp: () => void; onDown: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.habit} testID={`habit-row-${h.id}`}>
      <View style={s.rank}>
        <Text style={s.rankText}>{h.priority}</Text>
      </View>
      <Pressable style={{ flex: 1, gap: 6 }} onPress={() => router.push({ pathname: "/habit-form", params: { id: h.id } })} testID={`habit-edit-${h.id}`}>
        <Text style={s.name}>{h.name}</Text>
        <Text style={s.meta}>
          {h.sessions_per_week}× semana · {fmtDuration(h.duration_min)}
          {h.travel_before_min || h.travel_after_min ? ` · +${h.travel_before_min}/${h.travel_after_min} min viaje` : ""}
        </Text>
        <View style={s.tags}>
          <Text style={s.tag}>{PREF[h.preferred]}</Text>
          {h.forbidden_windows.map((w) => (
            <Text key={w.start} style={[s.tag, s.tagNo]}>No {w.start}–{w.end}</Text>
          ))}
          {h.forbidden_days.length > 0 && <Text style={[s.tag, s.tagNo]}>Sin {h.forbidden_days.map((d) => DAYS_SHORT[d]).join(" ")}</Text>}
        </View>
      </Pressable>
      <View style={{ gap: 6 }}>
        <Pressable disabled={first} onPress={onUp} style={[s.arrow, first && { opacity: 0.3 }]} testID={`habit-up-${h.id}`}>
          <Ionicons name="chevron-up" size={18} color={colors.onSurface} />
        </Pressable>
        <Pressable disabled={last} onPress={onDown} style={[s.arrow, last && { opacity: 0.3 }]} testID={`habit-down-${h.id}`}>
          <Ionicons name="chevron-down" size={18} color={colors.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

function RoutineRow({ r }: { r: Routine }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={s.routine} onPress={() => router.push({ pathname: "/routine-form", params: { id: r.id } })} testID={`routine-row-${r.id}`}>
      <View style={[s.bar, { backgroundColor: colors.routine }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{r.title}</Text>
        <Text style={s.meta}>
          {r.days.map((d) => DAYS_SHORT[d]).join(" · ")} · {r.start}–{r.end}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  habit: { flexDirection: "row", gap: 12, backgroundColor: c.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, alignItems: "center" },
  rank: { width: 34, height: 34, borderRadius: 11, backgroundColor: c.habitBg, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  rankText: { fontFamily: fonts.heading, fontSize: 16, color: c.habit },
  name: { fontFamily: fonts.headingSemi, fontSize: 17, color: c.onSurface },
  meta: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.muted },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: c.onSurfaceSecondary, backgroundColor: c.surfaceTertiary, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  tagNo: { color: c.error, backgroundColor: "rgba(244,63,94,0.10)" },
  arrow: { width: 38, height: 38, borderRadius: 10, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  routine: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14 },
  bar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  note: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: -4 },
  feedNote: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.event },
}));
