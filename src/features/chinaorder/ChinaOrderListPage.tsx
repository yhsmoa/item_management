import React, { useState, useEffect } from 'react';
import DashboardStatsCard from '../products/components/DashboardStatsCard';
import '../products/ProductListPage.css';
import './ChinaOrderListPage.css';
import { importGoogleSheetsData, ChinaOrderData } from '../../services/googleSheetsService';
import { supabase } from '../../config/supabase';

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

function ChinaOrderListPage() {
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
  
  // 주문 데이터
  const [orderData, setOrderData] = useState<ChinaOrderData[]>([]);
  const [filteredOrderData, setFilteredOrderData] = useState<ChinaOrderData[]>([]);

  // 컴포넌트 마운트 시 데이터 로드 + 🧹 메모리 누수 방지
  useEffect(() => {
    console.log('🔄 ChinaOrderListPage 컴포넌트 마운트됨');
    loadOrderData();
    
    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      console.log('🧹 ChinaOrderListPage 컴포넌트 언마운트 - 메모리 정리 중...');
      
      // 대용량 상태 데이터 초기화 (메모리 절약)
      setOrderData([]);
      setFilteredOrderData([]);
      setSelectedItems([]);
      setIsLoading(false);
      setSelectAll(false);
      
      console.log('✅ ChinaOrderListPage 메모리 정리 완료');
    };
  }, []);

  // 주문 데이터 로드
  const loadOrderData = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chinaorder_googlesheet')
        .select('*')
        .eq('user_id', userId)
        .order('china_order_number', { ascending: true }); // 주문번호 순서로 정렬

      if (error) {
        console.error('❌ 주문 데이터 로드 에러:', error);
        return;
      }

      setOrderData(data || []);
      setFilteredOrderData(data || []);

      

    } catch (error) {
      console.error('❌ 주문 데이터 로드 예외:', error);
    } finally {
      setIsLoading(false);
    }
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
      return currentUser.id || null;
    } catch (error) {
      console.error('❌ 사용자 정보 읽기 오류:', error);
      return null;
    }
  };

  // 구글 시트 데이터 가져오기 핸들러
  const handleGoogleSheetsImport = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await importGoogleSheetsData(userId);
      
      if (result.success) {
        alert(`구글 시트 데이터 가져오기 성공!\n저장된 데이터: ${result.savedCount}개`);
        // 데이터 다시 로드
        await loadOrderData();
      } else {
        alert(`구글 시트 데이터 가져오기 실패:\n${result.error}`);
      }
    } catch (error: any) {
      console.error('❌ 구글 시트 가져오기 에러:', error);
      alert(`오류가 발생했습니다:\n${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredOrderData.length / itemsPerPage);
  const currentTableRows = transformDataToTableRows(getCurrentPageData());

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">주문 목록</h1>
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
            <button
              onClick={handleGoogleSheetsImport}
              disabled={isLoading}
              className="product-list-button product-list-button-success"
            >
              {isLoading ? '처리 중...' : '구글시트 주문 api'}
            </button>
            
            <button
              disabled
              className="product-list-button product-list-button-primary"
            >
              생성 예정
            </button>

            <button
              disabled
              className="product-list-button product-list-button-info"
            >
              생성 예정
            </button>
            
            <button
              disabled
              className="product-list-button product-list-button-warning"
            >
              생성 예정
            </button>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="product-list-table-container">
          <table className="chinaorder-table" key={`table-page-${currentPage}`}>
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
              {currentTableRows.map((row, index) => (
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
                    <div className="chinaorder-item-info">
                      {row.item_name || '-'}
                      {row.option_name && '\n' + row.option_name}
                      {row.barcode && '\n' + row.barcode}
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
                  <td className="chinaorder-table-cell-remark">{row.remark || ''}</td>
                  <td className="chinaorder-table-cell-confirm">
                    <div className="chinaorder-shipment-info">
                      {row.confirm_order_id || '-'}<br/>
                      {row.confirm_shipment_id || '-'}
                    </div>
                  </td>
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

export default ChinaOrderListPage; 