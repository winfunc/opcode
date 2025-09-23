import { AnimatePresence, motion } from "framer-motion";
import opcodeLogo from "../../src-tauri/icons/icon.png";
import type { CSSProperties } from "react";

/**
 * StartupIntro - a lightweight startup overlay shown on app launch.
 * - Non-interactive; auto-fades after parent hides it via the `visible` prop.
 * - Uses existing shimmer/rotating-symbol styles from shimmer.css.
 */
export function StartupIntro({ visible }: { visible: boolean }) {
  // Simple entrance animations only
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background"
          aria-hidden="true"
        >
          {/* Ambient radial glow */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{
              background:
                "radial-gradient(800px circle at 50% 55%, var(--color-primary)/8, transparent 65%)",
              pointerEvents: "none",
            } as CSSProperties}
          />

          {/* Subtle vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(1200px circle at 50% 40%, transparent 60%, rgba(0,0,0,0.25))",
            }}
          />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative flex flex-col items-center justify-center gap-1"
          >

            {/* opcode logo slides left; brand text reveals to the right */}
            <div className="relative flex items-center justify-center">
              {/* Logo wrapper that gently slides left */}
              <motion.div
                className="relative z-10"
                initial={{ opacity: 0, scale: 1, x: 0 }}
                animate={{ opacity: 1, scale: 1, x: -14 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.2 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/15 blur-2xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0.9] }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
                <motion.img
                  src={opcodeLogo}
                  alt="opcode"
                  className="h-20 w-20 rounded-lg shadow-sm"
                  transition={{ repeat: Infinity, repeatType: "loop", ease: "linear", duration: 0.5 }}
                />
              </motion.div>

              {/* Brand text reveals left-to-right in the freed space */}
              <motion.div
                initial={{ x: -35, opacity: 0, clipPath: "inset(0 100% 0 0)" }}
                animate={{ x: 2, opacity: 1, clipPath: "inset(0 0% 0 0)" }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                style={{ willChange: "transform, opacity, clip-path" }}
              >
                <BrandText />
              </motion.div>
            </div>


          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StartupIntro;

function BrandText() {
  return (
    <div className="text-5xl font-extrabold tracking-tight brand-text">
      <span className="brand-text-solid">opcode</span>
      <span aria-hidden="true" className="brand-text-shimmer">opcode</span>
    </div>
  );
}
