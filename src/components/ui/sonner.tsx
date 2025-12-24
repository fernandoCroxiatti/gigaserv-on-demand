import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={16}
      duration={2500}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "uber-toast",
          title: "uber-toast__title",
          description: "uber-toast__desc",
          icon: "uber-toast__icon",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
