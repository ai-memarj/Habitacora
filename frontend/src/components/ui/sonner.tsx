"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Envoltorio del Toaster de sonner con nuestros tokens de tema, para que
 * los toasts respeten el modo oscuro y la paleta del resto de la app.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast glass-panel group-[.toaster]:shadow-lg group-[.toaster]:text-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
