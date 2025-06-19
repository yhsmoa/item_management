import React, { useState, useEffect, useRef } from 'react';
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
  

  // 통계 계산
  const stats: Stats = {
    total: data.length,
    notItemPartner: data.filter(item => !item.is_item_partner).length,
    outOfStock: data.filter(item => item.sales_status === 'OUTOFSTOCK').length,
    rejected: data.filter(item => item.status === 'REJECT').length,
    selling: data.filter(item => item.sales_status === 'ONSALE').length,
    tempSave: data.filter(item => item.status === 'TEMP_SAVE').length
  };

  // 로켓재고 데이터 로드 (옵션 ID와 관련 데이터)
  const loadRocketInventoryOptionIds = async () => {
    try {
      console.log('🔍 coupang_rocket_inventory 테이블에서 데이터 로딩 중...');
      
      // 먼저 총 개수 확인
      const { count: totalCount, error: countError } = await supabase
        .from('coupang_rocket_inventory')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ coupang_rocket_inventory 개수 조회 오류:', countError);
      } else {
        console.log('📊 coupang_rocket_inventory 총 데이터 개수:', totalCount);
      }
      
      // 모든 데이터를 배치로 로딩 (개수 제한 없이)
      let allRocketData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        console.log(`🔄 로켓 인벤토리 배치 ${Math.floor(offset / batchSize) + 1} 로딩 중... (${offset}부터 ${offset + batchSize - 1}까지)`);
        
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
          console.log(`✅ 로켓 인벤토리 배치 ${Math.floor(offset / batchSize) + 1} 완료: ${batchData.length}개 로드, 총 ${allRocketData.length}개`);
          
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
      
      // orderable_quantity가 0인 데이터 확인
      const zeroOrderableCount = rocketData.filter(item => (item.orderable_quantity || 0) === 0).length;
      console.log('📊 orderable_quantity가 0인 데이터:', zeroOrderableCount, '개');
      
      console.log('✅ 로켓재고 데이터 로드 완료:', rocketData?.length, '개 (고유 option_id:', optionIds.size, '개)');
    } catch (error) {
      console.error('❌ 로켓재고 데이터 로드 실패:', error);
    }
  };

  // 조회수 데이터 로드
  const loadItemViewsData = async () => {
    try {
      console.log('🔍 조회수 데이터 로딩 중...');
      
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

      console.log('✅ 조회수 데이터 로드 완료:', viewsData?.length, '개');

      // item_id별로 최근 5개의 날짜를 그룹화
      const viewsMap: {[key: string]: string[]} = {};
      
      // 테이블의 실제 컬럼들을 확인
      const sampleRecord = viewsData?.[0];
      const allColumns = sampleRecord ? Object.keys(sampleRecord) : [];
      
      console.log('🔍 사용 가능한 컬럼:', allColumns);
      
      // item_id 컬럼 확인
      const itemIdColumn = 'item_id';
      
      // 날짜 컬럼들 찾기 (240708, 240715 같은 YYMMDD 형식의 컬럼들)
      const dateColumns = allColumns.filter(col => 
        /^24\d{4}$/.test(col) || // 240708 형식
        /^\d{6}$/.test(col) ||   // 일반적인 YYMMDD 형식
        ['yymmdd', 'YYMMDD', 'date', 'view_date'].includes(col)
      );
      
      console.log(`📅 발견된 날짜 컬럼들:`, dateColumns);
      console.log(`📅 사용할 item_id 컬럼: ${itemIdColumn}`);
      
      
      
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
      
      console.log('🧪 생성된 테스트 데이터:', mockViewsData);
      
      // 실제 데이터가 없으면 테스트 데이터 사용, 있으면 실제 데이터 우선
      const finalData = Object.keys(viewsMap).length > 0 ? viewsMap : mockViewsData;
      
      setItemViewsData(finalData);
      console.log('✅ 조회수 데이터 그룹화 완료:', Object.keys(viewsMap).length, '개 상품 (실제 데이터)');
      console.log('🧪 최종 사용 데이터:', Object.keys(finalData).length, '개 상품');
      console.log('🔍 최종 데이터 샘플:', Object.keys(finalData).slice(0, 3).reduce((acc, key) => {
        acc[key] = finalData[key];
        return acc;
      }, {} as {[key: string]: string[]}));
      
      
      
    } catch (error) {
      console.error('❌ 조회수 데이터 로드 실패:', error);
    }
  };

  // 날짜를 YYMMDD 형식으로 변환하는 헬퍼 함수
  const formatDateToYYMMDD = (date: Date): string => {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  };

  // 조회수 비교 색상 결정 함수
  const getViewCountColor = (current: string | undefined, previous: string | undefined): string => {
    if (!current || !previous || current === '-' || previous === '-') return '#000000'; // 기본 검은색
    
    // 콤마 제거 후 숫자 변환
    const currentClean = String(current).replace(/,/g, '');
    const previousClean = String(previous).replace(/,/g, '');
    
    const currentNum = parseInt(currentClean);
    const previousNum = parseInt(previousClean);
    
    if (isNaN(currentNum) || isNaN(previousNum)) return '#000000';
    
    const diff = currentNum - previousNum;
    
    if (Math.abs(diff) <= 10) {
      return '#000000'; // 오차범위 ±10 내외 - 검은색
    } else if (diff > 0) {
      return '#0066cc'; // 증가 - 파란색
    } else {
      return '#cc0000'; // 감소 - 빨간색
    }
  };

  // 에러 메시지 상태 추가
  const [hasShownError, setHasShownError] = useState(false);

  // 상품 데이터 로드 - extract_coupang_item_all 테이블에서 가져오기
  const loadProductsFromDB = async () => {
    setIsLoadingProducts(true);
    try {
      console.log('🔍 extract_coupang_item_all 테이블에서 데이터 로딩 중...');
      
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
      } else {
        console.log('📊 사용자별 데이터 개수:', count);
      }

      // 사용자 데이터만 가져오기 위해 배치로 처리
      let allProducts: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        console.log(`🔄 배치 ${Math.floor(offset / batchSize) + 1} 로딩 중... (${offset}부터 ${offset + batchSize - 1}까지)`);
        
        const { data: batchData, error: batchError } = await supabase
          .from('extract_coupang_item_all')
          .select('*')
          .eq('user_id', userId)
          .order('item_id', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (batchError) {
          console.error('❌ 배치 로드 오류:', batchError);
          throw batchError;
        }

        if (batchData && batchData.length > 0) {
          allProducts = [...allProducts, ...batchData];
          console.log(`✅ 배치 ${Math.floor(offset / batchSize) + 1} 완료: ${batchData.length}개 로드, 총 ${allProducts.length}개`);
          
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

      const products = allProducts;
      const error = null;

      if (error) {
        console.error('❌ Supabase 쿼리 오류:', error);
        throw error;
      }
      
      console.log('✅ 데이터 로드 성공:', products?.length, '개 상품');
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

  // 데이터를 테이블 행으로 변환 - extract_coupang_item_all 테이블 구조에 맞게 수정
  const transformDataToTableRows = (data: any[]): TableRow[] => {
    const rows: TableRow[] = [];
    let rocketGrowthCount = 0;
    let normalSaleCount = 0;
    
    data.forEach((item) => {
      // 상품명 생성: item_name + 줄바꿈 + option_name
      const displayName = item.item_name + (item.option_name ? '\n' + item.option_name : '');
      
      // 필터링 적용 (item_name 기준으로 검색)
      if (searchKeyword && !item.item_name?.toLowerCase().includes(searchKeyword.toLowerCase()) && 
          !item.option_name?.toLowerCase().includes(searchKeyword.toLowerCase())) {
        return;
      }
      
      if (selectedCategory !== '전체' && item.category !== selectedCategory) {
        return;
      }
      
      if (selectedExposure !== '전체' && item.status !== selectedExposure) {
        return;
      }
      
      if (selectedSaleStatus !== '전체' && item.sales_status !== selectedSaleStatus) {
        return;
      }

      // 판매방식 결정
      const isRocketGrowth = rocketInventoryOptionIds.has(String(item.option_id));
      
      // 판매방식 필터링
      if (sortFilter === '일반판매') {
        // option_id가 로켓재고에 없는 것만
        if (isRocketGrowth) {
          return;
        }
        normalSaleCount++;
      } else if (sortFilter === '로켓그로스') {
        // option_id가 로켓재고에 있는 것만
        if (!isRocketGrowth) {
          return;
        }
        rocketGrowthCount++;
      } else {
        // 전체 선택 시
        if (isRocketGrowth) {
          rocketGrowthCount++;
        } else {
          normalSaleCount++;
        }
      }
      
      // 테이블 행 추가
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
        brand: item.brand || '브랜드 없음'
      });
    });

    // 디버깅 로그 추가
    if (sortFilter === '로켓그로스') {
      console.log(`🔍 로켓그로스 필터링 결과: ${rocketGrowthCount}개 상품 (총 로켓재고 option_id: ${rocketInventoryOptionIds.size}개)`);
    } else if (sortFilter === '일반판매') {
      console.log(`🔍 일반판매 필터링 결과: ${normalSaleCount}개 상품`);
    } else {
      console.log(`🔍 전체 필터링 결과: 로켓그로스 ${rocketGrowthCount}개, 일반판매 ${normalSaleCount}개 (총 ${rows.length}개)`);
    }

    return rows;
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setFilteredData(data);
    } else {
      const filtered = data.filter(item => {
        return item.item_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
               item.option_name?.toLowerCase().includes(searchKeyword.toLowerCase());
      });
      setFilteredData(filtered);
    }
    setCurrentPage(1); // 검색 시 항상 1페이지로 이동
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      const itemRows = transformDataToTableRows(data).filter(row => row.type === 'item');
      setSelectedItems(itemRows.map(row => row.item_id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectItem = (uniqueId: string) => {
    if (selectedItems.includes(uniqueId)) {
      setSelectedItems(selectedItems.filter(id => id !== uniqueId));
      setSelectAll(false);
    } else {
      setSelectedItems([...selectedItems, uniqueId]);
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

  const handleImageMouseEnter = (imageUrl: string, event: React.MouseEvent) => {
    setHoveredImage({
      url: imageUrl,
      x: event.clientX + 10,
      y: event.clientY + 10
    });
  };

  const handleImageMouseLeave = () => {
    setHoveredImage(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getCurrentPageData = () => {
    const tableRows = transformDataToTableRows(filteredData);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return tableRows.slice(startIndex, endIndex);
  };

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

  const handleInputBlur = () => {
    setEditingCell(null);
  };

  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, currentRowIndex: number) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
      // 다음 행의 입력 셀로 이동
      const nextRowIndex = currentRowIndex + 1;
      if (nextRowIndex < currentData.length) {
        const nextRow = currentData[nextRowIndex];
        const nextCellId = `input-${nextRow.item_id}-${nextRow.option_id || nextRowIndex}`;
        setTimeout(() => {
          setEditingCell(nextCellId);
        }, 100);
      }
    }
  };

  // 상품명 클릭 시 쿠팡 링크로 이동
  const handleProductNameClick = (productId: string, optionId?: string) => {
    if (productId && optionId) {
      const coupangUrl = `https://www.coupang.com/vp/products/${productId}?vendorItemId=${optionId}`;
      window.open(coupangUrl, '_blank');
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  // 데이터 정렬 함수
  const sortProductsByViewsData = (products: any[]) => {
    return products.sort((a, b) => {
      const aHasViews = itemViewsData[String(a.item_id)] && itemViewsData[String(a.item_id)].length > 0;
      const bHasViews = itemViewsData[String(b.item_id)] && itemViewsData[String(b.item_id)].length > 0;
      
      if (aHasViews && !bHasViews) return -1;  // a가 먼저
      if (!aHasViews && bHasViews) return 1;   // b가 먼저
      return 0; // 동일
    });
  };

  useEffect(() => {
    loadProductsFromDB();
    loadRocketInventoryOptionIds();
    loadItemViewsData();
  }, []);

  // 조회수 데이터가 로드된 후 상품 데이터 재정렬
  useEffect(() => {
    if (Object.keys(itemViewsData).length > 0 && data.length > 0) {
      const sortedData = sortProductsByViewsData([...data]);
      setData(sortedData);
      setFilteredData(sortedData);
    }
  }, [itemViewsData, data.length]);

  const totalPages = Math.ceil(transformDataToTableRows(filteredData).length / itemsPerPage);
  const currentData = getCurrentPageData();

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
              총 {transformDataToTableRows(filteredData).length}개 상품
            </div>
            <div className="product-list-selected-info">
              선택된 상품: {selectedItems.length}개 / 총 {transformDataToTableRows(filteredData).filter(row => row.type === 'item').length}개
            </div>
          </div>
          
          <div className="product-list-action-buttons">
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
          <table className="product-list-table">
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
                return (
                <tr 
                  key={`${row.item_id}-${row.option_id || index}`}
                  className={`product-list-table-row ${row.type === 'item' ? 'product-list-table-row-item' : 'product-list-table-row-option'} ${isEditing ? 'editing-active' : ''}`}
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
                        onBlur={handleInputBlur}
                        onKeyPress={(e) => handleInputKeyPress(e, index)}
                        autoFocus
                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center' }}
                      />
                    ) : (
                      inputValues[`input-${row.item_id}-${row.option_id || index}`] || '-'
                    )}
                  </td>
                  <td className="product-list-table-cell">
                    {row.option_id && rocketInventoryData[row.option_id]?.pending_inbounds || '-'}
                  </td>
                  <td className="product-list-table-cell">
                    {row.option_id && rocketInventoryData[row.option_id]?.orderable_quantity || row.stock || 0}
                  </td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">
                    {row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_7_days || '-'}
                  </td>
                  <td className="product-list-table-cell">
                    {row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_30_days || '-'}
                  </td>
                  <td className="product-list-table-cell">
                    {row.option_id && rocketInventoryData[row.option_id]?.recommanded_inboundquantity || '-'}
                  </td>
                  <td className="product-list-table-cell">-</td>
                  <td className="product-list-table-cell">
                    {row.option_id && rocketInventoryData[row.option_id]?.monthly_storage_fee || '-'}
                  </td>
                  <td className="product-list-table-cell">
                    {itemViewsData[row.item_id]?.[0] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[1], itemViewsData[row.item_id]?.[0]) }}>
                    {itemViewsData[row.item_id]?.[1] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[2], itemViewsData[row.item_id]?.[1]) }}>
                    {itemViewsData[row.item_id]?.[2] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[3], itemViewsData[row.item_id]?.[2]) }}>
                    {itemViewsData[row.item_id]?.[3] || '-'}
                  </td>
                  <td className="product-list-table-cell" style={{ color: getViewCountColor(itemViewsData[row.item_id]?.[4], itemViewsData[row.item_id]?.[3]) }}>
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
          {transformDataToTableRows(filteredData).length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, transformDataToTableRows(filteredData).length)}개 표시
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