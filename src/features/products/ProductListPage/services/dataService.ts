// Data service for database operations
import { supabase } from '../../../../config/supabase';
import { fetchCoupangSalesData } from '../../../../services/coupangSalesService';
import { viewsService } from '../../../../services/viewsService';
import { formatDateToYYMMDD, formatDateToMMDD } from '../utils/dateUtils';

export const loadRocketInventoryOptionIds = async (): Promise<{
  optionIds: Set<string>;
  rocketData: {[key: string]: any};
}> => {
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
    
    // orderable_quantity가 0인 데이터 확인 (통계용 - 로그는 제거)
    const zeroOrderableCount = rocketData.filter(item => (item.orderable_quantity || 0) === 0).length;
    
    return { optionIds, rocketData: dataMap };
  } catch (error) {
    console.error('❌ 로켓재고 데이터 로드 실패:', error);
    return { optionIds: new Set(), rocketData: {} };
  }
};

export const loadOrderQuantityData = async (): Promise<{[key: string]: number}> => {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;
    
    if (!userId) {
      console.error('❌ 사입상태 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
      return {};
    }

    // chinaorder_googlesheet 테이블에서 데이터 로드 (order_qty가 올바른 컬럼명)
    const { data: orderData, error } = await supabase
      .from('chinaorder_googlesheet')
      .select('barcode, order_qty')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ 사입상태 데이터 로드 오류:', error);
      return {};
    }

    // 바코드별로 order_quantity 합계 계산
    const quantityMap: {[key: string]: number} = {};
    
    orderData?.forEach((order: any) => {
      const barcode = String(order.barcode || '').trim();
      const quantity = parseInt(order.order_qty) || 0;
      
      if (barcode && quantity > 0) {
        quantityMap[barcode] = (quantityMap[barcode] || 0) + quantity;
      }
    });

    return quantityMap;
  } catch (error) {
    console.error('❌ 사입상태 데이터 로드 실패:', error);
    return {};
  }
};

export const loadCoupangSalesData = async (): Promise<{[key: string]: any}> => {
  try {
    const salesData = await fetchCoupangSalesData();
    console.log('✅ 쿠팡 판매량 데이터 로드 완료:', Object.keys(salesData).length, '개 항목');
    return salesData;
  } catch (error) {
    console.error('❌ 쿠팡 판매량 데이터 로드 실패:', error);
    return {};
  }
};

export const loadWarehouseStockData = async (): Promise<{[key: string]: number}> => {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;
    
    if (!userId) {
      console.error('❌ 창고재고 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
      return {};
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

    return warehouseStockMap;
  } catch (error) {
    console.error('❌ 창고재고 데이터 로드 실패:', error);
    return {};
  }
};

export const loadViewsData = async (): Promise<Array<{[key: string]: string}>> => {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;
    
    if (!userId) {
      console.error('❌ 조회수 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
      return [];
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

      return viewsMaps;
    } else {
      console.log('⚠️ 조회수 데이터가 없습니다.');
      return [];
    }
  } catch (error) {
    console.error('❌ 조회수 데이터 로드 실패:', error);
    return [];
  }
};

export const loadPurchaseStatusData = async (): Promise<{[key: string]: number}> => {
  try {
    console.log('🔄 사입상태 데이터 로딩 시작...');
    
    // 현재 로그인한 사용자 ID 가져오기
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;
    
    if (!userId) {
      console.error('❌ 사입상태 데이터 로드: 사용자 ID를 찾을 수 없습니다.');
      return {};
    }
    
    // chinaorder_googlesheet 테이블에서 barcode별로 order_status_ordering + order_status_shipment 합계 계산
    const { data, error } = await supabase
      .from('chinaorder_googlesheet')
      .select('barcode, order_status_ordering, order_status_shipment')
      .eq('user_id', userId);
    
    if (error) {
      console.error('❌ 사입상태 데이터 로드 실패:', error);
      return {};
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ 사입상태 데이터가 없습니다.');
      return {};
    }
    
    // barcode별로 order_status_ordering + order_status_shipment 합계 계산
    const purchaseStatusMap: {[key: string]: number} = {};
    
    data.forEach((item: any) => {
      if (item.barcode) {
        const ordering = parseInt(item.order_status_ordering) || 0;
        const shipment = parseInt(item.order_status_shipment) || 0;
        const total = ordering + shipment;
        
        if (purchaseStatusMap[item.barcode]) {
          purchaseStatusMap[item.barcode] += total;
        } else {
          purchaseStatusMap[item.barcode] = total;
        }
      }
    });
    
    console.log(`✅ 사입상태 데이터 로드 완료: ${Object.keys(purchaseStatusMap).length}개 바코드`);
    return purchaseStatusMap;
    
  } catch (error) {
    console.error('❌ 사입상태 데이터 로드 실패:', error);
    return {};
  }
};

export const loadItemViewsData = async (data: any[]): Promise<{[key: string]: string[]}> => {
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
    
    return finalData;
  } catch (error) {
    console.error('❌ 조회수 데이터 로드 실패:', error);
    return {};
  }
};

export const loadProductsFromDB = async (): Promise<{
  products: any[];
  error: any;
}> => {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;
    
    if (!userId) {
      console.error('❌ 사용자 ID를 찾을 수 없습니다.');
      throw new Error('로그인이 필요합니다.');
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

    return { products: allProducts, error: null };
  } catch (error) {
    console.error('❌ 상품 로드 실패:', error);
    return { products: [], error };
  }
};