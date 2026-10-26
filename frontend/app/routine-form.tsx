import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { DayPicker, TimeField } from "@/src/components/inputs";
import { refreshAll, useRoutines } from "@/src/hooks";
import { fonts, makeStyles } from "@/src/theme";
import { useToast } from "@/src/toast";
import { validTime } from "@/src/time";
import { Btn, Card, Field, Header, Screen } from "@/src/ui";

export default function RoutineForm() {
  const s = useStyles();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const routines = useRoutines();
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  useEffect(() => {
    const r = routines.data?.find((x) => x.id === id);
    if (r) {
      setTitle(r.title);
      setDays(r.days);
      setStart(r.start);
      setEnd(r.end);
    }
  }, [routines.data, id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/habitos"));
  const save = useMutation({
    mutationFn: () => api(id ? `/routines/${id}` : "/routines", { method: id ? "PUT" : "POST", body: { title, days, start, end } }),
    onSuccess: () => { refreshAll(); toast("Rutina guardada"); back(); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const del = useMutation({ mutationFn: () => api(`/routines/${id}`, { method: "DELETE" }), onSuccess: () => { refreshAll(); toast("Rutina eliminada", "info"); back(); } });

  return (
    <Screen testID="routine-form-screen" header={<Header eyebrow={id ? "Editar rutina" : "Nueva rutina fija"} title={title || "Algo inamovible"} onBack={back} />}>
      <Card style={{ gap: 14 }}>
        <Field label="Nombre" value={title} onChangeText={setTitle} placeholder="Trabajo, academia, clases…" testID="routine-title-input" />
        <Text style={s.label}>Días</Text>
        <DayPicker value={days} onChange={setDays} testPrefix="routine" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TimeField label="Empieza" value={start} onChange={setStart} testID="routine-start-input" />
          <TimeField label="Termina" value={end} onChange={setEnd} testID="routine-end-input" />
        </View>
      </Card>
      <Btn label="Guardar rutina" icon="checkmark" onPress={() => save.mutate()} loading={save.isPending} disabled={!title.trim() || !days.length || !validTime(start) || !validTime(end)} testID="routine-form-submit" />
      {id && <Btn variant="danger" label="Eliminar rutina" icon="trash-outline" onPress={() => del.mutate()} loading={del.isPending} testID="routine-delete-btn" />}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: c.muted },
}));
