import React, { useState, useEffect, useRef } from 'react';
import socketService from '../../services/socketService';

interface ChatMessage {
  id: number;
  user: string;
  message: string;
  timestamp: Date | string;
}

interface PremiereChatProps {
  premiereId: string;
  currentUsername?: string;
  viewerCount?: number;
  heading?: string;
  className?: string;
}

const PremiereChat: React.FC<PremiereChatProps> = ({
  premiereId,
  currentUsername,
  viewerCount,
  heading = 'Live Chat',
  className,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePremiereJoined = (data: any) => {
      if (Array.isArray(data?.chat)) {
        setMessages(data.chat);
      }
    };

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    socketService.onPremiereJoined(handlePremiereJoined);
    socketService.onNewMessage(handleNewMessage);

    return () => {
      socketService.removeListener('premiere-joined', handlePremiereJoined);
      socketService.removeListener('new-message', handleNewMessage);
    };
  }, [premiereId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    socketService.sendMessage(premiereId, text, currentUsername);
    setDraft('');
  };

  return (
    <div className={`flex flex-col bg-gray-900 ${className ?? ''}`}>
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-white font-semibold">{heading}</h3>
        {typeof viewerCount === 'number' && (
          <p className="text-gray-400 text-sm">{viewerCount} viewers</p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="text-sm">
              <span className="text-blue-400 font-medium">{message.user}:</span>
              <span className="text-white ml-2 break-words">{message.message}</span>
              <div className="text-gray-500 text-xs">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default PremiereChat;
