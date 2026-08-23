import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-16 z-50 mx-auto flex w-fit max-w-[calc(100%-24px)] items-center gap-2 rounded-full border border-amber-400/30 bg-slate-950/95 px-4 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur"
    >
      <WifiOff size={14} aria-hidden="true" />
      מצב אופליין — השירים שכבר נשמרו בטלפון עדיין זמינים
    </div>
  );
}
