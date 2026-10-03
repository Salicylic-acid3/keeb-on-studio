/**
 * Which half of the app a URL belongs to: ZMK at `/`, QMK at `/qmk`.
 */
export type Firmware = "zmk" | "qmk";

export const QMK_PATH = "/qmk";

export function firmwareFromPathname(pathname: string): Firmware {
  return pathname === QMK_PATH || pathname.startsWith(`${QMK_PATH}/`)
    ? "qmk"
    : "zmk";
}
