import { RoutineDetailClient } from "@/components/routines/routine-detail-client";

// Ruta dinámica por rutina: todo el contenido se pinta en cliente a
// partir de datos de la API, no hay nada que prerenderizar en build (no
// sabemos de antemano qué IDs de rutina existen). `instant` solo puede
// exportarse desde un Server Component, así que este page.tsx se queda
// sin "use client" y delega toda la UI/estado a RoutineDetailClient.
export const instant = false;

export default async function RoutineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoutineDetailClient routineId={Number(id)} />;
}
