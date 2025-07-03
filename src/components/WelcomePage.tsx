import { motion } from "framer-motion";
import { Bot, FolderCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/useI18n";

type View = "welcome" | "projects" | "agents" | "editor" | "settings" | "claude-file-editor" | "claude-code-session" | "usage-dashboard" | "mcp";

interface WelcomePageProps {
  onViewChange: (view: View) => void;
}

export function WelcomePage({ onViewChange }: WelcomePageProps) {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-center p-4" style={{ height: "100%" }}>
      <div className="w-full max-w-4xl">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="rotating-symbol"></span>
            {t('welcome.title')}
          </h1>
        </motion.div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* CC Agents Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              className="h-64 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border border-border/50 shimmer-hover"
              onClick={() => onViewChange("agents")}
            >
              <div className="h-full flex flex-col items-center justify-center p-8">
                <Bot className="h-16 w-16 mb-4 text-primary" />
                <h2 className="text-xl font-semibold">{t('welcome.ccAgents')}</h2>
              </div>
            </Card>
          </motion.div>

          {/* CC Projects Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              className="h-64 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border border-border/50 shimmer-hover"
              onClick={() => onViewChange("projects")}
            >
              <div className="h-full flex flex-col items-center justify-center p-8">
                <FolderCode className="h-16 w-16 mb-4 text-primary" />
                <h2 className="text-xl font-semibold">{t('welcome.ccProjects')}</h2>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 