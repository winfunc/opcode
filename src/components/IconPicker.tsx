import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  // Interface & Navigation
  Home,
  Menu,
  Settings,
  User,
  Users,
  LogOut,
  Bell,
  Bookmark,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Hash,
  Heart,
  Info,
  Link,
  Lock,
  Map,
  MessageSquare,
  Mic,
  Music,
  Paperclip,
  Phone,
  Pin,
  Plus,
  Save,
  Share,
  Star,
  Tag,
  Trash,
  Upload,
  Download,
  Edit,
  Copy,
  // Development & Tech
  Bot,
  Brain,
  Code,
  Terminal,
  Cpu,
  Database,
  GitBranch,
  Github,
  Globe,
  HardDrive,
  Laptop,
  Monitor,
  Server,
  Wifi,
  Cloud,
  Command,
  FileCode,
  FileJson,
  Folder,
  FolderOpen,
  Bug,
  Coffee,
  // Business & Finance
  Briefcase,
  Building,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  Calculator,
  Receipt,
  Wallet,
  // Creative & Design
  Palette,
  Brush,
  Camera,
  Film,
  Image,
  Layers,
  Layout,
  PenTool,
  Scissors,
  Type,
  Zap,
  Sparkles,
  Wand2,
  // Nature & Science
  Beaker,
  Atom,
  Dna,
  Flame,
  Leaf,
  Mountain,
  Sun,
  Moon,
  CloudRain,
  Snowflake,
  TreePine,
  Waves,
  Wind,
  // Gaming & Entertainment
  Gamepad2,
  Dice1,
  Trophy,
  Medal,
  Crown,
  Rocket,
  Target,
  Swords,
  Shield,
  // Communication
  Mail,
  Send,
  MessageCircle,
  Video,
  Voicemail,
  Radio,
  Podcast,
  Megaphone,
  // Miscellaneous
  Activity,
  Anchor,
  Award,
  Battery,
  Bluetooth,
  Compass,
  Crosshair,
  Flag,
  Flashlight,
  Gift,
  Headphones,
  Key,
  Lightbulb,
  Package,
  Puzzle,
  Search as SearchIcon,
  Smile,
  ThumbsUp,
  Umbrella,
  Watch,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Icon categories for better organization
 */
