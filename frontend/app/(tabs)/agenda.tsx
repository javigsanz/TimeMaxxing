import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { AgendaItem } from "@/src/api";
import { AgendaCard } from "@/src/components/agenda-card";
import { useAgenda, useSessionAction } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useToast } from "@/src/toast";
import { addDays, DAYS_SHORT, longDate, minutesOfDay, shortMonth, startOfWeek, ymd } from "@/src/time";
import { Empty, Header, Loading, Screen } from "@/src/ui";

const START_H = 6;
const PX = 0.9;

export default function Agenda() {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dayIdx, setDayIdx] = useState(() => (new Date().getDay() + 6) % 7);
  const [selected, setSelected] = useState<string | null>(null);
  const agenda = useAgenda(ymd(weekStart), 7);
  const action = useSessionAction();
  const day = addDays(weekStart, dayIdx);
  const all = agenda.data?.items || [];
  const byDay = (d: Date) => all.filter((i) => ymd(new Date(i.start)) === ymd(d));
  const items = useMemo(() => byDay(day), [all, dayIdx, weekStart]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = items.find((i) => i.id === selected);

  const move = (n: number) => {
    setWeekStart(addDays(weekStart, 7 * n));
    setSelected(null);
  };

  const act = (id: string, kind: "done" | "postpone" | "undo") =>
    action.mutate({ id, action: kind }, { onSuccess: (r) => { setSelected(null); toast(kind === "postpone" ? r.message : "Actualizado"); }, onError: (e: any) => toast(e.message, "error") });

  return (
    <Screen testID="calendario-tab-content" header={<Header eyebrow={`Semana del ${shortMonth(weekStart)}`} title="Agenda" right={<WeekNav onMove={move} />} />}>
      <View style={s.strip}>
        {DAYS_SHORT.map((l, i) => {
          const d = addDays(weekStart, i);
          const n = byDay(d).filter((x) => x.type === "session").length;
          const on = i === dayIdx;
          const isToday = ymd(d) === ymd(new Date());
          return (
            <Pressable key={l} onPress={() => { setDayIdx(i); setSelected(null); }} style={[s.dayCell, on && s.dayOn]} testID={`agenda-day-${i}`}>
              <Text style={[s.dayL, on && { color: colors.onBrandPrimary }]}>{l}</Text>
              <Text style={[s.dayN, on && { color: colors.onBrandPrimary }, isToday && !on && { color: colors.habit }]}>{d.getDate()}</Text>
              <View style={s.dots}>
                {Array.from({ length: Math.min(n, 3) }).map((_, k) => (
                  <View key={k} style={[s.dot, { backgroundColor: on ? colors.onBrandPrimary : colors.habit }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.dayTitle}>{longDate(day)}</Text>
      {agenda.isLoading ? <Loading /> : items.length === 0 ? (
        <Empty icon="calendar-clear-outline" title="Nada este día" text="Ni rutinas ni hábitos. Un buen hueco para descansar." />
      ) : (
        <DayGrid items={items} onSelect={setSelected} selected={selected} />
      )}
      {sel && (
        <AgendaCard item={sel} busy={action.isPending} onDone={() => act(sel.id, "done")} onPostpone={() => act(sel.id, "postpone")} onUndo={() => act(sel.id, "undo")} />
      )}
    </Screen>
  );
}

function WeekNav({ onMove }: { onMove: (n: number) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Pressable style={s.navBtn} onPress={() => onMove(-1)} testID="agenda-prev-week">
        <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
      </Pressable>
      <Pressable style={s.navBtn} onPress={() => onMove(1)} testID="agenda-next-week">
        <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

function DayGrid({ items, onSelect, selected }: { items: AgendaItem[]; onSelect: (id: string) => void; selected: string | null }) {
  const s = useStyles();
  const { colors } = useTheme();
  const hours = Array.from({ length: 24 - START_H + 1 }, (_, i) => START_H + i);
  const top = (m: number) => Math.max(0, (m - START_H * 60) * PX);
  return (
    <View style={[s.grid, { height: (24 - START_H) * 60 * PX + 10 }]} testID="agenda-day-grid">
      {hours.map((h) => (
        <View key={h} style={[s.hourLine, { top: top(h * 60) }]}>
          <Text style={s.hourText}>{String(h).padStart(2, "0")}:00</Text>
          <View style={s.hourRule} />
        </View>
      ))}
      {items.map((it) => {
        const a = minutesOfDay(it.start);
        const b = minutesOfDay(it.end) || 24 * 60;
        const isS = it.type === "session";
        const color = isS ? colors.habit : it.type === "event" ? colors.event : colors.routine;
        const bg = isS ? colors.habitBg : it.type === "event" ? colors.eventBg : colors.routineBg;
        return (
          <View key={it.id}>
            {isS && it.travel_before ? <View style={[s.travel, { top: top(a - it.travel_before), height: it.travel_before * PX }]} /> : null}
            {isS && it.travel_after ? <View style={[s.travel, { top: top(b), height: it.travel_after * PX }]} /> : null}
            <Pressable
              onPress={() => onSelect(it.id)}
              testID={`grid-block-${it.id}`}
              style={[s.block, { top: top(a), height: Math.max(22, (b - a) * PX - 2), backgroundColor: bg, borderLeftColor: color }, selected === it.id && { borderColor: color }]}
            >
              <Text style={[s.blockTitle, it.status === "done" && { textDecorationLine: "line-through" }]} numberOfLines={1}>
                {it.status === "done" ? "✓ " : ""}
                {it.title}
              </Text>
              {b - a >= 45 && <Text style={[s.blockTime, { color }]}>{`${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`}</Text>}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  strip: { flexDirection: "row", gap: 6 },
  dayCell: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, gap: 2 },
  dayOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  dayL: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.muted },
  dayN: { fontFamily: fonts.heading, fontSize: 18, color: c.onSurface },
  dots: { flexDirection: "row", gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayTitle: { fontFamily: fonts.headingSemi, fontSize: 18, color: c.onSurface, marginBottom: -8 },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  grid: { position: "relative" },
  hourLine: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  hourText: { width: 40, fontFamily: fonts.body, fontSize: 11, color: c.subtle, marginTop: -2 },
  hourRule: { flex: 1, height: 1, backgroundColor: c.divider },
  block: { position: "absolute", left: 50, right: 0, borderRadius: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  blockTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface },
  blockTime: { fontFamily: fonts.bodySemi, fontSize: 11 },
  travel: { position: "absolute", left: 50, right: 0, backgroundColor: c.travelBg, borderLeftWidth: 4, borderLeftColor: c.travel, borderRadius: 6 },
}));
