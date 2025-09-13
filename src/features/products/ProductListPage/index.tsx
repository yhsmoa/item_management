import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ActionButton from '../../../components/ActionButton';
import StatsCardsSection from './components/StatsCardsSection';
import ActionButtonsSection from './components/ActionButtonsSection';
import SearchSection from './components/SearchSection';
import ProgressIndicator from './components/ProgressIndicator';
import PaginationControls from './components/PaginationControls';
import ProductTable from './components/ProductTable';
import { supabase } from '../../../config/supabase';
import './index.css';
import { formatDateToMMDD } from './utils/dateUtils';
import { getViewCountColor } from './utils/viewsUtils';
import { calculateStats, Stats } from './utils/statsUtils';
import { TableRow, Progress, HoveredImage } from './types';
import { 
  loadProductsFromDB,
  loadRocketInventoryOptionIds,
  loadOrderQuantityData,
  loadCoupangSalesData,
  loadWarehouseStockData,
  loadViewsData,
  loadItemViewsData,
  loadPurchaseStatusData
} from './services/dataService';
import { ShipmentManagerService } from './services/shipmentManagerService';
import {
  handleDeleteAllData,
  handleExcelUpload,
  handleRocketInventoryExcelUpload,
  handleSalesExcelUpload
} from './services/uploadService';
import { useProductData } from './hooks/useProductData';
import { useTableSelection } from './hooks/useTableSelection';
import { usePagination } from './hooks/usePagination';
import { useOrderManagement } from './hooks/useOrderManagement';
import { useInventoryData } from './hooks/useInventoryData';
import { useViewsData } from './hooks/useViewsData';

// Main ProductListPage component

