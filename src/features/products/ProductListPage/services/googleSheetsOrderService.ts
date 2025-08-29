// Google Sheets order service for appending order data

/**
 * 주문 데이터 타입 정의
 */
export interface OrderRowData {
  item_name: string;    // C col
  option_name: string;  // D col  
  quantity: number;     // E col - '입력' 값
  barcode?: string;     // F col
  option_id: string;    // 옵션 ID
}

/**
 * 주문 데이터를 백엔드 API를 통해 Google Sheets '신규' 시트에 추가
 * @param userId 사용자 ID
 * @param inputValues 입력된 수량 데이터 {cellId: quantity}
 * @param allProductData 모든 상품 데이터 배열
 * @returns Promise<{success: boolean, addedCount: number, error?: string}>
 */
export async function appendOrderDataToGoogleSheets(
  userId: string, 
  inputValues: {[key: string]: string},
  allProductData: any[]
): Promise<{success: boolean, addedCount: number, error?: string}> {
  try {
    console.log('🚀 Google Sheets 주문 데이터 추가 시작...');

    // 1. 입력된 데이터 필터링 및 변환
    const validInputs = Object.entries(inputValues).filter(([_, quantity]) => {
      const numQuantity = Number(quantity);
      return !isNaN(numQuantity) && numQuantity > 0;
    });

    if (validInputs.length === 0) {
      return {
        success: false,
        addedCount: 0,
        error: '입력된 주문 데이터가 없습니다.'
      };
    }

    console.log('📦 유효한 주문 데이터:', validInputs.length + '개');

    // 2. 상품 데이터와 매칭하여 주문 배열 생성
    const orders: OrderRowData[] = [];

    for (const [cellId, quantity] of validInputs) {
      // cellId에서 item_id와 option_id 추출 (형식: input-{item_id}-{option_id})
      const parts = cellId.split('-');
      if (parts.length < 3) continue;
      
      const itemId = parts[1];
      const optionId = parts[2];

      // 해당 상품 데이터 찾기
      const productData = allProductData.find(item => 
        item.item_id === itemId && (item.option_id === optionId || String(item.option_id) === optionId)
      );

      if (productData) {
        orders.push({
          item_name: productData.item_name || '',
          option_name: productData.option_name || '',
          quantity: Number(quantity),
          barcode: productData.barcode || '',
          option_id: optionId
        });
        
        console.log('📝 주문 데이터 생성:', {
          item_name: productData.item_name,
          option_name: productData.option_name,
          quantity,
          option_id: optionId
        });
      } else {
        console.warn('⚠️ 상품 데이터를 찾을 수 없음:', { cellId, itemId, optionId });
      }
    }

    if (orders.length === 0) {
      return {
        success: false,
        addedCount: 0,
        error: '매칭되는 상품 데이터가 없습니다.'
      };
    }

    // 3. 백엔드 API를 통해 Google Sheets에 일괄 추가
    console.log('🌐 백엔드 API를 통한 Google Sheets 데이터 추가...');
    
    const response = await fetch('http://localhost:3001/api/googlesheets/batch-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        orders: orders
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ 백엔드 API 호출 실패:', errorData);
      return {
        success: false,
        addedCount: 0,
        error: errorData.message || `API 호출 실패: ${response.status}`
      };
    }

    const responseData = await response.json();
    console.log('✅ 구글 시트에 데이터 추가 완료:', responseData);

    return {
      success: responseData.success,
      addedCount: responseData.data?.processed_count || 0,
      error: responseData.success ? undefined : responseData.message
    };

  } catch (error: any) {
    console.error('❌ appendOrderDataToGoogleSheets 에러:', error);
    return {
      success: false,
      addedCount: 0,
      error: `예기치 못한 오류: ${error.message}`
    };
  }
}