const ICON_CATEGORIES = {
  "Interface & Navigation": [
    { name: "home", icon: Home },
    { name: "menu", icon: Menu },
    { name: "settings", icon: Settings },
    { name: "user", icon: User },
    { name: "users", icon: Users },
    { name: "log-out", icon: LogOut },
    { name: "bell", icon: Bell },
    { name: "bookmark", icon: Bookmark },
    { name: "calendar", icon: Calendar },
    { name: "clock", icon: Clock },
    { name: "eye", icon: Eye },
    { name: "eye-off", icon: EyeOff },
    { name: "hash", icon: Hash },
    { name: "heart", icon: Heart },
    { name: "info", icon: Info },
    { name: "link", icon: Link },
    { name: "lock", icon: Lock },
    { name: "map", icon: Map },
    { name: "message-square", icon: MessageSquare },
    { name: "mic", icon: Mic },
    { name: "music", icon: Music },
    { name: "paperclip", icon: Paperclip },
    { name: "phone", icon: Phone },
    { name: "pin", icon: Pin },
    { name: "plus", icon: Plus },
    { name: "save", icon: Save },
    { name: "share", icon: Share },
    { name: "star", icon: Star },
    { name: "tag", icon: Tag },
    { name: "trash", icon: Trash },
    { name: "upload", icon: Upload },
    { name: "download", icon: Download },
    { name: "edit", icon: Edit },
    { name: "copy", icon: Copy },
  ],
  "Development & Tech": [
    { name: "bot", icon: Bot },
    { name: "brain", icon: Brain },
    { name: "code", icon: Code },
    { name: "terminal", icon: Terminal },
    { name: "cpu", icon: Cpu },
    { name: "database", icon: Database },
    { name: "git-branch", icon: GitBranch },
    { name: "github", icon: Github },
    { name: "globe", icon: Globe },
    { name: "hard-drive", icon: HardDrive },
    { name: "laptop", icon: Laptop },
    { name: "monitor", icon: Monitor },
    { name: "server", icon: Server },
    { name: "wifi", icon: Wifi },
    { name: "cloud", icon: Cloud },
    { name: "command", icon: Command },
    { name: "file-code", icon: FileCode },
    { name: "file-json", icon: FileJson },
    { name: "folder", icon: Folder },
    { name: "folder-open", icon: FolderOpen },
    { name: "bug", icon: Bug },
    { name: "coffee", icon: Coffee },
  ],
  "Business & Finance": [
    { name: "briefcase", icon: Briefcase },
    { name: "building", icon: Building },
    { name: "credit-card", icon: CreditCard },
    { name: "dollar-sign", icon: DollarSign },
    { name: "trending-up", icon: TrendingUp },
    { name: "trending-down", icon: TrendingDown },
    { name: "bar-chart", icon: BarChart },
    { name: "pie-chart", icon: PieChart },
    { name: "calculator", icon: Calculator },
    { name: "receipt", icon: Receipt },
    { name: "wallet", icon: Wallet },
  ],
  "Creative & Design": [
    { name: "palette", icon: Palette },
    { name: "brush", icon: Brush },
    { name: "camera", icon: Camera },
    { name: "film", icon: Film },
    { name: "image", icon: Image },
    { name: "layers", icon: Layers },
    { name: "layout", icon: Layout },
    { name: "pen-tool", icon: PenTool },
    { name: "scissors", icon: Scissors },
    { name: "type", icon: Type },
    { name: "zap", icon: Zap },
    { name: "sparkles", icon: Sparkles },
    { name: "wand-2", icon: Wand2 },
  ],
  "Nature & Science": [
    { name: "beaker", icon: Beaker },
    { name: "atom", icon: Atom },
    { name: "dna", icon: Dna },
    { name: "flame", icon: Flame },
    { name: "leaf", icon: Leaf },
    { name: "mountain", icon: Mountain },
    { name: "sun", icon: Sun },
    { name: "moon", icon: Moon },
    { name: "cloud-rain", icon: CloudRain },
    { name: "snowflake", icon: Snowflake },
    { name: "tree-pine", icon: TreePine },
    { name: "waves", icon: Waves },
    { name: "wind", icon: Wind },
  ],
  "Gaming & Entertainment": [
    { name: "gamepad-2", icon: Gamepad2 },
    { name: "dice-1", icon: Dice1 },
    { name: "trophy", icon: Trophy },
    { name: "medal", icon: Medal },
    { name: "crown", icon: Crown },
    { name: "rocket", icon: Rocket },
    { name: "target", icon: Target },
    { name: "swords", icon: Swords },
    { name: "shield", icon: Shield },
  ],
  "Communication": [
    { name: "mail", icon: Mail },
    { name: "send", icon: Send },
    { name: "message-circle", icon: MessageCircle },
    { name: "video", icon: Video },
    { name: "voicemail", icon: Voicemail },
    { name: "radio", icon: Radio },
    { name: "podcast", icon: Podcast },
    { name: "megaphone", icon: Megaphone },
  ],
  "Miscellaneous": [
    { name: "activity", icon: Activity },
    { name: "anchor", icon: Anchor },
    { name: "award", icon: Award },
    { name: "battery", icon: Battery },
    { name: "bluetooth", icon: Bluetooth },
    { name: "compass", icon: Compass },
    { name: "crosshair", icon: Crosshair },
    { name: "flag", icon: Flag },
    { name: "flashlight", icon: Flashlight },
    { name: "gift", icon: Gift },
    { name: "headphones", icon: Headphones },
    { name: "key", icon: Key },
    { name: "lightbulb", icon: Lightbulb },
    { name: "package", icon: Package },
    { name: "puzzle", icon: Puzzle },
    { name: "search", icon: SearchIcon },
    { name: "smile", icon: Smile },
    { name: "thumbs-up", icon: ThumbsUp },
    { name: "umbrella", icon: Umbrella },
    { name: "watch", icon: Watch },
    { name: "wrench", icon: Wrench },
  ],
} as const;

type IconCategory = typeof ICON_CATEGORIES[keyof typeof ICON_CATEGORIES];
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
 * Similar to Notion's icon picker interface
 */
export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onSelect,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  // Filter icons based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return ICON_CATEGORIES;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, IconItem[]> = {};

    Object.entries(ICON_CATEGORIES).forEach(([category, icons]) => {
      const matchingIcons = icons.filter(({ name }) =>
        name.toLowerCase().includes(query)
      );
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
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              <p className="text-sm text-muted-foreground">
                No icons found for "{searchQuery}"
              </p>
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
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {category}
                    </h3>
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

// Export all available icon names for type safety
export const AVAILABLE_ICONS = Object.values(ICON_CATEGORIES)
  .flat()
  .map(({ name }) => name);

// Export icon map for easy access
export const ICON_MAP = Object.values(ICON_CATEGORIES)
  .flat()
  .reduce((acc, { name, icon }) => ({ ...acc, [name]: icon }), {} as Record<string, LucideIcon>); 