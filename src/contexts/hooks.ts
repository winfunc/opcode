/**
 * Context hooks separated to avoid fast refresh warnings
 */
import { useContext } from "react";
import { TabContext, ToastContext } from "./contexts";
import { createTabContextError, createToastContextError } from "./contextUtils";

export const useTabContext = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw createTabContextError("useTabContext");
  }
  return context;
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw createToastContextError("useToast");
  }
  return context;
};
