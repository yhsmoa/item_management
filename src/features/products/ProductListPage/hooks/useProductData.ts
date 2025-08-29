// Custom hook for managing product data
import { useState, useCallback } from 'react';

interface SearchSuggestion {
  type: 'product' | 'barcode';
  value: string;
  display: string;
}

export const useProductData = () => {

  // State management
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState(''); // 실제 적용된 검색어
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Generate search suggestions based on data
  const generateSearchSuggestions = useCallback((keyword: string) => {
    if (!keyword.trim() || keyword.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchTerm = keyword.toLowerCase().trim();
    const suggestions: SearchSuggestion[] = [];
    const seen = new Set<string>();

    // 상품명과 바코드에서 검색어와 일치하는 것들을 찾기
    data.forEach(item => {
      // 상품명 검색
      const productName = `${item.item_name || ''} ${item.option_name || ''}`.trim();
      if (productName.toLowerCase().includes(searchTerm)) {
        const key = `product:${productName}`;
        if (!seen.has(key) && suggestions.length < 10) {
          seen.add(key);
          suggestions.push({
            type: 'product',
            value: productName,
            display: productName
          });
        }
      }

      // 바코드 검색
      if (item.barcode && item.barcode.toLowerCase().includes(searchTerm)) {
        const key = `barcode:${item.barcode}`;
        if (!seen.has(key) && suggestions.length < 10) {
          seen.add(key);
          suggestions.push({
            type: 'barcode',
            value: item.barcode,
            display: `${item.barcode} (${item.item_name || '상품명 없음'})`
          });
        }
      }
    });

    setSearchSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
  }, [data]);

  // Handle search keyword change
  const handleSearchKeywordChange = useCallback((value: string) => {
    setSearchKeyword(value);
    generateSearchSuggestions(value);
  }, [generateSearchSuggestions]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    setSearchKeyword(suggestion.value);
    setShowSuggestions(false);
    setAppliedSearchKeyword(suggestion.value); // 바로 검색 실행
  }, []);

  // Handle search execution
  const handleSearch = useCallback(() => {
    setAppliedSearchKeyword(searchKeyword); // 현재 입력된 검색어를 적용된 검색어로 설정
    setShowSuggestions(false); // 제안 목록 숨김
  }, [searchKeyword]);

  // Handle key press for search
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return {
    // State
    data,
    filteredData,
    searchKeyword,
    appliedSearchKeyword,
    searchSuggestions,
    showSuggestions,
    
    // Setters
    setData,
    setFilteredData,
    setSearchKeyword,
    setAppliedSearchKeyword,
    setSearchSuggestions,
    setShowSuggestions,
    
    // Functions
    generateSearchSuggestions,
    handleSearchKeywordChange,
    handleSuggestionSelect,
    handleSearch,
    handleKeyPress
  };
};