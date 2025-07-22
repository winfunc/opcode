import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User,
  MoreVertical,
  RefreshCw,
  Copy,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

interface ChatPanelProps {
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

/**
 * Right-side chat panel component inspired by Cursor's AI chat
 * Features:
 * - Resizable width
 * - Message history
 * - Typing indicators
 * - Message actions (copy, feedback)
 * - Clean, modern design
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  width,
  onWidthChange,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m Claude, your AI coding assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const resizerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle panel resizing
  useEffect(() => {
    let isResizing = false;

    const handleMouseDown = (e: MouseEvent) => {
      isResizing = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(300, Math.min(600, window.innerWidth - e.clientX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    const resizer = resizerRef.current;
    if (resizer) {
      resizer.addEventListener('mousedown', handleMouseDown);
      return () => {
        resizer.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [onWidthChange]);

  // Handle textarea auto-resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you said: "${userMessage.content}". How can I help you with that?`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const MessageItem: React.FC<{ message: Message }> = ({ message }) => (
    <div className="group flex gap-3 hover:bg-accent/20 transition-colors rounded-lg p-2 -m-2">
      <div className="flex-shrink-0">
        {message.role === 'user' ? (
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">
            {message.role === 'user' ? 'You' : 'Claude'}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        
        <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </div>
        
        {/* Message actions */}
        <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyMessage(message.content)}
            className="h-7 w-7 hover:bg-background"
            title="Copy message"
          >
            <Copy className="w-3 h-3" />
          </Button>
          
          {message.role === 'assistant' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-background hover:text-green-600"
                title="Good response"
              >
                <ThumbsUp className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-background hover:text-red-500"
                title="Poor response"
              >
                <ThumbsDown className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-background"
                title="Regenerate response"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Resize Handle */}
      <div
        ref={resizerRef}
        className="w-1 bg-border/30 hover:bg-border cursor-col-resize transition-colors"
        title="Drag to resize"
      />

      {/* Chat Panel */}
      <div 
        className="bg-background border-l border-border flex flex-col"
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="font-medium text-sm">Claude Chat</span>
          </div>
          
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New conversation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  Export chat
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Clear history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
              title="Close chat panel (⌘J)"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 relative">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">C</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">Claude</span>
                      <span className="text-xs text-muted-foreground">thinking...</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          {/* Scroll to bottom button */}
          {messages.length > 5 && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-4 right-4 w-8 h-8 bg-background border border-border rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center"
              title="Scroll to bottom"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}
        </div>

        {/* Enhanced Input Area - Cursor Style */}
        <div className="border-t border-border/50 bg-background">
          {/* Model Selector */}
          <div className="px-4 py-2 border-b border-border/20">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium">Claude 4 Sonnet</span>
              </div>
              <button className="ml-auto p-1 hover:bg-muted rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main Input */}
          <div className="p-4">
            <div className="relative bg-muted/30 rounded-lg border border-border/50 focus-within:border-primary/50 transition-colors">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Claude anything..."
                className="min-h-[60px] max-h-[120px] resize-none border-0 bg-transparent p-4 pr-12 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                rows={1}
              />
              
              {/* Send Button */}
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className={cn(
                  "absolute right-2 bottom-2 h-8 w-8 rounded-md transition-all",
                  inputValue.trim() 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Footer Info */}
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <div className="flex items-center gap-2">
                <button className="hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <button className="hover:text-foreground transition-colors" title="Voice input">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};