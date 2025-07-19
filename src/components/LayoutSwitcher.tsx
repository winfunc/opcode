import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { 
  Layout, 
  Zap, 
  Settings, 
  Check,
  Monitor,
  Smartphone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { cn } from '@/lib/utils';

interface LayoutOption {
  id: 'classic' | 'cursor';
  name: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  preview: string;
}

interface LayoutSwitcherProps {
  currentLayout: 'classic' | 'cursor';
  onLayoutChange: (layout: 'classic' | 'cursor') => void;
}

const layoutOptions: LayoutOption[] = [
  {
    id: 'classic',
    name: 'Classic Layout',
    description: 'Traditional Claude Code interface with familiar tab-based navigation',
    icon: Layout,
    features: [
      'Traditional tab bar at top',
      'Familiar navigation patterns',
      'Horizontal tab scrolling',
      'Classic topbar with tools'
    ],
    preview: 'Traditional horizontal tabs with a top navigation bar'
  },
  {
    id: 'cursor',
    name: 'Cursor-Style Layout',
    description: 'Modern Cursor-inspired interface with sidebar navigation and integrated chat',
    icon: Zap,
    features: [
      'Modern sidebar navigation',
      'Integrated AI chat panel',
      'Resizable panels',
      'Clean, minimal design',
      'Keyboard shortcuts (⌘B, ⌘J)',
      'Responsive design'
    ],
    preview: 'Sidebar navigation with main editor and integrated chat panel'
  }
];

/**
 * Layout switcher component that allows users to choose between
 * the classic Claude Code layout and the new Cursor-style layout
 */
export const LayoutSwitcher: React.FC<LayoutSwitcherProps> = ({
  currentLayout,
  onLayoutChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState(currentLayout);

  useEffect(() => {
    setSelectedLayout(currentLayout);
  }, [currentLayout]);

  const handleLayoutSelect = (layoutId: 'classic' | 'cursor') => {
    setSelectedLayout(layoutId);
    onLayoutChange(layoutId);
    setIsOpen(false);
    
    // Store preference in localStorage
    localStorage.setItem('claudia-preferred-layout', layoutId);
  };

  const LayoutCard: React.FC<{ option: LayoutOption; isSelected: boolean }> = ({ 
    option, 
    isSelected 
  }) => (
    <button
      onClick={() => handleLayoutSelect(option.id)}
      className={cn(
        "relative p-6 rounded-lg border-2 text-left transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.02] group",
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-background hover:border-primary/50"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isSelected 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        )}>
          <option.icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{option.name}</h3>
          <p className="text-sm text-muted-foreground">{option.description}</p>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-4 p-3 bg-muted/50 rounded-md">
        <p className="text-xs text-muted-foreground italic">{option.preview}</p>
      </div>

      {/* Features */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Key Features:</h4>
        <ul className="space-y-1">
          {option.features.map((feature, index) => (
            <li key={index} className="text-xs text-muted-foreground flex items-center gap-2">
              <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </button>
  );

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Layout className="w-4 h-4" />
        Layout: {layoutOptions.find(l => l.id === currentLayout)?.name}
      </Button>

      {/* Layout Selection Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Choose Your Layout
            </DialogTitle>
            <DialogDescription>
              Select the interface layout that works best for your workflow. 
              You can change this anytime in settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {layoutOptions.map((option) => (
              <LayoutCard
                key={option.id}
                option={option}
                isSelected={selectedLayout === option.id}
              />
            ))}
          </div>

          {/* Additional info */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Monitor className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Responsive Design</h4>
                <p className="text-xs text-muted-foreground">
                  Both layouts are fully responsive and adapt to different screen sizes. 
                  The Cursor-style layout automatically adjusts panel visibility on smaller screens.
                </p>
              </div>
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-4 p-4 bg-accent/30 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Smartphone className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Keyboard Shortcuts</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘B</kbd> Toggle sidebar (Cursor layout)</p>
                  <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘J</kbd> Toggle chat panel (Cursor layout)</p>
                  <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘T</kbd> New tab (Both layouts)</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};