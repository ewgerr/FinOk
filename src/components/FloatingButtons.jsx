import { Send } from "lucide-react";

export default function FloatingButtons() {
  return (
    <div className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-40 flex flex-col gap-3">
      <a
        href="https://t.me/FinOkSupport_bot"
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        aria-label="Telegram"
      >
        <Send className="w-5 h-5" />
      </a>
    </div>
  );
}