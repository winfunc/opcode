# Store Implementation Notes

The store files (`sessionStore.ts` and `agentStore.ts`) provide examples of how to implement global state management with Zustand for the Claudia application.

## Key Benefits:
- Eliminates prop drilling across components
- Centralizes state management
- Provides optimized selectors for performance
- Handles real-time updates efficiently

## Implementation Status:
These stores are example implementations that would need to be adapted to match the actual API interface. The current API in `lib/api.ts` has different method names and signatures than what was assumed in the store implementations.

## To Complete Implementation:
1. Update the store methods to match actual API methods
2. Add proper TypeScript types from the API
3. Implement WebSocket/SSE for real-time updates
4. Connect stores to components using the custom selectors

## Example Usage:
```typescript
import { useSessionStore } from '@/stores/sessionStore';

function MyComponent() {
  const { sessions, fetchSessions } = useSessionStore();
  
  useEffect(() => {
    fetchSessions();
  }, []);
  
  return <div>{sessions.length} sessions</div>;
}
```