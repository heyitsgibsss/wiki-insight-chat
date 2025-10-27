import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import ChatHeader from "@/components/ChatHeader";
import { toast } from "sonner";

interface Message {
  id: string;
  message: string;
  response?: string;
  isUser: boolean;
  wikipediaUrl?: string;
  timestamp: Date;
}

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check auth (optional - only for saving chat history)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        loadChatHistory(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        loadChatHistory(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChatHistory = async (userId: string) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error loading chat history:", error);
      return;
    }

    const formattedMessages: Message[] = [];
    data.forEach((chat) => {
      formattedMessages.push({
        id: `${chat.id}-user`,
        message: chat.message,
        isUser: true,
        timestamp: new Date(chat.created_at),
      });
      formattedMessages.push({
        id: chat.id,
        message: chat.response,
        isUser: false,
        wikipediaUrl: chat.wikipedia_url || undefined,
        timestamp: new Date(chat.created_at),
      });
    });

    setMessages(formattedMessages);
  };

  const handleSendMessage = async (message: string) => {
    // Add user message
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      message,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Call smart chat edge function
      const { data, error } = await supabase.functions.invoke("smart-chat", {
        body: { query: message },
      });

      if (error) throw error;

      // Add bot response
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        message: data.summary || "I couldn't respond to that.",
        isUser: false,
        wikipediaUrl: data.type === 'wikipedia' ? data.url : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);

      // Save to database only if user is logged in
      if (user) {
        await supabase.from("chats").insert({
          user_id: user.id,
          message: message,
          response: botMessage.message,
          wikipedia_url: data.type === 'wikipedia' ? data.url : null,
        });
      }

    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const showEmptyState = messages.length === 0 && !loading;

  return (
    <div className="flex h-screen flex-col">
      <ChatHeader />
      
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto max-w-4xl px-4 py-6">
              {showEmptyState ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <h2 className="mb-2 bg-[var(--gradient-brand)] bg-clip-text text-5xl font-bold text-transparent opacity-10">
                    WikiChat
                  </h2>
                  <p className="text-sm text-muted-foreground opacity-70">
                    Chat with WikiChat — answers sourced directly and reliably from Wikipedia
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      message={msg.message}
                      isUser={msg.isUser}
                      wikipediaUrl={msg.wikipediaUrl}
                      timestamp={msg.timestamp}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          <div className="border-t bg-card/50 backdrop-blur-sm">
            <div className="container mx-auto max-w-4xl px-4 py-4">
              <ChatInput onSend={handleSendMessage} disabled={loading} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Chat;