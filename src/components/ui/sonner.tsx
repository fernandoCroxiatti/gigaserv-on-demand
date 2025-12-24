import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={24}
      duration={2500}
      gap={8}
      toastOptions={{
        classNames: {
          toast: "feedback-toast",
          title: "feedback-toast__title",
          description: "feedback-toast__description",
          actionButton: "feedback-toast__action",
          cancelButton: "feedback-toast__cancel",
          icon: "feedback-toast__icon",
          success: "feedback-toast--success",
          error: "feedback-toast--error",
          warning: "feedback-toast--warning",
          info: "feedback-toast--info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
