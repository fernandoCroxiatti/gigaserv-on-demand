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
      offset={80}
      duration={2500}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-[hsl(0,0%,12%)] !text-white !border-none !shadow-xl !rounded-xl !px-4 !py-3 !min-h-0 !max-w-[calc(100vw-2rem)] !w-auto",
          title: "!text-sm !font-medium !text-white",
          description: "!text-xs !text-white/70",
          actionButton: "!bg-white/20 !text-white !text-xs !font-medium !rounded-lg",
          cancelButton: "!bg-white/10 !text-white/70 !text-xs !rounded-lg",
          icon: "!text-white/80 !w-4 !h-4",
          success: "!bg-[hsl(152,50%,25%)]",
          error: "!bg-[hsl(0,60%,35%)]",
          warning: "!bg-[hsl(35,80%,35%)]",
          info: "!bg-[hsl(217,60%,35%)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
