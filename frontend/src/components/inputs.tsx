import { Pressable, Text, View } from "react-native";

import { fonts, makeStyles } from "@/src/theme";
import { DAYS_SHORT, maskTime } from "@/src/time";
import { Field } from "@/src/ui";

export function DayPicker({ value, onChange, testPrefix }: { value: number[]; onChange: (v: number[]) => void; testPrefix: string }) {
  const s = useStyles();
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <View style={s.row}>
      {DAYS_SHORT.map((l, i) => (
        <Pressable key={l} onPress={() => toggle(i)} style={[s.day, value.includes(i) && s.dayOn]} testID={`${testPrefix}-day-${i}`}>
          <Text style={[s.dayText, value.includes(i) && s.dayTextOn]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TimeField({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID: string }) {
  return (
    <Field label={label} value={value} onChangeText={(t) => onChange(maskTime(t))} placeholder="HH:MM" keyboardType="number-pad" maxLength={5} testID={testID} />
  );
}

export function Stepper({ value, onChange, min, max, testID, suffix }: { value: number; onChange: (v: number) => void; min: number; max: number; testID: string; suffix?: string }) {
  const s = useStyles();
  return (
    <View style={s.stepper}>
      <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} testID={`${testID}-minus`}>
        <Text style={s.stepSign}>−</Text>
      </Pressable>
      <Text style={s.stepValue} testID={`${testID}-value`}>
        {value}
        {suffix ? <Text style={s.stepSuffix}> {suffix}</Text> : null}
      </Text>
      <Pressable style={s.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} testID={`${testID}-plus`}>
        <Text style={s.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", gap: 6, justifyContent: "space-between" },
  day: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dayOn: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  dayText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.muted },
  dayTextOn: { color: c.habit },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  stepSign: { fontFamily: fonts.bodyBold, fontSize: 22, color: c.onSurface },
  stepValue: { fontFamily: fonts.heading, fontSize: 24, color: c.onSurface, minWidth: 40, textAlign: "center" },
  stepSuffix: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.muted },
}));
