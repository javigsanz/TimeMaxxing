import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { fonts, useTheme } from "@/src/theme";
import { Loading } from "@/src/ui";

const TABS: { name: string; title: string; icon: any }[] = [
  { name: "hoy", title: "Hoy", icon: "today-outline" },
  { name: "agenda", title: "Agenda", icon: "calendar-outline" },
  { name: "habitos", title: "Hábitos", icon: "flag-outline" },
  { name: "progreso", title: "Progreso", icon: "trending-up-outline" },
  { name: "ajustes", title: "Ajustes", icon: "settings-outline" },
];

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.habit,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarButtonTestID: `nav-tab-${t.name}`,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} size={size - 2} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
