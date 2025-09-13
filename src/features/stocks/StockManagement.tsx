import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';
import '../../features/products/ProductListPage/index.css';

/**
 * 재고 관리 페이지 컴포넌트
 * - 재고 목록 조회 및 관리
 * - 재고 수정 및 업데이트 기능
 */
function StockManagement() {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [locationSearchKeyword, setLocationSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchCategory, setSearchCategory] = useState('상품명');
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
  const [itemsPerPage, setItemsPerPage] = useState(100); // 기본 100개로 증가
  
  // 정렬 관련 state
  const [sortField, setSortField] = useState<string>('location'); // 위치, 상품명, 재고, 비고
  const [sortOrder, setSortOrder] = useState<string>('asc'); // 오름차순, 내림차순

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

  // 재고 데이터 로드 (Supabase에서 - 청크 방식으로 모든 데이터 가져오기)
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
      const batchSize = 1000; // 한번에 1000개씩 가져오기
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('stocks_management')
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
          
          // 가져온 데이터가 배치 크기보다 작으면 더 이상 데이터가 없음
          if (data.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ 총 ${allData.length}개의 재고 데이터를 로드했습니다.`);
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

    // 검색 카테고리별 검색
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
          // 기본적으로 상품명과 바코드 모두 검색
          filtered = filtered.filter(stock => 
            stock.item_name?.toLowerCase().includes(searchLower) ||
            stock.barcode?.toLowerCase().includes(searchLower)
          );
      }
    }

    // 위치 검색
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
      
      // 문자열 비교
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
  const handleEditComplete = async (cellId: string, stockId: number, field: 'stock' | 'location' | 'item_name' | 'note') => {
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
      } else if (field === 'item_name') {
        updateData.item_name = newValue.trim();
      } else if (field === 'note') {
        updateData.note = newValue.trim();
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
  const handleEditKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, cellId: string, stockId: number, field: 'stock' | 'location' | 'item_name' | 'note') => {
    if (e.key === 'Enter') {
      handleEditComplete(cellId, stockId, field);
    }
  };

  // XLSX 다운로드 핸들러
  const handleDownloadXLSX = () => {
    // 선택된 항목이 있으면 선택된 데이터만, 없으면 검색 결과 전체
    const dataToDownload = selectedItems.length > 0 
      ? getCurrentPageData().filter(item => selectedItems.includes(item.id))
      : getSortedData();

    if (dataToDownload.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    // 엑셀 데이터 준비
    const excelData = [
      ['위치', '바코드', '상품명', '재고', '비고'], // 헤더
      ...dataToDownload.map(stock => [
        stock.location || '',
        stock.barcode || '',
        stock.item_name || '',
        stock.stock || 0,
        stock.note || ''
      ])
    ];

    // 워크북 생성
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '재고관리');

    // 파일명 생성 (현재 날짜 포함)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `재고관리_${dateStr}_${timeStr}.xlsx`;

    // 다운로드
    XLSX.writeFile(workbook, filename);
  };

  // XLSX 수정 핸들러 (기능은 추후 구현)
  const handleEditXLSX = () => {
    // 추후 기능 구현 예정
    alert('XLSX 수정 기능은 추후 구현될 예정입니다.');
  };

  // 선택된 항목들 삭제 (청크 단위로 처리)
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
      const CHUNK_SIZE = 50; // 한번에 50개씩 삭제
      let deletedCount = 0;
      let errorCount = 0;

      // 선택된 항목들을 청크로 나누어 삭제
      for (let i = 0; i < selectedItems.length; i += CHUNK_SIZE) {
        const chunk = selectedItems.slice(i, i + CHUNK_SIZE);
        
        const { error } = await supabase
          .from('stocks_management')
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

      // 데이터 다시 로드
      await loadStockData();
      
      // 선택 해제
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
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">재고 관리</h1>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
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

          {/* 검색 카테고리 */}
          <div>
            <label className="product-list-label">검색 카테고리</label>
            <select 
              className="product-list-select"
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
            >
              <option value="바코드">바코드</option>
              <option value="상품명">상품명</option>
              <option value="비고">비고</option>
            </select>
          </div>

          {/* 위치 검색 */}
          <div className="product-list-search-container">
            <label className="product-list-label">자리검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={locationSearchKeyword}
                onChange={(e) => setLocationSearchKeyword(e.target.value)}
                onKeyPress={handleLocationKeyPress}
                placeholder="위치를 입력하세요..."
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

          {/* 검색창 */}
          <div className="product-list-search-container">
            <label className="product-list-label">검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`${searchCategory}를 입력하세요...`}
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
      <div className="product-list-table-section">
        {/* 테이블 헤더 */}
        <div className="product-list-table-header-section">
          <div className="product-list-table-info">
            <div className="product-list-data-count">
              총 {filteredStockData.length}개 상품 
              {filteredStockData.length > itemsPerPage && (
                <span style={{ color: '#6b7280', fontSize: '14px', marginLeft: '8px' }}>
                  (페이지당 {itemsPerPage}개 표시)
                </span>
              )}
            </div>
          </div>
          
          <div className="product-list-action-buttons">
            <button
              onClick={handleEditXLSX}
              className="product-list-button"
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
              className="product-list-button"
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
                <th className="product-list-table-header-cell" style={{ width: '4%', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={filteredStockData.length > 0 && selectedItems.length === getCurrentPageData().length && getCurrentPageData().every(item => selectedItems.includes(item.id))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </th>
                <th className="product-list-table-header-cell" style={{ width: '8%', textAlign: 'center' }}>위치</th>
                <th className="product-list-table-header-cell" style={{ width: '16%', textAlign: 'center' }}>바코드</th>
                <th className="product-list-table-header-cell" style={{ width: '24%', textAlign: 'left' }}>상품명</th>
                <th className="product-list-table-header-cell" style={{ width: '8%', textAlign: 'center' }}>재고</th>
                <th className="product-list-table-header-cell" style={{ width: '24%', textAlign: 'center' }}>비고</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {currentData.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ 
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
                        <span style={{ backgroundColor: '#9ca3af', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                          {stock.location}
                        </span>
                      )}
                    </td>
                    <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', fontSize: '16px' }}>
                      {stock.barcode}
                    </td>
                    <td 
                      className="product-list-table-cell" 
                      style={{ textAlign: 'left', padding: '12px', cursor: 'pointer' }}
                      onClick={() => handleCellClick(`item_name-${stock.id}`, stock.item_name)}
                    >
                      {editingCell === `item_name-${stock.id}` ? (
                        <input
                          type="text"
                          value={editValues[`item_name-${stock.id}`] || ''}
                          onChange={(e) => handleEditValueChange(`item_name-${stock.id}`, e.target.value)}
                          onBlur={() => handleEditComplete(`item_name-${stock.id}`, stock.id, 'item_name')}
                          onKeyPress={(e) => handleEditKeyPress(e, `item_name-${stock.id}`, stock.id, 'item_name')}
                          autoFocus
                          style={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent',
                            fontSize: '16px'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '16px' }}>
                          {stock.item_name}
                        </span>
                      )}
                    </td>
                    <td 
                      className="product-list-table-cell" 
                      style={{ textAlign: 'center', padding: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
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
                            fontSize: '16px',
                            // 숫자 입력 필드의 스피너 버튼 제거
                            MozAppearance: 'textfield' // Firefox용
                          }}
                          // Chrome, Safari, Edge용 스피너 버튼 제거
                          className="no-spinner"
                        />
                      ) : (
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                          {stock.stock}
                        </span>
                      )}
                    </td>
                    <td 
                      className="product-list-table-cell" 
                      style={{ textAlign: 'center', padding: '12px', fontSize: '16px', color: '#000000', cursor: 'pointer' }}
                      onClick={() => handleCellClick(`note-${stock.id}`, stock.note || '')}
                    >
                      {editingCell === `note-${stock.id}` ? (
                        <input
                          type="text"
                          value={editValues[`note-${stock.id}`] || ''}
                          onChange={(e) => handleEditValueChange(`note-${stock.id}`, e.target.value)}
                          onBlur={() => handleEditComplete(`note-${stock.id}`, stock.id, 'note')}
                          onKeyPress={(e) => handleEditKeyPress(e, `note-${stock.id}`, stock.id, 'note')}
                          autoFocus
                          style={{ 
                            width: '100%', 
                            textAlign: 'center', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent',
                            fontSize: '16px',
                            color: '#000000'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '16px' }}>
                          {stock.note || ''}
                        </span>
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