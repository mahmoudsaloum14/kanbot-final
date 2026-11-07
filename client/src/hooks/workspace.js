import { createContext, useContext, useEffect } from "react";
export const Auth = createContext(),
  Toast = createContext();
export const useAuth = () => useContext(Auth);
export const useToast = () => useContext(Toast);
export const changed = () => window.dispatchEvent(new Event("kanbot:changed"));
export function useRefresh(load) {
  useEffect(() => {
    window.addEventListener("kanbot:changed", load);
    return () => window.removeEventListener("kanbot:changed", load);
  }, [load]);
}
