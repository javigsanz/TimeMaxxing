import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { AgendaItem } from "@/src/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { hhmm } from "@/src/time";
import { Btn } from "@/src/ui";

type Props = {
  item: AgendaItem;
  onDone?: () => void;
  onPostpone?: () => void;
  onUndo?: () => void;
  onEdit?: () => void;
  busy?: boolean;
};

export function AgendaCard({ item, onDone, onPostpone, onUndo, onEdit, busy }: Props) {
  const s = useStyles();
  const { colors } = useTheme();
  const isSession = item.type === "session";
  const done = item.status === "done";
  const past = new Date(item.end) < new Date();
  const accent = isSession ? colors.habit : item.type === "event" ? colors.event : colors.routine;
  const bg = isSession ? colors.habitBg : item.type === "event" ? colors.eventBg : colors.routineBg;
  const tag = isSession ? "Hábito · IA" : item.type === "event" ? "Tu calendario" : "Rutina fija";
  return (
    <View style={s.row} testID={`agenda-item-${item.id}`}>
      <View style={s.timeCol}>
        <Text style={s.time}>{hhmm(item.start)}</Text>
        <Text style={s.timeEnd}>{hhmm(item.end)}</Text>
      </View>
      <Pressable onPress={onEdit} disabled={!onEdit} style={[s.card, { borderLeftColor: accent, backgroundColor: done ? colors.surfaceSecondary : bg }]}>
        <View style={s.top}>
          <Text style={[s.tag, { color: accent }]}>{tag}</Text>
          {done && (
            <View style={s.doneBadge} testID="session-done-badge">
              <Ionicons name="checkmark" size={12} color={colors.onBrandPrimary} />
              <Text style={s.doneText}>Hecho</Text>
            </View>
          )}
        </View>
        <Text style={[s.title, done && { textDecorationLine: "line-through", color: colors.muted }]}>{item.title}</Text>
        {isSession && (item.travel_before || item.travel_after) ? (
          <View style={s.travel}>
            <Ionicons name="walk-outline" size={13} color={colors.travel} />
            <Text style={s.travelText}>
              Sal a las {hhmm(new Date(new Date(item.start).getTime() - (item.travel_before || 0) * 60000).toISOString())} · {item.travel_before} min ida / {item.travel_after} min vuelta
            </Text>
          </View>
        ) : null}
        {isSession && item.reason && !done ? <Text style={s.reason}>{item.reason}</Text> : null}
        {isSession && !done && (
          <View style={s.actions}>
            <Btn small label="Hecho" icon="checkmark-circle" onPress={onDone!} disabled={busy} testID={`mark-done-btn-${item.id}`} style={{ flex: 1 }} />
            {!past && <Btn small variant="soft" label="Aplazar" icon="time-outline" onPress={onPostpone!} disabled={busy} testID={`mark-postpone-btn-${item.id}`} style={{ flex: 1 }} />}
          </View>
        )}
        {isSession && done && onUndo && (
          <Pressable onPress={onUndo} testID={`undo-done-btn-${item.id}`} hitSlop={6}>
            <Text style={s.undo}>Deshacer</Text>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", gap: 12 },
  timeCol: { width: 48, paddingTop: 14 },
  time: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  timeEnd: { fontFamily: fonts.body, fontSize: 12, color: c.subtle, marginTop: 2 },
  card: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: c.border, borderLeftWidth: 4, padding: 14, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tag: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase" },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.brandPrimary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  doneText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.onBrandPrimary },
  title: { fontFamily: fonts.headingSemi, fontSize: 17, color: c.onSurface },
  travel: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: c.travelBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  travelText: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.travel },
  reason: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  undo: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.muted, textDecorationLine: "underline", marginTop: 2 },
}));
