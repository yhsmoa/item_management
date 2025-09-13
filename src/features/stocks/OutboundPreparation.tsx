import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';
import './outbound-preparation.css';

/**
 * 출고 준비 페이지 컴포넌트
 * - 출고 준비 목록 조회 및 관리
 * - 출고 수정 및 업데이트 기능
 */
function OutboundPreparation() {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [locationSearchKeyword, setLocationSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchCategory, setSearchCategory] = useState('바코드');
  const [isLoading, setIsLoading] = useState(false);
  
  // 재고 데이터
  const [stockData, setStockData] = useState<any[]>([]);
  const [filteredStockData, setFilteredStockData] = useState<any[]>([]);
  
  // 선택된 항목들 관리
  const [selectedItems, setSelectedItems] = useState<number[]>([]);


  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
  // 정렬 관련 state
  const [sortField, setSortField] = useState<string>('location');
  const [sortOrder, setSortOrder] = useState<string>('asc');

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    console.log('🔄 OutboundPreparation 컴포넌트 마운트됨');
    loadStockData();
    
    return () => {
      console.log('🧹 OutboundPreparation 컴포넌트 언마운트 - 메모리 정리 중...');
      
      setStockData([]);
      setFilteredStockData([]);
      setSelectedItems([]);
      setIsLoading(false);
      
      console.log('✅ OutboundPreparation 메모리 정리 완료');
    };
  }, []);

  // 현재 사용자 ID 가져오기
  const getCurrentUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id) {
        return user.id;
      }
      
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        return userData.id || userData.email || 'temp_user';
      }
      
      return 'temp_user';
    } catch (error) {
      console.error('❌ 사용자 정보 가져오기 오류:', error);
      return 'temp_user';
    }
  };

  // 재고 데이터 로드
  const loadStockData = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('❌ 로그인된 사용자가 없습니다.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('stocks_shipment')
          .select('*')
          .eq('user_id', userId)
          .order('id', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error('데이터 로드 오류:', error);
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          
          if (data.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ 총 ${allData.length}개의 출고 준비 데이터를 로드했습니다.`);
      setStockData(allData);
      setFilteredStockData(allData);
    } catch (error) {
      console.error('데이터 로드 중 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 핸들러
  const handleSearch = async () => {
    let filtered = stockData;

    if (searchKeyword.trim()) {
      const searchLower = searchKeyword.toLowerCase().trim();
      
      switch (searchCategory) {
        case '바코드':
          filtered = filtered.filter(stock => 
            stock.barcode?.toLowerCase().includes(searchLower)
          );
          break;
        case '상품명':
          filtered = filtered.filter(stock => 
            stock.item_name?.toLowerCase().includes(searchLower)
          );
          break;
        case '비고':
          filtered = filtered.filter(stock => 
            stock.note?.toLowerCase().includes(searchLower)
          );
          break;
        default:
          filtered = filtered.filter(stock => 
            stock.item_name?.toLowerCase().includes(searchLower) ||
            stock.barcode?.toLowerCase().includes(searchLower)
          );
      }
    }

    if (locationSearchKeyword.trim()) {
      const locationLower = locationSearchKeyword.toLowerCase().trim();
      filtered = filtered.filter(stock => 
        stock.location?.toLowerCase().includes(locationLower)
      );
    }
    
    setFilteredStockData(filtered);
    setCurrentPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleLocationKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 페이지네이션
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 정렬된 데이터 가져오기
  const getSortedData = () => {
    const sortedData = [...filteredStockData].sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      switch(sortField) {
        case 'location':
          aValue = a.location || '';
          bValue = b.location || '';
          break;
        case 'item_name':
          aValue = a.item_name || '';
          bValue = b.item_name || '';
          break;
        case 'stock':
          const aStock = parseInt(a.stock) || 0;
          const bStock = parseInt(b.stock) || 0;
          return sortOrder === 'asc' ? aStock - bStock : bStock - aStock;
        case 'note':
          aValue = a.note || '';
          bValue = b.note || '';
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
    
    return sortedData;
  };
  
  const getCurrentPageData = () => {
    const sortedData = getSortedData();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  };

  const sortedData = getSortedData();
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
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
      setSelectedItems(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedItems(prev => [...prev, ...currentPageIds.filter(id => !prev.includes(id))]);
    }
  };


  // XLSX 다운로드 핸들러
  const handleDownloadXLSX = () => {
    const dataToDownload = selectedItems.length > 0 
      ? getCurrentPageData().filter(item => selectedItems.includes(item.id))
      : getSortedData();

    if (dataToDownload.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const excelData = [
      ['위치', '바코드', '상품명', '재고', '비고'],
      ...dataToDownload.map(stock => [
        stock.location || '',
        stock.barcode || '',
        stock.item_name || '',
        stock.stock || 0,
        stock.note || ''
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '출고준비');

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `출고준비_${dateStr}_${timeStr}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  // XLSX 수정 핸들러
  const handleEditXLSX = () => {
    alert('XLSX 수정 기능은 추후 구현될 예정입니다.');
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
      const CHUNK_SIZE = 50;
      let deletedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < selectedItems.length; i += CHUNK_SIZE) {
        const chunk = selectedItems.slice(i, i + CHUNK_SIZE);
        
        const { error } = await supabase
          .from('stocks_shipment')
          .delete()
          .in('id', chunk)
          .eq('user_id', userId);

        if (error) {
          console.error('청크 삭제 오류:', error);
          errorCount += chunk.length;
        } else {
          deletedCount += chunk.length;
        }
      }

      await loadStockData();
      setSelectedItems([]);
      
      if (errorCount > 0) {
        alert(`삭제 완료: ${deletedCount}개 성공, ${errorCount}개 실패`);
      } else {
        alert(`${deletedCount}개 항목이 삭제되었습니다.`);
      }
    } catch (err) {
      console.error('삭제 중 예외:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="outbound-preparation-container">
      {/* 페이지 헤더 */}
      <div className="outbound-preparation-page-header">
        <h1 className="outbound-preparation-page-title">출고 준비</h1>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="outbound-preparation-filter-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
          {/* 카테고리 */}
          <div>
            <label className="outbound-preparation-label">카테고리</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="outbound-preparation-select"
            >
              <option value="전체">전체</option>
              <option value="의류">의류</option>
              <option value="신발">신발</option>
              <option value="악세서리">악세서리</option>
            </select>
          </div>

          {/* 검색 카테고리 */}
          <div>
            <label className="outbound-preparation-label">검색 카테고리</label>
            <select 
              className="outbound-preparation-select"
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
            >
              <option value="바코드">바코드</option>
              <option value="상품명">상품명</option>
              <option value="비고">비고</option>
            </select>
          </div>

          {/* 위치 검색 */}
          <div className="outbound-preparation-search-container">
            <label className="outbound-preparation-label">자리검색</label>
            <div className="outbound-preparation-search-wrapper">
              <input
                type="text"
                value={locationSearchKeyword}
                onChange={(e) => setLocationSearchKeyword(e.target.value)}
                onKeyPress={handleLocationKeyPress}
                placeholder="위치를 입력하세요..."
                className="outbound-preparation-search-input"
              />
              <button 
                onClick={handleSearch}
                className="outbound-preparation-search-button"
              >
                🔍
              </button>
            </div>
          </div>

          {/* 검색창 */}
          <div className="outbound-preparation-search-container">
            <label className="outbound-preparation-label">검색</label>
            <div className="outbound-preparation-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`${searchCategory}를 입력하세요...`}
                className="outbound-preparation-search-input"
              />
              <button 
                onClick={handleSearch}
                className="outbound-preparation-search-button"
              >
                🔍
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 정렬 및 페이지당 개수 선택 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* 정렬 옵션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '14px', color: '#6b7280' }}>정렬:</label>
          <select 
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="location">위치</option>
            <option value="item_name">상품명</option>
            <option value="stock">재고</option>
            <option value="note">비고</option>
          </select>
          
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="asc">오름차순</option>
            <option value="desc">내림차순</option>
          </select>
        </div>
        
        {/* 페이지당 개수 선택 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '14px', color: '#6b7280' }}>페이지당:</label>
          <select 
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value={50}>50개</option>
            <option value={100}>100개</option>
            <option value={200}>200개</option>
            <option value={500}>500개</option>
            <option value={1000}>1000개</option>
            <option value={filteredStockData.length}>전체</option>
          </select>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="outbound-preparation-table-section">
        {/* 테이블 헤더 */}
        <div className="outbound-preparation-table-header-section">
          <div className="outbound-preparation-table-info">
            <div className="outbound-preparation-data-count">
              총 {filteredStockData.length}개 상품 
              {filteredStockData.length > itemsPerPage && (
                <span style={{ color: '#6b7280', fontSize: '14px', marginLeft: '8px' }}>
                  (페이지당 {itemsPerPage}개 표시)
                </span>
              )}
            </div>
          </div>
          
          <div className="outbound-preparation-action-buttons">
            <button
              onClick={handleEditXLSX}
              className="outbound-preparation-button"
              style={{ 
                backgroundColor: '#6b7280', 
                color: 'white',
                border: '1px solid #6b7280'
              }}
            >
              xlsx 수정
            </button>
            
            <button
              onClick={handleDownloadXLSX}
              className="outbound-preparation-button"
              style={{ 
                backgroundColor: '#10b981', 
                color: 'white',
                border: '1px solid #10b981'
              }}
            >
              xlsx 다운
            </button>
            
            <button
              onClick={handleDeleteSelected}
              disabled={selectedItems.length === 0}
              className="outbound-preparation-button outbound-preparation-button-danger"
            >
              삭제 ({selectedItems.length})
            </button>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="outbound-preparation-table-container">
          <table className="outbound-preparation-table">
            <thead className="outbound-preparation-table-header">
              <tr>
                <th className="outbound-preparation-table-header-cell" style={{ width: '4%', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={filteredStockData.length > 0 && selectedItems.length === getCurrentPageData().length && getCurrentPageData().every(item => selectedItems.includes(item.id))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </th>
                <th className="outbound-preparation-table-header-cell" style={{ width: '8%', textAlign: 'center' }}>위치</th>
                <th className="outbound-preparation-table-header-cell" style={{ width: '16%', textAlign: 'center' }}>바코드</th>
                <th className="outbound-preparation-table-header-cell" style={{ width: '24%', textAlign: 'left' }}>상품명</th>
                <th className="outbound-preparation-table-header-cell" style={{ width: '8%', textAlign: 'center' }}>재고</th>
                <th className="outbound-preparation-table-header-cell" style={{ width: '24%', textAlign: 'center' }}>비고</th>
              </tr>
            </thead>
            <tbody className="outbound-preparation-table-body">
              {currentData.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {isLoading ? '데이터를 불러오는 중...' : '출고 준비 데이터가 없습니다.'}
                  </td>
                </tr>
              )}
              {currentData.map((stock, index) => {
                return (
                  <tr key={stock.id} className="outbound-preparation-table-row">
                    <td className="outbound-preparation-table-cell" style={{ textAlign: 'center', padding: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(stock.id)}
                        onChange={() => handleItemSelect(stock.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td 
                      className="outbound-preparation-table-cell" 
                      style={{ textAlign: 'center', padding: '12px' }}
                    >
                      <span style={{ backgroundColor: '#9ca3af', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                        {stock.location}
                      </span>
                    </td>
                    <td className="outbound-preparation-table-cell" style={{ textAlign: 'center', padding: '12px', fontSize: '16px' }}>
                      {stock.barcode}
                    </td>
                    <td 
                      className="outbound-preparation-table-cell" 
                      style={{ textAlign: 'left', padding: '12px' }}
                    >
                      <span style={{ fontSize: '16px' }}>
                        {stock.item_name}
                      </span>
                    </td>
                    <td 
                      className="outbound-preparation-table-cell" 
                      style={{ textAlign: 'center', padding: '12px', fontWeight: 'bold', fontSize: '16px' }}
                    >
                      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        {stock.stock}
                      </span>
                    </td>
                    <td 
                      className="outbound-preparation-table-cell" 
                      style={{ textAlign: 'center', padding: '12px', fontSize: '16px', color: '#000000' }}
                    >
                      <span style={{ fontSize: '16px' }}>
                        {stock.note || ''}
                      </span>
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
        <div className="outbound-preparation-pagination">
          <div className="outbound-preparation-pagination-controls">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="outbound-preparation-pagination-button"
            >
              이전
            </button>
            
            <div className="outbound-preparation-pagination-info">
              {currentPage} / {totalPages}
            </div>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="outbound-preparation-pagination-button"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OutboundPreparation;