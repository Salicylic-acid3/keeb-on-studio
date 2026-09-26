import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "../hooks/useTheme";
import { useLanguage } from "../hooks/useLanguage";

/**
 * Light/dark switch. The same button on every page -- the top screen, the
 * standalone pages and the connected app -- so the theme can be changed
 * before a keyboard is ever connected, not only from inside the app.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${className}`}
      aria-label={
        theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")
      }
    >
      {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}
