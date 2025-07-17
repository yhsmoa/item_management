import React from 'react';
import styled from 'styled-components';

/**
 * 필터 옵션 타입 정의
 */
interface FilterOption {
  value: string;
  label: string;
}

/**
 * SearchBoard Props 타입 정의
 */
interface SearchBoardProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: {
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    placeholder?: string;
  }[];
  className?: string;
}

/**
 * 재사용 가능한 검색 및 필터 컴포넌트
 * - 검색 입력과 필터 드롭다운을 제공
 * - 다양한 페이지에서 공통으로 사용 가능
 */
const SearchBoard: React.FC<SearchBoardProps> = ({
  searchPlaceholder = '검색어를 입력하세요...',
  searchValue,
  onSearchChange,
  filters = [],
  className
}) => {
  return (
    <SearchBoardContainer className={className}>
      <SearchGroup>
        <SearchInput
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </SearchGroup>
      
      {filters.length > 0 && (
        <FilterGroup>
          {filters.map((filter, index) => (
            <FilterSelect
              key={index}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
            >
              {filter.placeholder && (
                <option value="">{filter.placeholder}</option>
              )}
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
          ))}
        </FilterGroup>
      )}
    </SearchBoardContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 검색 보드 컨테이너
 */
const SearchBoardContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

/**
 * 검색 그룹
 */
const SearchGroup = styled.div`
  flex: 1;
`;

/**
 * 검색 입력 필드
 */
const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

/**
 * 필터 그룹
 */
const FilterGroup = styled.div`
  display: flex;
  gap: 12px;

  @media (max-width: 768px) {
    flex-wrap: wrap;
  }
`;

/**
 * 필터 선택 드롭다운
 */
const FilterSelect = styled.select`
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 120px;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  @media (max-width: 768px) {
    min-width: 100px;
    flex: 1;
  }
`;

export default SearchBoard; 