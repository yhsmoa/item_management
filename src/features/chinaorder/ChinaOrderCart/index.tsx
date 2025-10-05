import React, { useState, useEffect, useRef } from 'react';
import DashboardStatsCard from '../../products/ProductListPage/components/DashboardStatsCard';
import ActionButton from '../../../components/ActionButton';
import { useGoogleSheetsDirectRead } from '../hooks/useGoogleSheetsDirectRead';
import { useLoadOrderInfo } from './hooks/useLoadOrderInfo';
import { supabase } from '../../../config/supabase';
import AddOrderModal from './components/AddOrderModal';
import BackupOrderModal from './components/BackupOrderModal';
import './styles.css';

// 임시 인터페이스 정의 (ChinaOrderData와 동일한 구조)
interface ChinaOrderData {
  china_order_number?: string;
  date?: string;
  item_name?: string;
  option_name?: string;
  barcode?: string;
  order_quantity?: number;
  image_url?: string;
  china_link?: string;
  china_option1?: string;
  china_option2?: string;
  china_price?: string;
  china_total_price?: string;
  order_status_ordering?: string;
  order_status_check?: string;
  order_status_cancel?: string;
  order_status_shipment?: string;
  remark?: string;
  note?: string;
  confirm_order_id?: string;
  confirm_shipment_id?: string;
  option_id?: string;
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

function ChinaorderCart() {
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
  
  // 📝 중복 로딩 방지를 위한 ref
  const loadingRef = useRef(false);
  const initialLoadRef = useRef(false);
  
  // 주문 데이터 - 빈 배열로 초기화 (다른 DB와 연동 예정)
  const [orderData, setOrderData] = useState<ChinaOrderData[]>([]);
  const [filteredOrderData, setFilteredOrderData] = useState<ChinaOrderData[]>([]);

  // 🆕 인라인 편집 상태 관리
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Google Sheets 직접 읽기 훅 (Supabase 저장 안함)
  const { isLoading: sheetsLoading, handleGoogleSheetsDirectRead } = useGoogleSheetsDirectRead((data) => {
    // 구글 시트에서 읽은 데이터를 직접 화면에 표시
    console.log('📥 구글 시트에서 직접 읽은 데이터:', data);
    setOrderData(data);
    setFilteredOrderData(data);
  });

  // 정보 불러오기 훅 (바코드 기반으로 이전 주문 정보 조회)
  const { isLoading: loadInfoLoading, loadOrderInfo } = useLoadOrderInfo();

  // 컴포넌트 마운트 시 구글 시트 자동 불러오기 (한 번만 실행)
  useEffect(() => {
    console.log('🔄 ChinaorderCart 컴포넌트 마운트됨');

    // 이미 초기 로드가 완료되었으면 건너뛰기
    if (initialLoadRef.current) {
      console.log('⚠️ 이미 초기 로드가 완료되었으므로 건너뜁니다.');
      return;
    }

    initialLoadRef.current = true;
    console.log('🚀 페이지 접속 시 구글 시트 자동 불러오기 시작');

    // 구글 시트 자동 불러오기
    handleGoogleSheetsDirectRead();

    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      console.log('🧹 ChinaorderCart 컴포넌트 언마운트 - 메모리 정리 중...');

      // 대용량 상태 데이터 초기화 (메모리 절약)
      setOrderData([]);
      setFilteredOrderData([]);
      setSelectedItems([]);
      setIsLoading(false);
      setSelectAll(false);

      console.log('✅ ChinaorderCart 메모리 정리 완료');
    };
  }, [handleGoogleSheetsDirectRead]); // handleGoogleSheetsDirectRead 의존성 추가

