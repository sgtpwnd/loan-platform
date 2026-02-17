import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog components must be used inside <Dialog />.");
  }
  return ctx;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

type DialogContentProps = {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
};

export function DialogContent({ children, className, overlayClassName }: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext();
  if (!open) return null;
  return createPortal(
    <div
      className={cx(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4",
        overlayClassName
      )}
      onClick={() => onOpenChange(false)}
    >
      <div
        className={cx(
          "relative w-full max-w-2xl rounded-xl border-2 border-slate-200 bg-white shadow-2xl",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

