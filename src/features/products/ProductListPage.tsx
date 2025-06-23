import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DashboardStatsCard from './components/DashboardStatsCard';
import { supabase } from '../../config/supabase';
import './ProductListPage.css';
import { processProductExcelUpload } from '../../services/excelUploadService';
import { processRocketInventoryExcelUpload } from '../../services/rocketInventoryService';
import { importImageInfoFromItemAll, importImageInfoFromItemAllRocketGrowth } from '../../services/imageInfoService';

// 인터페이스 정의
interface TableRow {
  type: 'item' | 'option';
  item_id: string;
  option_id?: string;
  product_name: string;
  image?: string;
  original_price?: number;
  sale_price?: number;
  status?: string;
  sales_method?: string;
  sales_status?: string;
  stock?: number;
  category?: string;
  brand?: string;
  barcode?: string; // 🆕 바코드 필드 추가
  [key: string]: any;
}

interface Stats {
  total: number;
  notItemPartner: number;
  outOfStock: number;
  rejected: number;
  selling: number;
  tempSave: number;
}

interface Progress {
  current: number;
  total: number;
  message: string;
}

interface HoveredImage {
  url: string;
  x: number;
  y: number;
}

function ProductListPage() {
  // State 정의
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [rocketInventoryOptionIds, setRocketInventoryOptionIds] = useState<Set<string>>(new Set());
  const [rocketInventoryData, setRocketInventoryData] = useState<{[key: string]: any}>({});
  const [itemViewsData, setItemViewsData] = useState<{[key: string]: string[]}>({});
  // 🆕 사입상태 데이터 (바코드별 주문 수량 합계)
  const [orderQuantityData, setOrderQuantityData] = useState<{[key: string]: number}>({});
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  // 검색 및 필터
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedExposure, setSelectedExposure] = useState('전체');
  const [selectedSaleStatus, setSelectedSaleStatus] = useState('전체');
  const [sortFilter, setSortFilter] = useState('전체');
  
  // 테이블 관련
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredImage, setHoveredImage] = useState<HoveredImage | null>(null);
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // 50개로 다시 변경
  
  // 입력 상태 관리
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  
  // 로딩 상태
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isLoadingApi2, setIsLoadingApi2] = useState(false);
  const [isLoadingNormalApi, setIsLoadingNormalApi] = useState(false);
  const [isUploadingRocketInventory, setIsUploadingRocketInventory] = useState(false);
  
  // 진행률
  const [productInfoProgress, setProductInfoProgress] = useState<Progress | null>(null);
  
  // 입력 ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🛠️ 5단계 최적화: 타이머 추적을 위한 ref 추가 (메모리 누수 방지)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 📊 통계 계산 최적화 - useMemo로 매 렌더링마다 재계산 방지
  const stats: Stats = useMemo(() => {
    return {
      total: data.length,
      notItemPartner: data.filter(item => !item.is_item_partner).length,
      outOfStock: data.filter(item => item.sales_status === 'OUTOFSTOCK').length,
      rejected: data.filter(item => item.status === 'REJECT').length,
      selling: data.filter(item => item.sales_status === 'ONSALE').length,
      tempSave: data.filter(item => item.status === 'TEMP_SAVE').length
    };
  }, [data]); // data가 변경될 때만 재계산

  // 🛠️ 4단계 최적화: 날짜 포맷팅 함수 캐싱
  const formatDateToYYMMDD = useCallback((date: Date): string => {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }, []);

  // 🆕 오늘 날짜를 MMDD 형태로 포맷팅
  const formatDateToMMDD = useCallback((date: Date): string => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}${day}`;
  }, []);

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
  }, [formatDateToMMDD]);

  // 🛠️ 수정된 조회수 색상 결정 함수: view1=검은색, view2~5는 이전값 대비 증감에 따라 색상 결정
  const getViewCountColor = useCallback((current: string | undefined, previous: string | undefined, isFirstView: boolean = false): string => {
    // view1인 경우 항상 검은색
    if (isFirstView) {
      return '#000000';
    }
    
    // current나 previous가 없으면 검은색
    if (!current || current === '-' || !previous || previous === '-') {
      return '#000000';
    }
    
    const currentNum = parseInt(current.replace(/,/g, ''));
    const previousNum = parseInt(previous.replace(/,/g, ''));
    
    if (isNaN(currentNum) || isNaN(previousNum)) {
      return '#000000';
    }
    
    // 차이 계산 (current - previous, 방향성 고려)
    const difference = currentNum - previousNum;
    
    // 이전값보다 10 초과 증가하면 파란색
    if (difference > 10) {
      return '#0000ff';  // 파란색 (10 초과 증가)
    } 
    // 이전값보다 10 이상 감소하면 빨간색  
    else if (difference <= -10) {
      return '#ff0000';  // 빨간색 (10 이상 감소)
    } 
    // 그 외의 경우 (±10 미만 차이) 검은색
    else {
      return '#000000';  // 검은색 (±10 미만 차이)
    }
  }, []);

  // 🛠️ 4단계 최적화: 상품 정렬 함수 캐싱
  const sortProductsByViewsData = useCallback((products: any[]) => {
    return products.sort((a, b) => {
      // 1차 정렬: 조회수 데이터 유무
      const aHasViews = itemViewsData[String(a.item_id)] && itemViewsData[String(a.item_id)].length > 0;
      const bHasViews = itemViewsData[String(b.item_id)] && itemViewsData[String(b.item_id)].length > 0;
      
      if (aHasViews && !bHasViews) return -1;  // a가 먼저
      if (!aHasViews && bHasViews) return 1;   // b가 먼저
      
      // 2차 정렬: 등록상품명 + 옵션명 결합 기준으로 알파벳 순서 정렬
      const aProductName = (a.item_name || '') + ' ' + (a.option_name || '');
      const bProductName = (b.item_name || '') + ' ' + (b.option_name || '');
      
      return aProductName.localeCompare(bProductName, 'ko', { numeric: true, caseFirst: 'lower' });
    });
  }, [itemViewsData]);

  // 🚀 성능 최적화: 값 하이라이트 렌더링 함수들
  const renderValueWithHighlight = useCallback((value: any, highlightClass: string) => {
    const numValue = parseFloat(value);
    if (value && !isNaN(numValue) && numValue > 0) {
      return <span className={highlightClass}>{value}</span>;
    }
    return value || '-';
  }, []);

  const renderInputValue = useCallback((row: TableRow, index: number) => {
    const cellId = `input-${row.item_id}-${row.option_id || index}`;
    const value = inputValues[cellId] || '';
    const numValue = parseFloat(value);
    
    if (value && !isNaN(numValue) && numValue > 0) {
      return <span className="value-highlight-yellow">{value}</span>;
    }
    return value || '-';
  }, [inputValues]);

  const renderPendingInbounds = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.pending_inbounds;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="value-highlight-gray">{value}</span> : '-';
  }, [rocketInventoryData]);

  const renderOrderableQuantity = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.orderable_quantity || row.stock || 0;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return numValue > 0 ? <span className="value-highlight-light-gray">{numValue}</span> : '-';
  }, [rocketInventoryData]);

  const renderOrderQuantity = useCallback((row: TableRow) => {
    const value = row.barcode && orderQuantityData[String(row.barcode)];
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="value-highlight-orange">{value}</span> : '-';
  }, [orderQuantityData]);

  const renderRecommendedQuantity = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.recommanded_inboundquantity;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="coupang-recommendation-text">{value}</span> : '-';
  }, [rocketInventoryData]);

  const renderStorageFee = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.monthly_storage_fee;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="value-highlight-red">{value}</span> : '-';
  }, [rocketInventoryData]);

  // 🆕 새로운 렌더링 함수들 (기간, 7일, 30일, 개인주문)
  const render7DaysSales = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_7_days;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="value-highlight-blue">{value}</span> : '-';
  }, [rocketInventoryData]);

  const render30DaysSales = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_30_days;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="value-highlight-blue">{value}</span> : '-';
  }, [rocketInventoryData]);

  // 🆕 행 배경색 결정 함수
  const shouldHighlightRow = useCallback((row: TableRow) => {
    // 개인주문은 항상 '-'이므로 제외하고, 기간도 '-'이므로 7일과 30일만 확인
    const sales7Days = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_7_days;
    const sales30Days = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_30_days;
    
    return (sales7Days && sales7Days > 0) || (sales30Days && sales30Days > 0);
  }, [rocketInventoryData]);

  // 로켓재고 데이터 로드 (옵션 ID와 관련 데이터)
  const loadRocketInventoryOptionIds = async () => {
    try {
      // 먼저 총 개수 확인
      const { count: totalCount, error: countError } = await supabase
        .from('coupang_rocket_inventory')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ coupang_rocket_inventory 개수 조회 오류:', countError);
      }
      
      // 모든 데이터를 배치로 로딩 (개수 제한 없이)
      let allRocketData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from('coupang_rocket_inventory')
          .select('option_id, pending_inbounds, orderable_quantity, sales_quantity_last_7_days, sales_quantity_last_30_days, recommanded_inboundquantity, monthly_storage_fee')
          .range(offset, offset + batchSize - 1);

        if (batchError) {
          console.error('❌ 로켓 인벤토리 배치 로드 오류:', batchError);
          throw batchError;
        }

        if (batchData && batchData.length > 0) {
          allRocketData = [...allRocketData, ...batchData];
          
          // 다음 배치로 이동
          offset += batchSize;
          
          // 배치 크기보다 적게 받았다면 더 이상 데이터가 없음
          if (batchData.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const rocketData = allRocketData;
      
      // orderable_quantity가 0인 데이터도 포함하여 모든 option_id 수집
      const optionIds = new Set<string>(rocketData.map((item: any) => String(item.option_id)));
      setRocketInventoryOptionIds(optionIds);
      
      // 옵션 ID를 키로 하는 데이터 맵 생성
      const dataMap: {[key: string]: any} = {};
      rocketData.forEach((item: any) => {
        dataMap[String(item.option_id)] = {
          pending_inbounds: item.pending_inbounds || 0,
          orderable_quantity: item.orderable_quantity || 0,
          sales_quantity_last_7_days: item.sales_quantity_last_7_days || 0,
          sales_quantity_last_30_days: item.sales_quantity_last_30_days || 0,
          recommanded_inboundquantity: item.recommanded_inboundquantity || 0,
          monthly_storage_fee: item.monthly_storage_fee || 0
        };
      });
      setRocketInventoryData(dataMap);
      
      // orderable_quantity가 0인 데이터 확인 (통계용 - 로그는 제거)
      const zeroOrderableCount = rocketData.filter(item => (item.orderable_quantity || 0) === 0).length;
    } catch (error) {
      console.error('❌ 로켓재고 데이터 로드 실패:', error);
    }
  };

  // 🆕 사입상태 데이터 로드 (chinaorder_googlesheet에서 바코드별 주문 수량 합계)
  const loadOrderQuantityData = async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 사입상태 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      // chinaorder_googlesheet 테이블에서 데이터 로드
      const { data: orderData, error } = await supabase
        .from('chinaorder_googlesheet')
        .select('barcode, order_quantity')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ 사입상태 데이터 로드 오류:', error);
        return;
      }

      // 바코드별로 order_quantity 합계 계산
      const quantityMap: {[key: string]: number} = {};
      
      orderData?.forEach((order: any) => {
        const barcode = String(order.barcode || '').trim();
        const quantity = parseInt(order.order_quantity) || 0;
        
        if (barcode && quantity > 0) {
          quantityMap[barcode] = (quantityMap[barcode] || 0) + quantity;
        }
      });

      setOrderQuantityData(quantityMap);
      
    } catch (error) {
      console.error('❌ 사입상태 데이터 로드 실패:', error);
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
  }, [data, formatDateToMMDD]);

  // 조회수 데이터 로드
  const loadItemViewsData = async () => {
    try {
      
      // 먼저 테이블 구조를 확인 (user_id 컬럼 없이)
      const { data: structureCheck, error: structureError } = await supabase
        .from('coupang_item_views')
        .select('*')
        .limit(1);
      
      if (structureError) {
        console.error('❌ 테이블 구조 확인 오류:', structureError);
        throw structureError;
      }

      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      let viewsData: any[] = [];
      
      // 테이블에 user_id 컬럼이 있는지 확인
      const hasUserIdColumn = structureCheck && structureCheck[0] && 'user_id' in structureCheck[0];
      
      // 먼저 간단한 쿼리로 테스트
      const { data: sampleData, error: sampleError } = await supabase
        .from('coupang_item_views')
        .select('*')
        .limit(5);
        
      if (sampleError) {
        console.error('❌ 기본 쿼리 실패:', sampleError);
        throw sampleError;
      }
      
      if (hasUserIdColumn && userId) {
        // user_id로 필터링해서 전체 데이터 로드 (배치 처리)
        const { count, error: countError } = await supabase
          .from('coupang_item_views')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (countError) {
          console.error('❌ 조회수 데이터 개수 확인 실패:', countError);
        }
        
        // 배치로 전체 데이터 로드
        let allViewsData: any[] = [];
        let hasMore = true;
        let offset = 0;
        const batchSize = 1000;

        while (hasMore) {
          const { data: batchData, error: batchError } = await supabase
            .from('coupang_item_views')
            .select('*')
            .eq('user_id', userId)
            .range(offset, offset + batchSize - 1);

          if (batchError) {
            console.error('❌ 조회수 배치 로드 오류:', batchError);
            throw batchError;
          }

          if (batchData && batchData.length > 0) {
            allViewsData = [...allViewsData, ...batchData];
            
            // 다음 배치로 이동
            offset += batchSize;
            
            // 배치 크기보다 적게 받았다면 더 이상 데이터가 없음
            if (batchData.length < batchSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
        
        viewsData = allViewsData;
        
      } else {
        // user_id 컬럼이 없거나 사용자 ID가 없으면 전체 데이터 로드
        const { data, error } = await supabase
          .from('coupang_item_views')
          .select('*');
          
        if (error) throw error;
        viewsData = data || [];
      }

      // item_id별로 최근 5개의 날짜를 그룹화
      const viewsMap: {[key: string]: string[]} = {};
      
      // 테이블의 실제 컬럼들을 확인
      const sampleRecord = viewsData?.[0];
      const allColumns = sampleRecord ? Object.keys(sampleRecord) : [];
      
      // item_id 컬럼 확인
      const itemIdColumn = 'item_id';
      
      // 날짜 컬럼들 찾기 (240708, 240715 같은 YYMMDD 형식의 컬럼들)
      const dateColumns = allColumns.filter(col => 
        /^24\d{4}$/.test(col) || // 240708 형식
        /^\d{6}$/.test(col) ||   // 일반적인 YYMMDD 형식
        ['yymmdd', 'YYMMDD', 'date', 'view_date'].includes(col)
      );
      
      
      
      viewsData?.forEach((view: any, index: number) => {
        const itemId = view[itemIdColumn] ? String(view[itemIdColumn]) : null;
        
        if (!itemId) {
          console.warn(`⚠️ ${index}번째 레코드에서 item_id를 찾을 수 없습니다:`, view);
          return;
        }
        
        if (!viewsMap[itemId]) {
          viewsMap[itemId] = [];
        }
        
                // 모든 날짜 컬럼을 날짜 순으로 정렬 (가장 최근 5개 컬럼만 선택)
        const sortedDateColumns = [...dateColumns].sort((a, b) => parseInt(b) - parseInt(a)); // 내림차순 정렬
        const recentDateColumns = sortedDateColumns.slice(0, 5); // 가장 최근 5개 날짜 컬럼
        
        // 최근 5개 날짜 컬럼을 오름차순으로 재정렬 (view1이 가장 과거, view5가 가장 최근)
        const finalDateColumns = recentDateColumns.sort((a, b) => parseInt(a) - parseInt(b));
        
        // 각 날짜 컬럼의 조회수 값을 순서대로 수집
        const viewValues: string[] = [];
        finalDateColumns.forEach(dateCol => {
          const viewCount = view[dateCol];
          
          // 값이 있는지 확인 (콤마가 있는 숫자도 포함)
          if (viewCount !== null && viewCount !== undefined && viewCount !== '' && viewCount !== '0') {
            const cleanValue = String(viewCount).replace(/,/g, ''); // 콤마 제거
            
            // 콤마를 제거한 후 숫자인지 확인
            if (!isNaN(Number(cleanValue)) && Number(cleanValue) > 0) {
              viewValues.push(cleanValue); // 콤마 제거된 값 저장
            } else {
              viewValues.push('-');
            }
          } else {
            viewValues.push('-');
          }
        });
        
        if (viewValues.length > 0) {
          viewsMap[itemId] = viewValues;
        }
      });

      console.log('📊 item_id별 조회수 데이터 샘플:', Object.keys(viewsMap).slice(0, 3).reduce((acc, key) => {
        acc[key] = viewsMap[key];
        return acc;
      }, {} as {[key: string]: string[]}));

      console.log('📊 item_id별 조회수 데이터 샘플:', Object.keys(viewsMap).slice(0, 3).reduce((acc, key) => {
        acc[key] = viewsMap[key];
        return acc;
      }, {} as {[key: string]: string[]}));

      // 실제 상품 데이터의 item_id들을 기반으로 테스트 데이터 생성
      const actualItemIds = Array.from(new Set(data.map(item => String(item.item_id))));
      const mockViewsData: {[key: string]: string[]} = {};
      
      // 처음 10개 상품에 대해서만 테스트 데이터 추가
      actualItemIds.slice(0, 10).forEach((itemId, index) => {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - index);
        
        const viewDates: string[] = [];
        for (let i = 0; i < 5; i++) {
          const viewDate = new Date(baseDate);
          viewDate.setDate(viewDate.getDate() - i);
          viewDates.push(formatDateToYYMMDD(viewDate));
        }
        mockViewsData[itemId] = viewDates;
      });
      
      // 실제 데이터가 없으면 테스트 데이터 사용, 있으면 실제 데이터 우선
      const finalData = Object.keys(viewsMap).length > 0 ? viewsMap : mockViewsData;
      
      setItemViewsData(finalData);
      
      
      
    } catch (error) {
      console.error('❌ 조회수 데이터 로드 실패:', error);
    }
  };

  // 에러 메시지 상태 추가
  const [hasShownError, setHasShownError] = useState(false);

  // 상품 데이터 로드 - extract_coupang_item_all 테이블에서 가져오기
  const loadProductsFromDB = async () => {
    setIsLoadingProducts(true);
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 사용자 ID를 찾을 수 없습니다.');
        alert('로그인이 필요합니다.');
        return;
      }

      // user_id로 필터링하여 총 개수를 확인
      const { count, error: countError } = await supabase
        .from('extract_coupang_item_all')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        console.error('❌ 개수 조회 오류:', countError);
      }

      // 사용자 데이터만 가져오기 위해 배치로 처리
      let allProducts: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      console.log(`📊 전체 데이터 개수 확인: ${count}개`);

      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from('extract_coupang_item_all')
          .select('*')
          .eq('user_id', userId)
          .order('option_id', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (batchError) {
          console.error('❌ 배치 로드 오류:', batchError);
          throw batchError;
        }

        if (batchData && batchData.length > 0) {
          console.log(`📊 배치 ${Math.floor(offset / batchSize) + 1} 로드: ${batchData.length}개 (누적: ${allProducts.length + batchData.length}개)`);
          
          allProducts = [...allProducts, ...batchData];
          
          // 다음 배치로 이동
          offset += batchSize;
          
          // 배치 크기보다 적게 받았다면 더 이상 데이터가 없음
          if (batchData.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`📊 최종 로드된 데이터: ${allProducts.length}개 (예상: ${count}개)`);

      const products = allProducts;
      const error = null;

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
      // 상품명 생성: item_name + 줄바꿈 + option_name
      const displayName = item.item_name + (item.option_name ? '\n' + item.option_name : '');
      
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

  // 🛠️ 수정된 필터링 함수: 모든 필터 조건을 한 번에 적용
  const applyAllFilters = useCallback(() => {
    console.log('🔍 [디버깅] ===== 필터링 시작 =====');
    console.log('🔍 [디버깅] 원본 데이터 개수:', data.length);
    console.log('🔍 [디버깅] 검색어:', `"${searchKeyword}"`);
    console.log('🔍 [디버깅] 선택된 카테고리:', selectedCategory);
    console.log('🔍 [디버깅] 선택된 노출상태:', selectedExposure);
    console.log('🔍 [디버깅] 선택된 판매상태:', selectedSaleStatus);
    console.log('🔍 [디버깅] 선택된 판매방식:', sortFilter);
    
    let filtered = [...data];
    
    // 1. 검색 키워드 필터링 (null/undefined 안전 처리)
    if (searchKeyword.trim()) {
      console.log('🔍 [디버깅] 검색 키워드 필터링 시작...');
      const beforeSearchCount = filtered.length;
      
      filtered = filtered.filter(item => {
        const itemName = (item.item_name || '').toLowerCase();
        const optionName = (item.option_name || '').toLowerCase();
        const searchTerm = searchKeyword.toLowerCase();
        
        // 개별 필드 검색 + 합쳐진 문자열 검색 모두 지원
        const combinedName = `${itemName} ${optionName}`.toLowerCase();
        
        const itemNameMatch = itemName.includes(searchTerm);
        const optionNameMatch = optionName.includes(searchTerm);
        const combinedNameMatch = combinedName.includes(searchTerm);
        
        const isMatch = itemNameMatch || optionNameMatch || combinedNameMatch;
        
        // 검색 매칭 상세 로그 (처음 5개만)
        if (beforeSearchCount <= 10 || isMatch) {
          console.log(`🔍 [디버깅] 검색 매칭 체크:`, {
            item_id: item.item_id,
            option_id: item.option_id,
            item_name: item.item_name,
            option_name: item.option_name,
            itemNameMatch,
            optionNameMatch,
            combinedNameMatch,
            isMatch
          });
        }
        
        return isMatch;
      });
      
      console.log(`🔍 [디버깅] 검색 필터링 완료: ${beforeSearchCount}개 → ${filtered.length}개`);
      
      // 검색 결과 상세 출력 (최대 5개)
      if (filtered.length > 0) {
        console.log('🔍 [디버깅] 검색 결과 샘플:');
        filtered.slice(0, 5).forEach((item, index) => {
          console.log(`🔍 [디버깅] 결과 ${index + 1}:`, {
            item_id: item.item_id,
            option_id: item.option_id,
            item_name: item.item_name,
            option_name: item.option_name
          });
        });
      }
    }
    
    // 2. 카테고리 필터링
    if (selectedCategory !== '전체') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => item.category === selectedCategory);
      console.log(`🔍 [디버깅] 카테고리 필터링: ${beforeCount}개 → ${filtered.length}개`);
    }
    
    // 3. 노출상태 필터링
    if (selectedExposure !== '전체') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => item.status === selectedExposure);
      console.log(`🔍 [디버깅] 노출상태 필터링: ${beforeCount}개 → ${filtered.length}개`);
    }
    
    // 4. 판매상태 필터링
    if (selectedSaleStatus !== '전체') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => item.sales_status === selectedSaleStatus);
      console.log(`🔍 [디버깅] 판매상태 필터링: ${beforeCount}개 → ${filtered.length}개`);
    }
    
    // 5. 판매방식 필터링
    if (sortFilter === '일반판매') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => !rocketInventoryOptionIds.has(String(item.option_id)));
      console.log(`🔍 [디버깅] 일반판매 필터링: ${beforeCount}개 → ${filtered.length}개`);
    } else if (sortFilter === '로켓그로스') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => rocketInventoryOptionIds.has(String(item.option_id)));
      console.log(`🔍 [디버깅] 로켓그로스 필터링: ${beforeCount}개 → ${filtered.length}개`);
    }
    
    // 6. 판매방식이 '전체'인 경우에만 정렬 적용
    if (sortFilter === '전체') {
      console.log('🔍 [디버깅] 정렬 적용 중...');
      filtered = filtered.sort((a, b) => {
        // 1차 정렬: 등록상품명 + 옵션명 기준으로 알파벳 순서 정렬
        const aProductName = (a.item_name || '') + ' ' + (a.option_name || '');
        const bProductName = (b.item_name || '') + ' ' + (b.option_name || '');
        
        const nameComparison = aProductName.localeCompare(bProductName, 'ko', { numeric: true, caseFirst: 'lower' });
        
        // 동일한 상품명+옵션명인 경우 2차 정렬 적용
        if (nameComparison === 0) {
          // 2차 정렬: 로켓그로스 상품(주황색 동그라미)을 먼저 표시
          const aIsRocket = rocketInventoryOptionIds.has(String(a.option_id));
          const bIsRocket = rocketInventoryOptionIds.has(String(b.option_id));
          
          if (aIsRocket && !bIsRocket) return -1;  // 로켓그로스가 먼저
          if (!aIsRocket && bIsRocket) return 1;   // 일반이 나중에
        }
        
        return nameComparison;
      });
      console.log('🔍 [디버깅] 정렬 완료');
    }
    
    console.log(`🔍 [디버깅] 최종 결과: ${filtered.length}개`);
    console.log('🔍 [디버깅] ===== 필터링 완료 =====');
    
    setFilteredData(filtered);
    
    // 🆕 페이지 초기화 개선: 검색어가 있을 때만 1페이지로 이동
    if (searchKeyword.trim()) {
      setCurrentPage(1);
      console.log('🔍 [디버깅] 페이지를 1페이지로 초기화');
    }
  }, [data, searchKeyword, selectedCategory, selectedExposure, selectedSaleStatus, sortFilter, rocketInventoryOptionIds]);

  // 🆕 검색 상태 보존 함수
  const preserveSearchState = useCallback(() => {
    if (searchKeyword.trim() || selectedCategory !== '전체' || selectedExposure !== '전체' || selectedSaleStatus !== '전체' || sortFilter !== '전체') {
      applyAllFilters();
    }
  }, [searchKeyword, selectedCategory, selectedExposure, selectedSaleStatus, sortFilter, applyAllFilters]);

  // 🛠️ 검색 함수 - applyAllFilters 호출
  const handleSearch = useCallback(() => {
    applyAllFilters();
  }, [applyAllFilters]);

  // 🛠️ 4단계 최적화: 키 입력 핸들러 캐싱
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // 🛠️ 4단계 최적화: 전체 선택 핸들러 캐싱
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      const itemRows = transformedData.filter(row => row.type === 'item');
      setSelectedItems(itemRows.map(row => row.item_id));
    }
    setSelectAll(!selectAll);
  }, [selectAll, transformedData]);

  // 🛠️ 4단계 최적화: 개별 선택 핸들러 캐싱
  const handleSelectItem = useCallback((uniqueId: string) => {
    if (selectedItems.includes(uniqueId)) {
      setSelectedItems(selectedItems.filter(id => id !== uniqueId));
      setSelectAll(false);
    } else {
      setSelectedItems([...selectedItems, uniqueId]);
    }
  }, [selectedItems]);

  const handleExcelUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsLoadingApi(true);
        try {
          await processProductExcelUpload(file, (stage, current, total) => {
            if (current !== undefined && total !== undefined) {
              setProductInfoProgress({ current, total, message: stage });
            }
          });
          await loadProductsFromDB();
          // 🆕 검색 상태 보존
          preserveSearchState();
          alert('상품등록 엑셀 업로드가 완료되었습니다.');
        } catch (error) {
          console.error('엑셀 업로드 실패:', error);
          alert('엑셀 업로드 중 오류가 발생했습니다.');
        } finally {
          setIsLoadingApi(false);
          setProductInfoProgress(null);
        }
      }
    };
    input.click();
  };

  const handleRocketInventoryExcelUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsUploadingRocketInventory(true);
        try {
          await processRocketInventoryExcelUpload(file, (stage, current, total) => {
            if (current !== undefined && total !== undefined) {
              setProductInfoProgress({ current, total, message: stage });
            }
          });
          await loadRocketInventoryOptionIds();
          // 🆕 검색 상태 보존
          preserveSearchState();
          alert('로켓그로스 xlsx 업로드가 완료되었습니다.');
        } catch (error) {
          console.error('로켓그로스 업로드 실패:', error);
          alert('로켓그로스 업로드 중 오류가 발생했습니다.');
        } finally {
          setIsUploadingRocketInventory(false);
          setProductInfoProgress(null);
        }
      }
    };
    input.click();
  };

  const handleNormalApiLoad = async () => {
    if (selectedItems.length === 0) {
      alert('선택된 상품이 없습니다.');
      return;
    }

    const confirmed = window.confirm(`선택된 ${selectedItems.length}개 상품의 이미지 정보를 가져오시겠습니까?`);
    if (!confirmed) return;

    setIsLoadingNormalApi(true);
    try {
      await importImageInfoFromItemAllRocketGrowth(selectedItems, (current, total, message) => {
        setProductInfoProgress({ current, total, message });
      });
      await loadProductsFromDB();
      // 🆕 검색 상태 보존
      preserveSearchState();
      alert('로켓그로스 API 로드가 완료되었습니다.');
    } catch (error) {
      console.error('로켓그로스 API 로드 실패:', error);
      alert('로켓그로스 API 로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingNormalApi(false);
      setProductInfoProgress(null);
    }
  };

  const handleApiLoad2 = async () => {
    if (selectedItems.length === 0) {
      alert('선택된 상품이 없습니다.');
      return;
    }

    const confirmed = window.confirm(`선택된 ${selectedItems.length}개 상품의 이미지 정보를 가져오시겠습니까?`);
    if (!confirmed) return;

    setIsLoadingApi2(true);
    try {
      await importImageInfoFromItemAll(selectedItems, (current, total, message) => {
        setProductInfoProgress({ current, total, message });
      });
      await loadProductsFromDB();
      // 🆕 검색 상태 보존
      preserveSearchState();
      alert('일반 API 로드가 완료되었습니다.');
    } catch (error) {
      console.error('일반 API 로드 실패:', error);
      alert('일반 API 로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingApi2(false);
      setProductInfoProgress(null);
    }
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

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // 🛠️ 4단계 최적화: 페이지네이션 데이터 계산 캐싱
  const getCurrentPageData = useCallback(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transformedData.slice(startIndex, endIndex);
  }, [transformedData, currentPage, itemsPerPage]);

  // 입력 셀 핸들러
  const handleCellClick = (cellId: string) => {
    setEditingCell(cellId);
  };

  const handleInputChange = (cellId: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [cellId]: value
    }));
  };

  const handleInputBlur = useCallback(async () => {
    // 입력 완료 시 저장 로직은 별도 처리
    setEditingCell(null);
  }, []);

  // 🛠️ 5단계 최적화: 입력 키 핸들러 - 타이머 메모리 누수 방지
  const handleInputKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>, currentRowIndex: number) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
      // 다음 행의 입력 셀로 이동
      const nextRowIndex = currentRowIndex + 1;
      const currentPageData = getCurrentPageData();
      if (nextRowIndex < currentPageData.length) {
        const nextRow = currentPageData[nextRowIndex];
        const nextCellId = `input-${nextRow.item_id}-${nextRow.option_id || nextRowIndex}`;
        
        // 🧹 기존 타이머가 있다면 정리
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // 새 타이머 설정 및 추적
        timeoutRef.current = setTimeout(() => {
          setEditingCell(nextCellId);
          timeoutRef.current = null; // 실행 후 참조 해제
        }, 100);
      }
    }
  }, [getCurrentPageData]);

  // 🆕 Enter 키 입력 시 저장 및 다음 셀로 이동
  const handleEnterKeyAndSave = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>, row: TableRow, cellId: string, currentRowIndex: number) => {
    if (e.key === 'Enter') {
      const inputValue = inputValues[cellId] || '';
      const quantity = parseFloat(inputValue);
      
      // 유효한 숫자이고 0보다 큰 경우에만 저장
      if (inputValue.trim() && !isNaN(quantity) && quantity > 0) {
        await saveToCart(row, quantity);
      }
      
      // 다음 행으로 이동
      handleInputKeyPress(e, currentRowIndex);
    }
  }, [inputValues, saveToCart, handleInputKeyPress]);

  // 🆕 Blur 시 저장
  const handleBlurAndSave = useCallback(async (row: TableRow, cellId: string) => {
    const inputValue = inputValues[cellId] || '';
    const quantity = parseFloat(inputValue);
    
    // 유효한 숫자이고 0보다 큰 경우에만 저장
    if (inputValue.trim() && !isNaN(quantity) && quantity > 0) {
      await saveToCart(row, quantity);
    }
    
    setEditingCell(null);
  }, [inputValues, saveToCart]);

  // 상품명 클릭 시 쿠팡 링크로 이동
  const handleProductNameClick = (productId: string, optionId?: string) => {
    if (productId && optionId) {
      const coupangUrl = `https://www.coupang.com/vp/products/${productId}?vendorItemId=${optionId}`;
      window.open(coupangUrl, '_blank');
    }
  };

  // 🚀 컴포넌트 마운트 시 데이터 로드 + 🧹 메모리 누수 방지
  useEffect(() => {
    console.log('🔄 ProductListPage 컴포넌트 마운트됨 - 초기 데이터 로딩 시작...');
    loadProductsFromDB();
    loadRocketInventoryOptionIds();
    loadItemViewsData();
    // 🆕 사입상태 데이터 로드 추가
    loadOrderQuantityData();
    
    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      console.log('🧹 ProductListPage 컴포넌트 언마운트 - 메모리 정리 중...');
      
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

  // window 객체에 디버깅 함수들 추가 (브라우저 콘솔에서 호출 가능)
  useEffect(() => {
    (window as any).debugSearchRivedi = debugSearchRivedi;
    (window as any).debugDataState = debugDataState;
    (window as any).debugOptionCounts = debugOptionCounts;
    (window as any).debugMemoryData = debugMemoryData;
    (window as any).debugDataFlow = debugDataFlow;
    
    console.log('🔧 [디버깅] 디버깅 함수들이 window 객체에 추가되었습니다.');
    console.log('🔧 [디버깅] 브라우저 콘솔에서 debugDataFlow() 를 호출하여 전체 데이터 흐름을 확인하세요.');
    
    // cleanup 함수
    return () => {
      delete (window as any).debugSearchRivedi;
      delete (window as any).debugDataState;
      delete (window as any).debugOptionCounts;
      delete (window as any).debugMemoryData;
      delete (window as any).debugDataFlow;
    };
  }, [data, filteredData, transformedData, searchKeyword, sortFilter, rocketInventoryOptionIds]);

  // 🆕 필터 조건 변경 시 자동 필터링 적용 (searchKeyword 추가)
  useEffect(() => {
    if (data.length > 0) {
      applyAllFilters();
    }
  }, [data, searchKeyword, selectedCategory, selectedExposure, selectedSaleStatus, sortFilter, rocketInventoryOptionIds, applyAllFilters]);

  // 🛠️ 4단계 최적화: 페이지네이션 계산 캐싱 (캐싱된 데이터 사용)
  const totalPages = useMemo(() => {
    return Math.ceil(transformedData.length / itemsPerPage);
  }, [transformedData, itemsPerPage]);

  // 🛠️ 4단계 최적화: 현재 페이지 데이터 캐싱
  const currentData = useMemo(() => {
    return getCurrentPageData();
  }, [getCurrentPageData]);

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">상품 조회/수정</h1>
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

      {/* 상단 액션 버튼 섹션 */}
      <div className="product-list-top-actions-section">
        <div className="product-list-top-actions-buttons">
          <button
            onClick={handleExcelUpload}
            disabled={isLoadingApi}
            className="product-list-button product-list-button-success"
          >
            {isLoadingApi ? '업로드 중...' : '상품등록 xlsx'}
          </button>
          
          <button
            onClick={handleApiLoad2}
            disabled={isLoadingApi2}
            className="product-list-button product-list-button-primary"
          >
            {isLoadingApi2 ? '처리 중...' : '쿠팡일반 api'}
          </button>

          <button
            onClick={handleNormalApiLoad}
            disabled={isLoadingNormalApi}
            className="product-list-button product-list-button-orange"
          >
            {isLoadingNormalApi ? '처리 중...' : '로켓그로스 api'}
          </button>
          
          <button
            onClick={handleRocketInventoryExcelUpload}
            disabled={isUploadingRocketInventory}
            className="product-list-button product-list-button-orange"
          >
            {isUploadingRocketInventory ? '업로드 중...' : '로켓그로스 xlsx'}
          </button>
        </div>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="product-list-filter-section">
        <div className="product-list-filter-grid-improved">
          {/* 판매방식 필터 (첫 번째로 이동) */}
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

          {/* 카테고리 (마지막으로 이동) */}
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
              총 {transformedData.length}개 상품
            </div>
            <div className="product-list-selected-info">
              선택된 상품: {selectedItems.length}개 / 총 {transformedData.filter(row => row.type === 'item').length}개
            </div>
          </div>
          
          <div className="product-list-action-buttons">
            <button
              onClick={() => {
                // TODO: 주문 기능 구현
                alert('주문 기능이 구현될 예정입니다.');
              }}
              className="product-list-button product-list-button-primary"
            >
              주문
            </button>
          </div>
        </div>

        {/* 진행률 표시 */}
        {productInfoProgress && (
          <div className="product-list-progress-section">
            <div className="product-list-progress-message">{productInfoProgress.message}</div>
            <div className="product-list-progress-bar">
              <div 
                className="product-list-progress-fill"
                style={{ width: `${(productInfoProgress.current / productInfoProgress.total) * 100}%` }}
              ></div>
            </div>
            <div className="product-list-progress-text">
              {productInfoProgress.current} / {productInfoProgress.total} ({((productInfoProgress.current / productInfoProgress.total) * 100).toFixed(1)}%)
            </div>
          </div>
        )}

        <div className="product-list-table-wrapper">
          <table className="product-list-table product-list-page-table">
            <thead className="product-list-table-header">
              <tr>
                <th className="product-list-table-header-cell product-list-table-header-checkbox">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="product-list-checkbox-large"
                  />
                </th>
                <th className="product-list-table-header-cell product-list-table-header-product">등록<br/>상품명/<br/>옵션명</th>
                <th className="product-list-table-header-cell" style={{ width: '50px', textAlign: 'center', padding: '0' }}>타입</th>
                <th className="product-list-table-header-cell product-list-table-header-number">입력</th>
                <th className="product-list-table-header-cell product-list-table-header-number">입고<br/>중</th>
                <th className="product-list-table-header-cell product-list-table-header-number">쿠팡<br/>재고</th>
                <th className="product-list-table-header-cell product-list-table-header-number">사입<br/>상태</th>
                <th className="product-list-table-header-cell product-list-table-header-number">개인<br/>주문</th>
                <th className="product-list-table-header-cell product-list-table-header-number">기간</th>
                <th className="product-list-table-header-cell product-list-table-header-number">7일</th>
                <th className="product-list-table-header-cell product-list-table-header-number">30일</th>
                <th className="product-list-table-header-cell product-list-table-header-number">쿠팡<br/>추천</th>
                <th className="product-list-table-header-cell product-list-table-header-number">창고<br/>재고</th>
                <th className="product-list-table-header-cell product-list-table-header-number">창고<br/>비</th>
                <th className="product-list-table-header-cell product-list-table-header-number">view1</th>
                <th className="product-list-table-header-cell product-list-table-header-number">view2</th>
                <th className="product-list-table-header-cell product-list-table-header-number">view3</th>
                <th className="product-list-table-header-cell product-list-table-header-number">view4</th>
                <th className="product-list-table-header-cell product-list-table-header-number">view5</th>
                <th className="product-list-table-header-cell product-list-table-header-number">원가</th>
                <th className="product-list-table-header-cell product-list-table-header-number">가격</th>
                <th className="product-list-table-header-cell product-list-table-header-number">마진</th>
                <th className="product-list-table-header-cell product-list-table-header-number">출고</th>
                <th className="product-list-table-header-cell product-list-table-header-number">반출</th>
                <th className="product-list-table-header-cell product-list-table-header-number">할인</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {currentData.map((row, index) => {
                const isEditing = editingCell === `input-${row.item_id}-${row.option_id || index}`;
                const uniqueKey = `${currentPage}-${index}-${row.item_id}-${row.option_id || 'no-option'}`;
                return (
                <tr 
                  key={uniqueKey}
                  className={`product-list-table-row ${row.type === 'item' ? 'product-list-table-row-item' : 'product-list-table-row-option'} ${isEditing ? 'editing-active' : ''} ${shouldHighlightRow(row) ? 'product-list-table-row-green-bg' : ''}`}
                >
                  <td className="product-list-table-cell">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(`${row.item_id}-${row.option_id || index}`)}
                      onChange={() => handleSelectItem(`${row.item_id}-${row.option_id || index}`)}
                      className="product-list-checkbox-large"
                    />
                  </td>
                  <td 
                    className="product-list-table-cell" 
                    style={{ 
                      whiteSpace: 'pre-line', 
                      maxWidth: '300px', 
                      padding: '8px 0px',
                      cursor: row.option_id ? 'pointer' : 'default'
                    }}
                    onClick={() => row.option_id && handleProductNameClick(row.item_id, row.option_id)}
                  >
                    {row.product_name}
                  </td>
                  <td 
                    className="product-list-table-cell" 
                    style={{ 
                      width: '50px', 
                      textAlign: 'center', 
                      padding: '0',
                      verticalAlign: 'middle' 
                    }}
                  >
                    {/* 로켓 인벤토리에 있는 option_id인 경우 주황색 동그라미 표시 */}
                    {row.option_id && rocketInventoryOptionIds.has(String(row.option_id)) ? (
                      <div 
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#ff9800',
                          margin: '0 auto',
                          display: 'inline-block'
                        }}
                        title="로켓그로스 상품"
                      ></div>
                    ) : null}
                  </td>
                  <td 
                    className="product-list-table-cell product-list-editable-cell" 
                    onClick={() => handleCellClick(`input-${row.item_id}-${row.option_id || index}`)}
                    style={{ cursor: 'pointer', backgroundColor: editingCell === `input-${row.item_id}-${row.option_id || index}` ? '#f0f8ff' : 'transparent' }}
                  >
                    {editingCell === `input-${row.item_id}-${row.option_id || index}` ? (
                      <input
                        type="text"
                        value={inputValues[`input-${row.item_id}-${row.option_id || index}`] || ''}
                        onChange={(e) => handleInputChange(`input-${row.item_id}-${row.option_id || index}`, e.target.value)}
                        onBlur={() => handleBlurAndSave(row, `input-${row.item_id}-${row.option_id || index}`)}
                        onKeyPress={(e) => handleEnterKeyAndSave(e, row, `input-${row.item_id}-${row.option_id || index}`, index)}
                        autoFocus
                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center' }}
                      />
                    ) : (
                      renderInputValue(row, index)
                    )}
                  </td>
                  <td className="product-list-table-cell">
                    {renderPendingInbounds(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {renderOrderableQuantity(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {/* 🆕 사입상태: 바코드별 주문 수량 합계 표시 */}
                    {renderOrderQuantity(row)}
                  </td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">
                    {render7DaysSales(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {render30DaysSales(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {renderRecommendedQuantity(row)}
                  </td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">
                    {renderStorageFee(row)}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[0], undefined, true) }}>
                    {/* 🔄 view1: 항상 검은색 */}
                    {itemViewsData[row.item_id]?.[0] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[1], itemViewsData[row.item_id]?.[0], false) }}>
                    {/* 🔄 view2: view1과 비교 */}
                    {itemViewsData[row.item_id]?.[1] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[2], itemViewsData[row.item_id]?.[1], false) }}>
                    {/* 🔄 view3: view2와 비교 */}
                    {itemViewsData[row.item_id]?.[2] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[3], itemViewsData[row.item_id]?.[2], false) }}>
                    {/* 🔄 view4: view3과 비교 */}
                    {itemViewsData[row.item_id]?.[3] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[4], itemViewsData[row.item_id]?.[3], false) }}>
                    {/* 🔄 view5: view4와 비교 */}
                    {itemViewsData[row.item_id]?.[4] || '-'}
                  </td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell" style={{ textAlign: 'right', fontWeight: '600', color: '#000000' }}>
                    {row.sale_price ? new Intl.NumberFormat('ko-KR').format(row.sale_price) + '원' : '-'}
                  </td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">-</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      <div className="product-list-pagination">
        <div className="product-list-pagination-controls">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="product-list-pagination-button"
          >
            이전
          </button>
          <span className="product-list-pagination-current">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="product-list-pagination-button"
          >
            다음
          </button>
        </div>
        <div className="product-list-pagination-info">
          {transformedData.length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, transformedData.length)}개 표시
        </div>
      </div>

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