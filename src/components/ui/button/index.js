import { cva } from "class-variance-authority";

export { default as Button } from "./Button.vue";

// 모양/크기는 style.css의 .ui-btn 계열이 담당하고, 여기서는 결만 고른다.
export const buttonVariants = cva(
  "ui-btn select-none outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "ui-btn--primary",
        destructive: "ui-btn--solid",
        outline: "ui-btn--outline",
        secondary: "ui-btn--soft",
        success: "ui-btn--primary",
        warning: "ui-btn--soft",
        ghost: "ui-btn--ghost",
        link: "ui-btn--ghost underline underline-offset-4",
      },
      size: {
        default: "",
        sm: "ui-btn--sm",
        lg: "h-[62px] px-8 text-[24px] rounded-2xl",
        icon: "ui-btn--icon",
        "icon-sm": "ui-btn--sm ui-btn--icon w-[42px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