  // 🔍 테이블 헤더와 열 너비 측정
  useEffect(() => {
    const measureTableColumns = () => {
      // 테이블이 렌더링될 때까지 잠시 대기
      setTimeout(() => {
        const table = document.querySelector('.product-list-table');
        if (!table) {
          console.log('❌ 테이블을 찾을 수 없습니다.');
          return;
        }

        console.log('📏 ========== 테이블 헤더 및 열 너비 측정 ==========');
        
        // 헤더 셀들 측정
        const headerCells = table.querySelectorAll('thead th.product-list-table-header-cell');
        console.log('📋 총 헤더 개수:', headerCells.length);
        
        headerCells.forEach((cell, index) => {
          const rect = cell.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(cell);
          const textContent = cell.textContent?.trim() || '';
          
          console.log(`📍 헤더 ${index + 1}번째:`, {
            텍스트: textContent,
            너비: `${rect.width.toFixed(1)}px`,
            CSS_width: computedStyle.width,
            CSS_minWidth: computedStyle.minWidth,
            CSS_maxWidth: computedStyle.maxWidth,
            실제_렌더링_너비: `${rect.width}px`
          });
        });

        // 첫 번째 데이터 행의 셀들도 측정 (실제 데이터 셀 크기)
        const firstDataRow = table.querySelector('tbody tr:first-child');
        if (firstDataRow) {
          console.log('📋 ========== 첫 번째 데이터 행 셀 측정 ==========');
          const dataCells = firstDataRow.querySelectorAll('td.product-list-table-cell');
          
          dataCells.forEach((cell, index) => {
            const rect = cell.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(cell);
            
            console.log(`📍 데이터셀 ${index + 1}번째:`, {
              너비: `${rect.width.toFixed(1)}px`,
              CSS_width: computedStyle.width,
              내용_미리보기: cell.textContent?.trim().substring(0, 20) + '...',
              실제_렌더링_너비: `${rect.width}px`
            });
          });
        }

        // 전체 테이블 정보
        const tableRect = table.getBoundingClientRect();
        console.log('📊 ========== 테이블 전체 정보 ==========');
        console.log('전체 테이블 너비:', `${tableRect.width.toFixed(1)}px`);
        console.log('테이블 layout:', window.getComputedStyle(table).tableLayout);
        
        console.log('📏 ========== 측정 완료 ==========');
      }, 1000); // 1초 후 측정 (테이블 렌더링 완료 대기)
    };

    // 데이터가 로드되고 테이블이 렌더링된 후 측정
    if (filteredOrderData.length > 0 && !isLoading) {
      measureTableColumns();
    }
  }, [filteredOrderData, isLoading]); // 데이터가 변경되거나 로딩이 완료될 때 측정

  // 📥 주문 데이터 로드 - 신규주문 페이지는 구글 시트에서 직접 읽기 때문에 초기화만 수행
  const loadOrderData = async () => {
    console.log('📋 신규주문 페이지 초기화 - 빈 데이터로 시작');
    setOrderData([]);
    setFilteredOrderData([]);
    setIsLoading(false);
  };

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
      // 고유한 ID 생성: 주문번호를 기본으로 사용
      const uniqueId = `${order.china_order_number || `order-${currentPage}-${index}`}-${order.option_id || index}`;
      
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
      order.china_order_number?.toLowerCase().includes(searchLower) ||
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

