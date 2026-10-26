import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api, type Habit } from "@/src/api";
import { DayPicker, Stepper, TimeField } from "@/src/components/inputs";
import { refreshAll } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useToast } from "@/src/toast";
import { validTime } from "@/src/time";
import { Btn, Card, Chip, Field, Header, Loading, Screen } from "@/src/ui";

const DURATIONS = [30, 45, 60, 90, 120];
const PREFS = [
  ["any", "Cualquiera"],
  ["morning", "Mañana"],
  ["afternoon", "Tarde"],
  ["evening", "Noche"],
] as const;

const EMPTY = { name: "", sessions_per_week: 3, duration_min: 60, travel_before_min: 0, travel_after_min: 0, forbidden_windows: [] as { start: string; end: string }[], forbidden_days: [] as number[], preferred: "any" as Habit["preferred"] };

export default function HabitForm() {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useQuery({ queryKey: ["habit", id], queryFn: () => api<Habit>(`/habits/${id}`), enabled: !!id });
  const [f, setF] = useState(EMPTY);
  const set = (patch: Partial<typeof EMPTY>) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (existing.data) {
      const { id: _i, priority: _p, ...rest } = existing.data as any;
      setF({ ...EMPTY, ...rest });
    }
  }, [existing.data]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/habitos"));
  const save = useMutation({
    mutationFn: () => api(id ? `/habits/${id}` : "/habits", { method: id ? "PUT" : "POST", body: f }),
    onSuccess: () => { refreshAll(); toast(id ? "Hábito actualizado" : "Hábito creado. Pulsa «Planificar con IA» en Hoy."); back(); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const del = useMutation({ mutationFn: () => api(`/habits/${id}`, { method: "DELETE" }), onSuccess: () => { refreshAll(); toast("Hábito eliminado", "info"); back(); } });

  const windowsOk = f.forbidden_windows.every((w) => validTime(w.start) && validTime(w.end));
  const setWin = (i: number, patch: Partial<{ start: string; end: string }>) => set({ forbidden_windows: f.forbidden_windows.map((w, k) => (k === i ? { ...w, ...patch } : w)) });
  const weekend = f.forbidden_days.includes(5) && f.forbidden_days.includes(6);

  if (id && existing.isLoading) return <Loading />;
  return (
    <Screen testID="habit-form-screen" header={<Header eyebrow={id ? "Editar" : "Nuevo hábito"} title={f.name || "¿Qué quieres hacer?"} onBack={back} />}>
      <Card style={s.card}>
        <Field label="Nombre" value={f.name} onChangeText={(t) => set({ name: t })} placeholder="Ir al gimnasio, leer, estudiar…" testID="habit-name-input" />
        <View style={s.rowBetween}>
          <Text style={s.label}>Veces por semana</Text>
          <Stepper value={f.sessions_per_week} onChange={(v) => set({ sessions_per_week: v })} min={1} max={7} testID="habit-sessions" />
        </View>
      </Card>

      <Card style={s.card}>
        <Text style={s.label}>Duración de cada sesión</Text>
        <View style={s.wrap}>
          {DURATIONS.map((d) => (
            <Chip key={d} label={d < 60 ? `${d} min` : `${d / 60} h`.replace(".5", ":30")} active={f.duration_min === d} onPress={() => set({ duration_min: d })} testID={`habit-duration-${d}`} />
          ))}
        </View>
        <Field label="O en minutos" value={String(f.duration_min)} onChangeText={(t) => set({ duration_min: Number(t.replace(/\D/g, "")) || 0 })} keyboardType="number-pad" testID="habit-duration-input" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field label="Ida (min)" value={String(f.travel_before_min)} onChangeText={(t) => set({ travel_before_min: Number(t.replace(/\D/g, "")) || 0 })} keyboardType="number-pad" testID="habit-travel-input" />
          <Field label="Vuelta (min)" value={String(f.travel_after_min)} onChangeText={(t) => set({ travel_after_min: Number(t.replace(/\D/g, "")) || 0 })} keyboardType="number-pad" testID="habit-travel-back-input" />
        </View>
      </Card>

      <Card style={s.card}>
        <View style={s.rowBetween}>
          <Text style={s.label}>Días que no</Text>
          <Pressable onPress={() => set({ forbidden_days: weekend ? f.forbidden_days.filter((d) => d < 5) : Array.from(new Set([...f.forbidden_days, 5, 6])).sort() })} testID="habit-weekend-toggle">
            <Text style={s.link}>{weekend ? "Quitar fin de semana" : "Sin fines de semana"}</Text>
          </Pressable>
        </View>
        <View testID="habit-forbidden-days-input">
          <DayPicker value={f.forbidden_days} onChange={(v) => set({ forbidden_days: v })} testPrefix="habit-forbidden" />
        </View>
        <Text style={s.label}>Franjas en las que no</Text>
        {f.forbidden_windows.map((w, i) => (
          <View key={i} style={s.win}>
            <TimeField label="Desde" value={w.start} onChange={(v) => setWin(i, { start: v })} testID={`habit-forbidden-start-${i}`} />
            <TimeField label="Hasta" value={w.end} onChange={(v) => setWin(i, { end: v })} testID={`habit-forbidden-end-${i}`} />
            <Pressable style={s.del} onPress={() => set({ forbidden_windows: f.forbidden_windows.filter((_, k) => k !== i) })} testID={`habit-forbidden-remove-${i}`}>
              <Ionicons name="close" size={18} color={colors.error} />
            </Pressable>
          </View>
        ))}
        <Btn small variant="soft" icon="add" label="Añadir franja prohibida" onPress={() => set({ forbidden_windows: [...f.forbidden_windows, { start: "16:30", end: "19:30" }] })} testID="habit-forbidden-time-input" />
      </Card>

      <Card style={s.card}>
        <Text style={s.label}>Momento preferido</Text>
        <View style={s.wrap}>
          {PREFS.map(([k, l]) => (
            <Chip key={k} label={l} active={f.preferred === k} onPress={() => set({ preferred: k })} testID={`habit-pref-${k}`} />
          ))}
        </View>
      </Card>

      <Btn label={id ? "Guardar cambios" : "Crear hábito"} icon="checkmark" onPress={() => save.mutate()} loading={save.isPending} disabled={!f.name.trim() || f.duration_min < 5 || !windowsOk} testID="habit-form-submit" />
      {id && <Btn variant="danger" label="Eliminar hábito" icon="trash-outline" onPress={() => del.mutate()} loading={del.isPending} testID="habit-delete-btn" />}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: c.muted },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  link: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.habit },
  win: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  del: { width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(244,63,94,0.12)", alignItems: "center", justifyContent: "center" },
}));
