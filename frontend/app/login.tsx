import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Btn, Field } from "@/src/ui";

const POINTS: { icon: any; text: string }[] = [
  { icon: "calendar-outline", text: "Lee tus rutinas fijas y tu calendario" },
  { icon: "sparkles-outline", text: "La IA coloca tus hábitos en los mejores huecos" },
  { icon: "flame-outline", text: "Marca, aplaza y mantén la racha" },
];

export default function Login() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/hoy" />;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password, mode, name.trim() || undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          <View style={s.logo}>
            <Ionicons name="time" size={26} color={colors.onBrandPrimary} />
          </View>
          <Text style={s.brand}>Hueco</Text>
          <Text style={s.h1}>Haz por fin lo que siempre aplazas.</Text>
          <View style={{ gap: 10, marginTop: 6 }}>
            {POINTS.map((p) => (
              <View key={p.text} style={s.point}>
                <Ionicons name={p.icon} size={18} color={colors.habit} />
                <Text style={s.pointText}>{p.text}</Text>
              </View>
            ))}
          </View>

          <View style={s.form}>
            <View style={s.tabs}>
              {(["login", "register"] as const).map((m) => (
                <Pressable key={m} onPress={() => setMode(m)} style={[s.tab, mode === m && s.tabOn]} testID={`auth-tab-${m}`}>
                  <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === "login" ? "Entrar" : "Crear cuenta"}</Text>
                </Pressable>
              ))}
            </View>
            {mode === "register" && <Field label="Nombre" value={name} onChangeText={setName} placeholder="Cómo te llamas" testID="auth-name-input" />}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="tu@email.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="auth-email-input" />
            <Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry testID="auth-password-input" onSubmitEditing={submit} />
            {error && <Text style={s.error} testID="auth-error">{error}</Text>}
            <Btn label={mode === "login" ? "Entrar" : "Empezar"} onPress={submit} loading={busy} disabled={!email || password.length < 6} testID="auth-submit-btn" />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, paddingHorizontal: 22 },
  inner: { width: "100%", maxWidth: 460, alignSelf: "center", gap: 10 },
  logo: { width: 52, height: 52, borderRadius: 16, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  brand: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: c.habit, marginTop: 14 },
  h1: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 40, color: c.onSurface, letterSpacing: -1 },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
  pointText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurfaceSecondary },
  form: { marginTop: 28, gap: 14, backgroundColor: c.surfaceSecondary, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 18 },
  tabs: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 4 },
  tab: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: c.surface },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.muted },
  tabTextOn: { color: c.onSurface },
  error: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.error },
}));
