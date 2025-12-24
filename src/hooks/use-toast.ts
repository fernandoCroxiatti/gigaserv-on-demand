import * as React from "react";
import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
};

type ToastReturn = {
  id: string | number;
  dismiss: () => void;
  update: (next: ToastInput) => void;
};

function showToast(input: ToastInput, id?: string | number) {
  const { title, description, variant } = input;
  const opts = { description, id } as const;

  if (variant === "destructive") return sonnerToast.error(title as any, opts as any);
  if (variant === "success") return sonnerToast.success(title as any, opts as any);
  return sonnerToast(title as any, opts as any);
}

function toast(input: ToastInput): ToastReturn {
  const id = showToast(input);

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (next) => {
      showToast({ ...input, ...next }, id);
    },
  };
}

function useToast() {
  return {
    toasts: [] as never[],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
