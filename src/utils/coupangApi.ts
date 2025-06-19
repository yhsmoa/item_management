// 쿠팡 API 설정
const COUPANG_CONFIG = {
  HOST: 'api-gateway.coupang.com',
  ACCESS_KEY: '6a9d9ee7-f252-4086-9a9c-306a38c70223',
  SECRET_KEY: 'c21e858a7d60e2c895b1534edf8801729634f18e',
  VENDOR_ID: 'A00312592'
};

/**
 * 문자열을 ArrayBuffer로 변환
 */
export function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * ArrayBuffer를 Hex 문자열로 변환
 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * HMAC Signature 생성 (Node.js 예시와 동일한 방식)
 */
export async function generateHmacSignature(method: string, path: string, query: string, secretKey: string, accessKey: string): Promise<string> {
  // Node.js 예시와 동일한 날짜 형식: substr(2,17).replace(/:/gi, '').replace(/-/gi, '') + 'Z'
  const datetime = new Date().toISOString().substr(2,17).replace(/:/gi, '').replace(/-/gi, '') + 'Z';
  
  // Node.js 예시와 동일: query 파라미터 그대로 사용 (? 없이)
  const message = `${datetime}${method}${path}${query}`;
  
  console.log('🔐 HMAC 생성 정보:', {
    datetime,
    method,
    path,
    query,
    message
  });
  
  // 키를 ArrayBuffer로 변환
  const key = await crypto.subtle.importKey(
    'raw',
    stringToArrayBuffer(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // HMAC 서명 생성
  const signature = await crypto.subtle.sign('HMAC', key, stringToArrayBuffer(message));
  const signatureHex = arrayBufferToHex(signature);
  
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signatureHex}`;
  console.log('🔐 Authorization 헤더:', authorization);
  
  return authorization;
}

/**
 * 쿠팡 상품 목록 페이징 조회
 */
export async function fetchCoupangProducts(nextToken?: string, maxPerPage: number = 10) {
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  
  // 쿼리 파라미터 구성
  const queryParams = new URLSearchParams({
    vendorId: COUPANG_CONFIG.VENDOR_ID,
    ...(nextToken && { nextToken }),
    maxPerPage: maxPerPage.toString()
  });
  
  const query = queryParams.toString();
  const fullPath = `${path}?${query}`;
  const method = 'GET';
  
  // HMAC Signature 생성 (path + query 분리하여 전달)
  const authorization = await generateHmacSignature(method, path, query, COUPANG_CONFIG.SECRET_KEY, COUPANG_CONFIG.ACCESS_KEY);
  
  // 프록시 서버를 통해 호출 (CORS 문제 해결)
  const url = `http://localhost:3002/api/coupang${fullPath}`;
  
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('쿠팡 API 호출 오류:', error);
    throw error;
  }
}

/**
 * 쿠팡 API 응답 데이터 타입
 */
export interface CoupangProduct {
  sellerProductId: string;
  sellerProductName: string;
  displayCategoryCode: number;
  categoryId: number;
  productId: number;
}

export interface CoupangApiResponse {
  code: string;
  message: string;
  nextToken: string;
  data: CoupangProduct[];
}

/**
 * 쿠팡 상품 상세 정보 조회 (최적화된 버전)
 */
export async function fetchCoupangProductDetail(sellerProductId: string, retries: number = 2) {
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${sellerProductId}`;
  const query = `vendorId=${COUPANG_CONFIG.VENDOR_ID}`;
  const method = 'GET';
  
  // HMAC Signature 생성
  const authorization = await generateHmacSignature(method, path, query, COUPANG_CONFIG.SECRET_KEY, COUPANG_CONFIG.ACCESS_KEY);
  
  // 프록시 서버를 통해 호출 (CORS 문제 해결)
  const url = `http://localhost:3002/api/coupang${path}?${query}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // AbortController로 timeout 구현
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 timeout
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`404: 상품이 존재하지 않습니다 (sellerProductId: ${sellerProductId})`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      if (attempt === retries) {
        console.error(`쿠팡 상품 상세 조회 최종 실패 (${retries + 1}회 시도):`, error);
        throw error;
      }
      
      console.warn(`쿠팡 상품 상세 조회 실패 (${attempt + 1}/${retries + 1}회), 재시도 중...`, error);
      
      // 재시도 전 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * 쿠팡 상품 아이템 정보 (옵션별)
 */
export interface CoupangItemInfo {
  vendorItemId: number;
  itemName: string;
  barcode?: string;
  salePrice: number;
  images?: Array<{
    cdnPath?: string;
    vendorPath?: string;
  }>;
}

/**
 * 쿠팡 상품 상세 정보 응답
 */
export interface CoupangProductDetailResponse {
  code: string;
  message: string;
  data: {
    sellerProductId: number;
    sellerProductName: string;
    items: Array<{
      itemName: string;
      images?: Array<{
        cdnPath?: string;
        vendorPath?: string;
      }>;
      rocketGrowthItemData?: {
        vendorItemId: number;
        barcode?: string;
        priceData: {
          salePrice: number;
        };
      };
      marketplaceItemData?: {
        vendorItemId: number;
        barcode?: string;
        priceData: {
          salePrice: number;
        };
      };
    }>;
  };
} 