function ProductListPage() {

  
  // Product data hook
  const {
    data,
    filteredData,
    searchKeyword,
    appliedSearchKeyword,
    searchSuggestions,
    showSuggestions,
    setData,
    setFilteredData,
    setSearchKeyword,
    setAppliedSearchKeyword,
    setSearchSuggestions,
    setShowSuggestions,
    generateSearchSuggestions,
    handleSearchKeywordChange,
    handleSuggestionSelect,
    handleSearch,
    handleKeyPress
  } = useProductData();

  // Inventory data hook
  const {
    rocketInventoryOptionIds,
    rocketInventoryData,
    orderQuantityData,
    warehouseStockData,
    purchaseStatusData,
    shipmentStockData,
    setRocketInventoryOptionIds,
    setRocketInventoryData,
    setOrderQuantityData,
    setWarehouseStockData,
    setPurchaseStatusData,
    setShipmentStockData,
    renderOrderableQuantity,
    renderOrderQuantity,
    renderWarehouseStock,
    renderPurchaseStatus,
    renderRecommendedQuantity,
    renderStorageFee,
    render7DaysSales,
    render30DaysSales,
    renderShipmentStock,
    shouldHighlightRow
  } = useInventoryData();

  // Views data hook
  const {
    itemViewsData,
    viewsDataByDate,
    coupangSalesData,
    setItemViewsData,
    setViewsDataByDate,
    setCoupangSalesData,
    renderPeriodSales,
    getViewCountByDate,
    hasPeriodSales
  } = useViewsData();

  // Other state 정의
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  // 검색 및 필터 (나머지 필터들)
  const [searchFilter, setSearchFilter] = useState('상품명'); // 카테고리 -> 검색필터로 변경
  const [selectedExposure, setSelectedExposure] = useState('전체');
  const [selectedSaleStatus, setSelectedSaleStatus] = useState('전체');
  const [sortFilter, setSortFilter] = useState('전체');
  
  // 테이블 관련
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredImage, setHoveredImage] = useState<HoveredImage | null>(null);
  
  
  
  // 로딩 상태
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isUploadingRocketInventory, setIsUploadingRocketInventory] = useState(false);
  const [isLoadingSalesExcel, setIsLoadingSalesExcel] = useState(false);
  
  // 진행률
  const [productInfoProgress, setProductInfoProgress] = useState<Progress | null>(null);
  
  // 입력 ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🛠️ 5단계 최적화: 타이머 추적을 위한 ref 추가 (메모리 누수 방지)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 📊 통계 계산 최적화 - useMemo로 매 렌더링마다 재계산 방지
  const stats: Stats = useMemo(() => {
    return calculateStats(data);
  }, [data]); // data가 변경될 때만 재계산


  // 🚀 UPSERT 방식 saveToCart 함수 (효율적인 INSERT/UPDATE 통합)
  const saveToCart = useCallback(async (row: TableRow, quantity: number) => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 사용자 ID를 찾을 수 없습니다.');
        alert('로그인이 필요합니다.');
        return;
      }

      // 오늘 날짜를 MMDD 형태로 변환
      const today = new Date();
      const dateMMDD = formatDateToMMDD(today);

      // chinaorder_cart 테이블에 저장할 데이터
      const cartData = {
        user_id: userId,
        option_id: row.option_id,
        date: dateMMDD,
        item_name: row.product_name.split('\n')[0] || '', // 첫 번째 줄이 item_name
        option_name: row.product_name.split('\n')[1] || '', // 두 번째 줄이 option_name
        barcode: row.barcode || '',
        quantity: quantity
      };

      console.log('🚀 UPSERT 저장할 데이터:', cartData);

      // 🚀 Supabase UPSERT: 기존 데이터가 있으면 UPDATE, 없으면 INSERT
      // Manual UPSERT 방식 사용 (더 안정적)
      
      // 1단계: 기존 데이터 확인
      const { data: existingData, error: checkError } = await supabase
        .from('chinaorder_cart')
        .select('*')
        .eq('user_id', userId)
        .eq('option_id', row.option_id)
        .eq('date', dateMMDD)
        .maybeSingle();

      if (checkError) {
        console.error('❌ 기존 데이터 확인 오류:', checkError);
        alert(`기존 데이터 확인 실패: ${checkError.message}`);
        return;
      }

      let result;
      let operation: 'INSERT' | 'UPDATE' = 'INSERT';

      if (existingData) {
        // 2-A단계: 기존 데이터가 있으면 UPDATE (quantity만 수정)
        operation = 'UPDATE';
        console.log(`🔄 기존 데이터 발견 - 수량만 업데이트: ${existingData.quantity} → ${quantity}`);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('chinaorder_cart')
          .update({ 
            quantity: quantity,
            // 다른 필드들도 최신 정보로 업데이트
            item_name: cartData.item_name,
            option_name: cartData.option_name,
            barcode: cartData.barcode
          })
          .eq('user_id', userId)
          .eq('option_id', row.option_id)
          .eq('date', dateMMDD)
          .select();

        if (updateError) {
          console.error('❌ 데이터 업데이트 오류:', updateError);
          alert(`데이터 업데이트 실패: ${updateError.message}`);
          return;
        }

        result = updateResult;
      } else {
        // 2-B단계: 기존 데이터가 없으면 INSERT (새로 추가)
        operation = 'INSERT';
        console.log('➕ 새로운 데이터 INSERT');
        
        const { data: insertResult, error: insertError } = await supabase
          .from('chinaorder_cart')
          .insert([cartData])
          .select();

        if (insertError) {
          console.error('❌ 데이터 INSERT 오류:', insertError);
          alert(`데이터 INSERT 실패: ${insertError.message}`);
          return;
        }

        result = insertResult;
      }

      console.log(`✅ ${operation} 성공:`, result);
      
      // 성공 피드백
      const actionText = operation === 'UPDATE' ? '수량 수정됨' : '새로 추가됨';
      console.log(`✅ ${cartData.item_name} (${cartData.option_name}) ${quantity}개 ${actionText}`);
      
      // 🔄 입력 필드 데이터 새로고침 (저장 후 즉시 반영)
      try {
        await loadInputFieldData();
      } catch (error) {
        console.error('❌ 입력 필드 데이터 새로고침 실패:', error);
      }
      
    } catch (error) {
      console.error('❌ UPSERT 저장 실패:', error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    }
  }, []);

  /**
   * 주문 데이터 타입 정의
   */

  /**
   * 기업급 에러 처리 유틸리티
   * @description unknown 타입의 에러를 안전하게 처리하는 유틸리티 함수
   */


  // 🛠️ 수정된 조회수 색상 결정 함수: view1=검은색, view2~5는 이전값 대비 증감에 따라 색상 결정

  // 🚀 성능 최적화: 값 하이라이트 렌더링 함수들
  const renderValueWithHighlight = useCallback((value: any, highlightClass: string) => {
    const numValue = parseFloat(value);
    if (value && !isNaN(numValue) && numValue > 0) {
      return <span className={highlightClass}>{value}</span>;
    }
    return value || '-';
  }, []);





  // JSX wrapper functions for hook render functions
  const renderOrderableQuantityWithStyle = useCallback((row: TableRow) => {
    const value = renderOrderableQuantity(row);
    return value && value !== '-' ? <span className="product-list-highlight-light-gray">{value}</span> : '-';
  }, [renderOrderableQuantity]);

  const renderOrderQuantityWithStyle = useCallback((row: TableRow) => {
    const value = renderOrderQuantity(row);
    return value && value !== '-' ? <span className="value-highlight-orange">{value}</span> : '-';
  }, [renderOrderQuantity]);

  const renderWarehouseStockWithStyle = useCallback((row: TableRow) => {
    const value = renderWarehouseStock(row);
    return value && value !== '-' ? <span className="stock-warehouse">{value}</span> : '-';
  }, [renderWarehouseStock]);

  const renderPurchaseStatusWithStyle = useCallback((row: TableRow) => {
    const value = renderPurchaseStatus(row);
    return value && value !== '-' ? <span className="purchase-status">{value}</span> : '-';
  }, [renderPurchaseStatus]);

  const renderPeriodSalesWithStyle = useCallback((row: TableRow) => {
    const value = renderPeriodSales(row);
    return value && value !== '-' ? <span className="product-list-highlight-blue-border">{value}</span> : '-';
  }, [renderPeriodSales]);

  const renderRecommendedQuantityWithStyle = useCallback((row: TableRow) => {
    const value = renderRecommendedQuantity(row);
    return value && value !== '-' ? <span className="coupang-recommendation-text">{value}</span> : '-';
  }, [renderRecommendedQuantity]);

  const renderStorageFeeWithStyle = useCallback((row: TableRow) => {
    const value = renderStorageFee(row);
    return value && value !== '-' ? <span className="value-highlight-red">{value}</span> : '-';
  }, [renderStorageFee]);

  const renderShipmentStockWithStyle = useCallback((row: TableRow) => {
    const value = renderShipmentStock(row);
    return value && value !== '-' ? <span className="shipment-stock">{value}</span> : '-';
  }, [renderShipmentStock]);

  const render7DaysSalesWithStyle = useCallback((row: TableRow) => {
    const value = render7DaysSales(row);
    return value && value !== '-' ? <span className="value-highlight-blue">{value}</span> : '-';
  }, [render7DaysSales]);

  const render30DaysSalesWithStyle = useCallback((row: TableRow) => {
    const value = render30DaysSales(row);
    return value && value !== '-' ? <span className="value-highlight-blue">{value}</span> : '-';
  }, [render30DaysSales]);

  // 로켓재고 데이터 로드 (옵션 ID와 관련 데이터)
  const loadRocketInventoryOptionIdsWrapper = async () => {
    try {
      const { optionIds, rocketData } = await loadRocketInventoryOptionIds();
      setRocketInventoryOptionIds(optionIds);
      setRocketInventoryData(rocketData);
    } catch (error) {
      console.error('❌ 로켓재고 데이터 로드 실패:', error);
    }
  };

  // 🆕 사입상태 데이터 로드 (chinaorder_googlesheet에서 바코드별 주문 수량 합계)
  const loadOrderQuantityDataWrapper = async () => {
    try {
      const quantityMap = await loadOrderQuantityData();
      setOrderQuantityData(quantityMap);
    } catch (error) {
      console.error('❌ 사입상태 데이터 로드 실패:', error);
    }
  };

  // 🆕 구매 상태 데이터 로드 (chinaorder_googlesheet에서 바코드별 주문+배송 상태 합계)
  const loadPurchaseStatusDataWrapper = async () => {
    try {
      const purchaseStatusMap = await loadPurchaseStatusData();
      setPurchaseStatusData(purchaseStatusMap);
    } catch (error) {
      console.error('❌ 구매상태 데이터 로드 실패:', error);
    }
  };

  // 🆕 쿠팡 판매량 데이터 로드
  const loadCoupangSalesDataWrapper = async () => {
    try {
      const salesData = await loadCoupangSalesData();
      setCoupangSalesData(salesData);
    } catch (error) {
      console.error('❌ 쿠팡 판매량 데이터 로드 실패:', error);
    }
  };

  // 🆕 창고재고 데이터 로드 (stocks_management에서 바코드별 재고 합계)
  const loadWarehouseStockDataWrapper = async () => {
    try {
      const warehouseStockMap = await loadWarehouseStockData();
      setWarehouseStockData(warehouseStockMap);
    } catch (error) {
      console.error('❌ 창고재고 데이터 로드 실패:', error);
    }
  };

  // 🆕 출고재고 데이터 로드 (stocks_shipment에서 바코드별 재고 합계)
  const loadShipmentStockDataWrapper = async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        console.error('❌ 출고재고 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      const shipmentStockMap = await ShipmentManagerService.loadShipmentStockData(userId);
      setShipmentStockData(shipmentStockMap);
    } catch (error) {
      console.error('❌ 출고재고 데이터 로드 실패:', error);
    }
  };

  // 조회수 데이터 로드 (최근 5개 날짜)
  const loadViewsDataWrapper = async () => {
    try {
      const viewsMaps = await loadViewsData();
      setViewsDataByDate(viewsMaps);
    } catch (error) {
      console.error('❌ 조회수 데이터 로드 실패:', error);
      setViewsDataByDate([]);
    }
  };

  // 🔄 입력 필드 데이터 로드 (DB에서 기존 저장된 입력값들 불러오기)
  const loadInputFieldData = useCallback(async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 입력 필드 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      // 오늘 날짜를 MMDD 형태로 변환
      const today = new Date();
      const dateMMDD = formatDateToMMDD(today);

      // chinaorder_cart 테이블에서 오늘 날짜의 주문 데이터 조회
      const { data: inputData, error } = await supabase
        .from('chinaorder_cart')
        .select('option_id, quantity')
        .eq('user_id', userId)
        .eq('date', dateMMDD);

      if (error) {
        console.error('❌ 입력 필드 데이터 로드 오류:', error);
        return;
      }

      // option_id별로 input field key 생성하여 inputValues 상태에 설정
      const loadedInputValues: {[key: string]: string} = {};
      
      inputData?.forEach((item: any) => {
        if (item.option_id && item.quantity) {
          const optionId = String(item.option_id);
          const quantity = String(item.quantity);
          
          // data에서 해당 option_id를 가진 아이템 찾기
          const matchingRow = data.find(row => String(row.option_id) === optionId);
          if (matchingRow) {
            const cellId = `input-${matchingRow.item_id}-${optionId}`;
            loadedInputValues[cellId] = quantity;
          }
        }
      });

      console.log('📝 입력 필드 데이터 로드 완료:', Object.keys(loadedInputValues).length + '개');
      
      // 기존 inputValues와 병합 (기존 입력 중인 값 보존)
      setInputValues(prev => ({
        ...loadedInputValues, // DB에서 불러온 값 먼저
        ...prev // 현재 입력 중인 값이 우선
      }));
      
    } catch (error) {
      console.error('❌ 입력 필드 데이터 로드 실패:', error);
    }
  }, [data]);

  // 조회수 데이터 로드
  const loadItemViewsDataWrapper = async () => {
    try {
      const finalData = await loadItemViewsData(data);
      setItemViewsData(finalData);
    } catch (error) {
      console.error('❌ 조회수 데이터 로드 실패:', error);
    }
  };

  // 에러 메시지 상태 추가
  const [hasShownError, setHasShownError] = useState(false);

  // 상품 데이터 로드 - extract_coupang_item_all 테이블에서 가져오기
  const loadProductsFromDBWrapper = async () => {
    setIsLoadingProducts(true);
    try {
      const { products, error } = await loadProductsFromDB();
      
      if (error) {
        console.error('❌ Supabase 쿼리 오류:', error);
        throw error;
      }
      
      setData(products || []);
      setFilteredData(products || []);
      setHasShownError(false); // 성공하면 에러 플래그 리셋
    } catch (error) {
      console.error('❌ 상품 로드 실패:', error);
      // 에러 메시지가 이미 표시되지 않았을 때만 alert 표시
      if (!hasShownError) {
        alert('상품을 불러오는데 실패했습니다. extract_coupang_item_all 테이블을 확인해주세요.');
        setHasShownError(true);
      }
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // 🛠️ 4단계 최적화: 데이터 변환 함수 캐싱 - 필터링 로직 제거하고 순수 변환만 담당
  const transformDataToTableRows = useCallback((data: any[]): TableRow[] => {
    const rows: TableRow[] = [];
    
    data.forEach((item) => {
      // 상품명 생성: item_name + 줄바꿈 + option_name + 줄바꿈 + option_id | barcode
      const optionLine = item.option_name ? '\n' + item.option_name : '';
      const infoLine = '\n' + String(item.option_id || '') + ' | ' + String(item.barcode || '');
      const displayName = item.item_name + optionLine + infoLine;
      
      // 판매방식 결정
      const isRocketGrowth = rocketInventoryOptionIds.has(String(item.option_id));
      
      // 테이블 행 추가 (필터링 로직 제거)
      rows.push({
        type: 'item',
        item_id: String(item.item_id || item.id),
        option_id: String(item.option_id),
        product_name: displayName,
        image: item.item_image_url || item.image_url,
        original_price: Number(item.price) || 0,
        sale_price: Number(item.price) || 0,
        status: item.status || 'UNKNOWN',
        sales_method: isRocketGrowth ? '로켓그로스' : '일반판매',
        sales_status: item.sales_status || 'UNKNOWN',
        stock: Number(item.stock) || 0,
        category: item.category || '미분류',
        brand: item.brand || '브랜드 없음',
        barcode: item.barcode || '' // 🆕 바코드 필드 추가 (사입상태용)
      });
    });

    return rows;
  }, [rocketInventoryOptionIds]);

  // 🆕 성능 최적화: transformDataToTableRows 결과 캐싱
  const transformedData = useMemo(() => {
    return transformDataToTableRows(filteredData);
  }, [transformDataToTableRows, filteredData]);

  // Pagination hook (manages the real currentPage)
  const {
    currentPage,
    totalPages,
    currentData,
    setCurrentPage,
    handlePageChange,
    getCurrentPageData
  } = usePagination({ transformedData, itemsPerPage: 100 });
  

  // Table selection hook
  const {
    selectedItems,
    selectAll,
    setSelectedItems,
    setSelectAll,
    handleSelectAll,
    handleSelectItem
  } = useTableSelection({ transformedData });

  // Order management hook
  const {
    inputValues,
    shippingValues,
    returnValues,
    editingCell,
    setInputValues,
    setShippingValues,
    setReturnValues,
    setEditingCell,
    getInputValue,
    getShippingValue,
    getReturnValue,
    renderInputValue,
    renderShippingValue,
    renderReturnValue,
    renderPendingInbounds,
    handleCellClick,
    handleInputChange,
    handleInputKeyPress,
    handleEnterKeyAndSave,
    handleBlurAndSave,
    handleBatchOrderSubmission
  } = useOrderManagement({ 
    data, 
    rocketInventoryData, 
    getCurrentPageData,
    shipmentStockData,
    onShipmentDataChange: loadShipmentStockDataWrapper
  });



  // 🆕 검색 자동완성 제안 생성 함수


  // 전체 데이터 삭제 핸들러
  const handleDeleteAllDataWrapper = async () => {
    await handleDeleteAllData({
      setData,
      setFilteredData,
      setSelectedItems,
      setSelectAll,
      loadProductsFromDB: loadProductsFromDBWrapper,
      setIsLoadingApi,
      setProductInfoProgress
    });
  };

  const handleExcelUploadWrapper = () => {
    handleExcelUpload({
      setIsLoadingApi,
      setProductInfoProgress,
      loadProductsFromDB: loadProductsFromDBWrapper,
      setData,
      setFilteredData,
      setSelectedItems,
      setSelectAll
    });
  };

  const handleRocketInventoryExcelUploadWrapper = () => {
    handleRocketInventoryExcelUpload({
      setIsUploadingRocketInventory,
      setProductInfoProgress,
      loadRocketInventoryOptionIds: loadRocketInventoryOptionIdsWrapper
    });
  };

  const handleSalesExcelUploadWrapper = () => {
    handleSalesExcelUpload({
      setIsLoadingSalesExcel,
      setProductInfoProgress
    });
  };



  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpanded(newExpanded);
  };

  // 🛠️ 4단계 최적화: 이미지 호버 핸들러들 캐싱
  const handleImageMouseEnter = useCallback((imageUrl: string, event: React.MouseEvent) => {
    setHoveredImage({
      url: imageUrl,
      x: event.clientX + 10,
      y: event.clientY + 10
    });
  }, []);

  const handleImageMouseLeave = useCallback(() => {
    setHoveredImage(null);
  }, []);


  // 상품명 클릭 시 쿠팡 링크로 이동
  const handleProductNameClick = (productId: string, optionId?: string) => {
    if (productId && optionId) {
      const coupangUrl = `https://www.coupang.com/vp/products/${productId}?vendorItemId=${optionId}`;
      window.open(coupangUrl, '_blank');
    }
  };

  // 🚀 컴포넌트 마운트 시 데이터 로드 + 🧹 메모리 누수 방지
  useEffect(() => {
    loadProductsFromDBWrapper();
    loadRocketInventoryOptionIdsWrapper();
    loadItemViewsDataWrapper();
    // 🆕 사입상태 데이터 로드 추가
    loadOrderQuantityDataWrapper();
    // 🆕 구매상태 데이터 로드 추가  
    loadPurchaseStatusDataWrapper();
    // 🆕 쿠팡 판매량 데이터 로드 추가
    loadCoupangSalesDataWrapper();
    // 🆕 창고재고 데이터 로드 추가
    loadWarehouseStockDataWrapper();
    // 🆕 출고재고 데이터 로드 추가
    loadShipmentStockDataWrapper();
    // 🆕 조회수 데이터 로드 추가
    loadViewsDataWrapper();
    
    // localStorage에서 입력값 복구 (유효성 검사 포함)
    const savedInputValues = localStorage.getItem('productInputValues');
    if (savedInputValues) {
      try {
        const parsedValues = JSON.parse(savedInputValues);
        console.log('📂 [LOAD] localStorage에서 복구된 데이터:', {
          totalItems: Object.keys(parsedValues).length,
          sample: Object.entries(parsedValues).slice(0, 3)
        });
        
        // 유효한 값만 필터링
        const validValues: {[key: string]: any} = {};
        Object.entries(parsedValues).forEach(([cellId, value]) => {
          if (value && String(value).trim() !== '' && value !== '0') {
            validValues[cellId] = value;
          }
        });
        
        console.log('✅ [LOAD] 유효한 데이터만 필터링:', {
          before: Object.keys(parsedValues).length,
          after: Object.keys(validValues).length
        });
        
        setInputValues(validValues);
        
        // 정리된 데이터로 localStorage 업데이트
        if (Object.keys(validValues).length === 0) {
          localStorage.removeItem('productInputValues');
        } else {
          localStorage.setItem('productInputValues', JSON.stringify(validValues));
        }
      } catch (error) {
        console.error('❌ [LOAD] localStorage 데이터 복구 실패:', error);
        localStorage.removeItem('productInputValues');
      }
    }
    
    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      // 타이머 정리
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // 대용량 상태 데이터 초기화 (메모리 절약)
      setData([]);
      setFilteredData([]);
      setSelectedItems([]);
      setItemViewsData({});
      setRocketInventoryOptionIds(new Set());
      // 🆕 사입상태 데이터 정리
      setOrderQuantityData({});
      
      console.log('✅ ProductListPage 메모리 정리 완료');
    };
  }, []);

  // 🔄 데이터 로드 후 입력 필드 데이터 로드 (data가 로드되면 실행)
  useEffect(() => {
    if (data && data.length > 0) {
      console.log('📝 상품 데이터 로드 완료 - 입력 필드 데이터 로딩 시작...');
      loadInputFieldData();
    }
  }, [data, loadInputFieldData]);

  // 🔍 디버깅용: Supabase에서 '리브디' 데이터 직접 조회
  const debugSearchRivedi = async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      console.log('🔍 [디버깅] Supabase에서 리브디 데이터 직접 조회 시작...');
      
      // extract_coupang_item_all 테이블에서 리브디 검색
      const { data: rivedyData, error } = await supabase
        .from('extract_coupang_item_all')
        .select('*')
        .eq('user_id', userId)
        .or('item_name.ilike.%리브디%,option_name.ilike.%리브디%')
        .order('item_id', { ascending: false });

      if (error) {
        console.error('❌ [디버깅] Supabase 조회 오류:', error);
        return;
      }

      console.log('📊 [디버깅] Supabase 리브디 검색 결과:');
      console.log(`📊 [디버깅] 총 ${rivedyData?.length || 0}개 발견`);
      
      if (rivedyData && rivedyData.length > 0) {
        rivedyData.forEach((item, index) => {
          console.log(`📊 [디버깅] ${index + 1}번째 데이터:`, {
            item_id: item.item_id,
            option_id: item.option_id,
            item_name: item.item_name,
            option_name: item.option_name,
            price: item.price,
            status: item.status,
            sales_status: item.sales_status
          });
        });
      } else {
        console.log('📊 [디버깅] 리브디 데이터가 없습니다.');
      }
      
      return rivedyData;
    } catch (error) {
      console.error('❌ [디버깅] 리브디 검색 실패:', error);
    }
  };

  // 🔍 디버깅용: 전체 데이터 상태 출력
  const debugDataState = () => {
    console.log('📊 [디버깅] 현재 데이터 상태:');
    console.log('📊 [디버깅] 원본 data 개수:', data.length);
    console.log('📊 [디버깅] 필터된 filteredData 개수:', filteredData.length);
    console.log('📊 [디버깅] 변환된 transformedData 개수:', transformedData.length);
    console.log('📊 [디버깅] 현재 searchKeyword:', `"${searchKeyword}"`);
    console.log('📊 [디버깅] 현재 sortFilter:', sortFilter);
    console.log('📊 [디버깅] rocketInventoryOptionIds 개수:', rocketInventoryOptionIds.size);
    
    if (searchKeyword.trim()) {
      console.log('🔍 [디버깅] 검색어가 있는 상태에서 원본 데이터 샘플:');
      data.slice(0, 3).forEach((item, index) => {
        console.log(`🔍 [디버깅] 원본 ${index + 1}:`, {
          item_id: item.item_id,
          option_id: item.option_id,
          item_name: item.item_name,
          option_name: item.option_name
        });
      });
    }
  };

  // 🆕 엑셀 상품별 옵션 개수 확인 함수
  const debugOptionCounts = async () => {
    try {
      console.log('🔍 [디버깅] 기본가디건 옵션별 개수 확인...');
      
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      const { data: cardiganData, error } = await supabase
        .from('extract_coupang_item_all')
        .select('*')
        .eq('user_id', userId)
        .ilike('item_name', '%기본가디건%');

      if (error) {
        console.error('❌ Supabase 쿼리 오류:', error);
        return;
      }

      console.log(`🔍 [Supabase] 기본가디건 전체 데이터: ${cardiganData?.length}개`);
      
      // 옵션별 개수 계산
      const optionCounts: {[key: string]: number} = {};
      cardiganData?.forEach((item) => {
        const optionName = item.option_name || '옵션없음';
        optionCounts[optionName] = (optionCounts[optionName] || 0) + 1;
      });

      console.log('🔍 [Supabase] 옵션별 개수:');
      Object.entries(optionCounts).forEach(([option, count]) => {
        console.log(`   ${option}: ${count}개`);
      });

      // 전체 데이터 상세 출력
      console.log('🔍 [Supabase] 전체 데이터 상세:');
      cardiganData?.forEach((item, index) => {
        console.log(`   ${index + 1}:`, {
          option_id: item.option_id,
          option_name: item.option_name,
          item_name: item.item_name
        });
      });
      
    } catch (error) {
      console.error('❌ 디버깅 오류:', error);
    }
  };

  // 🆕 메모리 상의 원본 데이터 중복 확인 함수
  const debugMemoryData = () => {
    console.log('🔍 [메모리] 원본 data 배열 중복 확인...');
    console.log('🔍 [메모리] 전체 data 개수:', data.length);
    
    // 기본가디건 데이터만 필터링
    const cardiganItems = data.filter(item => 
      item.item_name && item.item_name.includes('기본가디건')
    );
    
    console.log('🔍 [메모리] 기본가디건 데이터 개수:', cardiganItems.length);
    
    // 옵션별 개수 계산
    const optionCounts: {[key: string]: number} = {};
    const optionIds: {[key: string]: string[]} = {};
    
    cardiganItems.forEach((item, index) => {
      const optionName = item.option_name || '옵션없음';
      optionCounts[optionName] = (optionCounts[optionName] || 0) + 1;
      
      if (!optionIds[optionName]) {
        optionIds[optionName] = [];
      }
      optionIds[optionName].push(item.option_id);
      
      console.log(`🔍 [메모리] ${index + 1}:`, {
        option_id: item.option_id,
        option_name: item.option_name,
        item_name: item.item_name
      });
    });

    console.log('🔍 [메모리] 옵션별 개수:');
    Object.entries(optionCounts).forEach(([option, count]) => {
      console.log(`   ${option}: ${count}개`);
      console.log(`   ${option} option_ids:`, optionIds[option]);
    });
    
    // option_id 중복 확인
    const allOptionIds = cardiganItems.map(item => item.option_id);
    const uniqueOptionIds = Array.from(new Set(allOptionIds));
    
    console.log('🔍 [메모리] 총 option_id 개수:', allOptionIds.length);
    console.log('🔍 [메모리] 고유 option_id 개수:', uniqueOptionIds.length);
    
    if (allOptionIds.length !== uniqueOptionIds.length) {
      console.error('❌ [메모리] option_id 중복 발견!');
      
      // 중복된 option_id 찾기
      const duplicates: {[key: string]: number} = {};
      allOptionIds.forEach(id => {
        duplicates[id] = (duplicates[id] || 0) + 1;
      });
      
      Object.entries(duplicates).forEach(([id, count]) => {
        if (count > 1) {
          console.error(`❌ [메모리] 중복 option_id: ${id} (${count}회)`);
        }
      });
    } else {
      console.log('✅ [메모리] option_id 중복 없음');
    }
  };

  // 🆕 창고재고 디버깅 함수
  const debugWarehouseStock = () => {
    console.log('🔍 [창고재고 디버깅] ===== 창고재고 데이터 상태 =====');
    console.log('1. warehouseStockData 상태:', {
      총개수: Object.keys(warehouseStockData).length,
      전체데이터: warehouseStockData,
      샘플키: Object.keys(warehouseStockData).slice(0, 20)
    });
    
    console.log('2. 현재 제품 바코드 상태:', {
      제품수: data.length,
      바코드있는제품수: data.filter(item => item.barcode).length,
      샘플: data.slice(0, 5).map(item => ({
        상품명: item.item_name,
        바코드: item.barcode,
        매칭여부: item.barcode ? warehouseStockData[item.barcode] !== undefined : false,
        재고: item.barcode ? warehouseStockData[item.barcode] : null
      }))
    });
    
    // 특정 바코드 테스트
    const testBarcode = 'S0026693082112';
    console.log(`3. 테스트 바코드 ${testBarcode}:`, {
      제품에존재: data.some(item => item.barcode === testBarcode),
      창고재고에존재: testBarcode in warehouseStockData,
      재고값: warehouseStockData[testBarcode]
    });
    
    // 매칭 성공한 바코드 찾기
    const matchedBarcodes = data.filter(item => 
      item.barcode && warehouseStockData[item.barcode] !== undefined
    );
    console.log('4. 매칭 성공한 바코드:', {
      개수: matchedBarcodes.length,
      샘플: matchedBarcodes.slice(0, 5).map(item => ({
        상품명: item.item_name,
        바코드: item.barcode,
        재고: warehouseStockData[item.barcode]
      }))
    });
    
    return { warehouseStockData, data };
  };

  // 🆕 데이터 흐름 전체 디버깅 함수
  const debugDataFlow = () => {
    console.log('🔍 [데이터흐름] ===== 전체 데이터 흐름 디버깅 =====');
    
    // 1. 원본 데이터
    const cardiganInData = data.filter(item => 
      item.item_name && item.item_name.includes('기본가디건')
    );
    console.log('🔍 [1단계] 원본 data에서 기본가디건:', cardiganInData.length + '개');
    
    // 2. 필터된 데이터
    const cardiganInFiltered = filteredData.filter(item => 
      item.item_name && item.item_name.includes('기본가디건')
    );
    console.log('🔍 [2단계] filteredData에서 기본가디건:', cardiganInFiltered.length + '개');
    
    // 3. 변환된 데이터
    const cardiganInTransformed = transformedData.filter(row => 
      row.product_name && row.product_name.includes('기본가디건')
    );
    console.log('🔍 [3단계] transformedData에서 기본가디건:', cardiganInTransformed.length + '개');
    
    // 4. 현재 페이지 데이터
    const currentPageData = getCurrentPageData();
    const cardiganInCurrent = currentPageData.filter(row => 
      row.product_name && row.product_name.includes('기본가디건')
    );
    console.log('🔍 [4단계] currentData에서 기본가디건:', cardiganInCurrent.length + '개');
    
    // 각 단계별 상세 정보
    if (cardiganInTransformed.length > 0) {
      console.log('🔍 [3단계 상세] transformedData의 기본가디건:');
      cardiganInTransformed.forEach((row, index) => {
        const lines = row.product_name.split('\n');
        const itemName = lines[0] || '';
        const optionName = lines[1] || '';
        console.log(`   ${index + 1}: ${optionName} (option_id: ${row.option_id})`);
      });
    }
    
    console.log('🔍 [데이터흐름] ===== 디버깅 완료 =====');
  };



  // 🆕 필터 조건 변경 시 자동 필터링 적용 (순환 의존성 방지를 위해 직접 구현)
  useEffect(() => {
    if (data.length === 0) return;

    // console.log('🔍 [디버깅] ===== 필터링 시작 =====');
    // console.log('🔍 [디버깅] 원본 데이터 개수:', data.length);
    // console.log('🔍 [디버깅] 적용된 검색어:', `"${appliedSearchKeyword}"`);
    
    let filtered = [...data];
    
    // 1. 검색 키워드 필터링 (여러개 검색 지원)
    if (appliedSearchKeyword.trim()) {
      const keywords = appliedSearchKeyword
        .split(/[,\n\s]+/) // 콤마, 줄바꿈, 공백으로 분리
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .slice(0, 100);
      
      filtered = filtered.filter(item => {
        return keywords.some(keyword => {
          const lowerKeyword = keyword.toLowerCase();
          
          switch (searchFilter) {
            case '상품명':
              const itemName = (item.item_name || '').toLowerCase();
              const optionName = (item.option_name || '').toLowerCase();
              const productName = (item.product_name || '').toLowerCase();
              const combinedName = `${itemName} ${optionName}`.toLowerCase();
              return itemName.includes(lowerKeyword) || 
                     optionName.includes(lowerKeyword) || 
                     combinedName.includes(lowerKeyword) ||
                     productName.includes(lowerKeyword);
            
            case '옵션id':
              const optionId = String(item.option_id || '');
              return optionId.includes(keyword);
            
            case '바코드':
              const barcode = (item.barcode || '').toLowerCase();
              return barcode.includes(lowerKeyword);
            
            default:
              return false;
          }
        });
      });
    }
    
    // 카테고리 필터링 제거됨 (검색필터로 대체)
    
    // 3. 노출상태 필터링
    if (selectedExposure !== '전체') {
      filtered = filtered.filter(item => item.status === selectedExposure);
    }
    
    // 4. 판매상태 필터링
    if (selectedSaleStatus !== '전체') {
      filtered = filtered.filter(item => item.sales_status === selectedSaleStatus);
    }
    
    // 5. 판매방식 필터링
    if (sortFilter === '일반판매') {
      filtered = filtered.filter(item => !rocketInventoryOptionIds.has(String(item.option_id)));
    } else if (sortFilter === '로켓그로스') {
      filtered = filtered.filter(item => rocketInventoryOptionIds.has(String(item.option_id)));
    } else if (sortFilter === '사입보기') {
      // 사입보기 로직: 로켓그로스 전체 + 기간(coupang_sales) > 0인 일반판매
      filtered = filtered.filter(item => {
        const isRocketGrowth = rocketInventoryOptionIds.has(String(item.option_id));
        
        if (isRocketGrowth) {
          // 로켓그로스는 모두 노출
          return true;
        } else {
          // 일반판매는 '기간' 열에 값이 0보다 큰 경우만 노출
          return hasPeriodSales(item.item_id, item.option_id);
        }
      });
    }
    
    // console.log('🔍 [디버깅] 필터링 완료:', filtered.length + '개');
    setFilteredData(filtered);
    
    // 페이지 초기화는 실제 사용자 필터 변경 시에만 (rocketInventoryOptionIds 변경은 제외)
    // 하지만 이 useEffect는 rocketInventoryOptionIds가 필요하므로 페이지 초기화를 하지 않음
  }, [data, searchFilter, selectedExposure, selectedSaleStatus, sortFilter, appliedSearchKeyword, rocketInventoryOptionIds, hasPeriodSales]);

  // 🆕 사용자 필터 변경 시에만 페이지 초기화 - 이전 값 추적으로 정확한 변경 감지
  const prevFiltersRef = useRef({
    exposure: selectedExposure,
    saleStatus: selectedSaleStatus,
    sortFilter: sortFilter,
    searchKeyword: appliedSearchKeyword
  });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const hasActualFilterChange = 
      selectedExposure !== prev.exposure ||
      selectedSaleStatus !== prev.saleStatus ||
      sortFilter !== prev.sortFilter ||
      appliedSearchKeyword !== prev.searchKeyword;
    
    if (hasActualFilterChange) {
      setCurrentPage(1);
      console.log('🔍 [페이지네이션] 필터 실제 변경으로 1페이지로 초기화');
      
      // 이전 값 업데이트
      prevFiltersRef.current = {
        exposure: selectedExposure,
        saleStatus: selectedSaleStatus,
        sortFilter: sortFilter,
        searchKeyword: appliedSearchKeyword
      };
    }
  }, [selectedExposure, selectedSaleStatus, sortFilter, appliedSearchKeyword, setCurrentPage]);

  // 🚛 출고 처리 함수 (새로운 ShipmentManagerService 사용)
  const handleShipmentSubmission = useCallback(async () => {
    try {
      console.log('🚛 [SHIPMENT] 배치 출고 처리 시작 (새로운 방식)');
      
      // 1. 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        alert('로그인 정보를 찾을 수 없습니다.');
        return;
      }

      // 2. shippingValues에서 출고 데이터 추출
      console.log('📦 [SHIPMENT] 출고 데이터 추출 중...');
      console.log('🔍 [DEBUG] shippingValues 전체:', shippingValues);
      
      const shippingEntries = Object.entries(shippingValues)
        .filter(([cellId, quantity]) => {
          const numQuantity = Number(quantity);
          const isValid = !isNaN(numQuantity) && numQuantity > 0;
          if (!isValid) {
            console.log('❌ [SHIPMENT] 유효하지 않은 출고량 제외:', { cellId, quantity, numQuantity });
          }
          return isValid;
        });

      if (shippingEntries.length === 0) {
        alert('출고할 상품이 없습니다. 출고 수량을 입력해주세요.');
        return;
      }

      console.log('✅ [SHIPMENT] 유효한 출고 데이터:', shippingEntries.length + '개');
      
      // 3. 각 출고 데이터 처리 (새로운 ShipmentManagerService 사용)
      let processedCount = 0;
      let skippedCount = 0;
      
      for (const [cellId, quantity] of shippingEntries) {
        try {
          // cellId에서 정보 추출: shipping-{item_id}-{option_id}
          const cellIdParts = cellId.split('-');
          if (cellIdParts.length < 3) {
            console.error('❌ [SHIPMENT] 잘못된 cellId 형식:', cellId);
            skippedCount++;
            continue;
          }
          
          const itemId = cellIdParts[1];
          const optionId = cellIdParts[2];
          
          // data에서 해당 상품 정보 찾기
          const productInfo = data.find(item => 
            String(item.item_id) === itemId && String(item.option_id) === optionId
          );
          
          if (!productInfo || !productInfo.barcode) {
            console.log('❌ [SHIPMENT] 상품 정보 또는 바코드 없음:', { itemId, optionId, hasProduct: !!productInfo, hasBarcode: !!productInfo?.barcode });
            skippedCount++;
            continue;
          }

          const requestedQuantity = Number(quantity);
          console.log(`📦 [SHIPMENT] 처리 중: ${productInfo.item_name} (바코드: ${productInfo.barcode}, 요청수량: ${requestedQuantity})`);
          
          // 4. 창고재고에서 해당 바코드 확인
          const warehouseStock = warehouseStockData[productInfo.barcode];
          if (!warehouseStock || warehouseStock <= 0) {
            console.log('❌ [SHIPMENT] 창고재고 없음, 패스:', { barcode: productInfo.barcode, stock: warehouseStock });
            skippedCount++;
            continue;
          }

          // 5. 새로운 ShipmentManagerService 사용하여 출고 처리
          const currentShipmentAmount = shipmentStockData[productInfo.barcode] || 0;
          
          console.log(`🔄 [SHIPMENT] ShipmentManagerService 호출: ${productInfo.barcode}, ${currentShipmentAmount} → ${requestedQuantity}`);
          
          const result = await ShipmentManagerService.updateShipmentAmount(
            userId,
            productInfo.barcode,
            currentShipmentAmount,
            requestedQuantity
          );

          if (result.success) {
            console.log(`✅ [SHIPMENT] 출고 완료: ${productInfo.item_name} - ${result.message}`);
            processedCount++;
          } else {
            console.error(`❌ [SHIPMENT] 출고 실패: ${productInfo.item_name} - ${result.message}`);
            skippedCount++;
          }
          
        } catch (error) {
          console.error('❌ [SHIPMENT] 개별 항목 처리 실패:', { cellId, quantity, error });
          skippedCount++;
        }
      }

      // 6. 출고 데이터 새로고침
      if (processedCount > 0) {
        await loadShipmentStockDataWrapper();
      }

      // 7. 처리 결과 안내
      const resultMessage = `✅ 배치 출고 처리 완료!\n\n` +
        `• 처리된 상품: ${processedCount}개\n` +
        `• 건너뛴 상품: ${skippedCount}개\n\n` +
        `출고 수량 데이터를 초기화하시겠습니까?\n` +
        `(확인: 데이터 초기화, 취소: 데이터 유지)`;

      const shouldClearShippingData = window.confirm(resultMessage);
      
      if (shouldClearShippingData) {
        setShippingValues({});
        console.log('🗑️ [SHIPMENT] 출고 데이터 초기화 완료');
      } else {
        console.log('📋 [SHIPMENT] 출고 데이터 유지');
      }

      console.log('✅ [SHIPMENT] 배치 출고 처리 완료:', {
        processed: processedCount,
        skipped: skippedCount,
        dataCleared: shouldClearShippingData
      });
      
    } catch (error) {
      console.error('❌ [SHIPMENT] 배치 출고 처리 실패:', error);
      alert('배치 출고 처리 중 오류가 발생했습니다.');
    }
  }, [shippingValues, data, warehouseStockData, shipmentStockData, setShippingValues, loadShipmentStockDataWrapper]);

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">상품 조회/수정</h1>
      </div>

      {/* 버튼들 - 카드 위쪽 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* 왼쪽: API 버튼들 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <ActionButton
            onClick={() => {}}
            disabled={true}
            variant="primary"
          >
            쿠팡일반 api
          </ActionButton>

          <ActionButton
            onClick={() => {}}
            disabled={true}
            variant="warning"
          >
            로켓그로스 api
          </ActionButton>
        </div>
        
        {/* 오른쪽: 액션 버튼들 */}
        <ActionButtonsSection
          onDeleteAllData={handleDeleteAllDataWrapper}
          onExcelUpload={handleExcelUploadWrapper}
          onSalesExcelUpload={handleSalesExcelUploadWrapper}
          onRocketInventoryExcelUpload={handleRocketInventoryExcelUploadWrapper}
          isLoadingApi={isLoadingApi}
          isLoadingSalesExcel={isLoadingSalesExcel}
          isUploadingRocketInventory={isUploadingRocketInventory}
          inputValues={inputValues}
          onBatchOrderSubmission={handleBatchOrderSubmission}
        />
      </div>

      {/* 통계 카드 섹션 */}
      <StatsCardsSection stats={stats} />

      {/* 검색 및 필터 섹션 */}
      <SearchSection
        sortFilter={sortFilter}
        setSortFilter={setSortFilter}
        selectedExposure={selectedExposure}
        setSelectedExposure={setSelectedExposure}
        selectedSaleStatus={selectedSaleStatus}
        setSelectedSaleStatus={setSelectedSaleStatus}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        searchKeyword={searchKeyword}
        handleSearchKeywordChange={handleSearchKeywordChange}
        handleKeyPress={handleKeyPress}
        handleSearch={handleSearch}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        searchSuggestions={searchSuggestions}
        handleSuggestionSelect={handleSuggestionSelect}
      />

      {/* 데이터 테이블 */}
      <div className="product-list-table-section">
        {/* 테이블 헤더 - 데이터 개수와 액션 버튼들 */}
        <div className="product-list-table-header-section">
          <div className="product-list-table-info">
            <div className="product-list-data-count">
              총 {transformedData.length}개 상품
            </div>
            <div className="product-list-selected-info">
              선택된 상품: {selectedItems.length}개 / 총 {transformedData.filter(row => row.type === 'item').length}개
            </div>
          </div>
          
          
          <div className="product-list-action-buttons">
            <ActionButton
              onClick={() => {
                const inputCount = Object.keys(inputValues).filter(key => inputValues[key]).length;
                
                if (inputCount === 0) {
                  alert('초기화할 입력 데이터가 없습니다.');
                  return;
                }
                
                const shouldClear = window.confirm(
                  `현재 ${inputCount}개의 입력 데이터가 있습니다.\n\n` +
                  `모든 입력 데이터를 초기화하시겠습니까?`
                );
                
                if (shouldClear) {
                  setInputValues({});
                  localStorage.removeItem('productInputValues');
                  console.log('🗑️ [초기화] 입력 데이터 초기화 완료');
                  alert('입력 데이터가 초기화되었습니다.');
                }
              }}
              variant="info"
              className="small-button"
            >
              초기화
            </ActionButton>
            <ActionButton
              onClick={handleBatchOrderSubmission}
              variant="warning"
              className="small-button"
            >
              주문
            </ActionButton>
            <ActionButton
              onClick={handleShipmentSubmission}
              variant="primary"
              className="small-button"
            >
              출고
            </ActionButton>
            <ActionButton
              onClick={() => {
                // 반출 버튼 기능은 나중에 구현
                console.log('반출 버튼 클릭');
              }}
              variant="danger"
              className="small-button"
            >
              반출
            </ActionButton>
          </div>
        </div>

        {/* 진행률 표시 */}
        <ProgressIndicator progress={productInfoProgress} />

        <ProductTable
          currentData={currentData}
          currentPage={currentPage}
          selectAll={selectAll}
          selectedItems={selectedItems}
          handleSelectAll={handleSelectAll}
          handleSelectItem={handleSelectItem}
          editingCell={editingCell}
          handleCellClick={handleCellClick}
          getInputValue={getInputValue}
          getShippingValue={getShippingValue}
          getReturnValue={getReturnValue}
          handleInputChange={handleInputChange}
          handleBlurAndSave={handleBlurAndSave}
          handleEnterKeyAndSave={handleEnterKeyAndSave}
          renderInputValue={renderInputValue}
          renderShippingValue={renderShippingValue}
          renderReturnValue={renderReturnValue}
          renderPendingInbounds={renderPendingInbounds}
          renderOrderableQuantityWithStyle={renderOrderableQuantityWithStyle}
          renderOrderQuantityWithStyle={renderOrderQuantityWithStyle}
          renderPeriodSalesWithStyle={renderPeriodSalesWithStyle}
          render7DaysSalesWithStyle={render7DaysSalesWithStyle}
          render30DaysSalesWithStyle={render30DaysSalesWithStyle}
          renderRecommendedQuantityWithStyle={renderRecommendedQuantityWithStyle}
          renderWarehouseStockWithStyle={renderWarehouseStockWithStyle}
          renderPurchaseStatusWithStyle={renderPurchaseStatusWithStyle}
          renderStorageFeeWithStyle={renderStorageFeeWithStyle}
          shouldHighlightRow={shouldHighlightRow}
          getViewCountColor={getViewCountColor}
          getViewCountByDate={getViewCountByDate}
          handleProductNameClick={handleProductNameClick}
          rocketInventoryOptionIds={rocketInventoryOptionIds}
        />
      </div>

      {/* 페이지네이션 */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        handlePageChange={handlePageChange}
        transformedDataLength={transformedData.length}
      />

      {/* 호버 이미지 */}
      {hoveredImage && (
        <div
          style={{
            position: 'fixed',
            left: hoveredImage.x,
            top: hoveredImage.y,
            zIndex: 1000,
            pointerEvents: 'none',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white',
            padding: '4px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <img
            src={hoveredImage.url}
            alt="상품 이미지 확대"
            style={{ width: '200px', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
          />
        </div>
      )}
    </div>
  );
}

export default ProductListPage; 