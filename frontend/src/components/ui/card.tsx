import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Superficies de la app.
 *
 * Las variantes existen para poder construir jerarquía Bento: apilar
 * tarjetas idénticas es justo lo que hace que una pantalla se lea como un
 * MVP. Cada bloque debe elegir su peso según su función, no por defecto.
 *
 * Ninguna variante usa sombra proyectada: sobre un fondo casi negro una
 * `box-shadow` exterior no se percibe como elevación, solo emborrona el
 * borde. La separación la dan el escalón de luminancia (`bg-surface-*`) y
 * el realce interior de 1px (`.edge`), que es como lo resuelven
 * Linear/Vercel. Ver `globals.css`.
 */
const cardVariants = cva("rounded-xl text-card-foreground transition-colors", {
  variants: {
    variant: {
      /** Por defecto. Contenedor de trabajo: listas, formularios, datos. */
      quiet: "border border-border bg-surface-1 edge",
      /** Un escalón por encima: para el bloque que debe mandar en la pantalla. */
      elevated: "border border-border-strong bg-surface-2 edge",
      /**
       * Bloque editorial (la frase del día): sin borde, para que respire y
       * no parezca un formulario más. Se apoya solo en la luminancia.
       */
      editorial: "border border-transparent bg-surface-1 edge-soft",
      /** Sin superficie: para componer una zona sin introducir otra caja. */
      ghost: "border-0 bg-transparent",
    },
  },
  defaultVariants: { variant: "quiet" },
});

/** Densidades de padding. La jerarquía Bento también se construye con aire. */
const paddingVariants = cva("", {
  variants: {
    density: {
      comfortable: "p-6",
      compact: "p-4",
      airy: "p-6 sm:p-8",
      none: "p-0",
    },
  },
  defaultVariants: { density: "comfortable" },
});

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  )
);
Card.displayName = "Card";

interface CardSectionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof paddingVariants> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, density, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5", paddingVariants({ density }), className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight sm:text-xl", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, density, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(paddingVariants({ density }), "pt-0", className)}
      {...props}
    />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, density, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center", paddingVariants({ density }), "pt-0", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
