import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import '../../features/products/ProductListPage.css';

/**
 * 재고 관리 페이지 컴포넌트
 * - 재고 목록 조회 및 관리
 * - 재고 수정 및 업데이트 기능
 */
function StockManagement() {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [isLoading, setIsLoading] = useState(false);
  
  // 재고 데이터
  const [stockData, setStockData] = useState<any[]>([]);
  const [filteredStockData, setFilteredStockData] = useState<any[]>([]);
  
  // 선택된 항목들 관리
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  // 편집 상태 관리
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{[key: string]: string}>({});

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 컴포넌트 마운트 시 데이터 로드 + 🧹 메모리 누수 방지
  useEffect(() => {
    console.log('🔄 StockManagement 컴포넌트 마운트됨');
    loadStockData();
    
    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      console.log('🧹 StockManagement 컴포넌트 언마운트 - 메모리 정리 중...');
      
      // 대용량 상태 데이터 초기화 (메모리 절약)
      setStockData([]);
      setFilteredStockData([]);
      setSelectedItems([]);
      setEditValues({});
      setIsLoading(false);
      setEditingCell(null);
      
      console.log('✅ StockManagement 메모리 정리 완료');
    };
  }, []);

  // 현재 사용자 ID 가져오기
  const getCurrentUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id) {
        return user.id; // 실제 user ID 반환
      }
      
      // 대체 방법: localStorage에서 가져오기
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        return userData.id || userData.email || 'temp_user';
      }
      
      return 'temp_user'; // 임시 사용자 ID
    } catch (error) {
      console.error('❌ 사용자 정보 가져오기 오류:', error);
      return 'temp_user';
    }
  };

  // 재고 데이터 로드 (Supabase에서)
  const loadStockData = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('❌ 로그인된 사용자가 없습니다.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('stocks_management')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: false });

      if (error) {
        return;
      }

      setStockData(data || []);
      setFilteredStockData(data || []);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 핸들러
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setFilteredStockData(stockData);
      setCurrentPage(1);
      return;
    }

    const searchLower = searchKeyword.toLowerCase().trim();
    const filtered = stockData.filter(stock => 
      stock.item_name?.toLowerCase().includes(searchLower) ||
      stock.barcode?.toLowerCase().includes(searchLower)
    );
    
    setFilteredStockData(filtered);
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
    return filteredStockData.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredStockData.length / itemsPerPage);
  const currentData = getCurrentPageData();

  // 체크박스 선택 핸들러
  const handleItemSelect = (itemId: number) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // 전체 선택 핸들러 (현재 페이지만)
  const handleSelectAll = () => {
    const currentPageItems = getCurrentPageData();
    const currentPageIds = currentPageItems.map(item => item.id);
    const allSelected = currentPageIds.every(id => selectedItems.includes(id));
    
    if (allSelected) {
      // 현재 페이지 아이템들을 선택 해제
      setSelectedItems(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // 현재 페이지 아이템들을 선택
      setSelectedItems(prev => [...prev, ...currentPageIds.filter(id => !prev.includes(id))]);
    }
  };

  // 편집 모드 시작
  const handleCellClick = (cellId: string, currentValue: string | number) => {
    setEditingCell(cellId);
    setEditValues(prev => ({
      ...prev,
      [cellId]: String(currentValue)
    }));
  };

  // 편집 값 변경
  const handleEditValueChange = (cellId: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [cellId]: value
    }));
  };

  // 편집 완료 (blur 또는 Enter)
  const handleEditComplete = async (cellId: string, stockId: number, field: 'stock' | 'location') => {
    const newValue = editValues[cellId];
    if (!newValue) return;

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      let updateData: any = {};
      
      if (field === 'stock') {
        const stockValue = parseInt(newValue);
        if (isNaN(stockValue) || stockValue < 0) {
          alert('올바른 재고 수량을 입력해주세요.');
          return;
        }
        updateData.stock = stockValue;
      } else if (field === 'location') {
        updateData.location = newValue.trim();
      }

      const { error } = await supabase
        .from('stocks_management')
        .update(updateData)
        .eq('id', stockId)
        .eq('user_id', userId);

      if (error) {
        console.error('업데이트 오류:', error);
        alert('수정 중 오류가 발생했습니다.');
        return;
      }

      // 로컬 데이터 업데이트
      setStockData(prev => prev.map(stock => 
        stock.id === stockId ? { ...stock, ...updateData } : stock
      ));
      setFilteredStockData(prev => prev.map(stock => 
        stock.id === stockId ? { ...stock, ...updateData } : stock
      ));

    } catch (error) {
      console.error('수정 중 오류:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setEditingCell(null);
    }
  };

  // Enter 키 처리 (편집용)
  const handleEditKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, cellId: string, stockId: number, field: 'stock' | 'location') => {
    if (e.key === 'Enter') {
      handleEditComplete(cellId, stockId, field);
    }
  };

  // 선택된 항목들 삭제
  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    if (!window.confirm(`선택된 ${selectedItems.length}개 항목을 삭제하시겠습니까?`)) {
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const { error } = await supabase
        .from('stocks_management')
        .delete()
        .in('id', selectedItems)
        .eq('user_id', userId);

      if (error) {
        alert('삭제 중 오류가 발생했습니다.');
        return;
      }

      // 데이터 다시 로드
      await loadStockData();
      
      // 선택 해제
      setSelectedItems([]);
      
      alert(`${selectedItems.length}개 항목이 삭제되었습니다.`);
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">재고 관리</h1>
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

          {/* 재고 상태 */}
          <div>
            <label className="product-list-label">재고 상태</label>
            <select 
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="정상">정상</option>
              <option value="부족">부족</option>
              <option value="과다">과다</option>
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
                placeholder="상품명 또는 SKU를 입력하세요..."
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
              총 {filteredStockData.length}개 상품
            </div>
          </div>
          
          <div className="product-list-action-buttons">
            <button
              onClick={loadStockData}
              disabled={isLoading}
              className="product-list-button product-list-button-primary"
            >
              {isLoading ? '새로고침 중...' : '새로고침'}
            </button>
            
            <button
              onClick={handleDeleteSelected}
              disabled={selectedItems.length === 0}
              className="product-list-button product-list-button-danger"
            >
              삭제 ({selectedItems.length})
            </button>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="product-list-table">
            <thead className="product-list-table-header">
              <tr>
                <th className="product-list-table-header-cell" style={{ width: '60px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={filteredStockData.length > 0 && selectedItems.length === getCurrentPageData().length && getCurrentPageData().every(item => selectedItems.includes(item.id))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </th>
                <th className="product-list-table-header-cell" style={{ width: '180px', textAlign: 'center' }}>바코드</th>
                <th className="product-list-table-header-cell" style={{ width: '300px', textAlign: 'left' }}>상품명</th>
                <th className="product-list-table-header-cell" style={{ width: '100px', textAlign: 'center' }}>재고</th>
                <th className="product-list-table-header-cell" style={{ width: '120px', textAlign: 'center' }}>위치</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {currentData.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {isLoading ? '데이터를 불러오는 중...' : '재고 데이터가 없습니다.'}
                  </td>
                </tr>
              )}
              {currentData.map((stock, index) => {
                return (
                  <tr key={stock.id} className="product-list-table-row">
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(stock.id)}
                        onChange={() => handleItemSelect(stock.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', fontFamily: 'monospace' }}>
                      {stock.barcode}
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'left', padding: '12px' }}>
                      {stock.item_name}
                    </td>
                    <td 
                      className="product-list-table-cell" 
                      style={{ textAlign: 'center', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleCellClick(`stock-${stock.id}`, stock.stock)}
                    >
                      {editingCell === `stock-${stock.id}` ? (
                        <input
                          type="number"
                          value={editValues[`stock-${stock.id}`] || ''}
                          onChange={(e) => handleEditValueChange(`stock-${stock.id}`, e.target.value)}
                          onBlur={() => handleEditComplete(`stock-${stock.id}`, stock.id, 'stock')}
                          onKeyPress={(e) => handleEditKeyPress(e, `stock-${stock.id}`, stock.id, 'stock')}
                          autoFocus
                          style={{ 
                            width: '100%', 
                            textAlign: 'center', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent',
                            fontWeight: 'bold',
                            // 숫자 입력 필드의 스피너 버튼 제거
                            MozAppearance: 'textfield' // Firefox용
                          }}
                          // Chrome, Safari, Edge용 스피너 버튼 제거
                          className="no-spinner"
                        />
                      ) : (
                        stock.stock
                      )}
                    </td>
                    <td 
                      className="product-list-table-cell" 
                      style={{ textAlign: 'center', padding: '12px', cursor: 'pointer' }}
                      onClick={() => handleCellClick(`location-${stock.id}`, stock.location)}
                    >
                      {editingCell === `location-${stock.id}` ? (
                        <input
                          type="text"
                          value={editValues[`location-${stock.id}`] || ''}
                          onChange={(e) => handleEditValueChange(`location-${stock.id}`, e.target.value)}
                          onBlur={() => handleEditComplete(`location-${stock.id}`, stock.id, 'location')}
                          onKeyPress={(e) => handleEditKeyPress(e, `location-${stock.id}`, stock.id, 'location')}
                          autoFocus
                          style={{ 
                            width: '100%', 
                            textAlign: 'center', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent'
                          }}
                        />
                      ) : (
                        stock.location
                      )}
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

export default StockManagement; 