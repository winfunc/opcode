import { Clock } from "lucide-react";

/**
 * Parse and format error messages for better user experience
 * 
 * This utility function takes raw error messages and converts them into
 * user-friendly formats with appropriate titles, descriptions, and icons.
 * 
 * To add a new error type:
 * 1. Add a new if condition to check for your error pattern
 * 2. Return an object with title, description, isSpecialError: true
 * 3. Optionally include an icon from lucide-react
 * 
 * Example:
 * if (errorText.includes("your-error-pattern")) {
 *   return {
 *     title: "User-Friendly Title",
 *     description: "Helpful description with actionable advice",
 *     isSpecialError: true,
 *     icon: YourIcon
 *   };
 * }
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
  
  // Example: Add more error patterns here for other developers
  // Uncomment and customize the examples below as needed:
  
  // Rate limit errors
  // if (errorText.toLowerCase().includes("rate limit") || errorText.toLowerCase().includes("too many requests")) {
  //   return {
  //     title: "Rate Limit Exceeded",
  //     description: "You've made too many requests. Please wait a moment before trying again.",
  //     isSpecialError: true,
  //     icon: Clock
  //   };
  // }
  
  // Authentication errors
  // if (errorText.toLowerCase().includes("unauthorized") || errorText.toLowerCase().includes("invalid api key")) {
  //   return {
  //     title: "Authentication Failed",
  //     description: "Please check your API key configuration in settings.",
  //     isSpecialError: true
  //   };
  // }
  
  // Network/connection errors
  // if (errorText.toLowerCase().includes("network") || errorText.toLowerCase().includes("timeout")) {
  //   return {
  //     title: "Connection Error",
  //     description: "Unable to connect to the service. Please check your internet connection.",
  //     isSpecialError: true
  //   };
  // }
  
  // Context length errors
  // if (errorText.toLowerCase().includes("context") && errorText.toLowerCase().includes("length")) {
  //   return {
  //     title: "Input Too Long",
  //     description: "Your input exceeds the maximum context length. Please try with shorter content.",
  //     isSpecialError: true
  //   };
  // }
  
  // Quota/billing errors
  // if (errorText.toLowerCase().includes("quota") || errorText.toLowerCase().includes("billing")) {
  //   return {
  //     title: "Quota Exceeded",
  //     description: "Your usage quota has been exceeded. Please check your billing settings.",
  //     isSpecialError: true
  //   };
  // }
  
  // Model-specific errors
  // if (errorText.toLowerCase().includes("model not found") || errorText.toLowerCase().includes("unsupported model")) {
  //   return {
  //     title: "Model Unavailable",
  //     description: "The requested model is not available. Please try a different model.",
  //     isSpecialError: true
  //   };
  // }
  
  // Default fallback for unrecognized errors
  return {
    title: "Execution Failed",
    description: errorText,
    isSpecialError: false
  };
}; 