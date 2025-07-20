import { useState, useMemo, useCallback } from "react";

/**
 * Configuration options for pagination
 */
interface PaginationOptions {
  /** Initial page number (default: 1) */
  initialPage?: number;
  /** Initial number of items per page (default: 10) */
  initialPageSize?: number;
  /** Available page size options (default: [10, 25, 50, 100]) */
  pageSizeOptions?: number[];
}

/**
 * Result object returned by usePagination hook
 *
 * @template T - The type of items being paginated
 */
interface PaginationResult<T> {
  /** Current page number (1-based) */
  currentPage: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Items for the current page */
  paginatedData: T[];
  /** Function to navigate to a specific page */
  goToPage: (page: number) => void;
  /** Function to go to the next page */
  nextPage: () => void;
  /** Function to go to the previous page */
  previousPage: () => void;
  /** Function to change the page size */
  setPageSize: (size: number) => void;
  /** Whether there is a next page available */
  canGoNext: boolean;
  /** Whether there is a previous page available */
  canGoPrevious: boolean;
  /** Array of page numbers for pagination UI (includes -1 for ellipsis) */
  pageRange: number[];
}

/**
 * Custom hook for handling pagination logic
 *
 * Provides complete pagination functionality including data slicing,
 * navigation controls, and page range calculation for UI components.
 * Automatically handles edge cases and provides a clean API for pagination.
 *
 * @template T - The type of items being paginated
 * @param data - Array of items to paginate
 * @param options - Configuration options for pagination
 * @returns Object containing paginated data and control functions
 *
 * @example
 * ```tsx
 * const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const {
 *   paginatedData,
 *   currentPage,
 *   totalPages,
 *   nextPage,
 *   previousPage,
 *   goToPage,
 *   canGoNext,
 *   canGoPrevious
 * } = usePagination(items, { initialPageSize: 3 });
 *
 * return (
 *   <div>
 *     {paginatedData.map(item => <div key={item}>{item}</div>)}
 *     <button onClick={previousPage} disabled={!canGoPrevious}>
 *       Previous
 *     </button>
 *     <span>Page {currentPage} of {totalPages}</span>
 *     <button onClick={nextPage} disabled={!canGoNext}>
 *       Next
 *     </button>
 *   </div>
 * );
 * ```
 */
export function usePagination<T>(data: T[], options: PaginationOptions = {}): PaginationResult<T> {
  const {
    initialPage = 1,
    initialPageSize = 10,
    pageSizeOptions: _pageSizeOptions = [10, 25, 50, 100],
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  // Navigation functions
  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const previousPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    // Reset to first page when page size changes
    setCurrentPage(1);
  }, []);

  // Generate page range for pagination UI
  const pageRange = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      // Always show first page
      range.push(1);

      if (currentPage > 3) {
        range.push(-1); // Ellipsis
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        range.push(i);
      }

      if (currentPage < totalPages - 2) {
        range.push(-1); // Ellipsis
      }

      // Always show last page
      if (totalPages > 1) {
        range.push(totalPages);
      }
    }

    return range;
  }, [currentPage, totalPages]);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    goToPage,
    nextPage,
    previousPage,
    setPageSize: handleSetPageSize,
    canGoNext: currentPage < totalPages,
    canGoPrevious: currentPage > 1,
    pageRange,
  };
}
