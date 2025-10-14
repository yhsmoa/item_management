/**
 * 주문 조회 서비스
 * coupang_personal_order와 chinaorder_googlesheet_all을 매칭하여 사입상태를 조회
 */

import { OrderSearchResponse } from '../features/orders/types/orderSearch.types';

// 백엔드 URL 설정 (프로덕션 환경 자동 감지)
const backendUrl = process.env.REACT_APP_BACKEND_URL ||
  (window.location.hostname === '13.125.220.142'
    ? 'http://13.125.220.142:3001'
    : 'http://localhost:3001');

/**
 * 주문 조회 API 호출
 * @param userId 사용자 ID
 * @returns 조회 결과
 */
export const searchOrders = async (userId: string): Promise<OrderSearchResponse> => {
  try {
    console.log('📊 주문 조회 시작...', { userId });

    const response = await fetch(`${backendUrl}/api/orders/search-purchase-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: OrderSearchResponse = await response.json();

    if (result.success) {
      console.log('✅ 주문 조회 완료:', result.data);
    } else {
      console.error('❌ 주문 조회 실패:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ 주문 조회 API 호출 오류:', error);

    return {
      success: false,
      message: '주문 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
};