  // 현재 사용자 ID 가져오기
  const getCurrentUserId = () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      console.log('👤 localStorage에서 가져온 사용자 정보:', currentUser);
      console.log('👤 사용자 ID:', currentUser.id);
      return currentUser.id || null;
    } catch (error) {
      console.error('❌ 사용자 정보 읽기 오류:', error);
      return null;
    }
  };

  // 🔧 모달 상태 관리
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);

  // 🔧 액션 버튼 핸들러들
  const handleAddOrder = () => {
    console.log('🛒 주문 추가하기 버튼 클릭');
    setShowAddOrderModal(true);
  };

  /**
   * 정보 불러오기 핸들러
   * 바코드 기반으로 chinaorder_googlesheet에서 이전 주문 정보를 조회하여 현재 테이블 데이터에 반영
   */
  const handleLoadInfo = async () => {
    console.log('📥 정보 불러오기 버튼 클릭');

    // 현재 테이블 데이터 확인
    if (orderData.length === 0) {
      alert('먼저 구글 시트에서 데이터를 불러와주세요.');
      return;
    }

    // 정보 불러오기 실행 (훅 사용)
    await loadOrderInfo(orderData, (updatedData) => {
      // 업데이트된 데이터로 화면 갱신
      setOrderData(updatedData);
      setFilteredOrderData(updatedData);
      console.log('✅ 테이블 데이터 업데이트 완료');
    });
  };

  const handleDelete = async () => {
    console.log('🗑️ 삭제 버튼 클릭');
    console.log('선택된 항목들:', selectedItems);
    
    if (selectedItems.length === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    // 삭제 확인 다이얼로그
    const isConfirmed = window.confirm(`선택한 ${selectedItems.length}개 항목을 삭제하시겠습니까?`);
    if (!isConfirmed) return;

    try {
      setIsLoading(true);
      console.log('🔥 삭제 실행 시작');

      // 선택된 항목들의 option_id 추출
      const optionIdsToDelete = selectedItems.map(itemId => {
        const row = currentTableRows.find(r => r.id === itemId);
        return row?.option_id;
      }).filter(Boolean);

      console.log('삭제할 옵션ID들:', optionIdsToDelete);

      // DB에서 삭제
      const { error } = await supabase
        .from('chinaorder_cart')
        .delete()
        .in('option_id', optionIdsToDelete);

      if (error) {
        throw error;
      }

      console.log('✅ DB 삭제 완료');

      // 로컬 상태에서도 제거
      setOrderData(prevData => 
        prevData.filter(item => !optionIdsToDelete.includes(item.option_id))
      );
      
      setFilteredOrderData(prevData => 
        prevData.filter(item => !optionIdsToDelete.includes(item.option_id))
      );

      // 선택 상태 초기화
      setSelectedItems([]);
      setSelectAll(false);

      console.log('✅ 삭제 완료:', optionIdsToDelete.length, '개 항목');
      alert(`${optionIdsToDelete.length}개 항목이 삭제되었습니다.`);

    } catch (error) {
      console.error('❌ 삭제 실패:', error);
      alert('삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };


  const totalPages = Math.ceil(filteredOrderData.length / itemsPerPage);
  const currentTableRows = transformDataToTableRows(getCurrentPageData());

  // 🆕 인라인 편집 관련 함수들
  const handleCellClick = (rowId: string, field: string, currentValue: any) => {
    if (field === 'image_url') return; // 이미지 셀은 편집 불가
    
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue || ''));
  };

  const handleEditKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleEditBlur = () => {
    handleSaveEdit();
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;

    const { rowId, field } = editingCell;
    
    try {
      // DB 필드명 매핑 (인터페이스 → DB)
      const dbFieldMap: Record<string, string> = {
        'order_quantity': 'quantity',
        'remark': 'composition'
      };
      
      const dbField = dbFieldMap[field] || field;
      
      const { error } = await supabase
        .from('chinaorder_cart')
        .update({ [dbField]: editValue })
        .eq('option_id', rowId);

      if (error) {
        throw error;
      }

      // 로컬 데이터 업데이트
      setOrderData(prevData => 
        prevData.map(item => 
          item.option_id === rowId 
            ? { ...item, [field]: editValue }
            : item
        )
      );

      // 필터된 데이터도 업데이트
      setFilteredOrderData(prevData => 
        prevData.map(item => 
          item.option_id === rowId 
            ? { ...item, [field]: editValue }
            : item
        )
      );

      console.log('✅ 셀 업데이트 완료:', { rowId, field, dbField, value: editValue });

    } catch (error) {
      console.error('❌ 셀 업데이트 오류:', error);
      alert('데이터 업데이트에 실패했습니다.');
    } finally {
      setEditingCell(null);
      setEditValue('');
    }
  };

  return (
    <div className="product-list-container chinaorder-cart-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">신규주문</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ActionButton
            variant="success"
            onClick={handleGoogleSheetsDirectRead}
            loading={sheetsLoading}
            loadingText="가져오는 중..."
          >
            구글 시트 불러오기
          </ActionButton>
          <ActionButton
            variant="default"
            onClick={() => setShowBackupModal(true)}
          >
            주문 데이터베이스
          </ActionButton>
        </div>
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
          {/* 판매방식 필터 */}
          <div>
            <label className="product-list-label">판매방식</label>
            <select 
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="로켓그로스">로켓그로스</option>
              <option value="일반판매">일반판매</option>
            </select>
          </div>

          {/* 노출상태 */}
          <div>
            <label className="product-list-label">노출상태</label>
            <select 
              value={selectedExposure}
              onChange={(e) => setSelectedExposure(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="APPROVAL">승인</option>
              <option value="ON_SALE">판매중</option>
              <option value="REJECT">반려</option>
              <option value="SUSPENSION">일시중단</option>
            </select>
          </div>

          {/* 판매상태 */}
          <div>
            <label className="product-list-label">판매상태</label>
            <select 
              value={selectedSaleStatus}
              onChange={(e) => setSelectedSaleStatus(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
              <option value="ONSALE">판매중</option>
              <option value="OUTOFSTOCK">품절</option>
              <option value="SUSPENSION">판매중단</option>
            </select>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="product-list-label">카테고리</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="product-list-select"
            >
              <option value="전체">전체</option>
            </select>
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
                placeholder="검색어를 입력하세요... (Enter 키로 검색)"
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
              총 {filteredOrderData.length}개 주문
            </div>
            <div className="product-list-selected-info">
              선택된 주문: {selectedItems.length}개 / 총 {currentTableRows.length}개
            </div>
          </div>
          
          <div className="product-list-action-buttons">
            <ActionButton
              variant="primary"
              onClick={handleAddOrder}
              disabled={isLoading}
            >
              주문 추가하기
            </ActionButton>
            
            <ActionButton
              variant="info"
              onClick={handleLoadInfo}
              loading={loadInfoLoading}
              loadingText="불러오는 중..."
            >
              정보 불러오기
            </ActionButton>

            <ActionButton
              variant="danger"
              onClick={handleDelete}
              disabled={selectedItems.length === 0 || isLoading}
            >
              삭제
            </ActionButton>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="chinaorder-table chinaorder-cart-table" key={`table-page-${currentPage}`}>
            <thead className="chinaorder-table-header">
              <tr>
                <th className="chinaorder-table-header-cell chinaorder-table-header-checkbox">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="product-list-checkbox-large"
                  />
                </th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-image">이미지</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-order-number">주문번호</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-item-name">등록상품명/옵션명</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-china-option">중국옵션</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-quantity">수량</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-price">위안</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-status">진행</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-status">확인</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-status">취소</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-status">출고</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-remark">비고</th>
                <th className="chinaorder-table-header-cell chinaorder-table-header-confirm">출고번호</th>
              </tr>
            </thead>
            <tbody className="chinaorder-table-body">
              {currentTableRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="chinaorder-empty-data">
                    {isLoading ? '데이터를 불러오는 중...' : '데이터가 없습니다.'}
                  </td>
                </tr>
              )}
              {currentTableRows.map((row, index) => {
                // 편집 가능한 셀을 렌더링하는 함수
                const renderEditableCell = (field: string, value: any, style: any, isNumeric = false) => {
                  const isEditing = editingCell?.rowId === row.option_id && editingCell?.field === field;
                  
                  if (isEditing) {
                    return (
                      <input
                        type={isNumeric ? "number" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyPress={handleEditKeyPress}
                        onBlur={handleEditBlur}
                        autoFocus
                        style={{
                          width: '100%',
                          height: '100%',
                          padding: '2px 4px',
                          border: 'none',
                          outline: 'none',
                          fontSize: style.fontSize,
                          textAlign: 'center',
                          backgroundColor: 'transparent',
                          fontFamily: 'inherit'
                        }}
                      />
                    );
                  }
                  
                  return (
                    <div
                      onClick={() => handleCellClick(row.option_id!, field, value)}
                      style={{
                        cursor: 'pointer',
                        minHeight: '30px',
                        width: '100%',
                        height: '100%',
                        boxSizing: 'border-box',
                        padding: '4px 6px',
                        display: 'block',
                        fontSize: style.fontSize,
                        textAlign: 'center',
                        lineHeight: '1.2',
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap'
                      }}
                      title="클릭하여 편집"
                    >
                      {value || '-'}
                    </div>
                  );
                };

                return (
                  <tr key={row.id} className="chinaorder-table-row">
                    <td className="chinaorder-table-cell-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(row.id)}
                        onChange={() => handleSelectItem(row.id)}
                        className="product-list-checkbox-large"
                      />
                    </td>
                    <td className="chinaorder-table-cell-image">
                      {row.image_url && row.image_url !== row.china_link && !row.image_url.includes('placeholder') ? (
                        row.china_link ? (
                          <a href={row.china_link} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={row.image_url} 
                              alt="상품 이미지" 
                              className="chinaorder-product-image"
                              referrerPolicy="no-referrer"
                              onLoad={() => console.log(`✅ SUCCESS [${index}]:`, row.image_url)}
                              onError={(e) => {
                                console.log(`❌ FAILED [${index}]:`, row.image_url);
                                // 에러 시 이미지 숨기고 대체 텍스트 표시
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement?.parentElement;
                                if (parent && !parent.querySelector('.chinaorder-error-placeholder')) {
                                  const errorDiv = document.createElement('div');
                                  errorDiv.className = 'chinaorder-error-placeholder';
                                  errorDiv.textContent = '이미지 없음';
                                  parent.appendChild(errorDiv);
                                }
                              }}
                            />
                          </a>
                        ) : (
                          <img 
                            src={row.image_url} 
                            alt="상품 이미지" 
                            className="chinaorder-product-image"
                            referrerPolicy="no-referrer"
                            onLoad={() => console.log(`✅ SUCCESS [${index}]:`, row.image_url)}
                            onError={(e) => {
                              console.log(`❌ FAILED [${index}]:`, row.image_url);
                              // 에러 시 이미지 숨기고 대체 텍스트 표시
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector('.chinaorder-error-placeholder')) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'chinaorder-error-placeholder';
                                errorDiv.textContent = '이미지 없음';
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                        )
                      ) : (
                        <div className="chinaorder-image-placeholder">
                          이미지 없음
                        </div>
                      )}
                    </td>
                    <td className="chinaorder-table-cell-order-number">
                      <div className="chinaorder-order-info">
                        {row.date || '-'}<br/>
                        {row.china_order_number || '-'}
                      </div>
                    </td>
                    <td className="chinaorder-table-cell-item-name">
                      <div className="chinaorder-item-info" 
                           onClick={() => handleCellClick(row.option_id!, 'item_name', row.item_name)}
                           style={{ cursor: 'pointer' }}
                           title="클릭하여 편집">
                        {editingCell?.rowId === row.option_id && editingCell?.field === 'item_name' ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyPress={handleEditKeyPress}
                            onBlur={handleEditBlur}
                            autoFocus
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              fontSize: '13px',
                              backgroundColor: 'transparent',
                              fontFamily: 'inherit'
                            }}
                          />
                        ) : (
                          <>
                            {row.item_name || '-'}
                            {row.option_name && '\n' + row.option_name}
                            {row.barcode && '\n' + row.barcode}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="chinaorder-table-cell-china-option">
                      <div className="chinaorder-china-option-info">
                        {row.china_option1 || '-'}
                        {row.china_option2 && '\n' + row.china_option2}
                      </div>
                    </td>
                    <td className="chinaorder-table-cell-quantity">{row.order_quantity || '-'}</td>
                    <td className="chinaorder-table-cell-price">
                      <div className="chinaorder-price-info">
                        {row.china_price || '-'}
                        {row.china_total_price && '\n' + row.china_total_price}
                      </div>
                    </td>
                    <td className="chinaorder-table-cell-status">
                      {row.order_status_ordering ? (
                        <span className="chinaorder-status-badge chinaorder-status-ordering">
                          {row.order_status_ordering}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="chinaorder-table-cell-status">
                      {row.order_status_check ? (
                        <span className="chinaorder-status-badge chinaorder-status-check">
                          {row.order_status_check}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="chinaorder-table-cell-status">
                      {row.order_status_cancel ? (
                        <span className="chinaorder-status-badge chinaorder-status-cancel">
                          {row.order_status_cancel}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="chinaorder-table-cell-status">
                      {row.order_status_shipment ? (
                        <span className="chinaorder-status-badge chinaorder-status-shipment">
                          {row.order_status_shipment}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="chinaorder-table-cell-remark">{row.note || row.remark || ''}</td>
                    <td className="chinaorder-table-cell-confirm">
                      <div className="chinaorder-shipment-info">
                        {row.confirm_order_id || '-'}<br/>
                        {row.confirm_shipment_id || '-'}
                      </div>
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

      {/* 주문 추가 모달 */}
      <AddOrderModal
        isOpen={showAddOrderModal}
        onClose={() => setShowAddOrderModal(false)}
        onSave={(data) => {
          console.log('모달에서 저장된 데이터:', data);
          // TODO: 저장 로직 구현
          loadOrderData();
        }}
      />

      {/* 주문 데이터베이스 백업 모달 */}
      <BackupOrderModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onSave={(data) => {
          console.log('백업 데이터:', data);
          // TODO: 백업 로직 구현
        }}
      />
    </div>
  );
}

export default ChinaorderCart; 