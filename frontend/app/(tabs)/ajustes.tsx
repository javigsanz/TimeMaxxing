import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, Share, Text, View } from "react-native";

import { api, backendUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { TimeField } from "@/src/components/inputs";
import { refreshAll, useSettings } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useToast } from "@/src/toast";
import { validTime } from "@/src/time";
import { Btn, Card, Field, Header, Loading, Screen, Section } from "@/src/ui";

export default function Ajustes() {
  const s = useStyles();
  const { user, signOut } = useAuth();
  const settings = useSettings();
  const toast = useToast();
  const st = settings.data;

  return (
    <Screen testID="ajustes-tab-content" header={<Header eyebrow={user?.email} title="Ajustes" />}>
      {!st ? <Loading /> : (
        <>
          <ImportCalendars feeds={st.ical_feeds} />
          <ExportFeed token={st.feed_token} />
          <Schedule st={st} />
          <Btn variant="ghost" label="Cerrar sesión" icon="log-out-outline" onPress={async () => { await signOut(); toast("Sesión cerrada", "info"); }} testID="logout-btn" />
          <Text style={s.foot}>Zona horaria: {st.tz}</Text>
        </>
      )}
    </Screen>
  );
}

function ImportCalendars({ feeds }: { feeds: any[] }) {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [name, setName] = useState("Mi calendario");
  const [url, setUrl] = useState("");
  const [help, setHelp] = useState(false);
  const add = useMutation({ mutationFn: () => api("/calendar/feeds", { method: "POST", body: { name, url } }), onSuccess: (f: any) => { refreshAll(); setUrl(""); toast(f.error ? f.error : `Calendario conectado · ${f.count} eventos`, f.error ? "error" : "success"); }, onError: (e: any) => toast(e.message, "error") });
  const sync = useMutation({ mutationFn: () => api("/calendar/sync", { method: "POST" }), onSuccess: () => { refreshAll(); toast("Calendario sincronizado"); } });
  const del = useMutation({ mutationFn: (id: string) => api(`/calendar/feeds/${id}`, { method: "DELETE" }), onSuccess: refreshAll });

  return (
    <Section title="1 · Lee tu calendario" right={feeds.length ? <Btn small variant="soft" label="Sincronizar" icon="refresh" loading={sync.isPending} onPress={() => sync.mutate()} testID="ical-sync-btn" /> : undefined}>
      <Text style={s.p}>Pega el enlace iCal de Google Calendar o iCloud. Tus eventos cuentan como ocupados y la IA no pondrá nada encima.</Text>
      {feeds.map((f) => (
        <View key={f.id} style={s.feed} testID={`ical-feed-${f.id}`}>
          <Ionicons name={f.error ? "alert-circle" : "checkmark-circle"} size={20} color={f.error ? colors.error : colors.habit} />
          <View style={{ flex: 1 }}>
            <Text style={s.feedName}>{f.name}</Text>
            <Text style={s.feedMeta}>{f.error || `${f.count} eventos importados`}</Text>
          </View>
          <Pressable onPress={() => del.mutate(f.id)} hitSlop={8} testID={`ical-feed-delete-${f.id}`}>
            <Ionicons name="trash-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <Card style={{ gap: 12 }}>
        <Field label="Nombre" value={name} onChangeText={setName} testID="ical-name-input" />
        <Field label="Enlace iCal" value={url} onChangeText={setUrl} placeholder="https://calendar.google.com/…/basic.ics" autoCapitalize="none" testID="ical-url-input" />
        <Btn label="Conectar calendario" icon="link" onPress={() => add.mutate()} loading={add.isPending} disabled={url.length < 8} testID="ical-add-btn" />
        <Pressable onPress={() => setHelp(!help)} testID="ical-help-toggle">
          <Text style={s.link}>{help ? "Ocultar ayuda" : "¿Dónde encuentro mi enlace?"}</Text>
        </Pressable>
        {help && (
          <View style={{ gap: 8 }} testID="ical-help">
            <Text style={s.p}><Text style={s.b}>Google Calendar:</Text> en el ordenador, Configuración → elige tu calendario → «Dirección secreta en formato iCal». Copia el enlace.</Text>
            <Text style={s.p}><Text style={s.b}>iPhone / iCloud:</Text> en la app Calendario → Calendarios → (i) junto al calendario → activa «Calendario público» y comparte el enlace.</Text>
          </View>
        )}
      </Card>
    </Section>
  );
}

function ExportFeed({ token }: { token: string }) {
  const s = useStyles();
  const toast = useToast();
  const feedUrl = `${backendUrl}/api/feed/${token}.ics`;
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  const regen = useMutation({ mutationFn: () => api("/settings/feed-token", { method: "POST" }), onSuccess: () => { refreshAll(); toast("Nuevo enlace creado. Vuelve a suscribirte.", "info"); } });

  const copy = async () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(feedUrl).then(() => toast("Enlace copiado")).catch(() => toast("No se pudo copiar", "error"));
    } else {
      Share.share({ message: feedUrl });
    }
  };

  return (
    <Section title="2 · Tus hábitos en el móvil">
      <Text style={s.p}>Suscribe el calendario del móvil a este enlace y verás cada sesión que planifica la IA (con la ida y la vuelta incluidas). Se actualiza solo.</Text>
      <Card style={{ gap: 12 }}>
        <Text style={s.url} selectable numberOfLines={2} testID="webcal-url">{feedUrl}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn small label="Añadir al iPhone" icon="logo-apple" onPress={() => Linking.openURL(webcal)} testID="webcal-export-btn" style={{ flex: 1 }} />
          <Btn small variant="soft" label="Copiar enlace" icon="copy-outline" onPress={copy} testID="webcal-copy-btn" style={{ flex: 1 }} />
        </View>
        <Text style={s.hint}>Google Calendar: en el ordenador, «Otros calendarios» → «+» → «Desde URL» y pega el enlace. Aparecerá también en tu Android.</Text>
        <Pressable onPress={() => regen.mutate()} testID="webcal-regenerate-btn">
          <Text style={s.link}>Crear un enlace nuevo (invalida el anterior)</Text>
        </Pressable>
      </Card>
    </Section>
  );
}

function Schedule({ st }: { st: any }) {
  const toast = useToast();
  const [wake, setWake] = useState(st.wake);
  const [sleep, setSleep] = useState(st.sleep);
  const [buffer, setBuffer] = useState(String(st.buffer_min));
  useEffect(() => {
    setWake(st.wake);
    setSleep(st.sleep);
    setBuffer(String(st.buffer_min));
  }, [st.wake, st.sleep, st.buffer_min]);
  const save = useMutation({ mutationFn: () => api("/settings", { method: "PUT", body: { wake, sleep, buffer_min: Number(buffer) || 0 } }), onSuccess: () => { refreshAll(); toast("Horario guardado"); }, onError: (e: any) => toast(e.message, "error") });
  return (
    <Section title="3 · Tu horario">
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TimeField label="Me levanto" value={wake} onChange={setWake} testID="settings-wake-input" />
          <TimeField label="Me acuesto" value={sleep} onChange={setSleep} testID="settings-sleep-input" />
        </View>
        <Field label="Margen entre tareas (min)" value={buffer} onChangeText={(t) => setBuffer(t.replace(/\D/g, ""))} keyboardType="number-pad" testID="settings-buffer-input" hint="Respiro mínimo antes y después de cada bloque." />
        <Btn label="Guardar horario" onPress={() => save.mutate()} loading={save.isPending} disabled={!validTime(wake) || !validTime(sleep)} testID="settings-save-btn" />
      </Card>
    </Section>
  );
}

const useStyles = makeStyles((c) => ({
  p: { fontFamily: fonts.body, fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 20 },
  b: { fontFamily: fonts.bodyBold, color: c.onSurface },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: c.muted, lineHeight: 18 },
  link: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.habit },
  url: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.event, backgroundColor: c.surfaceTertiary, padding: 10, borderRadius: 10 },
  feed: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 12 },
  feedName: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  feedMeta: { fontFamily: fonts.body, fontSize: 12.5, color: c.muted },
  foot: { fontFamily: fonts.body, fontSize: 12, color: c.subtle, textAlign: "center" },
}));
