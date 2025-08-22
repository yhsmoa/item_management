import React, { useState } from 'react';
import DashboardStatsCard from './components/DashboardStatsCard';
import { viewsService } from '../../services/viewsService';
import { getCurrentUserId } from '../../services/authService';
import './ProductListPage.css';

function ViewsPage() {
  // Refs for date inputs
  const startDateRef = React.useRef<HTMLInputElement>(null);
  const endDateRef = React.useRef<HTMLInputElement>(null);
  
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewsData, setViewsData] = useState('');
  const [modalSelectedDate, setModalSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 날짜 선택 및 데이터 축적
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDateToAdd, setSelectedDateToAdd] = useState('');
  const [accumulatedData, setAccumulatedData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [addedDates, setAddedDates] = useState<string[]>([]);
  
  // 삭제 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [dateToDelete, setDateToDelete] = useState('');
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 더미 통계 데이터
  const stats = {
    total: 0,
    notItemPartner: 0,
    outOfStock: 0,
    rejected: 0,
    selling: 0,
    tempSave: 0
  };

  // 날짜 범위 생성 함수
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };
  
  // 시작일/종료일 변경 시 사용 가능한 날짜 업데이트
  const updateAvailableDates = async () => {
    if (startDate && endDate) {
      try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
          setAvailableDates([]);
          setSelectedDateToAdd('');
          return;
        }
        
        const result = await viewsService.getAvailableDates(currentUserId, startDate, endDate);
        
        if (result.success) {
          setAvailableDates(result.data);
          setSelectedDateToAdd(result.data[0] || '');
        } else {
          setAvailableDates([]);
          setSelectedDateToAdd('');
        }
      } catch (error) {
        console.error('사용 가능한 날짜 조회 오류:', error);
        setAvailableDates([]);
        setSelectedDateToAdd('');
      }
    } else {
      setAvailableDates([]);
      setSelectedDateToAdd('');
    }
  };
  
  // 날짜 추가 핸들러
  const handleAddDate = async () => {
    if (!selectedDateToAdd) {
      alert('추가할 날짜를 선택해주세요.');
      return;
    }
    
    // 이미 추가된 날짜인지 확인
    if (addedDates.includes(selectedDateToAdd)) {
      alert('이미 추가된 날짜입니다.');
      return;
    }
    
    // 최대 8개 제한 확인
    if (addedDates.length >= 8) {
      alert('최대 8개의 날짜만 추가할 수 있습니다.');
      return;
    }
    
    setIsLoading(true);
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const result = await viewsService.getViewsData(currentUserId, selectedDateToAdd);
      
      if (result.success && result.data.length > 0) {
        const newData = result.data.map((item: any) => ({
          date: selectedDateToAdd,
          productId: item.productId,
          productViews: item.productViews
        }));
        
        setAccumulatedData(prev => {
          const updated = [...prev, ...newData];
          // 검색어가 있으면 필터링 적용, 없으면 전체 데이터 표시
          if (searchKeyword.trim()) {
            const filtered = updated.filter(item => 
              item.productId && item.productId.toLowerCase().includes(searchKeyword.toLowerCase())
            );
            setFilteredData(filtered);
          } else {
            setFilteredData(updated);
          }
          return updated;
        });
        
        // 추가된 날짜 목록에 추가
        setAddedDates(prev => [...prev, selectedDateToAdd]);
      } else {
        alert(`${selectedDateToAdd} 날짜에 대한 데이터가 없습니다.`);
      }
    } catch (error) {
      console.error('날짜 추가 오류:', error);
      alert('날짜 추가 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 검색 핸들러 - productId 필터링
  const handleSearch = () => {
    if (!searchKeyword.trim()) {
      setFilteredData(accumulatedData);
      return;
    }
    
    const filtered = accumulatedData.filter(item => 
      item.productId && item.productId.toLowerCase().includes(searchKeyword.toLowerCase())
    );
    setFilteredData(filtered);
    setCurrentPage(1); // 검색 후 첫 페이지로 이동
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 날짜 입력 핸들러 - 자동 포커스 이동
  const handleDateInput = (value: string, field: 'start' | 'end', inputRef: React.RefObject<HTMLInputElement | null>) => {
    // YYYY-MM-DD 형식에서 자동 포커스 이동
    if (value.length === 4 && !value.includes('-')) {
      // 4자리 연도 입력 후 자동으로 월로 이동
      const formatted = value + '-';
      if (field === 'start') {
        setStartDate(formatted);
      } else {
        setEndDate(formatted);
      }
      // 커서를 월 위치로 이동
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(5, 5);
        }
      }, 0);
    } else if (value.length === 7 && value.split('-').length === 2) {
      // MM 입력 후 자동으로 일로 이동
      const formatted = value + '-';
      if (field === 'start') {
        setStartDate(formatted);
      } else {
        setEndDate(formatted);
      }
      // 커서를 일 위치로 이동
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(8, 8);
        }
      }, 0);
    } else {
      if (field === 'start') {
        setStartDate(value);
      } else {
        setEndDate(value);
      }
    }
  };
  
  // 날짜 조회 핸들러
  const handleDateSearch = async () => {
    if (!startDate || !endDate) {
      alert('시작일자와 종료일자를 선택해주세요.');
      return;
    }
    
    if (startDate > endDate) {
      alert('시작일자는 종료일자보다 이전이어야 합니다.');
      return;
    }
    
    await updateAvailableDates();
  };
  
  // 날짜 삭제 핸들러
  const handleDeleteDate = () => {
    if (!selectedDateToAdd) {
      alert('삭제할 날짜를 선택해주세요.');
      return;
    }
    
    setDateToDelete(selectedDateToAdd);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };
  
  // 삭제 확인 핸들러
  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== '삭제') {
      alert('삭제를 진행하려면 "삭제"라고 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const result = await viewsService.deleteViewsData(currentUserId, dateToDelete);
      
      if (result.success) {
        // 테이블에서 해당 날짜 데이터 제거
        setAccumulatedData(prev => prev.filter(item => item.date !== dateToDelete));
        setFilteredData(prev => prev.filter(item => item.date !== dateToDelete));
        
        // 추가된 날짜 목록에서 제거
        setAddedDates(prev => prev.filter(date => date !== dateToDelete));
        
        alert(`${dateToDelete} 날짜의 조회수 데이터가 삭제되었습니다.`);
        setShowDeleteModal(false);
      } else {
        alert('데이터 삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('날짜 삭제 오류:', error);
      alert('날짜 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 페이지네이션 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSaveViews = async () => {
    if (!viewsData.trim()) {
      alert('조회수 데이터를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const parsedData = viewsService.parseViewsData(viewsData);
      
      if (parsedData.length === 0) {
        alert('올바른 형식의 데이터를 입력해주세요.');
        return;
      }

      const currentUserId = getCurrentUserId();
      console.log('현재 사용자 ID:', currentUserId);
      
      if (!currentUserId) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const result = await viewsService.saveViewsData(parsedData, modalSelectedDate, currentUserId);
      
      if (result.success) {
        alert(`${result.insertedCount}개의 조회수 데이터가 성공적으로 저장되었습니다.`);
        setViewsData('');
        setShowModal(false);
      } else {
        alert('데이터 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 데이터 피벗 변환
  const transformDataToPivot = (data: any[]) => {
    if (!data || data.length === 0) return { pivotData: [], uniqueDates: [] };
    
    // 고유한 날짜들 추출 및 정렬
    const datesSet = new Set<string>();
    data.forEach(item => datesSet.add(item.date));
    const uniqueDates = Array.from(datesSet).sort();
    
    // 상품ID별로 그룹핑
    const groupedByProduct: { [key: string]: { [key: string]: string } } = {};
    data.forEach(item => {
      if (!groupedByProduct[item.productId]) {
        groupedByProduct[item.productId] = {};
      }
      groupedByProduct[item.productId][item.date] = item.productViews;
    });
    
    // 피벗 형태로 변환
    const pivotData = Object.keys(groupedByProduct).map(productId => {
      const row: { [key: string]: string } = { productId };
      uniqueDates.forEach(date => {
        row[date] = groupedByProduct[productId][date] || '-';
      });
      return row;
    });
    
    return { pivotData, uniqueDates };
  };
  
  // 검색어가 있으면 필터링된 데이터, 없으면 전체 데이터 사용
  React.useEffect(() => {
    if (searchKeyword.trim()) {
      const filtered = accumulatedData.filter(item => 
        item.productId && item.productId.toLowerCase().includes(searchKeyword.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(accumulatedData);
    }
  }, [accumulatedData, searchKeyword]);
  
  const { pivotData, uniqueDates } = transformDataToPivot(filteredData);
  
  // 페이지네이션 계산
  const totalPages = Math.ceil(pivotData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = pivotData.slice(startIndex, endIndex);

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">쿠팡 조회수 관리</h1>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button 
            className="product-list-button product-list-button-primary"
            onClick={() => setShowModal(true)}
          >
            조회수 추가
          </button>
        </div>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 첫 번째 줄: 시작일자, 종료일자, 조회 버튼 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            {/* 시작일자 */}
            <div>
              <label className="product-list-label">시작일자</label>
              <input
                ref={startDateRef}
                type="text"
                value={startDate}
                onChange={(e) => handleDateInput(e.target.value, 'start', startDateRef)}
                className="product-list-select"
                maxLength={10}
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
              />
            </div>
            
            {/* 종료일자 */}
            <div>
              <label className="product-list-label">종료일자</label>
              <input
                ref={endDateRef}
                type="text"
                value={endDate}
                onChange={(e) => handleDateInput(e.target.value, 'end', endDateRef)}
                className="product-list-select"
                maxLength={10}
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
              />
            </div>
            
            {/* 조회 버튼 */}
            <button 
              onClick={handleDateSearch}
              className="product-list-button product-list-button-primary"
              disabled={isLoading}
              style={{ height: 'fit-content' }}
            >
              {isLoading ? '조회중...' : '조회'}
            </button>
          </div>
          
          {/* 두 번째 줄: 조회날짜, 추가 버튼 */}
          <div style={{ display: 'flex', alignItems: 'end', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280' }}>
              추가된 날짜: {addedDates.length}/8개
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'end' }}>
            {/* 조회날짜 */}
            <div>
              <label className="product-list-label">조회날짜</label>
              <select 
                className="product-list-select"
                value={selectedDateToAdd}
                onChange={(e) => setSelectedDateToAdd(e.target.value)}
                disabled={availableDates.length === 0}
              >
                <option value="">날짜를 선택하세요</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
            
            {/* 추가 버튼 */}
            <button 
              onClick={handleAddDate}
              className="product-list-button product-list-button-primary"
              disabled={isLoading || !selectedDateToAdd || addedDates.length >= 8 || addedDates.includes(selectedDateToAdd)}
              style={{ height: 'fit-content' }}
            >
              {isLoading ? '로딩...' : '추가'}
            </button>
            
            {/* 삭제 버튼 */}
            <button 
              onClick={handleDeleteDate}
              className="product-list-button"
              disabled={isLoading || !selectedDateToAdd}
              style={{ 
                height: 'fit-content',
                backgroundColor: '#dc2626',
                color: 'white',
                border: '1px solid #dc2626'
              }}
            >
              {isLoading ? '로딩...' : '삭제'}
            </button>
          </div>
          
          {/* 세 번째 줄: 검색 */}
          <div className="product-list-search-container">
            <label className="product-list-label">검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="상품ID 또는 상품명으로 검색..."
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
              총 {pivotData.length}개 상품
            </div>
          </div>
          
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="product-list-table views-page-table" style={{ textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ width: '120px', textAlign: 'center' }}>상품ID</th>
                {uniqueDates.map(date => (
                  <th key={date} style={{ width: '120px', textAlign: 'center' }}>
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={1 + uniqueDates.length} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {isLoading ? '데이터를 불러오는 중...' : '데이터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentData.map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td style={{ textAlign: 'center' }}>{item.productId}</td>
                    {uniqueDates.map(date => (
                      <td key={date} style={{ textAlign: 'center' }}>
                        {(item as any)[date]}
                      </td>
                    ))}
                  </tr>
                ))
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

      {/* 조회수 추가 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>조회수 추가</h3>
            </div>
            
            <div className="modal-body">
              <div className="input-group">
                <label>날짜</label>
                <input
                  type="date"
                  value={modalSelectedDate}
                  onChange={(e) => setModalSelectedDate(e.target.value)}
                  className="modal-date-input"
                />
              </div>
              
              <div className="input-group" style={{ marginTop: '20px' }}>
                <label>조회수 데이터</label>
                <textarea
                  value={viewsData}
                  onChange={(e) => setViewsData(e.target.value)}
                  placeholder="조회수 데이터를 입력하세요..."
                  className="modal-textarea"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="modal-button modal-button-cancel"
                onClick={() => setShowModal(false)}
              >
                취소
              </button>
              <button 
                className="modal-button modal-button-save"
                onClick={handleSaveViews}
                disabled={isLoading}
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>조회수 데이터 삭제</h3>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '20px', fontSize: '16px', color: '#374151' }}>
                <p><strong>{dateToDelete}</strong> 날짜의 조회수를 삭제하시겠습니까?</p>
                <p>삭제 진행을 원하시면 <strong>'삭제'</strong>라고 입력해주세요.</p>
              </div>
              
              <div className="input-group">
                <label>확인 텍스트</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="삭제"
                  className="modal-date-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="modal-button modal-button-cancel"
                onClick={() => setShowDeleteModal(false)}
              >
                취소
              </button>
              <button 
                className="modal-button"
                onClick={handleConfirmDelete}
                disabled={isLoading || deleteConfirmText !== '삭제'}
                style={{
                  backgroundColor: deleteConfirmText === '삭제' ? '#dc2626' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  cursor: deleteConfirmText === '삭제' ? 'pointer' : 'not-allowed'
                }}
              >
                {isLoading ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewsPage;