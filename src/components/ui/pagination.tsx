import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number;
  /**
   * Total number of pages
   */
  totalPages: number;
  /**
   * Callback when page changes
   */
  onPageChange: (page: number) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Pagination component for navigating through paginated content
 * 
 * @example
 * <Pagination
 *   currentPage={1}
 *   totalPages={5}
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination navigation" className={cn("flex items-center justify-center space-x-2", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="h-8 w-8"
        aria-label={`Go to previous page (page ${currentPage - 1} of ${totalPages})`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      
      <span className="text-sm text-muted-foreground" aria-current="page" aria-label={`Current page ${currentPage} of ${totalPages} total pages`}>
        Page {currentPage} of {totalPages}
      </span>
      
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="h-8 w-8"
        aria-label={`Go to next page (page ${currentPage + 1} of ${totalPages})`}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}; 