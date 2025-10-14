/**
 * 주문 조회 Hook
 * - 주문 조회 버튼 클릭 시 사용
 * - coupang_personal_order의 데이터를 chinaorder_googlesheet_all에서 검색
 */

import { useState } from 'react';
import { searchOrders } from '../../../services/orderSearchService';

/**
 * 현재 로그인한 사용자 ID 가져오기
 */
function getCurrentUserId(): string | null {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return currentUser.id || currentUser.user_id || null;
  } catch (error) {
    return null;
  }
}

export const useOrderSearch = (onSuccess?: () => void) => {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 주문 조회 핸들러
   */
  const handleOrderSearch = async (): Promise<void> => {
    const userId = getCurrentUserId();

    if (!userId) {
      alert('로그인한 사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await searchOrders(userId);

      if (result.success && result.data) {
        alert(
          `주문 조회 완료!\n` +
          `매칭된 주문: ${result.data.matched_count}개`
        );

        // 성공 콜백 실행 (데이터 리로드 등)
        if (onSuccess) {
          onSuccess();
        }
      } else {
        alert(result.message || '주문 조회에 실패했습니다.');
      }
    } catch (error) {
      console.error('주문 조회 오류:', error);
      alert('주문 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleOrderSearch,
  };
};
