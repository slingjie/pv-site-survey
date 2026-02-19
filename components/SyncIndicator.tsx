import React, { useState, useEffect, useCallback } from "react";
import { onSyncStatusChange, syncToServer, type SyncStatus } from "../services/sync";

export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>({ state: "idle", pending: 0 });
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => onSyncStatusChange(setStatus), []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleClick = useCallback(() => { syncToServer(); }, []);

  const dotColor = online ? "bg-green-500" : "bg-red-500";
  const showBadge = status.pending > 0;

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-20 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 active:scale-95 transition-transform"
      title={online ? `在线${showBadge ? ` · ${status.pending} 项待同步` : ""}` : "离线"}
    >
      <span className={`w-3 h-3 rounded-full ${dotColor} ${status.state === "syncing" ? "animate-pulse" : ""}`} />
      {showBadge && (
        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
          {status.pending}
        </span>
      )}
    </button>
  );
}
