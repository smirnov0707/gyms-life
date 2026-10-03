import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner ships its own palette, and it does not ask the page which one to use.
 *
 * The `theme` prop defaults to `"light"`, so every toast was painted from
 * sonner's own light variables — a white card with dark text, floating over the
 * onyx ground, whatever the athlete's theme. The token classes below were
 * already right and had been for as long as they had been there; they were
 * being set on an element whose background came from somewhere else.
 *
 * `resolved` is the app's own answer to light/dark/system, so the toast follows
 * the theme switch in the header rather than the operating system alone.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
