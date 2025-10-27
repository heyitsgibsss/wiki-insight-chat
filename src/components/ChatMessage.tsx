import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  wikipediaUrl?: string;
  timestamp?: Date;
}

const ChatMessage = ({ message, isUser, wikipediaUrl, timestamp }: ChatMessageProps) => {
  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-[var(--shadow-message)] transition-all duration-200",
          isUser
            ? "bg-[hsl(var(--chat-user-bubble))] text-[hsl(var(--chat-user-text))]"
            : "bg-[hsl(var(--chat-bot-bubble))] text-[hsl(var(--chat-bot-text))]"
        )}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message}</p>
        
        {wikipediaUrl && (
          <a
            href={wikipediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View on Wikipedia
          </a>
        )}
        
        {timestamp && (
          <p className="mt-1 text-xs opacity-60">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;