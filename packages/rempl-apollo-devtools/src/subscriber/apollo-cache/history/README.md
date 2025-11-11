# History Feature - Refactoring Documentation

This document describes the refactored history feature architecture, following React best practices and promoting code reusability.

## 📁 Structure Overview

```
history/
├── components/          # Reusable, feature-specific components
│   ├── DialogHeader.tsx
│   ├── TimelineItem.tsx
│   ├── OperationMetadata.tsx
│   ├── MissingFieldItem.tsx
│   └── index.ts
├── hooks/              # Custom React hooks for state management
│   ├── useHistoryData.ts
│   ├── useHistorySelection.ts
│   ├── useCollapsibleSections.ts
│   └── index.ts
├── shared/             # Shared components, styles, and utilities
│   ├── components/     # Generic, reusable UI components
│   │   ├── Badge.tsx
│   │   ├── Tag.tsx
│   │   ├── CollapsibleSection.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Loading.tsx
│   │   └── index.ts
│   ├── styles/         # Common style utilities
│   │   └── common.styles.ts
│   ├── utils/          # Utility functions
│   │   ├── format.ts
│   │   └── index.ts
│   └── index.ts
├── HistoryDialog.tsx   # Main dialog container
├── HistoryTimeline.tsx # Timeline sidebar
├── HistoryDetails.tsx  # Details panel
├── EmptyStates.tsx     # Empty state components
└── index.ts
```

## 🎯 Key Improvements

### 1. **Separation of Concerns**

- **Components**: Split large monolithic components into smaller, focused pieces
- **Hooks**: Extracted business logic into custom hooks
- **Shared**: Created a library of reusable UI components

### 2. **Reusable Components**

#### Shared Components

All shared components are built with FluentUI and follow consistent patterns:

- **Badge**: Semantic status badges with predefined variants
- **Tag**: Lightweight labels for metadata
- **CollapsibleSection**: Expandable/collapsible content sections
- **CodeBlock**: Formatted code display with JSON support
- **EmptyState**: Consistent empty state messaging
- **Loading**: Loading spinner with optional label

#### Example Usage:

```tsx
import { Badge, Tag, CollapsibleSection } from "./shared";

// Using Badge
<Badge variant="optimistic">Optimistic</Badge>
<Badge variant="error">Error</Badge>

// Using Tag
<Tag variant="warning" icon={<Icon />}>Warning</Tag>

// Using CollapsibleSection
<CollapsibleSection
  title="Section Title"
  isExpanded={isExpanded}
  onToggle={handleToggle}
>
  {children}
</CollapsibleSection>
```

### 3. **Custom Hooks**

#### useHistoryData

Manages fetching and state for history data.

```tsx
const { history, operationData, loading, error, refetch } = useHistoryData({
  operationKey: item?.key,
  getOperationHistory: context?.getOperationHistory,
});
```

#### useHistorySelection

Manages timeline entry selection with navigation support.

```tsx
const {
  selectedIndex,
  selectedEntry,
  selectEntry,
  selectNext,
  selectPrevious,
} = useHistorySelection({
  history,
  autoSelectLast: true,
});
```

#### useCollapsibleSections

Manages multiple collapsible sections state.

```tsx
const { isExpanded, toggle, expand, collapse } = useCollapsibleSections({
  initialExpanded: ["changes", "data"],
});
```

### 4. **Style Organization**

#### Common Styles

Reusable style utilities in `shared/styles/common.styles.ts`:

- `useDialogStyles`: Modal/dialog layouts
- `useListItemStyles`: List item states
- `useCodeStyles`: Code/monospace text
- `usePanelStyles`: Panel and section layouts
- `useScrollbarStyles`: Custom scrollbar styling

#### Example:

```tsx
import { useDialogStyles, usePanelStyles } from "./shared";

const dialogClasses = useDialogStyles();
const panelClasses = usePanelStyles();
```

### 5. **Utility Functions**

Located in `shared/utils/format.ts`:

- `formatTime()`: Format timestamp to time string
- `formatDateTime()`: Format timestamp to full date/time
- `formatRelativeTime()`: Format to relative time ("2 mins ago")
- `safeStringify()`: Safe JSON stringification
- `truncate()`: String truncation with ellipsis
- `getValuePreview()`: Generate preview strings
- `deepEqual()`: Deep equality comparison

## 🏗️ Component Architecture

### HistoryDialog

**Main container** - Orchestrates the entire history feature.

**Responsibilities:**

- Fetch history data using `useHistoryData`
- Manage selection using `useHistorySelection`
- Render header, timeline, and details panel
- Handle loading and empty states

**Key Benefits:**

- Minimal logic, mostly composition
- Clear data flow
- Easy to test and maintain

### HistoryTimeline

**Sidebar timeline** - Displays list of history entries.

**Responsibilities:**

- Render timeline items
- Handle item selection
- Display entry metadata

**Uses:**

- `TimelineItem` component for each entry
- `Tag` component for entry badges
- Formatting utilities for timestamps

### HistoryDetails

**Details panel** - Shows detailed information for selected entry.

**Responsibilities:**

- Display operation metadata
- Show changes/diffs
- Display data snapshots
- Show missing fields

**Uses:**

- `OperationMetadata` component
- `CollapsibleSection` for expandable content
- `MissingFieldItem` for missing field warnings
- `useCollapsibleSections` hook for state

## 🎨 Design Patterns

### 1. **Composition over Inheritance**

Components are composed of smaller, reusable pieces rather than inheriting from base classes.

### 2. **Single Responsibility**

Each component has one clear purpose and doesn't try to do too much.

### 3. **Props Drilling Avoidance**

Custom hooks prevent passing props through multiple levels.

### 4. **Consistent Styling**

FluentUI tokens and shared style utilities ensure consistent look and feel.

### 5. **Type Safety**

Full TypeScript support with proper type exports.

## 🔄 Migration Guide

### Before (Old Pattern):

```tsx
// Large component with inline styles and logic
const Component = () => {
  const classes = makeStyles({
    /* many style rules */
  })();

  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  // ... complex logic

  return <div>{/* deeply nested JSX */}</div>;
};
```

### After (New Pattern):

```tsx
// Clean component using hooks and shared components
const Component = () => {
  const { data, loading } = useCustomHook();
  const { isExpanded, toggle } = useCollapsibleSections();

  return (
    <SharedComponent>
      <AnotherSharedComponent />
    </SharedComponent>
  );
};
```

## 📊 Benefits Summary

1. **Reduced Code Duplication**: Shared components eliminate repetitive code
2. **Better Maintainability**: Smaller, focused components are easier to maintain
3. **Improved Testability**: Isolated logic in hooks is easier to test
4. **Consistent UX**: Shared components ensure consistent behavior
5. **Better Performance**: Smaller components re-render less frequently
6. **Easier Onboarding**: Clear structure helps new developers understand the codebase
7. **Scalability**: Easy to add new features without affecting existing code

## 🚀 Future Enhancements

- Add unit tests for hooks
- Add Storybook stories for shared components
- Consider moving shared components to a package-level shared directory
- Add performance monitoring for large history datasets
- Implement virtualization for very long timelines

## 📝 Notes

- All components use FluentUI v9 components and tokens
- Accessibility features are built into shared components
- TypeScript types are properly exported for all components and hooks
- The refactoring maintains backward compatibility with existing APIs
