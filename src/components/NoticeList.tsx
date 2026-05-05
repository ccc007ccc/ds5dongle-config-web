import { AlertCircle } from "lucide-react";

interface NoticeListProps {
  supported: boolean;
}

export function NoticeList({ supported }: NoticeListProps) {
  return (
    <>
      {!supported && (
        <div className="notice warning">
          <AlertCircle size={18} />
          <span>WebHID is available in Chromium-based browsers on secure origins.</span>
        </div>
      )}
    </>
  );
}
