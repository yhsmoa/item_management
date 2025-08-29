// Search section component
import React from 'react';
import { SearchSuggestion } from '../types';

interface SearchSectionProps {
  sortFilter: string;
  setSortFilter: (value: string) => void;
  selectedExposure: string;
  setSelectedExposure: (value: string) => void;
  selectedSaleStatus: string;
  setSelectedSaleStatus: (value: string) => void;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  searchKeyword: string;
  handleSearchKeywordChange: (value: string) => void;
  handleKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSearch: () => void;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  searchSuggestions: SearchSuggestion[];
  handleSuggestionSelect: (suggestion: SearchSuggestion) => void;
}

export const SearchSection: React.FC<SearchSectionProps> = ({
  sortFilter,
  setSortFilter,
  selectedExposure,
  setSelectedExposure,
  selectedSaleStatus,
  setSelectedSaleStatus,
  searchFilter,
  setSearchFilter,
  searchKeyword,
  handleSearchKeywordChange,
  handleKeyPress,
  handleSearch,
  showSuggestions,
  setShowSuggestions,
  searchSuggestions,
  handleSuggestionSelect
}) => {
  return (
    <div className="product-list-filter-section">
      <div className="product-list-filter-grid-improved">
        {/* 판매방식 필터 (첫 번째로 이동) */}
        <div>
          <label className="product-list-label">판매방식</label>
          <select 
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value)}
            className="product-list-select"
          >
            <option value="전체">전체</option>
            <option value="로켓그로스">로켓그로스</option>
            <option value="일반판매">일반판매</option>
            <option value="사입보기">사입보기</option>
          </select>
        </div>

        {/* 노출상태 */}
        <div>
          <label className="product-list-label">노출상태</label>
          <select 
            value={selectedExposure}
            onChange={(e) => setSelectedExposure(e.target.value)}
            className="product-list-select"
          >
            <option value="전체">전체</option>
            <option value="APPROVAL">승인</option>
            <option value="ON_SALE">판매중</option>
            <option value="REJECT">반려</option>
            <option value="SUSPENSION">일시중단</option>
          </select>
        </div>

        {/* 판매상태 */}
        <div>
          <label className="product-list-label">판매상태</label>
          <select 
            value={selectedSaleStatus}
            onChange={(e) => setSelectedSaleStatus(e.target.value)}
            className="product-list-select"
          >
            <option value="전체">전체</option>
            <option value="ONSALE">판매중</option>
            <option value="OUTOFSTOCK">품절</option>
            <option value="SUSPENSION">판매중단</option>
          </select>
        </div>

        {/* 검색필터 */}
        <div>
          <label className="product-list-label">검색필터</label>
          <select 
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="product-list-select"
          >
            <option value="상품명">상품명</option>
            <option value="옵션id">옵션id</option>
            <option value="바코드">바코드</option>
          </select>
        </div>

        {/* 검색창 */}
        <div className="product-list-search-container" style={{ position: 'relative' }}>
          <label className="product-list-label">검색</label>
          <div className="product-list-search-wrapper" style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => handleSearchKeywordChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => searchKeyword.length >= 2 && setShowSuggestions(searchSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="콤마, 공백, 줄바꿈으로 여러개 검색 가능 (최대 100개)"
              className="product-list-search-input"
            />
            <span 
              onClick={handleSearch}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              🔍
            </span>
            
            {/* 검색 자동완성 드롭다운 */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000
                }}
              >
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.type}-${index}`}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: index < searchSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        marginRight: '8px',
                        backgroundColor: suggestion.type === 'product' ? '#dbeafe' : '#fef3c7',
                        color: suggestion.type === 'product' ? '#1e40af' : '#92400e'
                      }}
                    >
                      {suggestion.type === 'product' ? '상품' : '바코드'}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {suggestion.display}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchSection;