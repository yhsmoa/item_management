import { supabase } from '../config/supabase';

export interface ChinaOrderDataAll {
  user_id: string;
  order_number?: string;
  option_id?: string;
  china_order_number?: string;
  date?: string;
  item_name?: string;
  option_name?: string;
  barcode?: string;
  order_qty?: number;
  china_option1?: string;
  china_option2?: string;
  china_price?: number;
  china_total_price?: number;
  img_url?: string;
  china_link?: string;
  order_status_ordering?: number;
  note?: string;
  confirm_order_id?: string;
  confirm_shipment_id?: string;
  composition?: string;
  order_status_import?: number;
  order_status_cancel?: number;
  order_status_shipment?: number;
  sheet_name?: string;
  id: string;
  shipment_info?: string;
}

/**
 * 시트 이름을 코드로 변환
 */
const getSheetCode = (sheetName: string): string => {
  const sheetCodeMap: { [key: string]: string } = {
    '신규': 'N',
    '결제': 'P',
    '진행': 'O',
    '취소': 'C',
    '출고': 'D'
  };
  return sheetCodeMap[sheetName] || 'N';
};

/**
 * 구글 시트 데이터를 Supabase에 저장
 */
export const importGoogleSheetsDataAll = async (userId: string): Promise<{success: boolean, error?: string}> => {
  try {
    console.log('📊 구글 시트 데이터 가져오기 시작...');

    // 백엔드 API 호출하여 구글 시트 데이터 가져오기
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/googlesheets/import-data-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || '백엔드 API 호출 실패' };
    }

    const data = await response.json();

    // 백엔드에서 이미 데이터를 처리했다면 성공 반환
    if (data.success) {
      console.log('✅ 구글 시트 데이터 가져오기 성공');
      return { success: true };
    }

    // 만약 백엔드에서 데이터만 반환한다면 여기서 처리
    if (data.sheets) {
      console.log('🔄 Supabase에 데이터 저장 시작...');

      // 1. 기존 데이터 삭제
      const { error: deleteError } = await supabase
        .from('chinaorder_googlesheet_all')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ 기존 데이터 삭제 실패:', deleteError);
        return { success: false, error: `기존 데이터 삭제 실패: ${deleteError.message}` };
      }

      console.log('✅ 기존 데이터 삭제 완료');

      // 2. 시트별로 데이터 처리 및 삽입
      const sheetNames = ['신규', '결제', '진행', '취소', '출고'];
      let totalInserted = 0;

      for (const sheetName of sheetNames) {
        const sheetData = data.sheets[sheetName];
        if (!sheetData || sheetData.length === 0) {
          console.log(`⚠️ ${sheetName} 시트 데이터 없음`);
          continue;
        }

        console.log(`📝 ${sheetName} 시트 처리 중... (${sheetData.length}행)`);

        const sheetCode = getSheetCode(sheetName);
        const businessCode = sheetData[0]?.businessCode || 'HI'; // B1 셀의 사업자 코드

        // 데이터 변환
        const insertData: ChinaOrderDataAll[] = sheetData.map((row: any, index: number) => {
          const rowNumber = index + 1;
          const id = `${businessCode}-${sheetCode}-${rowNumber}`;

          return {
            id,
            user_id: userId,
            order_number: row.order_number || '',
            option_id: row.option_id || '',
            china_order_number: row.china_order_number || '',
            date: row.date || '',
            item_name: row.item_name || '',
            option_name: row.option_name || '',
            barcode: row.barcode || '',
            order_qty: parseInt(row.order_qty) || 0,
            china_option1: row.china_option1 || '',
            china_option2: row.china_option2 || '',
            china_price: parseFloat(row.china_price) || 0,
            china_total_price: parseFloat(row.china_total_price) || 0,
            img_url: row.img_url || '',
            china_link: row.china_link || '',
            order_status_ordering: parseInt(row.order_status_ordering) || 0,
            note: row.note || '',
            confirm_order_id: row.confirm_order_id || '',
            confirm_shipment_id: row.confirm_shipment_id || '',
            composition: row.composition || '',
            order_status_import: parseInt(row.order_status_import) || 0,
            order_status_cancel: parseInt(row.order_status_cancel) || 0,
            order_status_shipment: parseInt(row.order_status_shipment) || 0,
            sheet_name: sheetCode,
            shipment_info: row.shipment_info || ''
          };
        });

        // 배치로 삽입 (500개씩)
        const BATCH_SIZE = 500;
        for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
          const batch = insertData.slice(i, i + BATCH_SIZE);

          const { error: insertError } = await supabase
            .from('chinaorder_googlesheet_all')
            .insert(batch);

          if (insertError) {
            console.error(`❌ ${sheetName} 데이터 삽입 실패:`, insertError);
            return { success: false, error: `${sheetName} 데이터 삽입 실패: ${insertError.message}` };
          }

          totalInserted += batch.length;
          console.log(`✅ ${sheetName} 배치 삽입 완료 (${i + batch.length}/${insertData.length})`);
        }
      }

      console.log(`✅ 총 ${totalInserted}개 데이터 삽입 완료`);
      return { success: true };
    }

    return { success: false, error: '데이터 형식이 올바르지 않습니다.' };

  } catch (error: any) {
    console.error('❌ 구글 시트 데이터 가져오기 오류:', error);
    return { success: false, error: `오류 발생: ${error.message}` };
  }
};
