import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DashboardStatsCard from './components/DashboardStatsCard';
import { supabase } from '../../config/supabase';
import './ProductListPage.css';
import { processProductExcelUpload, processSalesExcelUpload } from '../../services/excelUploadService';
import { processRocketInventoryExcelUpload } from '../../services/rocketInventoryService';
import { importImageInfoFromItemAll, importImageInfoFromItemAllRocketGrowth } from '../../services/imageInfoService';
import { fetchCoupangSalesData } from '../../services/coupangSalesService';
import { viewsService } from '../../services/viewsService';

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
  // 🆕 쿠팡 판매량 데이터 (option_id별 판매량)
  const [coupangSalesData, setCoupangSalesData] = useState<{[key: string]: number}>({});
  // 🆕 창고재고 데이터 (바코드별 재고 합계)
  const [warehouseStockData, setWarehouseStockData] = useState<{[key: string]: number}>({});
  // 🆕 조회수 데이터 (날짜별로 item_id별 조회수 - view1~view5)
  const [viewsDataByDate, setViewsDataByDate] = useState<Array<{[key: string]: string}>>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  // 검색 및 필터
  const [searchKeyword, setSearchKeyword] = useState('');
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState(''); // 실제 적용된 검색어
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{type: 'product' | 'barcode', value: string, display: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFilter, setSearchFilter] = useState('상품명'); // 카테고리 -> 검색필터로 변경
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
  const itemsPerPage = 100;
  
  // 입력 상태 관리
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  
  // 로딩 상태
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isLoadingApi2, setIsLoadingApi2] = useState(false);
  const [isLoadingNormalApi, setIsLoadingNormalApi] = useState(false);
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

  /**
   * 주문 데이터 타입 정의
   */
  interface OrderData {
    item_name: string;
    option_name: string;
    quantity: number;
    barcode: string;
    option_id: string;
    _debug?: {
      cellId: string;
      itemId: string;
      original_product_name?: string;
    };
  }

  /**
   * 기업급 에러 처리 유틸리티
   * @description unknown 타입의 에러를 안전하게 처리하는 유틸리티 함수
   */
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '알 수 없는 오류가 발생했습니다.';
  };

  const getErrorStack = (error: unknown): string | undefined => {
    if (error instanceof Error) {
      return error.stack;
    }
    return undefined;
  };

  /**
   * 기업급 일괄 주문 처리 함수
   * @description localStorage에서 입력 데이터를 추출하고 상품 정보와 매칭하여 구글시트에 일괄 저장
   * @author 기업 전문 개발팀
   * @version 1.0.0
   * @created 2025-08-27
   */
  const handleBatchOrderSubmission = useCallback(async () => {
    const operationStartTime = performance.now();
    
    try {
      console.log('🚀 [BATCH_ORDER] 일괄 주문 처리 시작');
      
      // 1. 사용자 인증 검증
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ [BATCH_ORDER] 사용자 인증 실패');
        alert('로그인이 필요합니다.');
        return;
      }
      
      console.log('✅ [BATCH_ORDER] 사용자 인증 확인:', userId);

      // 2. localStorage에서 입력 데이터 추출
      console.log('📋 [BATCH_ORDER] 입력 데이터 추출 중...');
      console.log('🔍 [DEBUG] inputValues 전체:', inputValues);
      console.log('🔍 [DEBUG] inputValues 키 개수:', Object.keys(inputValues).length);
      
      const inputEntries = Object.entries(inputValues)
        .filter(([cellId, quantity]) => {
          const numQuantity = Number(quantity);
          const isValid = quantity && numQuantity > 0 && !isNaN(numQuantity);
          console.log(`🔍 [DEBUG] 필터링 체크: ${cellId} = ${quantity} -> ${isValid}`);
          return isValid;
        })
        .map(([cellId, quantity]) => ({
          cellId,
          quantity: Number(quantity)
        }));
      
      if (inputEntries.length === 0) {
        console.warn('⚠️ [BATCH_ORDER] 입력된 주문 데이터가 없음');
        alert('주문할 수량이 입력된 상품이 없습니다.');
        return;
      }
      
      console.log('📊 [BATCH_ORDER] 추출된 입력 데이터:', {
        total_entries: inputEntries.length,
        entries: inputEntries.slice(0, 3) // 처음 3개만 로그
      });

      // 3. 상품 데이터와 매칭하여 주문 정보 구성
      console.log('🔄 [BATCH_ORDER] 상품 데이터 매칭 중...');
      console.log('🔍 [BATCH_ORDER] 전체 상품 데이터 개수:', data.length);
      console.log('🔍 [BATCH_ORDER] 현재 페이지 데이터 개수:', getCurrentPageData().length);
      console.log('🔍 [BATCH_ORDER] inputValues와 data 매칭 분석...');
      
      // inputValues의 cellId들 분석
      const inputCellIds = Object.keys(inputValues);
      console.log('🔍 [BATCH_ORDER] inputValues cellId 샘플:', inputCellIds.slice(0, 5));
      
      // data의 item_id, option_id 샘플
      console.log('🔍 [BATCH_ORDER] data 상품 샘플:', data.slice(0, 3).map(p => ({
        item_id: p.item_id,
        option_id: p.option_id,
        expected_cellId: `input-${p.item_id}-${p.option_id}`
      })));
      
      const orders: OrderData[] = [];
      const unmatchedEntries: any[] = [];

      for (const { cellId, quantity } of inputEntries) {
        try {
          let productData: any = null;
          let itemId = '';
          let optionId = '';
          
          // localStorage에 상품 정보가 객체로 저장되어 있는 경우 우선 사용
          if (typeof quantity === 'object' && quantity !== null && 'item_name' in quantity) {
            const quantityObj = quantity as any;
            productData = {
              product_name: quantityObj.item_name,
              option_name: quantityObj.option_name || '',
              barcode: quantityObj.barcode || '',
              option_id: quantityObj.option_id,
              item_id: quantityObj.item_id
            };
            itemId = quantityObj.item_id;
            optionId = quantityObj.option_id;
            console.log('📦 [BATCH_ORDER] localStorage에서 상품 정보 사용:', productData);
          } else {
            // 기존 방식: cellId 파싱 및 현재 페이지 데이터 매칭
            const cellIdMatch = cellId.match(/^input-(.+)-(.+)$/);
            if (!cellIdMatch) {
              console.warn('⚠️ [BATCH_ORDER] 잘못된 cellId 형식:', cellId);
              unmatchedEntries.push({ cellId, reason: 'INVALID_CELL_ID_FORMAT' });
              continue;
            }

            [, itemId, optionId] = cellIdMatch;
            
            console.log(`🔍 [BATCH_ORDER] 매칭 시도 (현재 페이지):`, { cellId, itemId, optionId });
            
            // 현재 페이지 데이터에서 매칭되는 상품 찾기
            const matchingProduct = data.find(product => 
              String(product.item_id) === String(itemId) && 
              String(product.option_id) === String(optionId)
            );
            
            if (matchingProduct) {
              productData = matchingProduct;
              console.log('✅ [BATCH_ORDER] 현재 페이지에서 상품 매칭 성공');
            } else {
              // 현재 페이지에 없는 경우 - 다른 페이지의 상품으로 간주하고 스킵 (매칭 실패로 분류하지 않음)
              console.log('ℹ️ [BATCH_ORDER] 다른 페이지 상품으로 추정 - 처리 스킵:', { cellId, itemId, optionId });
              continue; // unmatchedEntries에 추가하지 않고 스킵
            }
          }

          const matchingProduct = productData;
          
          // quantity 값 추출 (새로운 형식과 기존 형식 모두 지원)
          const actualQuantity = (typeof quantity === 'object' && quantity !== null && 'quantity' in quantity) 
            ? (quantity as any).quantity 
            : quantity;
          
          console.log(`🔍 [BATCH_ORDER] 매칭 결과:`, { 
            cellId, 
            found: !!matchingProduct,
            matching_item_id: matchingProduct?.item_id,
            matching_option_id: matchingProduct?.option_id,
            quantity: actualQuantity
          });

          if (!matchingProduct) {
            console.warn('⚠️ [BATCH_ORDER] 매칭되는 상품 없음:', { itemId, optionId });
            unmatchedEntries.push({ cellId, itemId, optionId, reason: 'PRODUCT_NOT_FOUND' });
            continue;
          }

          // 상품명 파싱 전 데이터 확인
          console.log('🔍 [BATCH_ORDER] 매칭된 상품 전체 데이터:', {
            ...matchingProduct,
            // 긴 필드는 축약
            product_name: matchingProduct.product_name?.substring(0, 100) + '...'
          });

          // 데이터 추출 로직 개선
          // item_name과 option_name을 적절히 찾기
          let itemName = '';
          let optionName = '';
          
          // product_name이 있는 경우 파싱 시도
          if (matchingProduct.product_name) {
            const productLines = matchingProduct.product_name.split('\n');
            itemName = productLines[0]?.trim() || '';
            optionName = productLines[1]?.trim() || '';
          }
          
          // item_name 필드가 직접 있는 경우
          if (!itemName && matchingProduct.item_name) {
            itemName = String(matchingProduct.item_name).trim();
          }
          
          // option_name 필드가 직접 있는 경우
          if (!optionName && matchingProduct.option_name) {
            optionName = String(matchingProduct.option_name).trim();
          }
          
          // product_title 필드도 체크
          if (!itemName && matchingProduct.product_title) {
            itemName = String(matchingProduct.product_title).trim();
          }

          console.log('📝 [BATCH_ORDER] 추출된 데이터:', {
            itemName,
            optionName,
            barcode: matchingProduct.barcode,
            option_id: matchingProduct.option_id
          });

          // 필수 데이터 검증 (barcode는 선택사항으로 변경)
          if (!itemName) {
            console.warn('⚠️ [BATCH_ORDER] 필수 데이터 부족:', {
              itemId,
              optionId,
              available_fields: Object.keys(matchingProduct),
              itemName,
              optionName,
              barcode: matchingProduct.barcode
            });
            unmatchedEntries.push({ 
              cellId, 
              itemId, 
              optionId, 
              reason: 'MISSING_REQUIRED_DATA',
              available_fields: Object.keys(matchingProduct)
            });
            continue;
          }

          // 주문 데이터 구성
          orders.push({
            item_name: itemName,
            option_name: optionName || '옵션없음', // 옵션명이 없으면 기본값
            quantity: actualQuantity,
            barcode: String(matchingProduct.barcode || ''), // 바코드가 없으면 빈 문자열
            option_id: String(matchingProduct.option_id),
            // 디버깅을 위한 추가 정보
            _debug: {
              cellId,
              itemId: matchingProduct.item_id,
              original_product_name: matchingProduct.product_name
            }
          });

        } catch (error) {
          console.error(`❌ [BATCH_ORDER] 항목 처리 중 오류 (${cellId}):`, error);
          unmatchedEntries.push({ 
            cellId, 
            reason: 'PROCESSING_ERROR', 
            error: getErrorMessage(error)
          });
        }
      }

      console.log('📈 [BATCH_ORDER] 데이터 매칭 결과:', {
        total_inputs: inputEntries.length,
        matched_orders: orders.length,
        unmatched_entries: unmatchedEntries.length,
        success_rate: `${((orders.length / inputEntries.length) * 100).toFixed(1)}%`
      });
      
      if (unmatchedEntries.length > 0) {
        console.log('⚠️ [BATCH_ORDER] 매칭 실패 상세:', unmatchedEntries);
      }

      // 처리 가능한 주문이 없는 경우
      if (orders.length === 0) {
        console.error('❌ [BATCH_ORDER] 처리 가능한 주문이 없음');
        alert('처리 가능한 주문 데이터가 없습니다.\n상품 정보를 확인해 주세요.');
        return;
      }

      // 4. 백엔드 API 호출
      console.log('📡 [BATCH_ORDER] 백엔드 API 호출 중...');
      const apiStartTime = performance.now();
      
      const response = await fetch('http://localhost:3001/api/googlesheets/batch-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          orders: orders
        })
      });

      const result = await response.json();
      const apiEndTime = performance.now();
      
      console.log('📊 [BATCH_ORDER] API 응답:', {
        status: response.status,
        success: result.success,
        api_duration_ms: Math.round(apiEndTime - apiStartTime),
        result_summary: result.data || result.message
      });

      // 5. 결과 처리 및 사용자 피드백
      if (result.success) {
        const { processed_count, failed_count, processing_time_ms, range } = result.data;
        
        console.log('✅ [BATCH_ORDER] 처리 완료:', {
          processed_count,
          failed_count,
          server_processing_time_ms: processing_time_ms,
          googlesheet_range: range
        });

        // 성공 메시지 구성
        let successMessage = `✅ 주문 처리 완료!\n\n`;
        successMessage += `📊 처리 결과:\n`;
        successMessage += `• 성공: ${processed_count}개\n`;
        if (failed_count > 0) {
          successMessage += `• 실패: ${failed_count}개\n`;
        }
        if (unmatchedEntries.length > 0) {
          successMessage += `• 매칭 실패: ${unmatchedEntries.length}개\n`;
        }
        successMessage += `\n📍 구글시트 위치: ${range}`;
        successMessage += `\n⏱️ 처리 시간: ${processing_time_ms}ms`;

        alert(successMessage);

        // 모든 입력값 전체 초기화 (선택적)
        const shouldClearInputs = window.confirm('모든 입력값을 전체 초기화하시겠습니까?');
        if (shouldClearInputs) {
          console.log('🧹 [BATCH_ORDER] 전체 초기화 시작');
          console.log('🧹 [BATCH_ORDER] 초기화 전 총 입력값 개수:', Object.keys(inputValues).length);
          
          // 모든 입력값 완전 삭제
          setInputValues({});
          
          // localStorage 완전 삭제
          localStorage.removeItem('productInputValues');
          
          console.log('✅ [BATCH_ORDER] 모든 입력값 전체 초기화 완료');
        }

      } else {
        console.error('❌ [BATCH_ORDER] 서버 처리 실패:', result);
        alert(`주문 처리에 실패했습니다.\n\n오류: ${result.message}\n오류 코드: ${result.error_code || 'UNKNOWN'}`);
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const errorStack = getErrorStack(error);
      
      console.error('❌ [BATCH_ORDER] 예상치 못한 오류:', {
        error: errorMessage,
        stack: errorStack
      });
      
      alert(`주문 처리 중 오류가 발생했습니다.\n\n오류: ${errorMessage}\n\n개발자 도구의 콘솔을 확인해 주세요.`);
      
    } finally {
      const operationEndTime = performance.now();
      const totalDuration = Math.round(operationEndTime - operationStartTime);
      
      console.log('🏁 [BATCH_ORDER] 작업 완료:', {
        total_duration_ms: totalDuration,
        timestamp: new Date().toISOString()
      });
    }
  }, [inputValues, data]);

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

  // 입력값 추출 헬퍼 함수 (객체와 문자열 모두 지원)
  const getInputValue = useCallback((cellId: string): string => {
    const cellValue = inputValues[cellId];
    // 객체인 경우 quantity 속성 추출, 아니면 그대로 사용
    return (typeof cellValue === 'object' && cellValue !== null && 'quantity' in cellValue) 
      ? String((cellValue as any).quantity || '')
      : String(cellValue || '');
  }, [inputValues]);

  const renderInputValue = useCallback((row: TableRow, index: number) => {
    const cellId = `input-${row.item_id}-${row.option_id || index}`;
    
    // getInputValue 로직을 직접 인라인으로 처리
    const cellValue = inputValues[cellId];
    const value = (typeof cellValue === 'object' && cellValue !== null && 'quantity' in cellValue) 
      ? String((cellValue as any).quantity || '')
      : String(cellValue || '');
      
    const numValue = parseFloat(value);
    
    if (value && !isNaN(numValue) && numValue > 0) {
      return <span className="value-highlight-yellow">{value}</span>;
    }
    return value || '-';
  }, [inputValues]);

  const renderPendingInbounds = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.pending_inbounds;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="product-list-highlight-gray">{value}</span> : '-';
  }, [rocketInventoryData]);

  const renderOrderableQuantity = useCallback((row: TableRow) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.orderable_quantity || row.stock || 0;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return numValue > 0 ? <span className="product-list-highlight-light-gray">{numValue}</span> : '-';
  }, [rocketInventoryData]);

  const renderOrderQuantity = useCallback((row: TableRow) => {
    const value = row.barcode && orderQuantityData[String(row.barcode)];
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? <span className="value-highlight-orange">{value}</span> : '-';
  }, [orderQuantityData]);

  // 🆕 창고재고 렌더링 (바코드별 재고 합계)
  const renderWarehouseStock = useCallback((row: TableRow) => {
    const barcode = String(row.barcode || '').trim();
    const value = barcode && warehouseStockData[barcode];
    const numValue = typeof value === 'number' ? value : 0;
    
    return numValue > 0 ? <span className="stock-warehouse">{numValue}</span> : '-';
  }, [warehouseStockData]);

  // 🆕 기간 열 데이터 렌더링 (쿠팡 판매량 데이터)
  const renderPeriodSales = useCallback((row: TableRow) => {
    const optionId = String(row.option_id);
    const sales = coupangSalesData[optionId];
    
    if (sales && sales > 0) {
      return <span className="product-list-highlight-blue-border">{sales}</span>;
    }
    return '-';
  }, [coupangSalesData]);

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

  // 🆕 쿠팡 판매량 데이터 로드
  const loadCoupangSalesData = async () => {
    try {
      const salesData = await fetchCoupangSalesData();
      setCoupangSalesData(salesData);
      console.log('✅ 쿠팡 판매량 데이터 로드 완료:', Object.keys(salesData).length, '개 항목');
    } catch (error) {
      console.error('❌ 쿠팡 판매량 데이터 로드 실패:', error);
    }
  };

  // 🆕 창고재고 데이터 로드 (stocks_management에서 바코드별 재고 합계)
  const loadWarehouseStockData = async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 창고재고 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      // 먼저 전체 개수 확인
      const { count, error: countError } = await supabase
        .from('stocks_management')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('barcode', 'is', null)
        .neq('barcode', '');

      if (countError) {
        console.error('❌ 창고재고 개수 조회 오류:', countError);
      }

      // 배치로 모든 데이터 가져오기
      let allStocksData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from('stocks_management')
          .select('barcode, stock')
          .eq('user_id', userId)
          .not('barcode', 'is', null)
          .neq('barcode', '')
          .range(offset, offset + batchSize - 1);

        if (batchError) {
          console.error('❌ 창고재고 배치 로드 오류:', batchError);
          throw batchError;
        }

        if (batchData && batchData.length > 0) {
          allStocksData = [...allStocksData, ...batchData];
          offset += batchSize;
          
          if (batchData.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // 데이터 로드 완료

      // 바코드별 재고 합계 계산
      const warehouseStockMap: {[key: string]: number} = {};
      
      if (allStocksData.length > 0) {
        allStocksData.forEach(item => {
          const barcode = item.barcode;
          const stock = parseInt(item.stock) || 0;
          
          if (barcode && barcode.trim()) {
            const cleanBarcode = barcode.trim();
            if (warehouseStockMap[cleanBarcode]) {
              warehouseStockMap[cleanBarcode] += stock;
            } else {
              warehouseStockMap[cleanBarcode] = stock;
            }
          }
        });
      }

      setWarehouseStockData(warehouseStockMap);
      
    } catch (error) {
      console.error('❌ 창고재고 데이터 로드 실패:', error);
    }
  };

  // 조회수 데이터 로드 (최근 5개 날짜)
  const loadViewsData = async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        console.error('❌ 조회수 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      // 최근 5개 날짜의 조회수 데이터 가져오기
      const result = await viewsService.getRecentViewsData(userId);
      console.log('API 응답:', result);
      
      if (result.success && result.data && result.data.length > 0) {
        // 날짜별로 item_id별 조회수 맵 배열 생성
        const viewsMaps: Array<{[key: string]: string}> = [];
        
        result.data.forEach((document: any, index: number) => {
          const viewsMap: {[key: string]: string} = {};
          console.log(`날짜 ${index + 1} (${document.date}):`, document.views?.length || 0, '개 데이터');
          
          if (document.views && Array.isArray(document.views)) {
            document.views.forEach((item: any) => {
              if (item.productId && item.productViews) {
                viewsMap[item.productId] = item.productViews;
              }
            });
          }
          viewsMaps.push(viewsMap);
        });
        
        setViewsDataByDate(viewsMaps);
        console.log('✅ 최근 5개 날짜 조회수 데이터 로드 완료');
        console.log('날짜 순서 (오래된것→최신):', result.data.map((d: any) => d.date));
        console.log('view1~view5 데이터:', viewsMaps);
        
        // 첫 번째 item_id로 테스트
        if (viewsMaps[0]) {
          const firstItemId = Object.keys(viewsMaps[0])[0];
          if (firstItemId) {
            console.log(`샘플 테스트 - item_id: ${firstItemId}, view1 값: ${viewsMaps[0][firstItemId]}`);
          }
        }
      } else {
        console.log('⚠️ 조회수 데이터가 없습니다.');
        setViewsDataByDate([]);
      }
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

      // 바코드 데이터 확인
      if (allProducts.length > 0) {
        const barcodeSample = allProducts.slice(0, 5).map(item => ({
          상품명: item.item_name,
          옵션명: item.option_name,
          바코드: item.barcode,
          바코드타입: typeof item.barcode
        }));
        console.log('🔍 [제품로드] 바코드 샘플 확인:', barcodeSample);
        
        // 바코드가 있는 제품 수 확인
        const productsWithBarcode = allProducts.filter(item => item.barcode && item.barcode.trim()).length;
        console.log(`📊 [제품로드] 바코드가 있는 제품: ${productsWithBarcode}/${allProducts.length}개`);
      }

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

  // 🛠️ 수정된 필터링 함수: 모든 필터 조건을 한 번에 적용
  const applyAllFilters = useCallback(() => {
    console.log('🔍 [디버깅] ===== 필터링 시작 =====');
    console.log('🔍 [디버깅] 원본 데이터 개수:', data.length);
    console.log('🔍 [디버깅] 적용된 검색어:', `"${appliedSearchKeyword}"`);
    console.log('🔍 [디버깅] 선택된 검색필터:', searchFilter);
    console.log('🔍 [디버깅] 선택된 노출상태:', selectedExposure);
    console.log('🔍 [디버깅] 선택된 판매상태:', selectedSaleStatus);
    console.log('🔍 [디버깅] 선택된 판매방식:', sortFilter);
    
    let filtered = [...data];
    
    // 1. 검색 키워드 필터링 (null/undefined 안전 처리)
    if (appliedSearchKeyword.trim()) {
      console.log('🔍 [디버깅] 검색 키워드 필터링 시작...');
      const beforeSearchCount = filtered.length;
      
      // 콤마, 줄바꿈, 공백으로 분리하여 여러개 검색어 처리
      const keywords = appliedSearchKeyword
        .split(/[,\n\s]+/) // 콤마, 줄바꿈, 공백으로 분리
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .slice(0, 100); // 최대 100개로 제한
      
      filtered = filtered.filter(item => {
        // 검색 필터에 따라 다른 필드에서 검색
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
    
    // 카테고리 필터링 제거됨 (검색필터로 대체)
    
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
    } else if (sortFilter === '사입보기') {
      // 사입보기 필터링은 아래쪽 함수에서 처리됨 (중복 제거)
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
    
    // 🆕 페이지 초기화 개선: 필터 변경 시 1페이지로 이동
    if (selectedExposure !== '전체' || selectedSaleStatus !== '전체' || sortFilter !== '전체' || appliedSearchKeyword.trim()) {
      setCurrentPage(1);
      console.log('🔍 [디버깅] 페이지를 1페이지로 초기화');
    }
  }, [data, searchFilter, selectedExposure, selectedSaleStatus, sortFilter, appliedSearchKeyword, rocketInventoryOptionIds]);

  // 🆕 검색 상태 보존 함수 - 더 이상 필요없음 (useEffect가 자동 처리)
  // const preserveSearchState = useCallback(() => {
  //   // useEffect에서 자동으로 필터링됨
  // }, []);

  // 🆕 검색 자동완성 제안 생성 함수
  const generateSearchSuggestions = useCallback((keyword: string) => {
    if (!keyword.trim() || keyword.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchTerm = keyword.toLowerCase().trim();
    const suggestions: Array<{type: 'product' | 'barcode', value: string, display: string}> = [];
    const seen = new Set<string>();

    // 상품명과 바코드에서 검색어와 일치하는 것들을 찾기
    data.forEach(item => {
      // 상품명 검색
      const productName = `${item.item_name || ''} ${item.option_name || ''}`.trim();
      if (productName.toLowerCase().includes(searchTerm)) {
        const key = `product:${productName}`;
        if (!seen.has(key) && suggestions.length < 10) {
          seen.add(key);
          suggestions.push({
            type: 'product',
            value: productName,
            display: productName
          });
        }
      }

      // 바코드 검색
      if (item.barcode && item.barcode.toLowerCase().includes(searchTerm)) {
        const key = `barcode:${item.barcode}`;
        if (!seen.has(key) && suggestions.length < 10) {
          seen.add(key);
          suggestions.push({
            type: 'barcode',
            value: item.barcode,
            display: `${item.barcode} (${item.item_name || '상품명 없음'})`
          });
        }
      }
    });

    setSearchSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
  }, [data]);

  // 🛠️ 검색어 입력 핸들러
  const handleSearchKeywordChange = useCallback((value: string) => {
    setSearchKeyword(value);
    generateSearchSuggestions(value);
  }, [generateSearchSuggestions]);

  // 🛠️ 검색 제안 선택 핸들러
  const handleSuggestionSelect = useCallback((suggestion: {type: 'product' | 'barcode', value: string, display: string}) => {
    setSearchKeyword(suggestion.value);
    setShowSuggestions(false);
    setAppliedSearchKeyword(suggestion.value); // 바로 검색 실행
    setCurrentPage(1);
  }, []);

  // 🛠️ 검색 함수 - appliedSearchKeyword 업데이트 후 applyAllFilters 호출
  const handleSearch = useCallback(() => {
    setAppliedSearchKeyword(searchKeyword); // 현재 입력된 검색어를 적용된 검색어로 설정
    setCurrentPage(1); // 검색 시 첫 페이지로 이동
    setShowSuggestions(false); // 제안 목록 숨김
    // appliedSearchKeyword가 변경되면 useEffect에서 applyAllFilters가 호출됨
  }, [searchKeyword]);

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

  // 전체 데이터 삭제 핸들러
  const handleDeleteAllData = async () => {
    const confirmMessage = '정말로 모든 상품 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // 현재 로그인한 사용자 ID 가져오기
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        alert('로그인 정보를 찾을 수 없습니다.');
        return;
      }

      // extract_coupang_item_all 테이블에서 해당 user_id 데이터 삭제
      const { error } = await supabase
        .from('extract_coupang_item_all')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('데이터 삭제 실패:', error);
        alert('데이터 삭제 중 오류가 발생했습니다.');
        return;
      }

      // 성공 시 로컬 상태 초기화
      setData([]);
      setFilteredData([]);
      setSelectedItems([]);
      setSelectAll(false);
      
      alert('모든 상품 데이터가 성공적으로 삭제되었습니다.');
      
      // 데이터 다시 로드 (빈 상태 확인)
      await loadProductsFromDB();
      
    } catch (error) {
      console.error('전체 삭제 실패:', error);
      alert('데이터 삭제 중 오류가 발생했습니다.');
    }
  };

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
          // 검색 상태는 useEffect에서 자동으로 보존됨
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
          // 검색 상태는 useEffect에서 자동으로 보존됨
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

  const handleSalesExcelUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsLoadingSalesExcel(true);
        try {
          const result = await processSalesExcelUpload(file, (stage, current, total) => {
            if (current !== undefined && total !== undefined) {
              setProductInfoProgress({ current, total, message: stage });
            }
          });
          
          if (result.success) {
            alert(`판매량 xlsx 업로드가 완료되었습니다.\n처리된 데이터: ${result.processedCount}개`);
            console.log('📊 판매량 엑셀 업로드 성공:', {
              파일명: file.name,
              처리된행수: result.processedCount,
              전체행수: result.totalRows
            });
          } else {
            throw new Error(result.error || '업로드 실패');
          }
        } catch (error) {
          console.error('판매량 엑셀 업로드 실패:', error);
          alert(`판매량 엑셀 업로드 중 오류가 발생했습니다.\n${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
          setIsLoadingSalesExcel(false);
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
      // 검색 상태는 useEffect에서 자동으로 보존됨
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
      // 검색 상태는 useEffect에서 자동으로 보존됨
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

  // Debouncing을 위한 ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (cellId: string, value: string, productInfo?: any) => {
    console.log('📝 [INPUT] 입력 변경:', { cellId, value, valueLength: value.length });
    
    // 즉시 상태 업데이트 (빠른 UI 반응)
    if (!value || value.trim() === '' || value === '0') {
      const newInputValues = { ...inputValues };
      delete newInputValues[cellId];
      setInputValues(newInputValues);
      
      console.log('🗑️ [INPUT] 빈 값 제거:', cellId);
    } else {
      // 상태에는 단순 값만 저장 (기존 로직 유지)
      const newInputValues = {
        ...inputValues,
        [cellId]: value
      };
      setInputValues(newInputValues);
    }

    // localStorage 저장은 debouncing 적용
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (!value || value.trim() === '' || value === '0') {
          // 빈 값 처리
          const currentValues = JSON.parse(localStorage.getItem('productInputValues') || '{}');
          delete currentValues[cellId];
          
          if (Object.keys(currentValues).length === 0) {
            localStorage.removeItem('productInputValues');
            console.log('🗑️ [INPUT-DEBOUNCED] localStorage 완전 초기화');
          } else {
            localStorage.setItem('productInputValues', JSON.stringify(currentValues));
            console.log('💾 [INPUT-DEBOUNCED] localStorage 업데이트 (항목 제거)');
          }
        } else {
          // 값 저장 - 상품 정보도 함께 저장
          const currentValues = JSON.parse(localStorage.getItem('productInputValues') || '{}');
          
          // 상품 정보가 있으면 함께 저장
          if (productInfo) {
            currentValues[cellId] = {
              quantity: value,
              item_name: productInfo.product_name || productInfo.item_name || productInfo.product_title,
              option_name: productInfo.option_name || '',
              barcode: productInfo.barcode || '',
              option_id: productInfo.option_id,
              item_id: productInfo.item_id
            };
          } else {
            // 상품 정보가 없으면 기존 방식 유지
            currentValues[cellId] = value;
          }
          
          localStorage.setItem('productInputValues', JSON.stringify(currentValues));
          console.log('💾 [INPUT-DEBOUNCED] localStorage 업데이트 (값 저장):', { 
            totalItems: Object.keys(currentValues).length 
          });
        }
      } catch (error) {
        console.error('❌ [INPUT-DEBOUNCED] localStorage 업데이트 실패:', error);
      }
    }, 300); // 300ms debouncing
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

  // 🆕 Enter 키 입력 시 다음 셀로 이동 (메모리에만 저장)
  const handleEnterKeyAndSave = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>, row: TableRow, cellId: string, currentRowIndex: number) => {
    if (e.key === 'Enter') {
      // 다음 행으로 이동만 (DB 저장 안함)
      handleInputKeyPress(e, currentRowIndex);
    }
  }, [handleInputKeyPress]);

  // 🆕 Blur 시 메모리에만 저장 (DB 저장 안함)
  const handleBlurAndSave = useCallback(async (row: TableRow, cellId: string) => {
    setEditingCell(null);
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
    loadProductsFromDB();
    loadRocketInventoryOptionIds();
    loadItemViewsData();
    // 🆕 사입상태 데이터 로드 추가
    loadOrderQuantityData();
    // 🆕 쿠팡 판매량 데이터 로드 추가
    loadCoupangSalesData();
    // 🆕 창고재고 데이터 로드 추가
    loadWarehouseStockData();
    // 🆕 조회수 데이터 로드 추가
    loadViewsData();
    
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
          const optionId = String(item.option_id);
          const periodSales = coupangSalesData[optionId] || 0;
          return periodSales > 0;
        }
      });
    }
    
    // console.log('🔍 [디버깅] 필터링 완료:', filtered.length + '개');
    setFilteredData(filtered);
    
    // 페이지 초기화
    if (selectedExposure !== '전체' || selectedSaleStatus !== '전체' || sortFilter !== '전체' || appliedSearchKeyword.trim()) {
      setCurrentPage(1);
      // console.log('🔍 [디버깅] 페이지를 1페이지로 초기화');
    }
  }, [data, searchFilter, selectedExposure, selectedSaleStatus, sortFilter, appliedSearchKeyword, rocketInventoryOptionIds]);

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

      {/* 버튼들 - 카드 위쪽 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* 왼쪽: API 버튼들 */}
        <div style={{ display: 'flex', gap: '12px' }}>
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
        </div>
        
        {/* 오른쪽: 액션 버튼들 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleDeleteAllData}
            className="product-list-button product-list-button-danger"
          >
            전체삭제
          </button>
          
          <button
            onClick={handleExcelUpload}
            disabled={isLoadingApi}
            className="product-list-button product-list-button-success"
          >
            {isLoadingApi ? '업로드 중...' : '상품등록 xlsx'}
          </button>
          
          <button
            onClick={handleSalesExcelUpload}
            disabled={isLoadingSalesExcel}
            className="product-list-button product-list-button-success"
          >
            {isLoadingSalesExcel ? '업로드 중...' : '판매량 xlsx'}
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

      {/* 통계 카드 섹션 */}
      <div className="product-list-stats-section">
        <div className="product-list-stats-grid">
          <DashboardStatsCard title="전체" value={stats.total} color="default" />
          <DashboardStatsCard title="아이템파너 아님" value={stats.notItemPartner} hasInfo={true} subtitle="쿠팡 배송 성장 20% 상품 中" color="orange" />
          <DashboardStatsCard title="품절" value={stats.outOfStock} color="red" />
          <DashboardStatsCard title="승인반려" value={stats.rejected} hasInfo={true} color="red" />
          <DashboardStatsCard title="판매중" value={stats.selling} color="blue" />
          <DashboardStatsCard title="임시저장" value={stats.tempSave} color="default" />
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
              <option value="사입보기">사입보기</option>
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

          {/* 검색필터 */}
          <div>
            <label className="product-list-label">검색필터</label>
            <select 
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="product-list-select"
            >
              <option value="상품명">상품명</option>
              <option value="옵션id">옵션id</option>
              <option value="바코드">바코드</option>
            </select>
          </div>

          {/* 검색창 */}
          <div className="product-list-search-container" style={{ position: 'relative' }}>
            <label className="product-list-label">검색</label>
            <div className="product-list-search-wrapper">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => handleSearchKeywordChange(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => searchKeyword.length >= 2 && setShowSuggestions(searchSuggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // 지연으로 클릭 이벤트 허용
                placeholder="콤마, 공백, 줄바꿈으로 여러개 검색 가능 (최대 100개)"
                className="product-list-search-input"
              />
              <button 
                onClick={handleSearch}
                className="product-list-search-button"
              >
                🔍
              </button>
              
              {/* 검색 자동완성 드롭다운 */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}
                >
                  {searchSuggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.type}-${index}`}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: index < searchSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '14px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '12px',
                          marginRight: '8px',
                          backgroundColor: suggestion.type === 'product' ? '#dbeafe' : '#fef3c7',
                          color: suggestion.type === 'product' ? '#1e40af' : '#92400e'
                        }}
                      >
                        {suggestion.type === 'product' ? '상품' : '바코드'}
                      </span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {suggestion.display}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
                console.log('🔍 [진단] 현재 상태 확인:');
                console.log('inputValues:', inputValues);
                console.log('localStorage:', localStorage.getItem('productInputValues'));
                console.log('테이블 input 필드들:', document.querySelectorAll('input[type="number"]').length);
                
                // 실제 input 필드 값들 확인
                const inputFields = Array.from(document.querySelectorAll('input[type="number"]'));
                const fieldValues = inputFields.map(input => ({
                  id: input.getAttribute('data-cell-id') || 'unknown',
                  value: (input as HTMLInputElement).value
                }));
                console.log('실제 input 필드 값들:', fieldValues.filter(f => f.value));
                
                alert(`진단 결과:\n- inputValues 개수: ${Object.keys(inputValues).length}\n- localStorage 있음: ${!!localStorage.getItem('productInputValues')}\n- 입력 필드 개수: ${inputFields.length}\n- 값 있는 필드: ${fieldValues.filter(f => f.value).length}`);
              }}
              className="product-list-button product-list-button-secondary"
              style={{ marginRight: '8px' }}
            >
              진단
            </button>
            <button
              onClick={handleBatchOrderSubmission}
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
                        value={getInputValue(`input-${row.item_id}-${row.option_id || index}`)}
                        onChange={(e) => handleInputChange(`input-${row.item_id}-${row.option_id || index}`, e.target.value, row)}
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
                  <td className="product-list-table-cell">
                    {/* 🆕 기간 열: 쿠팡 판매량 데이터 표시 */}
                    {renderPeriodSales(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {render7DaysSales(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {render30DaysSales(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {renderRecommendedQuantity(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {/* 🆕 창고재고: 바코드별 재고 합계 표시 */}
                    {renderWarehouseStock(row)}
                  </td>
                  <td className="product-list-table-cell">
                    {renderStorageFee(row)}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(viewsDataByDate[0]?.[row.item_id], undefined, true) }}>
                    {/* 🔄 view1: 가장 오래된 날짜 데이터 */}
                    {viewsDataByDate[0]?.[row.item_id] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(viewsDataByDate[1]?.[row.item_id], viewsDataByDate[0]?.[row.item_id], false) }}>
                    {/* 🔄 view2: view1과 비교 */}
                    {viewsDataByDate[1]?.[row.item_id] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(viewsDataByDate[2]?.[row.item_id], viewsDataByDate[1]?.[row.item_id], false) }}>
                    {/* 🔄 view3: view2와 비교 */}
                    {viewsDataByDate[2]?.[row.item_id] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(viewsDataByDate[3]?.[row.item_id], viewsDataByDate[2]?.[row.item_id], false) }}>
                    {/* 🔄 view4: view3과 비교 */}
                    {viewsDataByDate[3]?.[row.item_id] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(viewsDataByDate[4]?.[row.item_id], viewsDataByDate[3]?.[row.item_id], false) }}>
                    {/* 🔄 view5: view4와 비교 (가장 최근 날짜) */}
                    {viewsDataByDate[4]?.[row.item_id] || '-'}
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