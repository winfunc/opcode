import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Github } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useI18n } from "@/lib/i18n";
import asteriskLogo from "@/assets/nfo/asterisk-logo.png";
import keygennMusic from "@/assets/nfo/claudia-nfo.ogg";
import { handleError } from "@/lib/errorHandler";
interface NFOCreditsProps {
  /**
   * Callback when the NFO window is closed
   */
  onClose: () => void;
}

/**
 * NFO Credits component - Displays a keygen/crack style credits window
 *
 * A nostalgic NFO-style credits screen with auto-scrolling text, retro fonts,
 * background music, and classic keygen aesthetics. Features include volume control,
 * animated text effects, and authentic retro styling reminiscent of 90s software.
 *
 * @param onClose - Callback when the NFO window is closed
 *
 * @example
 * ```tsx
 * <NFOCredits onClose={() => setShowNFO(false)} />
 * ```
 */
export const NFOCredits: React.FC<NFOCreditsProps> = ({ onClose }) => {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Initialize and autoplay audio muted then unmute
  useEffect(() => {
    const audio = new window.Audio(keygennMusic);
    audio.loop = true;
    audio.volume = 0.7;
    // Start muted to satisfy autoplay policy
    audio.muted = true;
    audioRef.current = audio;
    // Attempt to play
    audio
      .play()
      .then(() => {
        // Unmute after autoplay
        audio.muted = false;
      })
      .catch(async (err) => {
        await handleError("Audio autoplay failed:", { context: err });
      });
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  // Handle mute toggle
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Start auto-scrolling
  useEffect(() => {
    const scrollInterval = window.setInterval(() => {
      setScrollPosition((prev) => prev + 1);
    }, 30); // Smooth scrolling speed

    return () => window.clearInterval(scrollInterval);
  }, []);

  // Apply scroll position
  useEffect(() => {
    if (scrollRef.current) {
      const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      if (scrollPosition >= maxScroll) {
        // Reset to beginning when reaching the end
        setScrollPosition(0);
        scrollRef.current.scrollTop = 0;
      } else {
        scrollRef.current.scrollTop = scrollPosition;
      }
    }
  }, [scrollPosition]);

  // Credits content
  const creditsContent = [
    { type: "header", text: "CLAUDIA v0.1.0" },
    { type: "subheader", text: `[ ${t.nfo.strategicProject.toUpperCase()} ]` },
    { type: "spacer" },
    { type: "section", title: `━━━ ${t.nfo.credits.toUpperCase()} ━━━` },
    { type: "credit", role: t.nfo.poweredBy.toUpperCase(), name: "Anthropic Claude 4" },
    { type: "credit", role: "CLAUDE CODE", name: "The Ultimate Coding Assistant" },
    { type: "credit", role: "MCP PROTOCOL", name: "Model Context Protocol" },
    { type: "spacer" },
    { type: "section", title: `━━━ ${t.nfo.dependencies.toUpperCase()} ━━━` },
    { type: "credit", role: t.nfo.runtime.toUpperCase(), name: "Tauri Framework" },
    { type: "credit", role: t.nfo.uiFramework.toUpperCase(), name: "React + TypeScript" },
    { type: "credit", role: t.nfo.styling.toUpperCase(), name: "Tailwind CSS + shadcn/ui" },
    { type: "credit", role: t.nfo.animations.toUpperCase(), name: "Framer Motion" },
    { type: "credit", role: t.nfo.buildTool.toUpperCase(), name: "Vite" },
    { type: "credit", role: t.nfo.packageManager.toUpperCase(), name: "Bun" },
    { type: "spacer" },
    { type: "section", title: `━━━ ${t.nfo.specialThanks.toUpperCase()} ━━━` },
    { type: "text", content: t.nfo.openSourceCommunity },
    { type: "text", content: t.nfo.betaTesters },
    { type: "text", content: t.nfo.believers },
    { type: "spacer" },
    {
      type: "ascii",
      content: `
     ▄▄▄· .▄▄ · ▄▄▄▄▄▄▄▄ .▄▄▄  ▪  .▄▄ · ▄ •▄ 
    ▐█ ▀█ ▐█ ▀. •██  ▀▄.▀·▀▄ █·██ ▐█ ▀. █▌▄▌▪
    ▄█▀▀█ ▄▀▀▀█▄ ▐█.▪▐▀▀▪▄▐▀▀▄ ▐█·▄▀▀▀█▄▐▀▀▄·
    ▐█ ▪▐▌▐█▄▪▐█ ▐█▌·▐█▄▄▌▐█•█▌▐█▌▐█▄▪▐█▐█.█▌
     ▀  ▀  ▀▀▀▀  ▀▀▀  ▀▀▀ .▀  ▀▀▀▀ ▀▀▀▀ ·▀  ▀
    `,
    },
    { type: "spacer" },
    { type: "text", content: t.nfo.sharing },
    { type: "text", content: t.nfo.support },
    { type: "spacer" },
    { type: "spacer" },
    { type: "spacer" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop with blur */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

        {/* NFO Window */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-10"
        >
          <Card className="w-[600px] h-[500px] bg-background border-border shadow-2xl overflow-hidden">
            {/* Window Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="text-sm font-bold tracking-wider font-mono text-foreground">
                  CLAUDIA.NFO
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await openUrl("https://github.com/getAsterisk/claudia/issues/new");
                  }}
                  className="flex items-center gap-1 h-auto px-2 py-1"
                  title={t.nfo.fileABug}
                >
                  <Github className="h-3 w-3" />
                  <span className="text-xs">{t.nfo.fileABug}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="h-6 w-6 p-0"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* NFO Content */}
            <div className="relative h-[calc(100%-40px)] bg-background overflow-hidden">
              {/* Asterisk Logo Section (Fixed at top) */}
              <div className="absolute top-0 left-0 right-0 bg-background z-10 pb-4 text-center">
                <button
                  className="inline-block mt-4 hover:scale-110 transition-transform cursor-pointer"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await openUrl("https://asterisk.so");
                  }}
                >
                  <img
                    src={asteriskLogo}
                    alt="Asterisk"
                    className="h-20 w-auto mx-auto filter brightness-0 invert opacity-90"
                  />
                </button>
                <div className="text-muted-foreground text-sm font-mono mt-2 tracking-wider">
                  {t.nfo.strategicProject}
                </div>
              </div>

              {/* Scrolling Credits */}
              <div
                ref={scrollRef}
                className="absolute inset-0 top-32 overflow-hidden"
                style={{ fontFamily: "'Courier New', monospace" }}
              >
                <div className="px-8 pb-32">
                  {creditsContent.map((item, index) => {
                    switch (item.type) {
                      case "header":
                        return (
                          <div
                            key={index}
                            className="text-foreground text-3xl font-bold text-center mb-2 tracking-widest"
                          >
                            {item.text}
                          </div>
                        );
                      case "subheader":
                        return (
                          <div
                            key={index}
                            className="text-muted-foreground text-lg text-center mb-8 tracking-wide"
                          >
                            {item.text}
                          </div>
                        );
                      case "section":
                        return (
                          <div
                            key={index}
                            className="text-foreground text-xl font-bold text-center my-6 tracking-wider"
                          >
                            {item.title}
                          </div>
                        );
                      case "credit":
                        return (
                          <div
                            key={index}
                            className="flex justify-between items-center mb-2 text-foreground"
                          >
                            <span className="text-sm text-muted-foreground">{item.role}:</span>
                            <span className="text-base tracking-wide">{item.name}</span>
                          </div>
                        );
                      case "text":
                        return (
                          <div
                            key={index}
                            className="text-muted-foreground text-center text-sm mb-2"
                          >
                            {item.content}
                          </div>
                        );
                      case "ascii":
                        return (
                          <pre
                            key={index}
                            className="text-foreground text-xs text-center my-6 leading-tight opacity-80"
                          >
                            {item.content}
                          </pre>
                        );
                      case "spacer":
                        return <div key={index} className="h-8" />;
                      default:
                        return null;
                    }
                  })}
                </div>
              </div>

              {/* Subtle Scanlines Effect */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-foreground/[0.02] to-transparent animate-scanlines" />
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
