import React, { useState, useEffect, useMemo } from 'react';
import Title from '../../components/Title';
import { supabase } from '../../config/supabase';
import './ReturnItems.css';

/**
 * 쿠팡 로켓 인벤토리 데이터 타입 정의
 */
interface CoupangInventoryItem {
  option_id: string;
  product_name: string;
  option_name: string;
  pending_inbounds: number;
  orderable_quantity: number;
  offer_condition: string;
  sales_quantity_last_7_days: number;
  sales_quantity_last_30_days: number;
  monthly_storage_fee: number;
}

/**
 * 반출 관리 페이지 컴포넌트
 * - 반출 요청 목록 조회
 * - 반출 상태 관리
 * - 새로운 반출 요청 등록
 */
const ReturnItems: React.FC = () => {
  // 쿠팡 인벤토리 목록 상태
  const [inventoryItems, setInventoryItems] = useState<CoupangInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 선택된 아이템들
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // 검색 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 현재 로그인한 사용자 ID 가져오기
  const getCurrentUserId = (): string | null => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return currentUser.id || currentUser.user_id || null;
    } catch (error) {
      return null;
    }
  };

  // 데이터 가져오기
  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      const userId = getCurrentUserId();
      
      if (!userId) {
        return;
      }

      // 모든 데이터를 가져오기 위해 페이지네이션 방식 사용
      let allData: any[] = [];
      let from = 0;
      const rangeSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from('coupang_rocket_inventory')
          .select(`
            option_id,
            product_name,
            option_name,
            pending_inbounds,
            orderable_quantity,
            offer_condition,
            sales_quantity_last_7_days,
            sales_quantity_last_30_days,
            monthly_storage_fee,
            user_id
          `)
          .eq('user_id', userId)
          .gt('monthly_storage_fee', 0)
          .order('product_name', { ascending: true })
          .range(from, from + rangeSize - 1);

        if (batchError) {
          break;
        }

        if (batchData && batchData.length > 0) {
          allData = [...allData, ...batchData];
          
          if (batchData.length < rangeSize) {
            hasMore = false;
          } else {
            from += rangeSize;
          }
        } else {
          hasMore = false;
        }
      }
      
      setInventoryItems(allData);

    } catch (error) {
      // 에러 발생 시 빈 배열로 설정
      setInventoryItems([]);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 가져오기
  useEffect(() => {
    fetchInventoryData();
  }, []);

  /**
   * 아이템 선택 토글
   */
  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  /**
   * 전체 선택/해제
   */
  const handleSelectAll = () => {
    if (selectedItems.length === paginatedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedItems.map(item => item.option_id));
    }
  };

  /**
   * 필터링된 아이템 목록
   */
  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.option_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.option_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '전체' || item.offer_condition === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  /**
   * 페이지네이션된 아이템 목록
   */
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage, itemsPerPage]);

  /**
   * 총 페이지 수
   */
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  /**
   * 통계 데이터 계산
   */
  const statsData = useMemo(() => {
    const totalStorageFee = inventoryItems.reduce((sum, item) => sum + (item.monthly_storage_fee || 0), 0);
    const newItemsStorageFee = inventoryItems
      .filter(item => item.offer_condition === 'NEW')
      .reduce((sum, item) => sum + (item.monthly_storage_fee || 0), 0);
    const usedItemsStorageFee = inventoryItems
      .filter(item => item.offer_condition !== 'NEW')
      .reduce((sum, item) => sum + (item.monthly_storage_fee || 0), 0);

    return {
      totalStorageFee,
      newItemsStorageFee,
      usedItemsStorageFee
    };
  }, [inventoryItems]);

  /**
   * 검색 실행
   */
  const handleSearch = () => {
    setCurrentPage(1); // 검색 시 첫 페이지로 이동
  };

  /**
   * 페이지 변경
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedItems([]); // 페이지 변경 시 선택 초기화
  };

  /**
   * 상태별 색상 클래스 반환
   */
  const getStatusClass = (status: string) => {
    if (status === 'NEW') {
      return 'status-new';
    } else {
      return 'status-used';
    }
  };

  return (
    <div className="return-items-container">
      {/* 페이지 헤더 */}
      <Title 
        title="반출 관리"
        subtitle="쿠팡 로켓 인벤토리 현황을 확인하고 관리합니다."
      />

      {/* 필터 및 검색 영역 */}
      <div className="filter-section">
        <div className="search-flex-container">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter flex-item"
          >
            <option value="전체">전체 상태</option>
            <option value="NEW">신상품</option>
            <option value="USED">중고</option>
            <option value="REFURBISHED">리퍼브</option>
          </select>
          
          <input
            type="text"
            placeholder="상품명, 옵션명, 옵션ID로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input flex-item"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          
          <button 
            onClick={handleSearch}
            className="btn-primary flex-item"
          >
            검색
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>{statsData.totalStorageFee.toLocaleString()}</h3>
            <p>보관료</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🆕</div>
          <div className="stat-info">
            <h3>{statsData.newItemsStorageFee.toLocaleString()}</h3>
            <p>NEW</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-info">
            <h3>{statsData.usedItemsStorageFee.toLocaleString()}</h3>
            <p>중고제품</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-info">
            <h3>0</h3>
            <p>7일 판매량</p>
          </div>
        </div>
      </div>

      {/* 반출 목록 테이블 */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-info">
            총 {filteredItems.length}개 항목 (페이지 {currentPage} / {totalPages})
          </div>
        </div>

        <div className="table-wrapper">
          <table className="return-items-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>옵션ID</th>
                <th>상품명</th>
                <th className="center-header">입고중</th>
                <th className="center-header">재고</th>
                <th className="center-header">상태</th>
                <th className="center-header">7일 판매량</th>
                <th className="center-header">30일 판매량</th>
                <th className="center-header">보관료</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : paginatedItems.map(item => (
                <tr key={item.option_id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.option_id)}
                      onChange={() => handleItemSelect(item.option_id)}
                    />
                  </td>
                  <td className="item-code">{item.option_id}</td>
                  <td className="item-name">
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {item.option_name}
                      </div>
                    </div>
                  </td>
                  <td className="center-data">{item.pending_inbounds || 0}</td>
                  <td className="center-data">{item.orderable_quantity || 0}</td>
                  <td className="center-data">
                    <span className={`status-badge ${getStatusClass(item.offer_condition)}`}>
                      {item.offer_condition}
                    </span>
                  </td>
                  <td className="center-data">{item.sales_quantity_last_7_days || 0}</td>
                  <td className="center-data">{item.sales_quantity_last_30_days || 0}</td>
                  <td className="center-data">{item.monthly_storage_fee || 0}</td>
                </tr>
              ))}
              {!loading && paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">
                    {inventoryItems.length === 0 
                      ? '인벤토리 데이터가 없습니다.'
                      : '조건에 맞는 상품이 없습니다.'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="btn-secondary"
            >
              이전
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber: number;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNumber}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`page-button ${currentPage === pageNumber ? 'active' : ''}`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="btn-secondary"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnItems; 