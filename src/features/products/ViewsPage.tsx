import React, { useState } from 'react';
import DashboardStatsCard from './components/DashboardStatsCard';
import './ProductListPage.css';

function ViewsPage() {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 더미 통계 데이터
  const stats = {
    total: 0,
    notItemPartner: 0,
    outOfStock: 0,
    rejected: 0,
    selling: 0,
    tempSave: 0
  };

  // 검색 핸들러
  const handleSearch = () => {
    // 검색 로직 구현 예정
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 선택 핸들러
  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    if (!selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
      setSelectAll(false);
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  // 페이지네이션 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = 1; // 데이터가 없으므로 1페이지
  const currentData: any[] = []; // 빈 배열

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">쿠팡 조회수 관리</h1>
      </div>

      {/* 통계 카드 섹션 */}
      <div className="product-list-stats-grid">
        <DashboardStatsCard title="전체" value={stats.total} color="default" />
        <DashboardStatsCard title="아이템파너 아님" value={stats.notItemPartner} hasInfo={true} subtitle="쿠팡 배송 성장 20% 상품 中" color="orange" />
        <DashboardStatsCard title="품절" value={stats.outOfStock} color="red" />
        <DashboardStatsCard title="승인반려" value={stats.rejected} hasInfo={true} color="red" />
        <DashboardStatsCard title="판매중" value={stats.selling} color="blue" />
        <DashboardStatsCard title="임시저장" value={stats.tempSave} color="default" />
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div className="product-list-filter-grid-improved">
          {/* 검색창 */}
          <div className="product-list-search-container">
            <label className="product-list-label">검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="등록상품명으로 검색... (Enter 키로 검색)"
                className="product-list-search-input"
              />
              <button 
                onClick={handleSearch}
                className="product-list-search-button"
              >
                🔍
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="product-list-table-section">
        {/* 테이블 헤더 - 데이터 개수와 액션 버튼들 */}
        <div className="product-list-table-header-section">
          <div className="product-list-table-info">
            <div className="product-list-data-count">
              총 {currentData.length}개 상품
            </div>
            <div className="product-list-selected-info">
              선택된 상품: {selectedItems.length}개 / 총 {currentData.length}개
            </div>
          </div>
          
          <div className="product-list-action-buttons">
            <button
              className="product-list-button product-list-button-success"
              disabled
            >
              액션 버튼 1
            </button>
            
            <button
              className="product-list-button product-list-button-primary"
              disabled
            >
              액션 버튼 2
            </button>

            <button
              className="product-list-button product-list-button-info"
              disabled
            >
              액션 버튼 3
            </button>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="product-list-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ width: '120px' }}>등록상품id</th>
                <th style={{ width: '300px' }}>등록상품명/옵션명</th>
              </tr>
            </thead>
            <tbody>
              {currentData.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="product-list-pagination">
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
        )}
      </div>
    </div>
  );
}

export default ViewsPage;