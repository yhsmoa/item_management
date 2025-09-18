// Main product table component
import React from 'react';

interface ProductTableProps {
  // Data
  currentData: any[];
  currentPage: number;
  
  // Selection state
  selectAll: boolean;
  selectedItems: string[];
  handleSelectAll: () => void;
  handleSelectItem: (itemKey: string) => void;
  
  // Editing state
  editingCell: string | null;
  handleCellClick: (cellId: string, row?: any) => void;
  getInputValue: (cellId: string) => string;
  getShippingValue: (cellId: string) => string;
  getReturnValue: (cellId: string) => string;
  handleInputChange: (cellId: string, value: string, row: any) => void;
  handleBlurAndSave: (row: any, cellId: string) => void;
  handleEnterKeyAndSave: (e: React.KeyboardEvent<HTMLInputElement>, row: any, cellId: string, index: number) => void;
  
  // Render functions
  renderInputValue: (row: any, index: number) => React.ReactNode;
  renderShippingValue: (row: any, index: number) => React.ReactNode;
  renderReturnValue: (row: any, index: number) => React.ReactNode;
  renderPendingInbounds: (row: any) => React.ReactNode;
  renderOrderableQuantityWithStyle: (row: any) => React.ReactNode;
  renderOrderQuantityWithStyle: (row: any) => React.ReactNode;
  renderPeriodSalesWithStyle: (row: any) => React.ReactNode;
  render7DaysSalesWithStyle: (row: any) => React.ReactNode;
  render30DaysSalesWithStyle: (row: any) => React.ReactNode;
  renderRecommendedQuantityWithStyle: (row: any) => React.ReactNode;
  renderWarehouseStockWithStyle: (row: any) => React.ReactNode;
  renderPurchaseStatusWithStyle: (row: any) => React.ReactNode;
  renderStorageFeeWithStyle: (row: any) => React.ReactNode;
  
  // Utility functions
  shouldHighlightRow: (row: any) => boolean;
  getViewCountColor: (current: string | undefined, previous?: string | undefined, isFirst?: boolean) => string;
  getViewCountByDate: (itemId: string, index: number) => string;
  handleProductNameClick: (itemId: string, optionId: string) => void;
  
