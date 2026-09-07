import { useContext } from "react";
import { ConnectionContext } from "../components/DeviceConnection";

export function useConnection() {
  return useContext(ConnectionContext);
}
