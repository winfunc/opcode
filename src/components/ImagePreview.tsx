import React, { useState } from "react";
import { X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ImagePreviewProps {
  /**
   * Array of image file paths to preview
   */
  images: string[];
  /**
   * Callback to remove an image from the preview
   */
  onRemove: (index: number) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * ImagePreview component - Shows thumbnail previews of embedded images
 * 
 * Features:
 * - Shows up to 10 image thumbnails in a row
 * - Click on thumbnail to see full-size preview
 * - Hover to show remove button
 * - Smooth animations
 * 
 * @example
 * <ImagePreview 
 *   images={["/path/to/image1.png", "/path/to/image2.jpg"]}
 *   onRemove={(index) => console.log('Remove image at', index)}
 * />
 */
export const ImagePreview: React.FC<ImagePreviewProps> = ({
  images,
  onRemove,
  className,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Limit to 10 images
  const displayImages = images.slice(0, 10);

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index));
  };

  const handleRemove = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onRemove(index);
  };

  // Helper to get the image source - handles both file paths and data URLs
  const getImageSrc = (imagePath: string): string => {
    // If it's already a data URL, return as-is
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    // Otherwise, convert the file path
    return convertFileSrc(imagePath);
  };

  if (displayImages.length === 0) return null;

  return (
    <>
      <div className={cn("flex gap-2 p-2 overflow-x-auto", className)}>
        <AnimatePresence>
          {displayImages.map((imagePath, index) => (
            <motion.div
              key={`${imagePath}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="relative flex-shrink-0 group"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className="relative w-16 h-16 rounded-md overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedImageIndex(index)}
              >
                {imageErrors.has(index) ? (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Error</span>
                  </div>
                ) : (
                  <img
                    src={getImageSrc(imagePath)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(index)}
                  />
                )}
                
                {/* Hover overlay with maximize icon */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Remove button */}
              <AnimatePresence>
                {hoveredIndex === index && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                    onClick={(e) => handleRemove(e, index)}
                  >
                    <X className="h-3 w-3" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {images.length > 10 && (
          <div className="flex-shrink-0 w-16 h-16 rounded-md border border-border bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">+{images.length - 10}</span>
          </div>
        )}
      </div>

      {/* Full-size preview dialog */}
      <Dialog 
        open={selectedImageIndex !== null} 
        onOpenChange={(open) => !open && setSelectedImageIndex(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          {selectedImageIndex !== null && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={getImageSrc(displayImages[selectedImageIndex])}
                alt={`Full preview ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onError={() => handleImageError(selectedImageIndex)}
              />
              
              {/* Navigation buttons if multiple images */}
              {displayImages.length > 1 && (
                <>
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    onClick={() => setSelectedImageIndex((prev) => 
                      prev !== null ? (prev - 1 + displayImages.length) % displayImages.length : 0
                    )}
                  >
                    ←
                  </button>
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    onClick={() => setSelectedImageIndex((prev) => 
                      prev !== null ? (prev + 1) % displayImages.length : 0
                    )}
                  >
                    →
                  </button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}; 
