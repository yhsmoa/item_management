/**
 * 주문 조회 관련 타입 정의
 */

/**
 * 구글 시트 데이터 타입 (chinaorder_googlesheet_all)
 */
export interface GoogleSheetOrderData {
  id: string;
  user_id: string;
  shipment_info: string;  // V열 데이터 (예: "P-14100146147591 홍유정" 또는 "P-홍유정")
  sheet_name: string;
  order_number: string;
  china_order_number: string;
  item_name: string;
  option_name: string;
  barcode: string;
  order_qty: number;
  // ... 기타 필드들
}

/**
 * 주문 검색 결과 타입
 */
export interface OrderSearchResult {
  orderId: string;           // coupang_personal_order의 ID
  orderNumber: string;        // 주문번호
  recipientName: string;      // 수취인명
  matchedGoogleSheetId: string; // 매칭된 구글시트 데이터의 ID
  matchType: 'order_number' | 'recipient_name'; // 매칭 방식
}

/**
 * 주문 조회 요청 파라미터
 */
export interface OrderSearchRequest {
  user_id: string;
}

/**
 * 주문 조회 응답
 */
export interface OrderSearchResponse {
  success: boolean;
  message: string;
  data?: {
    matched_count: number;
    results: OrderSearchResult[];
  };
  error?: string;
}
