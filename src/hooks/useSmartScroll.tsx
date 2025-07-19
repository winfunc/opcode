import { useRef, useState, useCallback, useEffect } from 'react';

interface UseSmartScrollOptions {
  threshold?: number; // 距离底部多少像素认为是在底部
  scrollBehavior?: ScrollBehavior;
}

interface SmartScrollReturn {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  scrollAnchorRef: React.RefObject<HTMLDivElement>;
  isUserScrolling: boolean;
  isNearBottom: boolean;
  showNewMessageIndicator: boolean;
  scrollToBottom: () => void;
  handleScroll: () => void;
  dismissNewMessageIndicator: () => void;
  handleNewContent: () => void;
}

/**
 * 智能滚动Hook - 提供智能的自动滚动行为
 * 
 * 特性：
 * 1. 用户在底部时自动滚动到新内容
 * 2. 用户查看历史内容时保持位置不变
 * 3. 显示新消息提示
 * 4. 用户滚回底部时恢复自动滚动
 */
export function useSmartScroll(
  options: UseSmartScrollOptions = {}
): SmartScrollReturn {
  const {
    threshold = 100, // 默认100px内认为是在底部
    scrollBehavior = 'smooth'
  } = options;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const lastScrollTop = useRef(0);

  /**
   * 检查是否接近底部
   */
  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= threshold;
  }, [threshold]);

  /**
   * 滚动到底部
   */
  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: scrollBehavior
    });
    
    // 重置状态
    setIsUserScrolling(false);
    setShowNewMessageIndicator(false);
  }, [scrollBehavior]);

  /**
   * 处理滚动事件
   */
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop } = container;
    const nearBottom = checkIfNearBottom();
    
    // 判断滚动方向
    const isScrollingUp = scrollTop < lastScrollTop.current;
    lastScrollTop.current = scrollTop;

    // 更新状态
    setIsNearBottom(nearBottom);
    
    // 如果用户向上滚动，标记为用户正在滚动
    if (isScrollingUp && !nearBottom) {
      setIsUserScrolling(true);
    }
    
    // 如果用户滚动到底部，恢复自动滚动
    if (nearBottom) {
      setIsUserScrolling(false);
      setShowNewMessageIndicator(false);
    }
  }, [checkIfNearBottom]);

  /**
   * 处理新内容到达
   */
  const handleNewContent = useCallback(() => {
    const nearBottom = checkIfNearBottom();
    
    // 只有在用户不在滚动且在底部时才自动滚动
    if (!isUserScrolling && nearBottom) {
      // 使用 requestAnimationFrame 确保DOM更新后再滚动
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    } else if (isUserScrolling) {
      // 用户在查看历史内容时显示新消息提示
      setShowNewMessageIndicator(true);
    }
  }, [isUserScrolling, checkIfNearBottom, scrollToBottom]);

  /**
   * 关闭新消息提示
   */
  const dismissNewMessageIndicator = useCallback(() => {
    setShowNewMessageIndicator(false);
    scrollToBottom();
  }, [scrollToBottom]);

  /**
   * 初始化时检查状态
   */
  useEffect(() => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);
  }, [checkIfNearBottom]);

  return {
    scrollContainerRef,
    scrollAnchorRef,
    isUserScrolling,
    isNearBottom,
    showNewMessageIndicator,
    scrollToBottom,
    handleScroll,
    dismissNewMessageIndicator,
    handleNewContent
  };
}

/**
 * 新消息提示组件示例
 */
export const NewMessageIndicator: React.FC<{
  onClick: () => void;
  count?: number;
}> = ({ onClick, count }) => {
  return (
    <div 
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-slide-up"
      onClick={onClick}
    >
      <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
        <svg 
          className="w-4 h-4 animate-bounce" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 14l-7 7m0 0l-7-7m7 7V3" 
          />
        </svg>
        <span className="text-sm font-medium">
          {count ? `${count} new messages` : 'New messages'}
        </span>
      </button>
    </div>
  );
};