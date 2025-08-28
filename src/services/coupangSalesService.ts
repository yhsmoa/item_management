import { supabase } from '../config/supabase';

export interface CoupangSalesData {
  option_id: string;
  item_id: string;
  sales: number;
  user_id: string;
  created_at?: string;
}

/**
 * 현재 로그인한 사용자 ID를 가져오는 함수
 */
function getCurrentUserId(): string | null {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) return null;
  
  try {
    const user = JSON.parse(currentUser);
    return user.id || null;
  } catch (error) {
    console.error('사용자 정보 파싱 오류:', error);
    return null;
  }
}

/**
 * coupang_sales 테이블에서 현재 사용자의 판매량 데이터를 가져오는 함수
 */
export async function fetchCoupangSalesData(): Promise<{[key: string]: number}> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.warn('사용자가 로그인되지 않았습니다.');
      return {};
    }

    const { data, error } = await supabase
      .from('coupang_sales')
      .select('option_id, sales')
      .eq('user_id', userId);

    if (error) {
      console.error('coupang_sales 데이터 조회 실패:', error);
      return {};
    }

    if (!data || data.length === 0) {
      console.log('coupang_sales 데이터가 없습니다.');
      return {};
    }

    // option_id를 키로 하는 객체로 변환
    const salesMap: {[key: string]: number} = {};
    data.forEach((item: any) => {
      if (item.option_id && item.sales !== null && item.sales !== undefined) {
        salesMap[item.option_id] = parseInt(item.sales) || 0;
      }
    });

    console.log(`coupang_sales 데이터 로드 완료: ${Object.keys(salesMap).length}개 항목`);
    return salesMap;

  } catch (error) {
    console.error('coupang_sales 데이터 가져오기 실패:', error);
    return {};
  }
}