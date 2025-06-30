import { Clock } from "lucide-react";

/**
 * Parse and format error messages for better user experience
 */
export const parseErrorMessage = (errorText: string): { 
  title: string; 
  description: string; 
  isSpecialError: boolean; 
  icon?: React.ComponentType<any> 
} => {
  // Claude AI usage limit reached error
  if (errorText.includes("Claude AI usage limit reached")) {
    const match = errorText.match(/Claude AI usage limit reached\|(\d+)/);
    if (match) {
      const timestamp = parseInt(match[1]);
      const resetDate = new Date(timestamp * 1000);
      const now = new Date();
      
      // Format the reset time in user's local timezone
      const isToday = resetDate.toDateString() === now.toDateString();
      const isTomorrow = resetDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
      const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      let timeDescription;
      if (isToday) {
        timeDescription = `today at ${resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (isTomorrow) {
        timeDescription = `tomorrow at ${resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        timeDescription = resetDate.toLocaleString([], { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      
      return {
        title: "Claude AI Usage Limit Reached",
        description: `Your Claude AI usage has reached the limit. The limit will reset ${timeDescription} (${timeZoneName}).`,
        isSpecialError: true,
        icon: Clock
      };
    }
  }
  
  return {
    title: "Execution Failed",
    description: errorText,
    isSpecialError: false
  };
}; 