  // Sets and data
  rocketInventoryOptionIds: Set<string>;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  currentData,
  currentPage,
  selectAll,
  selectedItems,
  handleSelectAll,
  handleSelectItem,
  editingCell,
  handleCellClick,
  getInputValue,
  getShippingValue,
  getReturnValue,
  handleInputChange,
  handleBlurAndSave,
  handleEnterKeyAndSave,
  renderInputValue,
  renderShippingValue,
  renderReturnValue,
  renderPendingInbounds,
  renderOrderableQuantityWithStyle,
  renderOrderQuantityWithStyle,
  renderPeriodSalesWithStyle,
  render7DaysSalesWithStyle,
  render30DaysSalesWithStyle,
  renderRecommendedQuantityWithStyle,
  renderWarehouseStockWithStyle,
  renderPurchaseStatusWithStyle,
  renderStorageFeeWithStyle,
  shouldHighlightRow,
  getViewCountColor,
  getViewCountByDate,
  handleProductNameClick,
  rocketInventoryOptionIds
}) => {
  return (
    <div className="product-list-table-wrapper">
      <table className="product-list-table product-list-page-table">
        <thead className="product-list-table-header">
          <tr>
            <th className="product-list-table-header-cell product-list-table-header-checkbox">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="product-list-checkbox-large"
              />
            </th>
            <th className="product-list-table-header-cell product-list-table-header-product">등록<br/>상품명/<br/>옵션명</th>
            <th className="product-list-table-header-cell" style={{ width: '50px', textAlign: 'center', padding: '0' }}>타입</th>
            <th className="product-list-table-header-cell product-list-table-header-number">입력</th>
            <th className="product-list-table-header-cell product-list-table-header-number">입고<br/>중</th>
            <th className="product-list-table-header-cell product-list-table-header-number">쿠팡<br/>재고</th>
            <th className="product-list-table-header-cell product-list-table-header-number">사입<br/>상태</th>
            <th className="product-list-table-header-cell product-list-table-header-number">개인<br/>주문</th>
            <th className="product-list-table-header-cell product-list-table-header-number">기간</th>
            <th className="product-list-table-header-cell product-list-table-header-number">7일</th>
            <th className="product-list-table-header-cell product-list-table-header-number">30일</th>
            <th className="product-list-table-header-cell product-list-table-header-number">쿠팡<br/>추천</th>
            <th className="product-list-table-header-cell product-list-table-header-number">창고<br/>재고</th>
            <th className="product-list-table-header-cell product-list-table-header-number">창고<br/>비</th>
            <th className="product-list-table-header-cell product-list-table-header-number">view1</th>
            <th className="product-list-table-header-cell product-list-table-header-number">view2</th>
            <th className="product-list-table-header-cell product-list-table-header-number">view3</th>
            <th className="product-list-table-header-cell product-list-table-header-number">view4</th>
            <th className="product-list-table-header-cell product-list-table-header-number">view5</th>
            <th className="product-list-table-header-cell product-list-table-header-number">원가</th>
            <th className="product-list-table-header-cell product-list-table-header-number">가격</th>
            <th className="product-list-table-header-cell product-list-table-header-number">마진</th>
            <th className="product-list-table-header-cell product-list-table-header-number">출고</th>
            <th className="product-list-table-header-cell product-list-table-header-number">반출</th>
            <th className="product-list-table-header-cell product-list-table-header-number">할인</th>
          </tr>
        </thead>
        <tbody className="product-list-table-body">
          {currentData.map((row, index) => {
            const isEditing = editingCell === `input-${row.item_id}-${row.option_id || index}`;
            const uniqueKey = `${currentPage}-${index}-${row.item_id}-${row.option_id || 'no-option'}`;

            // item_id가 이전 행과 다른지 확인하여 경계선 표시
            const isNewItemGroup = index > 0 && currentData[index - 1].item_id !== row.item_id;

            return (
            <tr
              key={uniqueKey}
              className={`product-list-table-row ${row.type === 'item' ? 'product-list-table-row-item' : 'product-list-table-row-option'} ${isEditing ? 'editing-active' : ''} ${shouldHighlightRow(row) ? 'product-list-table-row-green-bg' : ''} ${isNewItemGroup ? 'product-list-table-row-item-border' : ''}`}
            >
              <td className="product-list-table-cell">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(`${row.item_id}-${row.option_id || index}`)}
                  onChange={() => handleSelectItem(`${row.item_id}-${row.option_id || index}`)}
                  className="product-list-checkbox-large"
                />
              </td>
              <td 
                className="product-list-table-cell" 
                style={{ 
                  whiteSpace: 'pre-line', 
                  maxWidth: '300px', 
                  padding: '8px 0px',
                  cursor: row.option_id ? 'pointer' : 'default'
                }}
                onClick={() => row.option_id && handleProductNameClick(row.item_id, row.option_id)}
              >
                {row.product_name}
              </td>
              <td 
                className="product-list-table-cell" 
                style={{ 
                  width: '50px', 
                  textAlign: 'center', 
                  padding: '0',
                  verticalAlign: 'middle' 
                }}
              >
                {/* 로켓 인벤토리에 있는 option_id인 경우 주황색 동그라미 표시 */}
                {row.option_id && rocketInventoryOptionIds.has(String(row.option_id)) ? (
                  <div 
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#ff9800',
                      margin: '0 auto',
                      display: 'inline-block'
                    }}
                    title="로켓그로스 상품"
                  ></div>
                ) : null}
              </td>
              <td 
                className="product-list-table-cell product-list-editable-cell" 
                onClick={() => handleCellClick(`input-${row.item_id}-${row.option_id || index}`)}
                style={{ cursor: 'pointer', backgroundColor: editingCell === `input-${row.item_id}-${row.option_id || index}` ? '#f0f8ff' : 'transparent' }}
              >
                {editingCell === `input-${row.item_id}-${row.option_id || index}` ? (
                  <input
                    type="text"
                    value={getInputValue(`input-${row.item_id}-${row.option_id || index}`)}
                    onChange={(e) => handleInputChange(`input-${row.item_id}-${row.option_id || index}`, e.target.value, row)}
                    onBlur={() => handleBlurAndSave(row, `input-${row.item_id}-${row.option_id || index}`)}
                    onKeyPress={(e) => handleEnterKeyAndSave(e, row, `input-${row.item_id}-${row.option_id || index}`, index)}
                    autoFocus
                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center' }}
                  />
                ) : (
                  renderInputValue(row, index)
                )}
              </td>
              <td className="product-list-table-cell">
                {renderPendingInbounds(row)}
              </td>
              <td className="product-list-table-cell">
                {renderOrderableQuantityWithStyle(row)}
              </td>
              <td className="product-list-table-cell">
                {/* 🆕 사입상태: 바코드별 주문+배송 상태 합계 표시 */}
                {renderPurchaseStatusWithStyle(row)}
              </td>
              <td className="product-list-table-cell">
                {/* 🆕 개인주문: 현재 사용하지 않음 (사입상태만 표시) */}
                -
              </td>
              <td className="product-list-table-cell">
                {/* 🆕 기간 열: 쿠팡 판매량 데이터 표시 */}
                {renderPeriodSalesWithStyle(row)}
              </td>
              <td className="product-list-table-cell">
                {render7DaysSalesWithStyle(row)}
              </td>
              <td className="product-list-table-cell">
                {render30DaysSalesWithStyle(row)}
              </td>
              <td className="product-list-table-cell">
                {renderRecommendedQuantityWithStyle(row)}
              </td>
              <td className="product-list-table-cell">
                {/* 🆕 창고재고: 바코드별 재고 합계 표시 */}
                {renderWarehouseStockWithStyle(row)}
              </td>
              <td className="product-list-table-cell">
                {renderStorageFeeWithStyle(row)}
              </td>
              <td className="product-list-table-cell" style={{ color: getViewCountColor(getViewCountByDate(row.item_id, 0), undefined, true) }}>
                {/* 🔄 view1: 가장 오래된 날짜 데이터 */}
                {getViewCountByDate(row.item_id, 0)}
              </td>
              <td className="product-list-table-cell" style={{ color: getViewCountColor(getViewCountByDate(row.item_id, 1), getViewCountByDate(row.item_id, 0), false) }}>
                {/* 🔄 view2: view1과 비교 */}
                {getViewCountByDate(row.item_id, 1)}
              </td>
              <td className="product-list-table-cell" style={{ color: getViewCountColor(getViewCountByDate(row.item_id, 2), getViewCountByDate(row.item_id, 1), false) }}>
                {/* 🔄 view3: view2와 비교 */}
                {getViewCountByDate(row.item_id, 2)}
              </td>
              <td className="product-list-table-cell" style={{ color: getViewCountColor(getViewCountByDate(row.item_id, 3), getViewCountByDate(row.item_id, 2), false) }}>
                {/* 🔄 view4: view3과 비교 */}
                {getViewCountByDate(row.item_id, 3)}
              </td>
              <td className="product-list-table-cell" style={{ color: getViewCountColor(getViewCountByDate(row.item_id, 4), getViewCountByDate(row.item_id, 3), false) }}>
                {/* 🔄 view5: view4와 비교 (가장 최근 날짜) */}
                {getViewCountByDate(row.item_id, 4)}
              </td>
              <td className="product-list-table-cell">-</td>
              <td className="product-list-table-cell" style={{ textAlign: 'right', fontWeight: '600', color: '#000000' }}>
                {row.sale_price ? new Intl.NumberFormat('ko-KR').format(row.sale_price) + '원' : '-'}
              </td>
              <td className="product-list-table-cell">-</td>
              <td 
                className="product-list-table-cell product-list-editable-cell shipping-cell" 
                onClick={() => handleCellClick(`shipping-${row.item_id}-${row.option_id || index}`, row)}
                style={{ cursor: 'pointer', backgroundColor: editingCell === `shipping-${row.item_id}-${row.option_id || index}` ? '#d6ebff' : undefined }}
              >
                {editingCell === `shipping-${row.item_id}-${row.option_id || index}` ? (
                  <input
                    type="text"
                    value={getShippingValue(`shipping-${row.item_id}-${row.option_id || index}`)}
                    onChange={(e) => handleInputChange(`shipping-${row.item_id}-${row.option_id || index}`, e.target.value, row)}
                    onBlur={() => handleBlurAndSave(row, `shipping-${row.item_id}-${row.option_id || index}`)}
                    onKeyPress={(e) => handleEnterKeyAndSave(e, row, `shipping-${row.item_id}-${row.option_id || index}`, index)}
                    autoFocus
                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center' }}
                  />
                ) : (
                  renderShippingValue(row, index)
                )}
              </td>
              <td 
                className="product-list-table-cell product-list-editable-cell return-cell" 
                onClick={() => handleCellClick(`return-${row.item_id}-${row.option_id || index}`, row)}
                style={{ cursor: 'pointer', backgroundColor: editingCell === `return-${row.item_id}-${row.option_id || index}` ? '#ffd6d6' : undefined }}
              >
                {editingCell === `return-${row.item_id}-${row.option_id || index}` ? (
                  <input
                    type="text"
                    value={getReturnValue(`return-${row.item_id}-${row.option_id || index}`)}
                    onChange={(e) => handleInputChange(`return-${row.item_id}-${row.option_id || index}`, e.target.value, row)}
                    onBlur={() => handleBlurAndSave(row, `return-${row.item_id}-${row.option_id || index}`)}
                    onKeyPress={(e) => handleEnterKeyAndSave(e, row, `return-${row.item_id}-${row.option_id || index}`, index)}
                    autoFocus
                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center' }}
                  />
                ) : (
                  renderReturnValue(row, index)
                )}
              </td>
              <td className="product-list-table-cell">-</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;