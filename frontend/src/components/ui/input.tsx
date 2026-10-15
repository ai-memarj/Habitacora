import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Campos de texto.
 *
 * La variante `line` formaliza el estilo "sin caja" (solo borde inferior)
 * que ya se usaba en la pantalla Hoy, pero copiado a mano como una
 * constante `fieldClass` duplicada en `today-card.tsx` y `task-card.tsx`.
 * Al vivir aquí deja de divergir entre ficheros y, sobre todo, deja de
 * estar fuera del sistema: los subrayados tienen el mismo grosor, el
 * mismo color y el mismo foco que el resto de la app.
 *
 * `numeric` existe porque las cifras en campos proporcionales bailan de
 * ancho al teclearlas. No usa el atributo `maxLength` (los navegadores lo
 * ignoran en `type="number"`, ver CLAUDE.md): eso se recorta en el
 * `onChange` de quien lo use.
 */
const inputVariants = cva(
  cn(
    "flex w-full bg-transparent text-sm transition-colors",
    "placeholder:text-muted-foreground",
    "disabled:cursor-not-allowed disabled:opacity-50"
  ),
  {
    variants: {
      variant: {
        /** Campo con caja. Para formularios densos y diálogos. */
        box: cn(
          "h-9 rounded-md border border-input px-3 py-1",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        ),
        /** Solo borde inferior. Para bloques que no deben parecer un formulario. */
        line: cn(
          "h-9 rounded-none border-0 border-b border-input px-0",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-0"
        ),
      },
      numeric: {
        true: "tabular-nums",
        false: "",
      },
    },
    defaultVariants: { variant: "box", numeric: false },
  }
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, numeric, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          inputVariants({
            variant,
            // Un campo numérico pide cifras tabulares salvo que se diga
            // lo contrario explícitamente.
            numeric: numeric ?? (type === "number" ? true : false),
          }),
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
