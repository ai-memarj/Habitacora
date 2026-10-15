import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Etiquetas cortas.
 *
 * La separación entre `metric` y `emotional` es el mecanismo que protege
 * el presupuesto de color de la app. Antes TODO badge usaba `soft`
 * (violeta), así que los minutos de cada tarea competían en intensidad
 * con la racha del día: cuatro badges de acento en una lista de cuatro
 * tareas, y cero acento en los momentos que de verdad lo merecen.
 *
 * - `metric` es el destino por defecto de cualquier NÚMERO (minutos,
 *   cupos, porcentajes). Neutro y con `tabular-nums`, para que las cifras
 *   no bailen al actualizarse.
 * - `emotional` se reserva a los tres momentos del ritual que la
 *   dirección de arte marca: frase del día, racha y cierre del día.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground font-semibold",
        secondary: "border-transparent bg-secondary text-secondary-foreground font-semibold",
        outline: "border-border text-foreground font-semibold",
        soft: "border-transparent bg-primary/10 text-primary font-semibold",
        /** Cifras. Neutro a propósito: un número no es un evento. */
        metric: "border-transparent bg-surface-3 text-muted-foreground font-medium tabular-nums",
        /** Los tres momentos emocionales. Úsalo con cuentagotas. */
        emotional:
          "border-transparent bg-accent-emotional/12 text-accent-emotional font-semibold",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
