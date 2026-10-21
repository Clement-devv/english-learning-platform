// src/hooks/useTabFromUrl.js
// Opens the dashboard tab named in ?tab= — used by notification clicks (public/sw.js) and
// links like /teacher/dashboard?tab=messages — then removes the parameter so a refresh or
// the back button doesn't keep jumping there.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * @param {(tab: string) => void} setActiveTab
 * @param {string[]} allowed  tab keys this dashboard has (anything else is ignored)
 */
export function useTabFromUrl(setActiveTab, allowed) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (!tab) return;
    if (allowed.includes(tab)) setActiveTab(tab);
    params.delete("tab");
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : "" }, { replace: true, state: location.state });
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps
}
