import { supabase } from '../config/supabase';
import { fetchCoupangProducts, CoupangApiResponse, CoupangProduct, fetchCoupangProductDetail, CoupangProductDetailResponse, generateHmacSignature } from '../utils/coupangApi';
import { getCurrentUserId } from './authService';

// 🛠️ 3단계 최적화: API 호출 캐싱 메커니즘
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // 캐시 만료 시간 (ms)
}

// 🛠️ 캐시 스토리지 (메모리 기반)
const cacheStorage = new Map<string, CacheEntry<any>>();

// 🛠️ 캐시 설정
const CACHE_CONFIG = {
  PRODUCT_DETAIL_TTL: 5 * 60 * 1000, // 상품 상세 정보 5분 캐시
  ITEM_IDS_TTL: 10 * 60 * 1000,      // 아이템 ID 목록 10분 캐시
  MAX_CACHE_SIZE: 1000,              // 최대 캐시 항목 수
  CLEANUP_INTERVAL: 30 * 60 * 1000   // 30분마다 캐시 정리
};

// 🛠️ 캐시 유틸리티 함수들
function getCacheKey(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  // 캐시 크기 제한 체크
  if (cacheStorage.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
    clearExpiredCache();
  }
  
  cacheStorage.set(key, {
    data,
    timestamp: Date.now(),
    expiresIn: ttl
  });
}

function getCache<T>(key: string): T | null {
  const entry = cacheStorage.get(key);
  if (!entry) return null;
  
  // 만료 체크
  if (Date.now() - entry.timestamp > entry.expiresIn) {
    cacheStorage.delete(key);
    return null;
  }
  
  return entry.data;
}

function clearExpiredCache(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];
  
  // TypeScript 호환성을 위해 Array.from() 사용
  Array.from(cacheStorage.entries()).forEach(([key, entry]) => {
    if (now - entry.timestamp > entry.expiresIn) {
      expiredKeys.push(key);
    }
  });
  
  expiredKeys.forEach(key => cacheStorage.delete(key));
  console.log(`🧹 캐시 정리 완료: ${expiredKeys.length}개 만료된 항목 제거`);
}

// 🛠️ 주기적 캐시 정리
setInterval(clearExpiredCache, CACHE_CONFIG.CLEANUP_INTERVAL);

/**
 * 쿠팡 아이템 데이터 타입
 */
export interface CoupangItem {
  user_id: string;
  item_id: string;
}

/**
 * 쿠팡 상품 상세 정보 데이터 타입 (extract_coupang_item_info 테이블용)
 */
export interface CoupangItemInfo {
  option_id: string;      // vendorItemId
  item_id: string;        // 검색한 sellerProductId
  barcode: string;        // barcode
  price: string;          // salePrice
  item_name: string;      // sellerProductName
  option_name: string;    // itemName
  item_image_url: string; // cdnPath or vendorPath
  user_id?: string;       // 사용자 ID
}

/**
 * 진행상황 콜백 함수 타입
 */
export interface BulkImportProgress {
  currentPage: number;
  totalProcessed: number;
  currentBatch: CoupangProduct[];
  isComplete: boolean;
  error?: string;
}

/**
 * 쿠팡 이미지 URL을 완전한 접근 가능한 URL로 변환
 */
function convertCoupangImageUrl(cdnPath: string, vendorPath?: string): string {
  // 빈 값이면 빈 문자열 반환
  if (!cdnPath && !vendorPath) {
    return '';
  }

  // 우선순위: cdnPath > vendorPath
  const imagePath = cdnPath || vendorPath || '';
  
  // 이미 완전한 URL인 경우 그대로 반환
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 작동하는 것으로 확인된 쿠팡 CDN URL 패턴들 (image6, image7 우선)
  const coupangCdnBases = [
    'https://image6.coupangcdn.com/image/',      // 3번 - 작동 확인됨
    'https://image7.coupangcdn.com/image/',      // 4번 - 작동 확인됨
    'https://image8.coupangcdn.com/image/',
    'https://image9.coupangcdn.com/image/',
    'https://thumbnail6.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail7.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail8.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail9.coupangcdn.com/thumbnails/remote/'
  ];

  // vendor_inventory/ 경로 또는 기타 모든 경로 처리
  // 작동하는 것으로 확인된 첫 번째 패턴(image6) 사용
  return `${coupangCdnBases[0]}${imagePath}`;
}

/**
 * 여러 쿠팡 CDN URL 시도해서 접근 가능한 URL 찾기
 */
