import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_4px_20px_rgb(0_0_0/0.12)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_4px_20px_rgb(0_0_0/0.12)]",
        outline:
          "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        uber: "bg-foreground text-background hover:bg-foreground/90 shadow-[0_8px_30px_rgb(0_0_0/0.15)]",
        provider: "bg-[hsl(217_91%_60%)] text-white hover:bg-[hsl(217_91%_55%)] shadow-[0_4px_20px_rgb(0_0_0/0.12)]",
        success: "bg-[hsl(145_63%_42%)] text-white hover:bg-[hsl(145_63%_37%)] shadow-[0_4px_20px_rgb(0_0_0/0.12)]",
        warning: "bg-[hsl(45_93%_47%)] text-foreground hover:bg-[hsl(45_93%_42%)] shadow-[0_4px_20px_rgb(0_0_0/0.12)]",
        glass: "bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-card/90 shadow-[0_8px_32px_rgb(0_0_0/0.08)]",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-9 rounded-lg px-4",
        lg: "h-14 rounded-2xl px-8 text-base",
        xl: "h-16 rounded-2xl px-10 text-lg",
        icon: "h-12 w-12",
        "icon-sm": "h-9 w-9",
        "icon-lg": "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
