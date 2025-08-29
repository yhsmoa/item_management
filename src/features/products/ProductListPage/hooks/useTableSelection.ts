// Custom hook for managing table selection
import { useState, useCallback } from 'react';

interface UseTableSelectionProps {
  transformedData?: any[];
}

export const useTableSelection = (props: UseTableSelectionProps = {}) => {
  const { transformedData = [] } = props;

  // State management
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Handle select all functionality
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      // 전체 선택 해제
      setSelectedItems([]);
    } else {
      // 전체 선택 (item 타입만)
      const itemIds = transformedData
        .filter(row => row.type === 'item')
        .map(row => `${row.item_id}-${row.option_id || 'default'}`);
      setSelectedItems(itemIds);
    }
    setSelectAll(!selectAll);
  }, [selectAll, transformedData]);

  // Handle individual item selection
  const handleSelectItem = useCallback((uniqueId: string) => {
    if (selectedItems.includes(uniqueId)) {
      setSelectedItems(selectedItems.filter(id => id !== uniqueId));
    } else {
      setSelectedItems([...selectedItems, uniqueId]);
    }
  }, [selectedItems]);

  return {
    // State
    selectedItems,
    selectAll,
    
    // Setters
    setSelectedItems,
    setSelectAll,
    
    // Functions
    handleSelectAll,
    handleSelectItem
  };
};