"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Moon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { sleepApi } from "@/lib/api";
import type { SleepLog } from "@/types";

interface SleepCardProps {
  date: string;
  sleep: SleepLog | null | undefined;
  onChanged: () => void;
}

const PHASE_COLORS = {
  light: "#A8C5E8",
  deep: "#3E5C94",
  rem: "#B89AE8",
};

function minutesBetween(startStr: string, endStr: string) {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return end - start;
}

export function SleepCard({ date, sleep, onChanged }: SleepCardProps) {
  const [sleepTime, setSleepTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [light, setLight] = useState("");
  const [deep, setDeep] = useState("");
  const [rem, setRem] = useState("");
  const [saving, setSaving] = useState(false);

  // Sincroniza el formulario cuando llegan datos nuevos (cambio de día o
  // resolución de la petición SWR), ajustando el estado durante el propio
  // render en vez de en un efecto — patrón recomendado por React para
  // "adjusting state when a prop changes" (evita el parpadeo de un
  // useEffect y la cascada de renders que conlleva).
  const [prevSleep, setPrevSleep] = useState(sleep);
  if (sleep !== prevSleep) {
    setPrevSleep(sleep);
    setSleepTime(sleep?.sleep_time?.slice(0, 5) ?? "");
    setWakeTime(sleep?.wake_time?.slice(0, 5) ?? "");
    setLight(sleep?.light_pct?.toString() ?? "");
    setDeep(sleep?.deep_pct?.toString() ?? "");
    setRem(sleep?.rem_pct?.toString() ?? "");
  }

  const chartData = [
    { name: "Ligero", value: Number(light) || 0, color: PHASE_COLORS.light },
    { name: "Profundo", value: Number(deep) || 0, color: PHASE_COLORS.deep },
    { name: "REM", value: Number(rem) || 0, color: PHASE_COLORS.rem },
  ].filter((d) => d.value > 0);

  const duration =
    sleepTime && wakeTime
      ? (() => {
          const m = minutesBetween(sleepTime, wakeTime);
          return `${Math.floor(m / 60)}h ${m % 60}m`;
        })()
      : null;

  async function handleSave() {
    setSaving(true);
    try {
      await sleepApi.upsert({
        date,
        sleep_time: sleepTime ? `${sleepTime}:00` : null,
        wake_time: wakeTime ? `${wakeTime}:00` : null,
        light_pct: light ? Number(light) : null,
        deep_pct: deep ? Number(deep) : null,
        rem_pct: rem ? Number(rem) : null,
      });
      onChanged();
      toast.success("Sueño guardado");
    } catch {
      toast.error("No se pudo guardar el sueño");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Moon className="size-4 text-primary" />
          Sueño
        </CardTitle>
        {duration && <Badge variant="soft">{duration}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sleep-time">Hora de dormir</Label>
            <Input id="sleep-time" type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wake-time">Hora de despertar</Label>
            <Input id="wake-time" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="grid flex-1 grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="light-pct">Ligero %</Label>
              <Input id="light-pct" type="number" min={0} max={100} value={light} onChange={(e) => setLight(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deep-pct">Profundo %</Label>
              <Input id="deep-pct" type="number" min={0} max={100} value={deep} onChange={(e) => setDeep(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rem-pct">REM %</Label>
              <Input id="rem-pct" type="number" min={0} max={100} value={rem} onChange={(e) => setRem(e.target.value)} />
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="size-20 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    innerRadius={22}
                    outerRadius={38}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(value, name) => [`${value}%`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <Button variant="secondary" className="w-full" onClick={handleSave} disabled={saving}>
          Guardar sueño
        </Button>
      </CardContent>
    </Card>
  );
}
