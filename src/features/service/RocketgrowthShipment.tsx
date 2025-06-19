import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import '../products/ProductListPage.css';

/**
 * 로켓그로스 입고 페이지 컴포넌트
 * - 로켓그로스 상품 입고 관리
 * - 입고 계획 및 실행
 */
function RocketgrowthShipment() {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedStatus, setSelectedStatus] = useState('전체');
  const [isLoading, setIsLoading] = useState(false);
  
  // 데이터
  const [shipmentData, setShipmentData] = useState<any[]>([]);
  const [filteredShipmentData, setFilteredShipmentData] = useState<any[]>([]);
  
  // 선택된 항목들 관리
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadShipmentData();
  }, []);

  // 로켓그로스 입고 데이터 로드
  const loadShipmentData = async () => {
    try {
      setIsLoading(true);
      
      // 실제 데이터 로드 로직 (임시로 빈 배열)
      // TODO: 실제 로켓그로스 입고 데이터 API 연동
      const mockData: any[] = [];
      
      setShipmentData(mockData);
      setFilteredShipmentData(mockData);
    } catch (error) {
      console.error('로켓그로스 입고 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 핸들러
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setFilteredShipmentData(shipmentData);
      setCurrentPage(1);
      return;
    }

    const searchLower = searchKeyword.toLowerCase().trim();
    const filtered = shipmentData.filter(item => 
      item.product_name?.toLowerCase().includes(searchLower) ||
      item.barcode?.toLowerCase().includes(searchLower)
    );
    
    setFilteredShipmentData(filtered);
    setCurrentPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 페이지네이션
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredShipmentData.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredShipmentData.length / itemsPerPage);
  const currentData = getCurrentPageData();

  // 체크박스 선택 핸들러
  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // 전체 선택 핸들러
  const handleSelectAll = () => {
    const currentPageItems = getCurrentPageData();
    const currentPageIds = currentPageItems.map(item => item.id);
    const allSelected = currentPageIds.every(id => selectedItems.includes(id));
    
    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedItems(prev => [...prev, ...currentPageIds.filter(id => !prev.includes(id))]);
    }
  };

  // 입고 계획 생성
  const handleCreateShipmentPlan = () => {
    // TODO: 입고 계획 생성 로직
    alert('입고 계획 생성 기능은 준비 중입니다.');
  };

  // 입고 실행
  const handleExecuteShipment = () => {
    if (selectedItems.length === 0) {
      alert('입고할 상품을 선택해주세요.');
      return;
    }
    
    // TODO: 입고 실행 로직
    alert(`${selectedItems.length}개 상품 입고 실행 기능은 준비 중입니다.`);
  };

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">로켓그로스 입고</h1>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div className="product-list-filter-grid-improved">
          {/* 카테고리 */}
          <div>
            <label className="product-list-label">카테고리</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="의류">의류</option>
              <option value="신발">신발</option>
              <option value="악세서리">악세서리</option>
            </select>
          </div>

          {/* 입고 상태 */}
          <div>
            <label className="product-list-label">입고 상태</label>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="대기">입고 대기</option>
              <option value="진행">입고 진행</option>
              <option value="완료">입고 완료</option>
            </select>
          </div>

          {/* 빈 공간 */}
          <div></div>
          <div></div>

          {/* 검색창 */}
          <div className="product-list-search-container">
            <label className="product-list-label">검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="상품명 또는 바코드로 검색..."
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
        {/* 테이블 헤더 */}
        <div className="product-list-table-header-section">
          <div className="product-list-table-info">
            <div className="product-list-data-count">
              총 {filteredShipmentData.length}개 상품
            </div>
            <div className="product-list-selected-info">
              선택된 상품: {selectedItems.length}개
            </div>
          </div>
          
          <div className="product-list-action-buttons">
            <button
              onClick={loadShipmentData}
              disabled={isLoading}
              className="product-list-button product-list-button-primary"
            >
              {isLoading ? '새로고침 중...' : '새로고침'}
            </button>
            
            <button
              onClick={handleCreateShipmentPlan}
              className="product-list-button product-list-button-success"
            >
              입고 계획 생성
            </button>
            
            <button
              onClick={handleExecuteShipment}
              disabled={selectedItems.length === 0}
              className="product-list-button product-list-button-orange"
            >
              입고 실행 ({selectedItems.length})
            </button>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-wrapper">
          <table className="product-list-table">
            <thead className="product-list-table-header">
              <tr>
                <th className="product-list-table-header-cell" style={{ width: '60px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={filteredShipmentData.length > 0 && selectedItems.length === getCurrentPageData().length && getCurrentPageData().every(item => selectedItems.includes(item.id))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </th>
                <th className="product-list-table-header-cell">상품명</th>
                <th className="product-list-table-header-cell" style={{ width: '150px', textAlign: 'center' }}>바코드</th>
                <th className="product-list-table-header-cell" style={{ width: '100px', textAlign: 'center' }}>현재 재고</th>
                <th className="product-list-table-header-cell" style={{ width: '100px', textAlign: 'center' }}>추천 입고량</th>
                <th className="product-list-table-header-cell" style={{ width: '100px', textAlign: 'center' }}>계획 입고량</th>
                <th className="product-list-table-header-cell" style={{ width: '120px', textAlign: 'center' }}>입고 상태</th>
                <th className="product-list-table-header-cell" style={{ width: '120px', textAlign: 'center' }}>예상 입고일</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {currentData.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {isLoading ? '데이터를 불러오는 중...' : '로켓그로스 입고 데이터가 없습니다.'}
                  </td>
                </tr>
              )}
              {currentData.map((item, index) => {
                return (
                  <tr key={item.id} className="product-list-table-row">
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleItemSelect(item.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td className="product-list-table-cell" style={{ padding: '12px' }}>
                      {item.product_name}
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', fontFamily: 'monospace' }}>
                      {item.barcode}
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px' }}>
                      {item.current_stock}
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', color: '#0066cc' }}>
                      {item.recommended_quantity}
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', fontWeight: 'bold' }}>
                      {item.planned_quantity || '-'}
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px' }}>
                      <span className={`status-badge ${item.status}`}>
                        {item.status === 'waiting' ? '대기' : 
                         item.status === 'processing' ? '진행' : 
                         item.status === 'completed' ? '완료' : '-'}
                      </span>
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px' }}>
                      {item.expected_date || '-'}
                    </td>
                  </tr>
                );
              })}
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

export default RocketgrowthShipment; 