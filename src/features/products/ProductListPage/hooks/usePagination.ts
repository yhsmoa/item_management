// Custom hook for managing pagination
import { useState, useCallback, useMemo } from 'react';

interface UsePaginationProps {
  transformedData?: any[];
  itemsPerPage?: number;
}

export const usePagination = (props: UsePaginationProps = {}) => {
  const { transformedData = [], itemsPerPage = 100 } = props;

  // State management
  const [currentPage, setCurrentPage] = useState(1);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(transformedData.length / itemsPerPage);
  }, [transformedData.length, itemsPerPage]);

  // Get current page data
  const getCurrentPageData = useCallback(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transformedData.slice(startIndex, endIndex);
  }, [transformedData, currentPage, itemsPerPage]);

  // Current page data (cached)
  const currentData = useMemo(() => {
    return getCurrentPageData();
  }, [getCurrentPageData]);

  return {
    // State
    currentPage,
    totalPages,
    currentData,
    
    // Setters
    setCurrentPage,
    
    // Functions
    handlePageChange,
    getCurrentPageData
  };
};