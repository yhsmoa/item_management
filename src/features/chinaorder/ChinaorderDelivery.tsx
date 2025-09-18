import React, { useState, useEffect } from 'react';
import DashboardStatsCard from '../products/ProductListPage/components/DashboardStatsCard';
import ActionButton from '../../components/ActionButton';
import { useGoogleSheetsImport } from './hooks/useGoogleSheetsImport';
import './ChinaorderDelivery.css';

// 🛠️ 출고중 데이터 구조 정의
interface ChinaOrderData {
  user_id?: string;
  option_id?: string;
  date?: string;
  item_name?: string;
  option_name?: string;
  barcode?: string;
  quantity?: number;
  // 추가 필드들 (나중에 확장 가능)
  created_at?: string;
  updated_at?: string;
}

// 인터페이스 정의
interface TableRow extends ChinaOrderData {
  type: 'order';
  id: string;
}

interface Stats {
  total: number;
  notItemPartner: number;
  outOfStock: number;
  rejected: number;
  selling: number;
  tempSave: number;
}

function ChinaorderDelivery() {
  // Google Sheets 가져오기 훅
  const { isLoading: sheetsLoading, handleGoogleSheetsImport } = useGoogleSheetsImport();

  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedExposure, setSelectedExposure] = useState('전체');
  const [selectedSaleStatus, setSelectedSaleStatus] = useState('전체');
  const [sortFilter, setSortFilter] = useState('전체');
  
  // 테이블 관련
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  
  // 주문 데이터 - 빈 배열로 초기화 (데이터베이스 연결 제거됨)
  const [orderData, setOrderData] = useState<ChinaOrderData[]>([]);
  const [filteredOrderData, setFilteredOrderData] = useState<ChinaOrderData[]>([]);

  // 컴포넌트 마운트 시 처리
  useEffect(() => {
    console.log('🔄 ChinaorderDelivery 컴포넌트 마운트됨');
    
    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      console.log('🧹 ChinaorderDelivery 컴포넌트 언마운트 - 메모리 정리 중...');
      
      // 대용량 상태 데이터 초기화 (메모리 절약)
      setOrderData([]);
      setFilteredOrderData([]);
      setSelectedItems([]);
      setIsLoading(false);
      setSelectAll(false);
      
      console.log('✅ ChinaorderDelivery 메모리 정리 완료');
    };
  }, []);

  // 통계 계산
  const stats: Stats = {
    total: filteredOrderData.length,
    notItemPartner: 0,
    outOfStock: 0,
    rejected: 0,
    selling: 0,
    tempSave: 0
  };

  // 데이터를 테이블 행으로 변환
  const transformDataToTableRows = (data: ChinaOrderData[]): TableRow[] => {
    return data.map((order, index) => {
      // 고유한 ID 생성: option_id와 날짜를 기본으로 사용
      const uniqueId = `${order.option_id || `order-${currentPage}-${index}`}-${order.date || index}`;
      
      return {
        ...order,
        type: 'order' as const,
        id: uniqueId
      };
    });
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setFilteredOrderData(orderData);
      setCurrentPage(1);
      setSelectedItems([]);
      setSelectAll(false);
      return;
    }

    // 정확한 문자열 매칭을 위해 toLowerCase()를 사용한 포함 검색
    const searchLower = searchKeyword.toLowerCase().trim();
    const filtered = orderData.filter(order => 
      order.option_id?.toLowerCase().includes(searchLower) ||
      order.item_name?.toLowerCase().includes(searchLower) ||
      order.option_name?.toLowerCase().includes(searchLower) ||
      order.barcode?.toLowerCase().includes(searchLower)
    );
    
    setFilteredOrderData(filtered);
    setCurrentPage(1);
    // 검색 시 선택된 항목들 초기화
    setSelectedItems([]);
    setSelectAll(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    if (!selectAll) {
      const currentTableRows = transformDataToTableRows(getCurrentPageData());
      setSelectedItems(currentTableRows.map(row => row.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (uniqueId: string) => {
    if (selectedItems.includes(uniqueId)) {
      setSelectedItems(selectedItems.filter(id => id !== uniqueId));
      setSelectAll(false);
    } else {
      setSelectedItems([...selectedItems, uniqueId]);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 페이지 변경 시 선택된 항목들 초기화
    setSelectedItems([]);
    setSelectAll(false);
  };

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredOrderData.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredOrderData.length / itemsPerPage);
  const currentTableRows = transformDataToTableRows(getCurrentPageData());

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">출고 조회</h1>
        <ActionButton
          variant="success"
          onClick={handleGoogleSheetsImport}
          loading={sheetsLoading}
          loadingText="새로고침 중..."
        >
          새로고침
        </ActionButton>
      </div>


      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
          {/* 드롭박스 1 */}
          <div>
            <label className="product-list-label">출고상태</label>
            <select
              value={selectedSaleStatus}
              onChange={(e) => setSelectedSaleStatus(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="출고준비">출고준비</option>
              <option value="출고">출고</option>
            </select>
          </div>

          {/* 드롭박스 2 */}
          <div>
            <label className="product-list-label">출고날짜</label>
            <select
              value={selectedExposure}
              onChange={(e) => setSelectedExposure(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="오늘">오늘</option>
              <option value="7일">7일</option>
              <option value="30일">30일</option>
            </select>
          </div>

          {/* 조회 버튼 */}
          <div>
            <button
              onClick={handleSearch}
              className="delivery-search-button"
              style={{
                position: 'static',
                transform: 'none',
                right: 'auto',
                top: 'auto',
                width: '100%',
                height: '42px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease-in-out'
              }}
            >
              조회
            </button>
          </div>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="product-list-table-section">
        {/* 테이블 헤더 - 데이터 개수 */}
        <div className="product-list-table-header-section">
          <div className="product-list-table-info">
            <div className="product-list-data-count">
              총 {filteredOrderData.length}개 주문
            </div>
            <div className="product-list-selected-info">
              선택된 주문: {selectedItems.length}개 / 총 {currentTableRows.length}개
            </div>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="product-list-table" key={`table-page-${currentPage}`}>
            <thead className="product-list-table-header">
              <tr>
                <th className="product-list-table-header-cell product-list-table-header-checkbox" style={{ width: '40px', padding: '1px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="product-list-checkbox-large"
                  />
                </th>
                <th className="product-list-table-header-cell" style={{ width: '80px', padding: '1px', textAlign: 'center' }}>옵션ID</th>
                <th className="product-list-table-header-cell" style={{ width: '120px', padding: '1px', textAlign: 'left' }}>상품명</th>
                <th className="product-list-table-header-cell" style={{ width: '100px', padding: '1px', textAlign: 'left' }}>옵션명</th>
                <th className="product-list-table-header-cell" style={{ width: '80px', padding: '1px', textAlign: 'center' }}>바코드</th>
                <th className="product-list-table-header-cell" style={{ width: '60px', padding: '1px', textAlign: 'center' }}>수량</th>
                <th className="product-list-table-header-cell" style={{ width: '80px', padding: '1px', textAlign: 'center' }}>날짜</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {currentTableRows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {isLoading ? '데이터를 불러오는 중...' : '출고중인 주문이 없습니다.'}
                  </td>
                </tr>
              )}
              {currentTableRows.map((row, index) => (
                <tr key={row.id} className="product-list-table-row">
                  <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '1px' }}>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(row.id)}
                      onChange={() => handleSelectItem(row.id)}
                      className="product-list-checkbox-large"
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ padding: '1px', fontSize: '11px', textAlign: 'center' }}>{row.option_id || '-'}</td>
                  <td className="product-list-table-cell" style={{ padding: '1px', textAlign: 'left', fontSize: '13px' }}>{row.item_name || '-'}</td>
                  <td className="product-list-table-cell" style={{ padding: '1px', textAlign: 'left', fontSize: '12px' }}>{row.option_name || '-'}</td>
                  <td className="product-list-table-cell" style={{ padding: '1px', fontSize: '11px', textAlign: 'center' }}>{row.barcode || '-'}</td>
                  <td className="product-list-table-cell" style={{ padding: '1px', fontSize: '12px', textAlign: 'center' }}>{row.quantity || '-'}</td>
                  <td className="product-list-table-cell" style={{ padding: '1px', fontSize: '11px', textAlign: 'center' }}>{row.date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="product-list-pagination">
          <div className="product-list-pagination-controls">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="product-list-pagination-button"
            >
              이전
            </button>
            
            <div className="product-list-pagination-info">
              {currentPage} / {totalPages}
            </div>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="product-list-pagination-button"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChinaorderDelivery; 