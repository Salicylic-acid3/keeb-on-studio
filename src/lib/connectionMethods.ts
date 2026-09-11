/**
 * Which ways of reaching a keyboard this app offers.
 *
 * Bluetooth is off. Not because the transport is broken — the GATT client
 * here works and is left in place — but because reaching Studio over BLE on
 * this firmware costs more than it is worth:
 *
 * ZMK stops advertising once the active profile is bonded and connected, so a
 * keyboard in normal use never appears in the browser's device picker. The one
 * escape hatch is ZMK_STUDIO_LOCK_BLE_DIRECT_ADVERTISING_ON_UNLOCK, which only
 * fires inside zmk_studio_core_unlock() and therefore only exists if Studio
 * locking is on. So "connect over Bluetooth" and "no lock" cannot both be true,
 * and a lock you cannot reliably open is a keyboard you cannot configure.
 *
 * These keyboards are wired-only for configuration, and unlocked. The
 * keyboard's own Bluetooth — profiles, pairing, output priority — is a
 * different thing entirely and is untouched.
 *
 * Nothing below this flag has been deleted. Setting it back to true restores
 * the button and the whole BLE path with it; the firmware side would need
 * CONFIG_ZMK_STUDIO_LOCKING back on to match.
 */
export const BLE_CONNECTION_ENABLED = false;
