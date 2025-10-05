import { useState } from 'react';
import { supabase } from '../../../../config/supabase';

/**
 * 정보 불러오기 훅
 * 바코드를 기반으로 chinaorder_googlesheet에서 이전 주문 정보를 조회하여 테이블에 반영
 */

interface OrderInfoResult {
  china_option1?: string;
  china_option2?: string;
  china_price?: string;
  china_link?: string;
  img_url?: string;
}

export const useLoadOrderInfo = () => {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 현재 로그인한 사용자 ID 가져오기
   */
  const getCurrentUserId = (): string | null => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return currentUser.id || null;
    } catch (error) {
      console.error('❌ 사용자 정보 읽기 오류:', error);
      return null;
    }
  };

  /**
   * 바코드로 chinaorder_googlesheet에서 이전 주문 정보 조회
   * @param barcode - 조회할 바코드
   * @returns 주문 정보 또는 null
   */
  const fetchOrderInfoByBarcode = async (barcode: string): Promise<OrderInfoResult | null> => {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('❌ 사용자 ID를 찾을 수 없습니다.');
      return null;
    }

    if (!barcode || barcode.trim() === '') {
      console.log('⚠️ 바코드가 비어있어 조회를 건너뜁니다.');
      return null;
    }

    try {
      console.log(`🔍 바코드 조회 시작: ${barcode}`);

      // chinaorder_googlesheet에서 user_id와 barcode로 조회 (데이터 1개)
      const { data, error } = await supabase
        .from('chinaorder_googlesheet')
        .select('china_option1, china_option2, china_price, china_link, img_url')
        .eq('user_id', userId)
        .eq('barcode', barcode)
        .limit(1);

      if (error) {
        console.error('❌ Supabase 조회 오류:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log(`📭 바코드 ${barcode}에 대한 이전 주문 정보를 찾을 수 없습니다.`);
        return null;
      }

      const orderInfo = data[0];
      console.log(`✅ 바코드 ${barcode} 조회 성공:`, orderInfo);

      return orderInfo;

    } catch (error) {
      console.error(`❌ 바코드 ${barcode} 조회 중 예외 발생:`, error);
      return null;
    }
  };

  /**
   * 여러 바코드에 대해 일괄 조회
   * @param barcodes - 조회할 바코드 배열
   * @returns 바코드를 키로 하는 주문 정보 맵
   */
  const fetchOrderInfoBatch = async (barcodes: string[]): Promise<Map<string, OrderInfoResult>> => {
    const resultMap = new Map<string, OrderInfoResult>();

    // 중복 제거 및 빈 값 필터링
    const uniqueBarcodes = Array.from(new Set(barcodes.filter(b => b && b.trim() !== '')));

    console.log(`📦 일괄 조회 시작: ${uniqueBarcodes.length}개 바코드`);

    for (const barcode of uniqueBarcodes) {
      const info = await fetchOrderInfoByBarcode(barcode);
      if (info) {
        resultMap.set(barcode, info);
      }
    }

    console.log(`✅ 일괄 조회 완료: ${resultMap.size}개 정보 조회됨`);

    return resultMap;
  };

  /**
   * 정보 불러오기 메인 함수
   * @param orderData - 현재 테이블의 주문 데이터 배열
   * @param onUpdate - 데이터 업데이트 콜백 함수
   */
  const loadOrderInfo = async (
    orderData: any[],
    onUpdate: (updatedData: any[]) => void
  ): Promise<void> => {
    setIsLoading(true);

    try {
      console.log('🔄 정보 불러오기 시작:', orderData.length, '개 항목');

      // 모든 바코드 수집
      const barcodes = orderData
        .map(order => order.barcode)
        .filter(barcode => barcode && barcode.trim() !== '');

      if (barcodes.length === 0) {
        alert('바코드가 있는 항목이 없습니다.');
        return;
      }

      // 일괄 조회
      const orderInfoMap = await fetchOrderInfoBatch(barcodes);

      if (orderInfoMap.size === 0) {
        alert('조회된 이전 주문 정보가 없습니다.');
        return;
      }

      // 데이터 업데이트
      const updatedData = orderData.map(order => {
        const barcode = order.barcode;
        if (!barcode) return order;

        const info = orderInfoMap.get(barcode);
        if (!info) return order;

        // 정보 병합
        return {
          ...order,
          china_option1: info.china_option1 || order.china_option1,
          china_option2: info.china_option2 || order.china_option2,
          china_price: info.china_price || order.china_price,
          china_link: info.china_link || order.china_link,
          image_url: info.img_url || order.image_url,
        };
      });

      console.log('✅ 데이터 업데이트 완료');

      // 콜백 실행
      onUpdate(updatedData);

      alert(`${orderInfoMap.size}개 항목의 정보를 불러왔습니다.`);

    } catch (error) {
      console.error('❌ 정보 불러오기 실패:', error);
      alert('정보 불러오기 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    loadOrderInfo,
    fetchOrderInfoByBarcode,
    fetchOrderInfoBatch,
  };
};
