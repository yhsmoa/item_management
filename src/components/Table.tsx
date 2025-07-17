import React from 'react';
import styled from 'styled-components';

/**
 * 테이블 컬럼 정의 타입
 */
interface TableColumn {
  key: string;
  title: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

/**
 * 테이블 액션 정의 타입
 */
interface TableAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

/**
 * Table Props 타입 정의
 */
interface TableProps<T = any, K = string | number> {
  columns: TableColumn[];
  data: T[];
  // 선택 기능
  selectable?: boolean;
  selectedItems?: K[];
  onSelectItem?: (itemId: K) => void;
  onSelectAll?: () => void;
  getItemId?: (item: T) => K;
  // 액션 버튼
  actions?: TableAction[];
  // 기타 옵션
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

/**
 * 재사용 가능한 테이블 컴포넌트
 * - 정렬, 선택, 액션 버튼 등의 기능 제공
 * - 다양한 페이지에서 공통으로 사용 가능
 */
const Table = <T = any, K = string | number>({
  columns,
  data,
  selectable = false,
  selectedItems = [],
  onSelectItem,
  onSelectAll,
  getItemId = (item: T) => (item as any).id,
  actions = [],
  emptyMessage = '데이터가 없습니다.',
  loading = false,
  className
}: TableProps<T, K>) => {
  const allSelected = selectable && data.length > 0 && selectedItems.length === data.length;
  const hasSelectedItems = selectedItems.length > 0;

  return (
    <TableContainer className={className}>
      {/* 테이블 헤더 액션 */}
      {(actions.length > 0 || selectable) && (
        <TableHeader>
          <TableActions>
            {selectable && onSelectAll && (
              <ActionButton
                onClick={onSelectAll}
                variant="secondary"
              >
                {allSelected ? '전체 해제' : '전체 선택'}
              </ActionButton>
            )}
            {hasSelectedItems && actions.map((action, index) => (
              <ActionButton
                key={index}
                onClick={action.onClick}
                variant={action.variant || 'secondary'}
                disabled={action.disabled}
              >
                {action.label} {hasSelectedItems && `(${selectedItems.length})`}
              </ActionButton>
            ))}
          </TableActions>
          <TableInfo>
            총 {data.length}개 항목
          </TableInfo>
        </TableHeader>
      )}

      {/* 테이블 래퍼 */}
      <TableWrapper>
        <StyledTable>
          <TableHead>
            <tr>
              {selectable && (
                <th style={{ width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th 
                  key={column.key}
                  style={{ 
                    width: column.width,
                    textAlign: column.align || 'left'
                  }}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </TableHead>
          <TableBody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <EmptyState>로딩 중...</EmptyState>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <EmptyState>{emptyMessage}</EmptyState>
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const itemId = getItemId(row);
                const isSelected = selectedItems.includes(itemId);
                
                return (
                  <TableRow key={rowIndex} $selected={isSelected}>
                    {selectable && (
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onSelectItem?.(itemId)}
                        />
                      </td>
                    )}
                                         {columns.map((column) => (
                       <td 
                         key={column.key}
                         style={{ textAlign: column.align || 'left' }}
                       >
                         {column.render 
                           ? column.render((row as any)[column.key], row)
                           : (row as any)[column.key]
                         }
                       </td>
                     ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </StyledTable>
      </TableWrapper>
    </TableContainer>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 테이블 컨테이너
 */
const TableContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
`;

/**
 * 테이블 헤더
 */
const TableHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
`;

/**
 * 테이블 액션
 */
const TableActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;

  @media (max-width: 768px) {
    justify-content: center;
  }
`;

/**
 * 액션 버튼
 */
const ActionButton = styled.button<{ variant?: string }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #4f46e5;
          color: white;
          &:hover { background: #3b37f3; }
        `;
      case 'danger':
        return `
          background: #ef4444;
          color: white;
          &:hover { background: #dc2626; }
        `;
      default:
        return `
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          &:hover { background: #e5e7eb; }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/**
 * 테이블 정보
 */
const TableInfo = styled.div`
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
`;

/**
 * 테이블 래퍼
 */
const TableWrapper = styled.div`
  overflow-x: auto;
`;

/**
 * 스타일드 테이블
 */
const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
`;

/**
 * 테이블 헤드
 */
const TableHead = styled.thead`
  background: #f9fafb;

  th {
    padding: 16px 12px;
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
  }
`;

/**
 * 테이블 바디
 */
const TableBody = styled.tbody``;

/**
 * 테이블 로우
 */
const TableRow = styled.tr<{ $selected?: boolean }>`
  background: ${props => props.$selected ? '#f0f9ff' : 'white'};
  transition: background-color 0.2s ease;

  &:hover {
    background: #f9fafb;
  }

  td {
    padding: 16px 12px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 14px;
    color: #374151;
    vertical-align: middle;
  }
`;

/**
 * 빈 상태 메시지
 */
const EmptyState = styled.div`
  text-align: center;
  padding: 48px;
  color: #6b7280;
  font-style: italic;
`;

export default Table; 