async function findAccessibleImageUrl(imagePath: string): Promise<string> {
  if (!imagePath) return '';
  
  // 이미 완전한 URL인 경우
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 작동하는 것으로 확인된 순서로 정렬
  const coupangCdnBases = [
    'https://image6.coupangcdn.com/image/',      // 작동 확인됨
    'https://image7.coupangcdn.com/image/',      // 작동 확인됨
    'https://image8.coupangcdn.com/image/',
    'https://image9.coupangcdn.com/image/',
    'https://thumbnail6.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail7.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail8.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail9.coupangcdn.com/thumbnails/remote/'
  ];

  for (const baseUrl of coupangCdnBases) {
    const testUrl = `${baseUrl}${imagePath}`;
    
    try {
      // HEAD 요청으로 이미지 접근 가능한지 확인 (실제로는 CORS 때문에 실패할 수 있음)
      const response = await fetch(testUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ 접근 가능한 이미지 URL 발견: ${testUrl}`);
        return testUrl;
      }
    } catch (error) {
      // 무시하고 다음 URL 시도
      continue;
    }
  }

  // 모든 시도가 실패하면 첫 번째 기본 URL (image6) 반환
  console.log(`⚠️ 접근 가능한 이미지 URL을 찾지 못함. 기본 URL 사용: ${imagePath}`);
  return `${coupangCdnBases[0]}${imagePath}`;
}

/**
 * 쿠팡 아이템을 supabase의 extract-coupang-item-id 테이블에 저장
 */
export async function saveCoupangItem(itemId: string, itemName: string = ''): Promise<boolean> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.error('❌ 로그인한 사용자 ID가 없습니다.');
      return false;
    }
    
    const newItem: CoupangItem = {
      user_id: userId,
      item_id: itemId
    };

    // upsert를 사용하여 중복 시 업데이트, 없으면 삽입
    const { error } = await supabase
      .from('extract-coupang-item-id')
      .upsert([newItem], { 
        onConflict: 'item_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('쿠팡 아이템 저장 오류:', error);
      return false;
    }

    console.log('✅ 쿠팡 아이템 저장 성공:', newItem);
    return true;
  } catch (error) {
    console.error('쿠팡 아이템 저장 예외:', error);
    return false;
  }
}

/**
 * 여러 쿠팡 아이템을 한번에 저장 (중복 검사 후 새로운 것만 삽입)
 */
export async function saveCoupangItems(itemIds: string[]): Promise<boolean> {
  try {
    if (itemIds.length === 0) {
      console.log('✅ 저장할 아이템이 없습니다.');
      return true;
    }

    // 1. 기존 데이터베이스에서 이미 존재하는 item_id들 조회
    const { data: existingItems, error: selectError } = await supabase
      .from('extract-coupang-item-id')
      .select('item_id')
      .in('item_id', itemIds);

    if (selectError) {
      console.error('기존 데이터 조회 오류:', selectError);
      return false;
    }

    // 2. 이미 존재하는 item_id들 목록 생성 (문자열로 통일)
    const existingItemIds = existingItems?.map((item: any) => String(item.item_id)) || [];
    
    // 3. 새로운 item_id들도 문자열로 변환하여 필터링
    const itemIdsAsString = itemIds.map(id => String(id));
    const newItemIds = itemIdsAsString.filter(itemId => !existingItemIds.includes(itemId));
    
    console.log(`📋 기존 데이터: ${existingItemIds.length}개, 새로운 데이터: ${newItemIds.length}개, 중복: ${itemIds.length - newItemIds.length}개`);

    if (newItemIds.length === 0) {
      console.log('✅ 모든 데이터가 이미 존재합니다. 스킵합니다.');
      return true;
    }

    // 4. 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.error('❌ 로그인한 사용자 ID가 없습니다.');
      return false;
    }
    
    // 5. 새로운 아이템들만 삽입
    const newItems: CoupangItem[] = newItemIds.map(itemId => ({
      user_id: userId,
      item_id: itemId // 이미 문자열로 변환됨
    }));

    const { error } = await supabase
      .from('extract-coupang-item-id')
      .insert(newItems);

    if (error) {
      console.error('쿠팡 아이템들 저장 오류:', error);
      return false;
    }

    console.log(`✅ 쿠팡 아이템들 저장 성공: ${newItems.length}개 (중복 ${existingItemIds.length}개 스킵)`);
    return true;
  } catch (error) {
    console.error('쿠팡 아이템들 저장 예외:', error);
    return false;
  }
}

/**
 * 모든 쿠팡 상품을 페이징으로 가져와서 일괄 저장
 */
export async function importAllCoupangProducts(
  onProgress?: (progress: BulkImportProgress) => void,
  maxPerPage: number = 50 // 페이지당 최대 상품 수
): Promise<{ success: boolean; totalImported: number; error?: string }> {
  
  let nextToken: string | undefined = undefined;
  let currentPage = 0;
  let totalProcessed = 0;

  try {
    console.log('🚀 쿠팡 상품 전체 가져오기 시작...');

    // 페이징을 통해 모든 상품 수집 및 배치별 저장
    while (true) {
      currentPage++;
      
      console.log(`📄 페이지 ${currentPage} 처리 중... (nextToken: ${nextToken || 'first'})`);
      
      // API 호출
      const response: CoupangApiResponse = await fetchCoupangProducts(nextToken, maxPerPage);
      
      if (response.code !== 'SUCCESS') {
        throw new Error(`API 호출 실패: ${response.message}`);
      }

      const currentBatch = response.data || [];
      
      if (currentBatch.length === 0) {
        console.log('📋 더 이상 가져올 상품이 없습니다.');
        break;
      }

      // 진행상황 콜백 호출
      if (onProgress) {
        onProgress({
          currentPage,
          totalProcessed: totalProcessed + currentBatch.length,
          currentBatch,
          isComplete: false
        });
      }

      // 현재 배치 즉시 저장 (메모리 효율적)
      const productIds = currentBatch.map(product => product.sellerProductId);
      const saveSuccess = await saveCoupangItems(productIds);

      if (!saveSuccess) {
        throw new Error(`페이지 ${currentPage} 저장 실패`);
      }

      totalProcessed += currentBatch.length;
      console.log(`✅ 페이지 ${currentPage}: ${currentBatch.length}개 상품 저장 완료 (총 ${totalProcessed}개)`);

      // 다음 토큰 확인
      if (!response.nextToken || response.nextToken === '') {
        console.log('🏁 모든 페이지 처리 완료!');
        break;
      }

      nextToken = response.nextToken;

      // API 호출 간격 (rate limiting 방지)
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 대기
    }

    // 완료 콜백
    if (onProgress) {
      onProgress({
        currentPage,
        totalProcessed,
        currentBatch: [],
        isComplete: true
      });
    }

    console.log(`🎉 전체 작업 완료! ${totalProcessed}개 상품이 성공적으로 저장되었습니다.`);

    return {
      success: true,
      totalImported: totalProcessed
    };

  } catch (error) {
    console.error('❌ 일괄 가져오기 오류:', error);
    
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    
    // 오류 콜백
    if (onProgress) {
      onProgress({
        currentPage,
        totalProcessed,
        currentBatch: [],
        isComplete: true,
        error: errorMessage
      });
    }

    return {
      success: false,
      totalImported: totalProcessed,
      error: errorMessage
    };
  }
}

/**
 * extract-coupang-item-id 테이블에서 모든 item_id 조회 (캐싱 적용)
 */
export async function getCoupangItemIds(): Promise<string[]> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.warn('⚠️ 로그인한 사용자 ID가 없어서 item_id를 조회하지 않습니다.');
      return [];
    }
    
    // 🛠️ 캐시 확인
    const cacheKey = getCacheKey('item_ids', userId);
    const cachedData = getCache<string[]>(cacheKey);
    
    if (cachedData) {
      console.log(`📋 캐시에서 사용자 ${userId}의 item_id 로드: ${cachedData.length}개 (캐시 히트)`);
      return cachedData;
    }
    
    console.log('🔍 extract-coupang-item-id 조회 - 사용자 ID:', userId);
    
    const { data, error } = await supabase
      .from('extract-coupang-item-id')
      .select('item_id')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ 아이템 ID 조회 오류:', error);
      return [];
    }

    const itemIds = data?.map((item: any) => String(item.item_id)) || [];
    
    // 🛠️ 캐시에 저장
    setCache(cacheKey, itemIds, CACHE_CONFIG.ITEM_IDS_TTL);
    
    console.log(`📦 사용자 ${userId}의 item_id 개수: ${itemIds.length}개 (데이터베이스에서 로드)`);
    if (itemIds.length > 0) {
      console.log('   - 첫 번째 item_id:', itemIds[0]);
    }

    return itemIds;
  } catch (error) {
    console.error('❌ 아이템 ID 조회 예외:', error);
    return [];
  }
}

/**
 * 쿠팡 상품 상세 정보를 extract_coupang_item_info 테이블에 저장
 */
export async function saveCoupangItemInfo(itemInfo: CoupangItemInfo): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('extract_coupang_item_info')
      .upsert([itemInfo], { 
        onConflict: 'option_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('상품 상세 정보 저장 오류:', error);
      return false;
    }

    console.log('✅ 상품 상세 정보 저장 성공:', itemInfo.option_id);
    return true;
  } catch (error) {
    console.error('상품 상세 정보 저장 예외:', error);
    return false;
  }
}

/**
 * 상품 상세 정보를 가져와서 저장하는 함수 (최적화된 버전)
 */
export async function fetchAndSaveProductInfo(
  sellerProductId: string
): Promise<{ success: boolean; itemCount: number; error?: string }> {
  try {
    console.log(`🔍 상품 ${sellerProductId} 상세 정보 조회 시작...`);
    
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    console.log(`👤 사용자 ID: ${userId} (타입: ${typeof userId})`);
    
    if (!userId) {
      console.error('❌ 사용자 ID가 없습니다! 로그인이 필요합니다.');
      return { success: false, itemCount: 0, error: '로그인이 필요합니다.' };
    }
    
    // 🛠️ 상품 상세 정보 조회 (캐싱 적용)
    const productCacheKey = getCacheKey('product_detail', sellerProductId);
    let response: CoupangProductDetailResponse | null = getCache<CoupangProductDetailResponse>(productCacheKey);
    
    if (!response) {
      console.log(`🌐 API에서 상품 ${sellerProductId} 상세 정보 조회 (캐시 미스)`);
      try {
        response = await fetchCoupangProductDetail(sellerProductId);
        // 🛠️ 성공한 응답만 캐시에 저장
        if (response && response.code === 'SUCCESS') {
          setCache(productCacheKey, response, CACHE_CONFIG.PRODUCT_DETAIL_TTL);
        }
      } catch (error: any) {
        // 404 오류 처리 (상품이 존재하지 않거나 삭제됨)
        if (error.message?.includes('404')) {
          console.warn(`⚠️ 상품 ${sellerProductId}: 쿠팡에서 삭제되었거나 존재하지 않는 상품입니다. (404)`);
          return { success: true, itemCount: 0, error: '상품이 존재하지 않음 (삭제된 상품)' };
        }
        
        // 기타 네트워크 오류
        console.error(`❌ 상품 ${sellerProductId}: API 호출 실패 -`, error.message);
        throw error; // 재시도 가능한 오류는 상위로 전달
      }
    } else {
      console.log(`📋 캐시에서 상품 ${sellerProductId} 상세 정보 로드 (캐시 히트)`);
    }
    
    // null 체크
    if (!response) {
      throw new Error('API 호출 결과가 null입니다.');
    }
    
    if (response.code !== 'SUCCESS') {
      throw new Error(`API 호출 실패: ${response.message}`);
    }

    const productData = response.data;
    if (!productData || !productData.items || productData.items.length === 0) {
      console.log(`⚠️ 상품 ${sellerProductId}에 아이템이 없습니다.`);
      return { success: true, itemCount: 0 };
    }

    const items = productData.items;
    const itemInfos: CoupangItemInfo[] = [];
    
    console.log(`📦 상품 ${sellerProductId}에서 ${items.length}개 옵션 발견`);

    // 모든 아이템(옵션) 정보를 먼저 수집
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 실제 API 응답 구조 분석 - 로그에서 확인한 구조 사용
      console.log(`📦 옵션 ${i + 1} 전체 데이터:`, JSON.stringify(item, null, 2));
      
      // API 응답에서 직접 필드들 추출 (로그에서 확인한 구조)
      const vendorItemId = (item as any).vendorItemId || '';
      const salePrice = (item as any).salePrice || '';
      const barcode = (item as any).barcode || '';
      
      console.log(`📦 옵션 ${i + 1} 추출된 데이터:`, {
        itemName: item.itemName,
        vendorItemId: vendorItemId,
        salePrice: salePrice,
        barcode: barcode,
        hasImages: item.images && item.images.length > 0,
        imageCount: item.images?.length || 0
      });

      // 이미지 URL 추출 및 변환 (cdnPath 우선, 없으면 vendorPath)
      let imageUrl = '';
      if (item.images && item.images.length > 0) {
        const image = item.images[0];
        imageUrl = convertCoupangImageUrl(image.cdnPath || '', image.vendorPath || '');
        
        // 첫 번째 상품의 이미지 URL 변환 과정을 로깅
        if (i === 0) {
          console.log(`🖼️ 이미지 URL 변환:`, {
            원본_cdnPath: image.cdnPath,
            원본_vendorPath: image.vendorPath,
            변환된_URL: imageUrl
          });
        }
      }

      // CoupangItemInfo 객체 생성 - 실제 API 응답 구조에 맞게 수정
      const itemInfo: CoupangItemInfo = {
        option_id: String(vendorItemId),
        item_id: String(sellerProductId),
        barcode: String(barcode),
        price: String(salePrice),
        item_name: productData.sellerProductName || '',
        option_name: item.itemName || '',
        item_image_url: imageUrl,
        user_id: userId
      };

      console.log(`💾 옵션 ${i + 1} 저장 데이터:`, itemInfo);
      itemInfos.push(itemInfo);
    }

    // 한 번에 모든 옵션 저장 (배치 삽입)
    if (itemInfos.length > 0) {
      console.log(`💾 상품 ${sellerProductId} 배치 저장 시도: ${itemInfos.length}개 옵션`);
      console.log('   - 첫 번째 옵션 데이터:', {
        option_id: itemInfos[0].option_id,
        user_id: itemInfos[0].user_id,
        item_name: itemInfos[0].item_name,
        option_name: itemInfos[0].option_name
      });
      console.log('   - 저장할 전체 데이터:', JSON.stringify(itemInfos, null, 2));
      
      const { error } = await supabase
        .from('extract_coupang_item_info')
        .upsert(itemInfos, { 
          onConflict: 'option_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ 상품 ${sellerProductId} 배치 저장 오류:`, {
          error: error,
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint
        });
        console.error('   - 실패한 데이터 샘플:', {
          option_id: itemInfos[0]?.option_id,
          item_id: itemInfos[0]?.item_id,
          user_id: itemInfos[0]?.user_id,
          dataLength: itemInfos.length,
          fullData: itemInfos[0]
        });
        return { success: false, itemCount: 0, error: error.message };
      }
      
      console.log(`✅ 상품 ${sellerProductId} 배치 저장 성공: ${itemInfos.length}개 옵션`);
      
      // 저장 확인
      try {
        const { data: savedData, error: selectError } = await supabase
          .from('extract_coupang_item_info')
          .select('*')
          .eq('item_id', sellerProductId)
          .eq('user_id', userId);
        
        if (selectError) {
          console.error('❌ 저장 확인 오류:', selectError);
        } else {
          console.log(`🔍 저장 확인: ${savedData?.length || 0}개 옵션이 데이터베이스에 저장됨`);
          if (savedData && savedData.length > 0) {
            console.log('🔍 저장된 데이터 샘플:', savedData[0]);
          }
        }
      } catch (verifyError) {
        console.error('❌ 저장 확인 중 오류:', verifyError);
      }
    }

    console.log(`✅ 상품 ${sellerProductId}: ${itemInfos.length}개 옵션 저장 완료`);
    
    return {
      success: true,
      itemCount: itemInfos.length
    };

  } catch (error) {
    console.error(`❌ 상품 ${sellerProductId} 처리 오류:`, error);
    return {
      success: false,
      itemCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 모든 상품의 상세 정보를 가져와서 저장 (최적화된 버전)
 */
export async function importAllProductInfo(
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; totalProcessed: number; totalSaved: number; error?: string }> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      return {
        success: false,
        totalProcessed: 0,
        totalSaved: 0,
        error: '로그인한 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.'
      };
    }

    // 기존 데이터 삭제 (신중하게)
    console.log('🗑️ 기존 상품 정보 삭제 중...');
    
    onProgress?.(0, 0, '기존 데이터 조회 중...');
    
    const { data: existingData, error: selectError } = await supabase
      .from('extract_coupang_item_info')
      .select('id')
      .eq('user_id', userId);
    
    if (selectError) {
      console.error('❌ 기존 데이터 조회 오류:', selectError);
      return {
        success: false,
        totalProcessed: 0,
        totalSaved: 0,
        error: `기존 데이터 조회 실패: ${selectError.message}`
      };
    }
    
    if (existingData && existingData.length > 0) {
      const { error: deleteError } = await supabase
        .from('extract_coupang_item_info')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('❌ 기존 데이터 삭제 오류:', deleteError);
        return {
          success: false,
          totalProcessed: 0,
          totalSaved: 0,
          error: `기존 데이터 삭제 실패: ${deleteError.message}`
        };
      }
      
      console.log(`✅ 기존 데이터 삭제 완료: ${existingData.length}개`);
      
      // 삭제 완료 후 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log('✅ 삭제할 기존 데이터 없음');
    }

    onProgress?.(0, 0, 'item_id 목록 조회 중...');
    
    // extract-coupang-item-id에서 모든 item_id 조회
    const itemIds = await getCoupangItemIds();
    
    if (itemIds.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        totalSaved: 0,
        error: 'extract-coupang-item-id 테이블에 데이터가 없습니다.'
      };
    }

    console.log(`🚀 총 ${itemIds.length}개 상품의 상세 정보를 가져옵니다.`);
    
    let totalProcessed = 0;
    let totalSaved = 0;
    // 🛠️ API 호출 최적화: 배치 크기 축소 (8 → 3)
    const BATCH_SIZE = 3; // 더 보수적인 배치 크기로 API 서버 부하 감소
    // 🛠️ API 호출 최적화: 딜레이 증가 (100ms → 500ms)
    const BATCH_DELAY = 500; // Rate limiting 방지를 위한 더 긴 딜레이

    // 배치별로 처리
    for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
      const batch = itemIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(itemIds.length / BATCH_SIZE);
      
      onProgress?.(
        i + batch.length, 
        itemIds.length, 
        `배치 ${batchNumber}/${totalBatches} 처리 중... (${batch.length}개 보수적 처리)`
      );

      console.log(`📦 배치 ${batchNumber}/${totalBatches}: ${batch.length}개 상품 보수적 병렬 처리 시작 (최적화됨)`);

      // 현재 배치를 병렬로 처리
      const batchPromises = batch.map(async (itemId) => {
        try {
          const result = await fetchAndSaveProductInfo(itemId);
          return { itemId, ...result };
        } catch (error) {
          console.error(`❌ 상품 ${itemId} 처리 실패:`, error);
          return { 
            itemId, 
            success: false, 
            itemCount: 0, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
          };
        }
      });

      // 배치 완료 대기 (실패해도 계속 진행)
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 결과 집계
      batchResults.forEach((result) => {
        totalProcessed++;
        if (result.status === 'fulfilled' && result.value.success) {
          totalSaved += result.value.itemCount;
        }
      });

      console.log(`✅ 배치 ${batchNumber} 완료: ${batch.length}개 처리 (누적: ${totalProcessed}/${itemIds.length}) - 최적화됨`);

      // 🛠️ 다음 배치 전 더 긴 딜레이 (마지막 배치가 아닌 경우만)
      if (i + BATCH_SIZE < itemIds.length) {
        console.log(`⏳ 다음 배치 전 ${BATCH_DELAY}ms 대기 중... (API 서버 보호)`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log(`🎉 전체 작업 완료! ${totalProcessed}개 상품 처리, ${totalSaved}개 옵션 저장 (최적화됨)`);

    return {
      success: true,
      totalProcessed,
      totalSaved
    };

  } catch (error) {
    console.error('❌ 전체 상품 정보 가져오기 오류:', error);
    
    return {
      success: false,
      totalProcessed: 0,
      totalSaved: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 실패한 상품들만 재시도하는 함수
 */
export async function retryFailedProducts(
  failedItemIds: string[],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; totalProcessed: number; totalSaved: number; error?: string }> {
  if (failedItemIds.length === 0) {
    return { success: true, totalProcessed: 0, totalSaved: 0 };
  }

  console.log(`🔄 실패한 ${failedItemIds.length}개 상품 재시도 시작...`);
  
  let totalProcessed = 0;
  let totalSaved = 0;
  // 🛠️ 재시도 최적화: 더욱 보수적인 배치 크기 (5 → 2)
  const BATCH_SIZE = 2; // 재시도는 더욱 보수적으로 API 안정성 확보
  // 🛠️ 재시도 최적화: 더 긴 딜레이 (200ms → 1000ms)
  const BATCH_DELAY = 1000; // 재시도 시 더 긴 대기 시간으로 서버 부하 방지

  for (let i = 0; i < failedItemIds.length; i += BATCH_SIZE) {
    const batch = failedItemIds.slice(i, i + BATCH_SIZE);
    
    onProgress?.(
      i + batch.length, 
      failedItemIds.length, 
      `재시도 중... (${i + batch.length}/${failedItemIds.length})`
    );

    const batchPromises = batch.map(async (itemId) => {
      try {
        const result = await fetchAndSaveProductInfo(itemId);
        return { itemId, ...result };
      } catch (error) {
        return { itemId, success: false, itemCount: 0, error: String(error) };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result) => {
      totalProcessed++;
      if (result.status === 'fulfilled' && result.value.success) {
        totalSaved += result.value.itemCount;
      }
    });

    if (i + BATCH_SIZE < failedItemIds.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return {
    success: true,
    totalProcessed,
    totalSaved
  };
}

/**
 * 이미지 URL 테스트 및 검증
 */
export async function testImageUrl(imagePath: string): Promise<void> {
  console.log(`🔍 이미지 URL 테스트: ${imagePath}`);
  
  // 작동하는 것으로 확인된 순서로 정렬
  const coupangCdnBases = [
    'https://image6.coupangcdn.com/image/',      // ✅ 작동 확인됨
    'https://image7.coupangcdn.com/image/',      // ✅ 작동 확인됨
    'https://image8.coupangcdn.com/image/',
    'https://image9.coupangcdn.com/image/',
    'https://thumbnail6.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail7.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail8.coupangcdn.com/thumbnails/remote/',
    'https://thumbnail9.coupangcdn.com/thumbnails/remote/'
  ];

  for (const baseUrl of coupangCdnBases) {
    const testUrl = `${baseUrl}${imagePath}`;
    console.log(`📎 테스트 URL: ${testUrl}`);
  }
}

/**
 * extract_coupang_item_info 테이블에서 모든 데이터 조회
 */
export async function getCoupangItemInfos(): Promise<CoupangItemInfo[]> {
  try {
    console.log('🔍 extract_coupang_item_info 테이블 조회 시작...');
    
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    console.log('🔍 현재 로그인한 사용자 ID:', userId);
    
    let data = null;
    let error = null;
    
    if (userId) {
      const result = await supabase
        .from('extract_coupang_item_info')
        .select('*')
        .eq('user_id', userId);
      
      data = result.data;
      error = result.error;
    } else {
      console.warn('⚠️ 로그인한 사용자 ID가 없어서 상품 정보를 조회하지 않습니다.');
      return [];
    }

    console.log('📊 Supabase 응답:', { data, error });

    if (error) {
      console.error('❌ 상품 정보 조회 오류:', error);
      return [];
    }

    console.log(`✅ 조회된 데이터 개수: ${data?.length || 0}`);
    if (data && data.length > 0) {
      console.log('📝 첫 번째 데이터 샘플:', data[0]);
    }

    return data || [];
  } catch (error) {
    console.error('❌ 상품 정보 조회 예외:', error);
    return [];
  }
}

/**
 * item_id별로 그룹화된 상품 정보 조회
 */
export interface GroupedCoupangItemInfo {
  item_id: string;
  item_name: string;
  item_image_url: string;
  options: Array<{
    option_id: string;
    option_name: string;
    barcode: string;
    price: string;
  }>;
}

export async function getGroupedCoupangItemInfos(): Promise<GroupedCoupangItemInfo[]> {
  try {
    console.log('🔄 상품 정보 그룹화 시작...');
    
    const itemInfos = await getCoupangItemInfos();
    
    console.log(`📦 가져온 원본 데이터 개수: ${itemInfos.length}`);
    
    if (itemInfos.length === 0) {
      console.log('⚠️ 원본 데이터가 없습니다.');
      return [];
    }
    
    // item_id별로 그룹화
    const grouped = itemInfos.reduce((acc, item) => {
      const existingGroup = acc.find(group => group.item_id === item.item_id);
      
      if (existingGroup) {
        // 기존 그룹에 옵션 추가
        existingGroup.options.push({
          option_id: item.option_id,
          option_name: item.option_name,
          barcode: item.barcode,
          price: item.price
        });
      } else {
        // 새 그룹 생성
        acc.push({
          item_id: item.item_id,
          item_name: item.item_name,
          item_image_url: item.item_image_url,
          options: [{
            option_id: item.option_id,
            option_name: item.option_name,
            barcode: item.barcode,
            price: item.price
          }]
        });
      }
      
      return acc;
    }, [] as GroupedCoupangItemInfo[]);

    console.log(`🎯 그룹화된 상품 개수: ${grouped.length}`);
    if (grouped.length > 0) {
      console.log('📝 첫 번째 그룹 샘플:', grouped[0]);
    }

    return grouped;
  } catch (error) {
    console.error('❌ 그룹화된 상품 정보 조회 예외:', error);
    return [];
  }
}

/**
 * extract_coupang_item_all에서 item_id와 option_id를 조회해서 이미지 정보를 가져오는 함수
 * @param selectedItemIds 선택된 item_id 배열 (빈 배열이면 모든 데이터 처리)
 * @param onProgress 진행상황 콜백
 */
export async function importImageInfoFromItemAll(
  selectedItemIds: string[] = [],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; totalProcessed: number; totalSaved: number; error?: string }> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      return {
        success: false,
        totalProcessed: 0,
        totalSaved: 0,
        error: '로그인한 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.'
      };
    }

    onProgress?.(0, 0, 'extract_coupang_item_all 데이터 조회 중...');
    
    // extract_coupang_item_all에서 데이터 조회 (페이지네이션으로 모든 데이터 가져오기)
    let allItemData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    console.log(`🔍 선택된 item_id: ${selectedItemIds.length > 0 ? selectedItemIds.length + '개' : '전체'}`);
    
    while (hasMore) {
      let query = supabase
      .from('extract_coupang_item_all')
      .select('item_id, option_id')
        .eq('user_id', userId);
      
      // 선택된 item_id가 있으면 필터링
      if (selectedItemIds.length > 0) {
        query = query.in('item_id', selectedItemIds);
      }
      
      const { data: batchData, error: batchError } = await query
        .order('item_id', { ascending: true })
        .range(from, from + batchSize - 1);
    
      if (batchError) {
        console.error(`❌ extract_coupang_item_all 배치 ${from}-${from + batchSize - 1} 조회 오류:`, batchError);
        break;
      }
      
      if (batchData && batchData.length > 0) {
        // 🛠️ 배열 최적화: concat 대신 push 사용으로 메모리 효율성 개선
        allItemData.push(...batchData);
        console.log(`📦 데이터 배치 ${Math.floor(from/batchSize) + 1}: ${batchData.length}개 (누적: ${allItemData.length}개)`);
        
        // 마지막 배치인지 확인
        if (batchData.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    if (allItemData.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        totalSaved: 0,
        error: selectedItemIds.length > 0 
          ? '선택된 상품에 대한 데이터가 extract_coupang_item_all 테이블에 없습니다.'
          : 'extract_coupang_item_all 테이블에 데이터가 없습니다.'
      };
    }

    // item_id 별로 그룹화 (중복 제거)
    const itemIds = allItemData.map(item => item.item_id);
    const uniqueItemIds = itemIds.filter((itemId, index) => itemIds.indexOf(itemId) === index);
    
    console.log(`🚀 extract_coupang_item_all에서 ${allItemData.length}개 데이터 발견`);
    console.log(`🎯 중복 제거 후 ${uniqueItemIds.length}개 고유 item_id로 이미지 정보를 가져옵니다.`);

    // 선택된 상품만 처리하는 경우 기존 데이터를 삭제하지 않고, 해당 상품만 업데이트
    if (selectedItemIds.length > 0) {
      // 선택된 상품들의 기존 데이터만 삭제
      onProgress?.(0, uniqueItemIds.length, '선택된 상품의 기존 이미지 데이터 삭제 중...');
      console.log(`🗑️ 선택된 ${selectedItemIds.length}개 상품의 기존 extract_coupang_item_info 데이터 삭제 중...`);
      
      const { error: deleteError } = await supabase
        .from('extract_coupang_item_info')
        .delete()
        .eq('user_id', userId)
        .in('item_id', selectedItemIds);
      
      if (deleteError) {
        console.error('❌ 선택된 상품의 기존 데이터 삭제 오류:', deleteError);
        return {
          success: false,
          totalProcessed: 0,
          totalSaved: 0,
          error: `선택된 상품의 기존 데이터 삭제 실패: ${deleteError.message}`
        };
      }
      
      console.log('✅ 선택된 상품의 기존 이미지 데이터 삭제 완료');
    } else {
      // 전체 처리하는 경우 모든 기존 데이터 삭제
    onProgress?.(0, uniqueItemIds.length, '기존 이미지 데이터 삭제 중...');
      console.log(`🗑️ 사용자 ${userId}의 모든 기존 extract_coupang_item_info 데이터 삭제 중...`);
    
    const { error: deleteError } = await supabase
      .from('extract_coupang_item_info')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('❌ 기존 데이터 삭제 오류:', deleteError);
      return {
        success: false,
        totalProcessed: 0,
        totalSaved: 0,
        error: `기존 데이터 삭제 실패: ${deleteError.message}`
      };
    }
    
      console.log('✅ 모든 기존 이미지 데이터 삭제 완료');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));

    let totalProcessed = 0;
    let totalSaved = 0;
    // 🛠️ API 호출 최적화: 배치 크기 축소 (8 → 3) - importImageInfoFromItemAll
    const BATCH_SIZE = 3; // 더 보수적인 배치 크기로 API 서버 부하 감소
    // 🛠️ API 호출 최적화: 딜레이 증가 (100ms → 500ms)
    const BATCH_DELAY = 500; // Rate limiting 방지를 위한 더 긴 딜레이

    // 배치별로 처리
    for (let i = 0; i < uniqueItemIds.length; i += BATCH_SIZE) {
      const batch = uniqueItemIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(uniqueItemIds.length / BATCH_SIZE);
      
      const progressMessage = selectedItemIds.length > 0 
        ? `선택된 상품 배치 ${batchNumber}/${totalBatches} 이미지 정보 가져오는 중... (${batch.length}개 병렬 처리)`
        : `배치 ${batchNumber}/${totalBatches} 이미지 정보 가져오는 중... (${batch.length}개 병렬 처리)`;
      
      onProgress?.(
        i + batch.length, 
        uniqueItemIds.length, 
        progressMessage
      );

      console.log(`📦 배치 ${batchNumber}/${totalBatches}: ${batch.length}개 상품 이미지 정보 병렬 처리 시작`);

      // 현재 배치를 병렬로 처리
      const batchPromises = batch.map(async (itemId) => {
        try {
          const result = await fetchAndSaveProductInfo(itemId);
          return { itemId, ...result };
        } catch (error) {
          console.error(`❌ 상품 ${itemId} 이미지 정보 처리 실패:`, error);
          return { 
            itemId, 
            success: false, 
            itemCount: 0, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
          };
        }
      });

      // 배치 완료 대기 (실패해도 계속 진행)
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 결과 집계
      batchResults.forEach((result) => {
        totalProcessed++;
        if (result.status === 'fulfilled' && result.value.success) {
          totalSaved += result.value.itemCount;
        }
      });

      console.log(`✅ 배치 ${batchNumber} 완료: ${batch.length}개 처리 (누적: ${totalProcessed}/${uniqueItemIds.length})`);

      // 다음 배치 전 짧은 딜레이 (마지막 배치가 아닌 경우만)
      if (i + BATCH_SIZE < uniqueItemIds.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    const resultMessage = selectedItemIds.length > 0 
      ? `선택된 상품 이미지 정보 가져오기 완료! ${totalProcessed}개 상품 처리, ${totalSaved}개 옵션 저장`
      : `모든 상품 이미지 정보 가져오기 완료! ${totalProcessed}개 상품 처리, ${totalSaved}개 옵션 저장`;
    
    console.log(`🎉 ${resultMessage}`);

    return {
      success: true,
      totalProcessed,
      totalSaved
    };

  } catch (error) {
    console.error('❌ 이미지 정보 가져오기 오류:', error);
    return {
      success: false,
      totalProcessed: 0,
      totalSaved: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 테이블 행 데이터 타입 (item_name 행과 option_name 행을 구분)
 */
export interface TableRowData {
  id: string;           // 고유 식별자
  type: 'item' | 'option';  // 행 타입
  item_id: string;      // 상품 ID
  item_name: string;    // 상품명
  item_image_url: string; // 이미지 URL
  option_id?: string;   // 옵션 ID (option 타입일 때만)
  option_name?: string; // 옵션명 (option 타입일 때만)
  barcode?: string;     // 바코드 (option 타입일 때만)
  price?: string;       // 가격 (option 타입일 때만)
  isFirst?: boolean;    // 같은 item_id의 첫 번째 옵션인지 여부
  // 로켓 재고 데이터 필드들
  orderable_quantity?: string; // 창고재고
  pending_inbounds?: string; // 입고중
  sales_quantity_last_7_days?: string; // 7일 판매량
  sales_quantity_last_30_days?: string; // 30일 판매량
  recommanded_inboundquantity?: string; // 쿠팡추천
  monthly_storage_fee?: string; // 창고비용
  // extract_coupang_item_all 테이블 필드들
  regular_price?: string; // 정가
  sales_status?: string; // 판매상태
  coupang_stock?: string; // 쿠팡재고
  sales_quantity?: string; // 판매수량
  coupang_approval?: string; // 쿠팡승인
}

/**
 * 현재 로그인한 사용자 ID를 가져오는 함수 (로컬 스토리지에서)
 */
function getLocalUserId(): string | null {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return currentUser.id || currentUser.user_id || null;
  } catch (error) {
    console.error('❌ 사용자 정보 읽기 오류:', error);
    return null;
  }
}

/**
 * 테이블 행 데이터 가져오기 (extract_coupang_item_all 기본, extract_coupang_item_info에서 이미지)
 * 상품별로 그룹화된 데이터를 반환
 */
export async function getTableRowData(): Promise<TableRowData[]> {
  try {
    console.log('🚀 테이블 행 데이터 로드 시작...');
    
    const userId = getLocalUserId();
    if (!userId) {
      console.error('❌ 로그인한 사용자 ID가 없습니다.');
      return [];
    }
    
    console.log('🔑 사용자 ID:', userId);
    
    // extract_coupang_item_all 데이터 가져오기 (페이지네이션으로 모든 데이터 가져오기)
    let allItemData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batchData, error: batchError } = await supabase
      .from('extract_coupang_item_all')
      .select('*')
      .eq('user_id', userId)
      .order('item_id', { ascending: true })
        .order('option_id', { ascending: true })
        .range(from, from + batchSize - 1);
      
      if (batchError) {
        console.error(`❌ extract_coupang_item_all 배치 ${from}-${from + batchSize - 1} 조회 오류:`, batchError);
        break;
      }
      
      if (batchData && batchData.length > 0) {
        // 🛠️ 배열 최적화: concat 대신 push 사용으로 메모리 효율성 개선
        allItemData.push(...batchData);
        console.log(`📦 배치 ${Math.floor(from/batchSize) + 1}: ${batchData.length}개 (누적: ${allItemData.length}개)`);
        
        // 마지막 배치인지 확인
        if (batchData.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    const itemAllData = allItemData;
    const allError = null;
    
    if (allError) {
      console.error('❌ extract_coupang_item_all 데이터 조회 오류:', allError);
      return [];
    }
    
    console.log(`📊 extract_coupang_item_all 데이터: ${itemAllData?.length || 0}개`);
    
    if (!itemAllData || itemAllData.length === 0) {
      console.log('📋 extract_coupang_item_all 데이터가 없습니다.');
      return [];
    }
    
    // extract_coupang_item_info 데이터 가져오기 (이미지 URL용)
    const { data: itemInfoData, error: infoError } = await supabase
      .from('extract_coupang_item_info')
      .select('option_id, item_image_url')
      .eq('user_id', userId);
    
    if (infoError) {
      console.error('❌ extract_coupang_item_info 데이터 조회 오류:', infoError);
    }
    
    console.log(`🖼️ extract_coupang_item_info 이미지 데이터: ${itemInfoData?.length || 0}개`);
    
    // option_id를 키로 하는 이미지 URL 맵 생성
    const imageUrlMap = new Map<string, string>();
    if (itemInfoData) {
      itemInfoData.forEach((info: any) => {
        if (info.option_id && info.item_image_url) {
          imageUrlMap.set(info.option_id, info.item_image_url);
        }
      });
    }
    
    // item_id별로 그룹화
    const groupedData = new Map<string, any[]>();
    
    itemAllData.forEach(item => {
      const itemId = item.item_id;
      if (!groupedData.has(itemId)) {
        groupedData.set(itemId, []);
      }
      groupedData.get(itemId)!.push(item);
    });
    
    console.log(`📋 상품 그룹화: ${groupedData.size}개 상품`);
    
    const tableRows: TableRowData[] = [];
    
    for (const [itemId, options] of Array.from(groupedData.entries())) {
      // 첫 번째 옵션 정보로 상품 행 생성
      const firstOption = options[0];
      const firstOptionImageUrl = imageUrlMap.get(firstOption.option_id) || '';
      
      // 상품 행 추가 (등록상품명 = item_name)
      const itemRow: TableRowData = {
        id: `item-${itemId}`,
        type: 'item',
        item_id: itemId,
        item_name: firstOption.item_name || '', // extract_coupang_item_all의 item_name
        item_image_url: firstOptionImageUrl
      };
      
      tableRows.push(itemRow);
      
      // 각 옵션 행들 추가
      options.forEach((option: any, index: number) => {
        const optionImageUrl = imageUrlMap.get(option.option_id) || '';
        
        const optionRow: TableRowData = {
          id: `option-${option.option_id}`,
          type: 'option',
          item_id: itemId,
          item_name: option.item_name || '', // extract_coupang_item_all의 item_name
          item_image_url: optionImageUrl,
          option_id: option.option_id,
          option_name: option.option_name || '', // extract_coupang_item_all의 option_name
          barcode: option.barcode || '',
          price: option.price || '',
          isFirst: index === 0,
          // extract_coupang_item_all 테이블의 다른 필드들
          regular_price: option.regular_price || '',
          sales_status: option.sales_status || '',
          coupang_stock: option.coupang_stock || '',
          sales_quantity: option.sales_quantity || '',
          coupang_approval: option.coupang_approval || ''
        };
        
        tableRows.push(optionRow);
      });
    }
    
    console.log(`✅ 테이블 행 데이터 생성 완료: ${tableRows.length}개 행`);
    console.log('📝 첫 번째 상품 샘플:', tableRows.find(row => row.type === 'item'));
    console.log('📝 첫 번째 옵션 샘플:', tableRows.find(row => row.type === 'option'));
    
    return tableRows;
    
  } catch (error) {
    console.error('❌ 테이블 행 데이터 로드 오류:', error);
    return [];
  }
} 

/**
 * 데이터베이스 상태 디버깅 함수
 */
export async function debugDatabaseState(): Promise<void> {
  try {
    const userId = getLocalUserId();
    console.log('🔍 DEBUG: 현재 로그인 사용자 ID:', userId);
    
    // 1. extract_coupang_item_all 전체 데이터 개수
    const { data: allData, error: allError } = await supabase
      .from('extract_coupang_item_all')
      .select('*', { count: 'exact' });
    
    console.log('📊 DEBUG: extract_coupang_item_all 전체 데이터 개수:', allData?.length || 0);
    
    if (userId) {
      // 2. 해당 사용자의 extract_coupang_item_all 데이터 개수 (count로 정확한 개수 확인)
      const { count: userCount, error: countError } = await supabase
        .from('extract_coupang_item_all')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      console.log(`📊 DEBUG: 사용자 ${userId}의 extract_coupang_item_all 실제 개수:`, userCount || 0);
      
      // 실제 데이터도 가져오기 (샘플용)
      const { data: userAllData, error: userAllError } = await supabase
        .from('extract_coupang_item_all')
        .select('*')
        .eq('user_id', userId)
        .limit(10);
      
      console.log(`📊 DEBUG: 사용자 ${userId}의 extract_coupang_item_all 샘플 데이터:`, userAllData?.length || 0);
      
             // 3. 해당 사용자의 unique item_id 개수
       if (userAllData && userAllData.length > 0) {
                   const itemIds = userAllData.map((item: any) => item.item_id);
          const uniqueItemIds = itemIds.filter((itemId: any, index: number) => itemIds.indexOf(itemId) === index);
         console.log(`📊 DEBUG: 사용자 ${userId}의 unique item_id 개수:`, uniqueItemIds.length);
         
         // 4. 샘플 데이터 출력
         console.log('📝 DEBUG: 첫 번째 데이터 샘플:', userAllData[0]);
         console.log('📝 DEBUG: 마지막 데이터 샘플:', userAllData[userAllData.length - 1]);
         
         // 5. item_id별 옵션 개수 분포
                   const itemIdCounts = userAllData.reduce((acc: any, item: any) => {
           acc[item.item_id] = (acc[item.item_id] || 0) + 1;
           return acc;
         }, {} as Record<string, number>);
         
         const sortedItemIds = Object.entries(itemIdCounts)
           .sort(([,a], [,b]) => (b as number) - (a as number))
           .slice(0, 5); // 상위 5개만
         
         console.log('📊 DEBUG: 옵션 개수 상위 5개 상품:', sortedItemIds);
       }
      
      // 6. extract_coupang_item_info 데이터 확인
      const { data: infoData, error: infoError } = await supabase
        .from('extract_coupang_item_info')
        .select('*')
        .eq('user_id', userId);
      
      console.log(`🖼️ DEBUG: 사용자 ${userId}의 extract_coupang_item_info 데이터 개수:`, infoData?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ DEBUG: 데이터베이스 상태 확인 오류:', error);
  }
}

/**
 * 일반쿠팡 API를 사용해서 상품 상세 정보 조회 및 저장
 */
export async function fetchAndSaveProductInfoRocketGrowth(
  sellerProductId: string
): Promise<{ success: boolean; itemCount: number; error?: string }> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.error('❌ 로켓그로스 API - 사용자 ID가 없습니다!');
      return { success: false, itemCount: 0, error: '로그인이 필요합니다.' };
    }
    
    // 로켓그로스 API로 상품 상세 정보 조회
    let response: CoupangProductDetailResponse;
    try {
      response = await fetchCoupangProductDetailRocketGrowth(sellerProductId);
    } catch (error: any) {
      if (error.message?.includes('404')) {
        console.warn(`⚠️ 로켓그로스 API - 상품 ${sellerProductId}: 삭제되었거나 존재하지 않는 상품입니다.`);
        return { success: true, itemCount: 0, error: '상품이 존재하지 않음' };
      }
      console.error(`❌ 로켓그로스 API - 상품 ${sellerProductId} API 호출 실패:`, error.message);
      return { success: false, itemCount: 0, error: error.message };
    }
    
    if (response.code !== 'SUCCESS') {
      console.error(`❌ 로켓그로스 API - 응답 오류: ${response.message}`);
      return { success: false, itemCount: 0, error: response.message };
    }

    const productData = response.data;
    if (!productData || !productData.items || productData.items.length === 0) {
      console.error(`❌ 로켓그로스 API - 상품 ${sellerProductId}에 아이템이 없습니다.`);
      return { success: true, itemCount: 0 };
    }

    const items = productData.items;
    const itemInfos: CoupangItemInfo[] = [];

    // 모든 아이템(옵션) 정보를 먼저 수집
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 가이드에 따른 로켓그로스 데이터 추출
      let vendorItemId = 0;
      let salePrice = 0;
      let barcode = '';

      // 로켓그로스 상품인 경우 rocketGrowthItemData에서 추출
      if (item.rocketGrowthItemData) {
        vendorItemId = item.rocketGrowthItemData.vendorItemId || 0;
        salePrice = item.rocketGrowthItemData.priceData?.salePrice || 0;
        barcode = item.rocketGrowthItemData.barcode || '';
      } else {
        // 일반 상품인 경우 직접 필드에서 추출
        vendorItemId = (item as any).vendorItemId || 0;
        salePrice = (item as any).salePrice || 0;
        barcode = (item as any).barcode || '';
      }

      // 빈 값 처리 (일반쿠팡과 동일하게)
      const finalVendorItemId = vendorItemId && vendorItemId !== 0 ? String(vendorItemId) : '0';
      const finalSalePrice = salePrice && salePrice !== 0 ? String(salePrice) : '0';
      const finalBarcode = barcode && barcode !== '' ? String(barcode) : '';

      // 이미지 URL 추출
      let imageUrl = '';
      if (item.images && item.images.length > 0) {
        const image = item.images[0];
        imageUrl = convertCoupangImageUrl(image.cdnPath || '', image.vendorPath || '');
      }

      const itemInfo: CoupangItemInfo = {
        option_id: finalVendorItemId,
        item_id: String(sellerProductId),
        barcode: finalBarcode,
        price: finalSalePrice,
        item_name: productData.sellerProductName || '',
        option_name: item.itemName || '',
        item_image_url: imageUrl,
        user_id: userId
      };

      itemInfos.push(itemInfo);
    }

    // 배치 저장
    if (itemInfos.length > 0) {
      const { error } = await supabase
        .from('extract_coupang_item_info')
        .insert(itemInfos);
      
      if (error) {
        console.error('❌ 로켓그로스 API - 저장 오류:', error.message);
        console.error('❌ 실패 데이터:', itemInfos[0]);
        return { success: false, itemCount: 0, error: error.message };
      }
    }

    return {
      success: true,
      itemCount: itemInfos.length
    };

  } catch (error) {
    console.error(`❌ 로켓그로스 API - 상품 ${sellerProductId} 처리 실패:`, error);
    return {
      success: false,
      itemCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

export async function fetchAndSaveProductInfoNormal(
  sellerProductId: string
): Promise<{ success: boolean; itemCount: number; error?: string }> {
  try {
    console.log(`🔍 일반쿠팡 API - 상품 ${sellerProductId} 상세 정보 조회 시작...`);
    
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    console.log(`👤 일반쿠팡 API - 사용자 ID: ${userId} (타입: ${typeof userId})`);
    
    if (!userId) {
      console.error('❌ 일반쿠팡 API - 사용자 ID가 없습니다! 로그인이 필요합니다.');
      return { success: false, itemCount: 0, error: '로그인이 필요합니다.' };
    }
    
    // 일반쿠팡 API로 상품 상세 정보 조회
    let response: CoupangProductDetailResponse;
    try {
      response = await fetchCoupangProductDetailNormal(sellerProductId);
    } catch (error: any) {
      // 404 오류 처리 (상품이 존재하지 않거나 삭제됨)
      if (error.message?.includes('404')) {
        console.warn(`⚠️ 일반쿠팡 API - 상품 ${sellerProductId}: 쿠팡에서 삭제되었거나 존재하지 않는 상품입니다. (404)`);
        return { success: true, itemCount: 0, error: '상품이 존재하지 않음 (삭제된 상품)' };
      }
      
      // 기타 네트워크 오류
      console.error(`❌ 일반쿠팡 API - 상품 ${sellerProductId}: API 호출 실패 -`, error.message);
      throw error; // 재시도 가능한 오류는 상위로 전달
    }
    
    if (response.code !== 'SUCCESS') {
      throw new Error(`일반쿠팡 API 호출 실패: ${response.message}`);
    }

    const productData = response.data;
    if (!productData || !productData.items || productData.items.length === 0) {
      console.log(`⚠️ 일반쿠팡 API - 상품 ${sellerProductId}에 아이템이 없습니다.`);
      return { success: true, itemCount: 0 };
    }

    const items = productData.items;
    const itemInfos: CoupangItemInfo[] = [];
    
    console.log(`📦 일반쿠팡 API - 상품 ${sellerProductId}에서 ${items.length}개 옵션 발견`);

    // 모든 아이템(옵션) 정보를 먼저 수집 - 일반쿠팡 API 구조에 맞게
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 일반쿠팡 API 응답 구조 분석 - 직접 필드 접근
      console.log(`📦 일반쿠팡 API - 옵션 ${i + 1} 전체 데이터:`, JSON.stringify(item, null, 2));
      
      // 일반쿠팡 API에서는 items 배열에서 직접 필드들 추출
      const vendorItemId = (item as any).vendorItemId || 0;
      const salePrice = (item as any).salePrice || 0;
      const barcode = (item as any).barcode || '';
      
      console.log(`📦 일반쿠팡 API - 옵션 ${i + 1} 추출된 데이터:`, {
        itemName: item.itemName,
        vendorItemId: vendorItemId,
        salePrice: salePrice,
        barcode: barcode,
        hasImages: item.images && item.images.length > 0,
        imageCount: item.images?.length || 0
      });

      // 이미지 URL 추출 및 변환 (cdnPath 우선, 없으면 vendorPath)
      let imageUrl = '';
      if (item.images && item.images.length > 0) {
        const image = item.images[0];
        imageUrl = convertCoupangImageUrl(image.cdnPath || '', image.vendorPath || '');
        
        // 첫 번째 상품의 이미지 URL 변환 과정을 로깅
        if (i === 0) {
          console.log(`🖼️ 일반쿠팡 API - 이미지 URL 변환:`, {
            원본_cdnPath: image.cdnPath,
            원본_vendorPath: image.vendorPath,
            변환된_URL: imageUrl
          });
        }
      }

      // CoupangItemInfo 객체 생성 - option_id가 빈 값이면 고유한 값 생성
      const finalOptionId = vendorItemId && vendorItemId !== 0 && vendorItemId !== '' 
        ? String(vendorItemId) 
        : `${sellerProductId}_option_${i + 1}`;  // 고유한 option_id 생성
      
      const itemInfo: CoupangItemInfo = {
        option_id: finalOptionId,
        item_id: String(sellerProductId),
        barcode: barcode && barcode !== '' ? String(barcode) : '',
        price: salePrice && salePrice !== 0 && salePrice !== '' ? String(salePrice) : '0',
        item_name: productData.sellerProductName || '',
        option_name: item.itemName || '',
        item_image_url: imageUrl,
        user_id: userId
      };

      console.log(`💾 일반쿠팡 API - 옵션 ${i + 1} 저장 데이터:`, itemInfo);
      itemInfos.push(itemInfo);
    }

    // 한 번에 모든 옵션 저장 (배치 삽입)
    if (itemInfos.length > 0) {
      console.log(`💾 일반쿠팡 API - 상품 ${sellerProductId} 배치 저장 시도: ${itemInfos.length}개 옵션`);
      console.log('   - 첫 번째 옵션 데이터:', {
        option_id: itemInfos[0].option_id,
        user_id: itemInfos[0].user_id,
        item_name: itemInfos[0].item_name,
        option_name: itemInfos[0].option_name
      });
      console.log('   - 저장할 전체 데이터:', JSON.stringify(itemInfos, null, 2));
      
      const { error } = await supabase
        .from('extract_coupang_item_info')
        .upsert(itemInfos, { 
          onConflict: 'option_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ 일반쿠팡 API - 상품 ${sellerProductId} 배치 저장 오류:`, {
          error: error,
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint
        });
        console.error('   - 실패한 데이터 샘플:', {
          option_id: itemInfos[0]?.option_id,
          item_id: itemInfos[0]?.item_id,
          user_id: itemInfos[0]?.user_id,
          dataLength: itemInfos.length,
          fullData: itemInfos[0]
        });
        return { success: false, itemCount: 0, error: error.message };
      }
      
      console.log(`✅ 일반쿠팡 API - 상품 ${sellerProductId} 배치 저장 성공: ${itemInfos.length}개 옵션`);
      
      // 저장 확인
      try {
        const { data: savedData, error: selectError } = await supabase
          .from('extract_coupang_item_info')
          .select('*')
          .eq('item_id', sellerProductId)
          .eq('user_id', userId);
        
        if (selectError) {
          console.error('❌ 일반쿠팡 API - 저장 확인 오류:', selectError);
        } else {
          console.log(`🔍 일반쿠팡 API - 저장 확인: ${savedData?.length || 0}개 옵션이 데이터베이스에 저장됨`);
          if (savedData && savedData.length > 0) {
            console.log('🔍 일반쿠팡 API - 저장된 데이터 샘플:', savedData[0]);
          }
        }
      } catch (verifyError) {
        console.error('❌ 일반쿠팡 API - 저장 확인 중 오류:', verifyError);
      }
    }

    console.log(`✅ 일반쿠팡 API - 상품 ${sellerProductId}: ${itemInfos.length}개 옵션 저장 완료`);
    
    return {
      success: true,
      itemCount: itemInfos.length
    };

  } catch (error) {
    console.error(`❌ 일반쿠팡 API - 상품 ${sellerProductId} 처리 오류:`, error);
    return {
      success: false,
      itemCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 로켓그로스 API를 사용해서 extract_coupang_item_all에서 이미지 정보 가져오기
 */
export async function importImageInfoFromItemAllRocketGrowth(
  selectedItemIds: string[] = [],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; totalProcessed: number; totalSaved: number; error?: string }> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.error('❌ 로켓그로스 API - 사용자 ID가 없습니다!');
      return {
        success: false,
        totalProcessed: 0,
        totalSaved: 0,
        error: '로그인한 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.'
      };
    }

    onProgress?.(0, 0, 'extract_coupang_item_all 데이터 조회 중...');
    
    // extract_coupang_item_all에서 데이터 조회 (페이지네이션으로 모든 데이터 가져오기)
    let allItemData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from('extract_coupang_item_all')
        .select('item_id, option_id')
        .eq('user_id', userId);
      
      // 선택된 item_id가 있으면 필터링
      if (selectedItemIds.length > 0) {
        query = query.in('item_id', selectedItemIds);
      }
      
      const { data: batchData, error: batchError } = await query
        .order('item_id', { ascending: true })
        .range(from, from + batchSize - 1);
      
      if (batchError) {
        console.error(`❌ 로켓그로스 API - extract_coupang_item_all 배치 ${from}-${from + batchSize - 1} 조회 오류:`, batchError);
        break;
      }
      
      if (batchData && batchData.length > 0) {
        // 🛠️ 배열 최적화: concat 대신 push 사용으로 메모리 효율성 개선
        allItemData.push(...batchData);
        console.log(`📦 로켓그로스 API - 데이터 배치 ${Math.floor(from/batchSize) + 1}: ${batchData.length}개 (누적: ${allItemData.length}개)`);
        
        // 마지막 배치인지 확인
        if (batchData.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    if (allItemData.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        totalSaved: 0,
        error: selectedItemIds.length > 0 
          ? '선택된 상품에 대한 데이터가 extract_coupang_item_all 테이블에 없습니다.'
          : 'extract_coupang_item_all 테이블에 데이터가 없습니다.'
      };
    }

    // item_id 별로 그룹화 (중복 제거)
    const itemIds = allItemData.map(item => item.item_id);
    const uniqueItemIds = itemIds.filter((itemId, index) => itemIds.indexOf(itemId) === index);
    
    console.log(`🚀 로켓그로스 API - extract_coupang_item_all에서 ${allItemData.length}개 데이터 발견`);
    console.log(`🎯 로켓그로스 API - 중복 제거 후 ${uniqueItemIds.length}개 고유 item_id로 이미지 정보를 가져옵니다.`);

    // 선택된 상품만 처리하는 경우 기존 데이터를 삭제하지 않고, 해당 상품만 업데이트
    if (selectedItemIds.length > 0) {
      // 선택된 상품들의 기존 데이터만 삭제
      onProgress?.(0, uniqueItemIds.length, '선택된 상품의 기존 이미지 데이터 삭제 중...');
      console.log(`🗑️ 로켓그로스 API - 선택된 ${selectedItemIds.length}개 상품의 기존 extract_coupang_item_info 데이터 삭제 중...`);
      
      const { error: deleteError } = await supabase
        .from('extract_coupang_item_info')
        .delete()
        .eq('user_id', userId)
        .in('item_id', selectedItemIds);
      
      if (deleteError) {
        console.error('❌ 로켓그로스 API - 선택된 상품의 기존 데이터 삭제 오류:', deleteError);
        return {
          success: false,
          totalProcessed: 0,
          totalSaved: 0,
          error: `선택된 상품의 기존 데이터 삭제 실패: ${deleteError.message}`
        };
      }
      
      console.log('✅ 로켓그로스 API - 선택된 상품의 기존 이미지 데이터 삭제 완료');
    } else {
      // 전체 처리하는 경우 모든 기존 데이터 삭제
      onProgress?.(0, uniqueItemIds.length, '기존 이미지 데이터 삭제 중...');
      console.log(`🗑️ 로켓그로스 API - 사용자 ${userId}의 모든 기존 extract_coupang_item_info 데이터 삭제 중...`);
      
      const { error: deleteError } = await supabase
        .from('extract_coupang_item_info')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('❌ 로켓그로스 API - 기존 데이터 삭제 오류:', deleteError);
        return {
          success: false,
          totalProcessed: 0,
          totalSaved: 0,
          error: `기존 데이터 삭제 실패: ${deleteError.message}`
        };
      }
      
      console.log('✅ 로켓그로스 API - 모든 기존 이미지 데이터 삭제 완료');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));

    let totalProcessed = 0;
    let totalSaved = 0;
    // 🛠️ API 호출 최적화: 배치 크기 축소 (8 → 3) - RocketGrowth
    const BATCH_SIZE = 3; // 더 보수적인 배치 크기로 API 서버 부하 감소
    // 🛠️ API 호출 최적화: 딜레이 증가 (100ms → 500ms)
    const BATCH_DELAY = 500; // Rate limiting 방지를 위한 더 긴 딜레이

    // 배치별로 처리
    for (let i = 0; i < uniqueItemIds.length; i += BATCH_SIZE) {
      const batch = uniqueItemIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(uniqueItemIds.length / BATCH_SIZE);
      
      const progressMessage = selectedItemIds.length > 0 
        ? `로켓그로스 API - 선택된 상품 배치 ${batchNumber}/${totalBatches} 이미지 정보 가져오는 중... (${batch.length}개 병렬 처리)`
        : `로켓그로스 API - 배치 ${batchNumber}/${totalBatches} 이미지 정보 가져오는 중... (${batch.length}개 병렬 처리)`;
      
      onProgress?.(
        i + batch.length, 
        uniqueItemIds.length, 
        progressMessage
      );

      console.log(`📦 로켓그로스 API - 배치 ${batchNumber}/${totalBatches}: ${batch.length}개 상품 이미지 정보 병렬 처리 시작`);

      // 현재 배치를 병렬로 처리
      const batchPromises = batch.map(async (itemId) => {
        try {
          const result = await fetchAndSaveProductInfoRocketGrowth(itemId);
          return { itemId, ...result };
        } catch (error) {
          console.error(`❌ 로켓그로스 API - 상품 ${itemId} 이미지 정보 처리 실패:`, error);
          return { 
            itemId, 
            success: false, 
            itemCount: 0, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
          };
        }
      });

      // 배치 완료 대기 (실패해도 계속 진행)
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 결과 집계
      batchResults.forEach((result) => {
        totalProcessed++;
        if (result.status === 'fulfilled' && result.value.success) {
          totalSaved += result.value.itemCount;
        }
      });

      console.log(`✅ 로켓그로스 API - 배치 ${batchNumber} 완료: ${batch.length}개 처리 (누적: ${totalProcessed}/${uniqueItemIds.length})`);

      // 다음 배치 전 짧은 딜레이 (마지막 배치가 아닌 경우만)
      if (i + BATCH_SIZE < uniqueItemIds.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    const resultMessage = selectedItemIds.length > 0 
      ? `로켓그로스 API - 선택된 상품 이미지 정보 가져오기 완료! ${totalProcessed}개 상품 처리, ${totalSaved}개 옵션 저장`
      : `로켓그로스 API - 모든 상품 이미지 정보 가져오기 완료! ${totalProcessed}개 상품 처리, ${totalSaved}개 옵션 저장`;
    
    console.log(`🎉 ${resultMessage}`);

    return {
      success: true,
      totalProcessed,
      totalSaved
    };

  } catch (error) {
    console.error('❌ 로켓그로스 API - 이미지 정보 가져오기 실패:', error);
    return {
      success: false,
      totalProcessed: 0,
      totalSaved: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * 일반쿠팡 API를 사용해서 extract_coupang_item_all에서 이미지 정보 가져오기
 */
export async function importImageInfoFromItemAllNormal(
  selectedItemIds: string[] = [],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; totalProcessed: number; totalSaved: number; error?: string }> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      return {
        success: false,
        totalProcessed: 0,
        totalSaved: 0,
        error: '로그인한 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.'
      };
    }

    onProgress?.(0, 0, 'extract_coupang_item_all 데이터 조회 중...');
    
    // extract_coupang_item_all에서 데이터 조회 (페이지네이션으로 모든 데이터 가져오기)
    let allItemData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    console.log(`🔍 일반쿠팡 API - 선택된 item_id: ${selectedItemIds.length > 0 ? selectedItemIds.length + '개' : '전체'}`);
    
    while (hasMore) {
      let query = supabase
        .from('extract_coupang_item_all')
        .select('item_id, option_id')
        .eq('user_id', userId);
      
      // 선택된 item_id가 있으면 필터링
      if (selectedItemIds.length > 0) {
        query = query.in('item_id', selectedItemIds);
      }
      
      const { data: batchData, error: batchError } = await query
        .order('item_id', { ascending: true })
        .range(from, from + batchSize - 1);
      
      if (batchError) {
        console.error(`❌ 일반쿠팡 API - extract_coupang_item_all 배치 ${from}-${from + batchSize - 1} 조회 오류:`, batchError);
        break;
      }
      
      if (batchData && batchData.length > 0) {
        // 🛠️ 배열 최적화: concat 대신 push 사용으로 메모리 효율성 개선
        allItemData.push(...batchData);
        console.log(`📦 일반쿠팡 API - 데이터 배치 ${Math.floor(from/batchSize) + 1}: ${batchData.length}개 (누적: ${allItemData.length}개)`);
        
        // 마지막 배치인지 확인
        if (batchData.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    if (allItemData.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        totalSaved: 0,
        error: selectedItemIds.length > 0 
          ? '선택된 상품에 대한 데이터가 extract_coupang_item_all 테이블에 없습니다.'
          : 'extract_coupang_item_all 테이블에 데이터가 없습니다.'
      };
    }

    // item_id 별로 그룹화 (중복 제거)
    const itemIds = allItemData.map(item => item.item_id);
    const uniqueItemIds = itemIds.filter((itemId, index) => itemIds.indexOf(itemId) === index);
    
    console.log(`🚀 일반쿠팡 API - extract_coupang_item_all에서 ${allItemData.length}개 데이터 발견`);
    console.log(`🎯 일반쿠팡 API - 중복 제거 후 ${uniqueItemIds.length}개 고유 item_id로 이미지 정보를 가져옵니다.`);

    // 선택된 상품만 처리하는 경우 기존 데이터를 삭제하지 않고, 해당 상품만 업데이트
    if (selectedItemIds.length > 0) {
      // 선택된 상품들의 기존 데이터만 삭제
      onProgress?.(0, uniqueItemIds.length, '선택된 상품의 기존 이미지 데이터 삭제 중...');
      console.log(`🗑️ 일반쿠팡 API - 선택된 ${selectedItemIds.length}개 상품의 기존 extract_coupang_item_info 데이터 삭제 중...`);
      
      const { error: deleteError } = await supabase
        .from('extract_coupang_item_info')
        .delete()
        .eq('user_id', userId)
        .in('item_id', selectedItemIds);
      
      if (deleteError) {
        console.error('❌ 일반쿠팡 API - 선택된 상품의 기존 데이터 삭제 오류:', deleteError);
        return {
          success: false,
          totalProcessed: 0,
          totalSaved: 0,
          error: `선택된 상품의 기존 데이터 삭제 실패: ${deleteError.message}`
        };
      }
      
      console.log('✅ 일반쿠팡 API - 선택된 상품의 기존 이미지 데이터 삭제 완료');
    } else {
      // 전체 처리하는 경우 모든 기존 데이터 삭제
      onProgress?.(0, uniqueItemIds.length, '기존 이미지 데이터 삭제 중...');
      console.log(`🗑️ 일반쿠팡 API - 사용자 ${userId}의 모든 기존 extract_coupang_item_info 데이터 삭제 중...`);
      
      const { error: deleteError } = await supabase
        .from('extract_coupang_item_info')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('❌ 일반쿠팡 API - 기존 데이터 삭제 오류:', deleteError);
        return {
          success: false,
          totalProcessed: 0,
          totalSaved: 0,
          error: `기존 데이터 삭제 실패: ${deleteError.message}`
        };
      }
      
      console.log('✅ 일반쿠팡 API - 모든 기존 이미지 데이터 삭제 완료');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));

    let totalProcessed = 0;
    let totalSaved = 0;
    // 🛠️ API 호출 최적화: 배치 크기 축소 (8 → 3) - Normal API
    const BATCH_SIZE = 3; // 더 보수적인 배치 크기로 API 서버 부하 감소
    // 🛠️ API 호출 최적화: 딜레이 증가 (100ms → 500ms)
    const BATCH_DELAY = 500; // Rate limiting 방지를 위한 더 긴 딜레이

    // 배치별로 처리
    for (let i = 0; i < uniqueItemIds.length; i += BATCH_SIZE) {
      const batch = uniqueItemIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(uniqueItemIds.length / BATCH_SIZE);
      
      const progressMessage = selectedItemIds.length > 0 
        ? `일반쿠팡 API - 선택된 상품 배치 ${batchNumber}/${totalBatches} 이미지 정보 가져오는 중... (${batch.length}개 병렬 처리)`
        : `일반쿠팡 API - 배치 ${batchNumber}/${totalBatches} 이미지 정보 가져오는 중... (${batch.length}개 병렬 처리)`;
      
      onProgress?.(
        i + batch.length, 
        uniqueItemIds.length, 
        progressMessage
      );

      console.log(`📦 일반쿠팡 API - 배치 ${batchNumber}/${totalBatches}: ${batch.length}개 상품 이미지 정보 병렬 처리 시작`);

      // 현재 배치를 병렬로 처리
      const batchPromises = batch.map(async (itemId) => {
        try {
          const result = await fetchAndSaveProductInfoNormal(itemId);
          return { itemId, ...result };
        } catch (error) {
          console.error(`❌ 일반쿠팡 API - 상품 ${itemId} 이미지 정보 처리 실패:`, error);
          return { 
            itemId, 
            success: false, 
            itemCount: 0, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
          };
        }
      });

      // 배치 완료 대기 (실패해도 계속 진행)
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 결과 집계
      batchResults.forEach((result) => {
        totalProcessed++;
        if (result.status === 'fulfilled' && result.value.success) {
          totalSaved += result.value.itemCount;
        }
      });

      console.log(`✅ 일반쿠팡 API - 배치 ${batchNumber} 완료: ${batch.length}개 처리 (누적: ${totalProcessed}/${uniqueItemIds.length})`);

      // 다음 배치 전 짧은 딜레이 (마지막 배치가 아닌 경우만)
      if (i + BATCH_SIZE < uniqueItemIds.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    const resultMessage = selectedItemIds.length > 0 
      ? `일반쿠팡 API - 선택된 상품 이미지 정보 가져오기 완료! ${totalProcessed}개 상품 처리, ${totalSaved}개 옵션 저장`
      : `일반쿠팡 API - 모든 상품 이미지 정보 가져오기 완료! ${totalProcessed}개 상품 처리, ${totalSaved}개 옵션 저장`;
    
    console.log(`🎉 ${resultMessage}`);

    return {
      success: true,
      totalProcessed,
      totalSaved
    };

  } catch (error) {
    console.error('❌ 일반쿠팡 API - 이미지 정보 가져오기 오류:', error);
    return {
      success: false,
      totalProcessed: 0,
      totalSaved: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 일반쿠팡 API로 상품 상세 정보 조회
 */
async function fetchCoupangProductDetailNormal(sellerProductId: string): Promise<CoupangProductDetailResponse> {
  // 쿠팡 API 설정
  const COUPANG_CONFIG = {
    HOST: 'api-gateway.coupang.com',
    ACCESS_KEY: '6a9d9ee7-f252-4086-9a9c-306a38c70223',
    SECRET_KEY: 'c21e858a7d60e2c895b1534edf8801729634f18e',
    VENDOR_ID: 'A00312592'
  };

  const path = `/seller-products/${sellerProductId}`;
  const query = `vendorId=${COUPANG_CONFIG.VENDOR_ID}`;
  const method = 'GET';
  
  // HMAC Signature 생성
  const authorization = await generateHmacSignature(method, `/v2/providers/seller_api/apis/api/v1/marketplace${path}`, query, COUPANG_CONFIG.SECRET_KEY, COUPANG_CONFIG.ACCESS_KEY);
  
  const url = `http://localhost:3002/api/marketplace${path}?${query}`;
  
  console.log(`🌐 일반쿠팡 API 호출: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`일반쿠팡 API HTTP 오류: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`📥 일반쿠팡 API 응답 수신: ${sellerProductId}`);
  
  return data;
}

/**
 * 로켓그로스 API로 상품 상세 정보 조회 (일반쿠팡 API와 동일한 방식)
 */
async function fetchCoupangProductDetailRocketGrowth(sellerProductId: string): Promise<CoupangProductDetailResponse> {
  // 쿠팡 API 설정
  const COUPANG_CONFIG = {
    HOST: 'api-gateway.coupang.com',
    ACCESS_KEY: '6a9d9ee7-f252-4086-9a9c-306a38c70223',
    SECRET_KEY: 'c21e858a7d60e2c895b1534edf8801729634f18e',
    VENDOR_ID: 'A00312592'
  };

  const path = `/seller-products/${sellerProductId}`;
  const query = `vendorId=${COUPANG_CONFIG.VENDOR_ID}`;
  const method = 'GET';
  
  // HMAC Signature 생성
  const authorization = await generateHmacSignature(method, `/v2/providers/seller_api/apis/api/v1/marketplace${path}`, query, COUPANG_CONFIG.SECRET_KEY, COUPANG_CONFIG.ACCESS_KEY);
  
  const url = `http://localhost:3002/api/marketplace${path}?${query}`;
  
  console.log(`🌐 로켓그로스 API 호출: ${url}`);
  console.log(`🔐 Authorization 헤더:`, authorization);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json',
    },
  });

  console.log(`📊 로켓그로스 API 응답 상태: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ 로켓그로스 API 오류 응답:`, errorText);
    throw new Error(`로켓그로스 API HTTP 오류: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`📥 로켓그로스 API 응답 수신: ${sellerProductId}`, data);
  
  return data;
}
 