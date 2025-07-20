import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ICON_CATEGORIES } from "@/constants/iconConstants";

type IconCategory = (typeof ICON_CATEGORIES)[keyof typeof ICON_CATEGORIES];
type IconItem = IconCategory[number];

interface IconPickerProps {
  /**
   * Currently selected icon name
   */
  value: string;
  /**
   * Callback when an icon is selected
   */
  onSelect: (iconName: string) => void;
  /**
   * Whether the picker is open
   */
  isOpen: boolean;
  /**
   * Callback to close the picker
   */
  onClose: () => void;
}

/**
 * Icon picker component with search and categories
 *
 * A comprehensive icon selection interface similar to Notion's icon picker.
 * Features include categorized icons, search functionality, hover previews,
 * and smooth animations. Supports all Lucide icons organized by category.
 *
 * @param value - Currently selected icon name
 * @param onSelect - Callback when an icon is selected
 * @param isOpen - Whether the picker dialog is open
 * @param onClose - Callback to close the picker
 *
 * @example
 * ```tsx
 * const [selectedIcon, setSelectedIcon] = useState('user');
 * const [showPicker, setShowPicker] = useState(false);
 *
 * <IconPicker
 *   value={selectedIcon}
 *   onSelect={(iconName) => {
 *     setSelectedIcon(iconName);
 *     console.log('Selected icon:', iconName);
 *   }}
 *   isOpen={showPicker}
 *   onClose={() => setShowPicker(false)}
 * />
 * ```
 */
export const IconPicker: React.FC<IconPickerProps> = ({ value, onSelect, isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  // Filter icons based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return ICON_CATEGORIES;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, IconItem[]> = {};

    Object.entries(ICON_CATEGORIES).forEach(([category, icons]) => {
      const matchingIcons = icons.filter(({ name }) => name.toLowerCase().includes(query));
      if (matchingIcons.length > 0) {
        filtered[category] = matchingIcons;
      }
    });

    return filtered;
  }, [searchQuery]);

  // Get all icons for search
  const allIcons = useMemo(() => {
    return Object.values(ICON_CATEGORIES).flat();
  }, []);

  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    onClose();
    setSearchQuery("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Choose an icon</DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Icon Grid */}
        <div className="h-[60vh] px-6 py-4 overflow-y-auto">
          {Object.keys(filteredCategories).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-sm text-muted-foreground">No icons found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {Object.entries(filteredCategories).map(([category, icons]) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
                    <div className="grid grid-cols-10 gap-2">
                      {icons.map((item: IconItem) => {
                        const Icon = item.icon;
                        return (
                          <motion.button
                            key={item.name}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelect(item.name)}
                            onMouseEnter={() => setHoveredIcon(item.name)}
                            onMouseLeave={() => setHoveredIcon(null)}
                            className={cn(
                              "p-2.5 rounded-lg transition-colors relative group",
                              "hover:bg-accent hover:text-accent-foreground",
                              value === item.name && "bg-primary/10 text-primary"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {hoveredIcon === item.name && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg whitespace-nowrap z-10">
                                {item.name}
                              </div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">
            Click an icon to select • {allIcons.length} icons available
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
