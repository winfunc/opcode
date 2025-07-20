/**
 * Widget components index
 *
 * Central export point for all widget components used in the application.
 * Widgets are specialized components for displaying different types of
 * Claude Code tool outputs and interactions.
 *
 * @example
 * ```tsx
 * import { TodoWidget, LSWidget, BashWidget } from '@/components/widgets';
 *
 * // Use widgets in your components
 * <TodoWidget data={todoData} />
 * <LSWidget data={lsData} />
 * <BashWidget data={bashData} />
 * ```
 */
export { TodoWidget } from "./TodoWidget";
export { LSWidget } from "./LSWidget";
export { BashWidget } from "./BashWidget";

// TODO: Add these widgets as they are implemented
// export { LSResultWidget } from './LSWidget';
// export { ReadWidget } from './ReadWidget';
// export { ReadResultWidget } from './ReadResultWidget';
// export { GlobWidget } from './GlobWidget';
// export { WriteWidget } from './WriteWidget';
// export { GrepWidget } from './GrepWidget';
// export { EditWidget } from './EditWidget';
// export { EditResultWidget } from './EditResultWidget';
// export { MCPWidget } from './MCPWidget';
// export { CommandWidget } from './CommandWidget';
// export { CommandOutputWidget } from './CommandOutputWidget';
// export { SummaryWidget } from './SummaryWidget';
// export { MultiEditWidget } from './MultiEditWidget';
// export { MultiEditResultWidget } from './MultiEditResultWidget';
// export { SystemReminderWidget } from './SystemReminderWidget';
// export { SystemInitializedWidget } from './SystemInitializedWidget';
// export { TaskWidget } from './TaskWidget';
// export { WebSearchWidget } from './WebSearchWidget';
// export { ThinkingWidget } from './ThinkingWidget';
// export { WebFetchWidget } from './WebFetchWidget';
// export { TodoReadWidget } from './TodoReadWidget';
