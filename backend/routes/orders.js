/**
 * 주문 관련 API 라우트
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 주문 조회 API
 * @route POST /api/orders/search-purchase-status
 * @description coupang_personal_order와 chinaorder_googlesheet_all을 매칭하여 사입상태 조회
 *
 * 매칭 로직:
 * 1. coupang_personal_order의 order_number와 recipient_name 가져오기
 * 2. chinaorder_googlesheet_all의 shipment_info에서 "P-"로 시작하는 데이터 필터링
 * 3. shipment_info 형식: "P-14100146147591 홍유정" 또는 "P-홍유정"
 * 4. order_number 먼저 매칭 시도, 실패 시 recipient_name 매칭 시도
 * 5. 매칭되면 chinaorder_googlesheet_all의 id를 coupang_personal_order의 사입상태 컬럼에 저장
 */
router.post('/search-purchase-status', async (req, res) => {
  const startTime = Date.now();

  try {
    const { user_id } = req.body;

    console.log('🎯 [ENDPOINT] /api/orders/search-purchase-status 엔드포인트 호출됨!');
    console.log('📥 [ORDER_SEARCH] 주문 조회 시작:', {
      user_id,
      timestamp: new Date().toISOString()
    });

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id가 필요합니다.',
        error_code: 'INVALID_INPUT'
      });
    }

    // 1. coupang_personal_order에서 사용자의 주문 데이터 조회
    console.log('📋 [ORDER_SEARCH] 주문 데이터 조회 중...');

    let allOrderData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: orderBatch, error: orderError } = await supabase
        .from('coupang_personal_order')
        .select('id, order_number, recipient_name')
        .eq('user_id', user_id)
        .range(from, to);

      if (orderError) {
        throw new Error(`주문 데이터 조회 실패: ${orderError.message}`);
      }

      if (orderBatch && orderBatch.length > 0) {
        allOrderData = [...allOrderData, ...orderBatch];
        hasMore = orderBatch.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ [ORDER_SEARCH] 주문 데이터 조회 완료: ${allOrderData.length}개`);

    if (allOrderData.length === 0) {
      return res.json({
        success: true,
        message: '조회할 주문 데이터가 없습니다.',
        data: {
          matched_count: 0,
          results: []
        }
      });
    }

    // 2. chinaorder_googlesheet_all에서 "P-"로 시작하는 shipment_info 데이터 조회
    console.log('📊 [ORDER_SEARCH] 구글 시트 데이터 조회 중...');

    let allGoogleSheetData = [];
    page = 0;
    hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: sheetBatch, error: sheetError } = await supabase
        .from('chinaorder_googlesheet_all')
        .select('id, shipment_info')
        .eq('user_id', user_id)
        .like('shipment_info', 'P-%')
        .range(from, to);

      if (sheetError) {
        throw new Error(`구글 시트 데이터 조회 실패: ${sheetError.message}`);
      }

      if (sheetBatch && sheetBatch.length > 0) {
        allGoogleSheetData = [...allGoogleSheetData, ...sheetBatch];
        hasMore = sheetBatch.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ [ORDER_SEARCH] 구글 시트 데이터 조회 완료: ${allGoogleSheetData.length}개`);

    if (allGoogleSheetData.length === 0) {
      return res.json({
        success: true,
        message: '"P-"로 시작하는 구글 시트 데이터가 없습니다.',
        data: {
          matched_count: 0,
          results: []
        }
      });
    }

    // 3. 매칭 로직 수행
    console.log('🔍 [ORDER_SEARCH] 매칭 시작...');

    const matchResults = [];
    let matchedCount = 0;

    for (const order of allOrderData) {
      const orderNumber = order.order_number || '';
      const recipientName = order.recipient_name || '';

      let matchedGoogleSheet = null;
      let matchType = '';

      // 3-1. order_number로 먼저 매칭 시도
      if (orderNumber) {
        matchedGoogleSheet = allGoogleSheetData.find(sheet => {
          const shipmentInfo = sheet.shipment_info || '';
          // "P-14100146147591 홍유정" 형태에서 "P-" 뒤의 주문번호 추출
          const match = shipmentInfo.match(/^P-(\S+)/);
          if (match && match[1]) {
            return match[1] === orderNumber;
          }
          return false;
        });

        if (matchedGoogleSheet) {
          matchType = 'order_number';
        }
      }

      // 3-2. order_number 매칭 실패 시 recipient_name으로 매칭
      if (!matchedGoogleSheet && recipientName) {
        matchedGoogleSheet = allGoogleSheetData.find(sheet => {
          const shipmentInfo = sheet.shipment_info || '';
          // "P-홍유정" 또는 "P-14100146147591 홍유정" 형태에서 이름 추출
          // 공백이 있으면 공백 뒤의 텍스트를, 없으면 "P-" 뒤의 텍스트를 이름으로 간주
          if (shipmentInfo.includes(' ')) {
            const parts = shipmentInfo.split(' ');
            const name = parts.slice(1).join(' '); // 공백 뒤의 모든 텍스트
            return name === recipientName;
          } else {
            const name = shipmentInfo.replace(/^P-/, '');
            return name === recipientName;
          }
        });

        if (matchedGoogleSheet) {
          matchType = 'recipient_name';
        }
      }

      // 3-3. 매칭 성공 시 결과 저장 및 업데이트
      if (matchedGoogleSheet) {
        matchResults.push({
          orderId: order.id,
          orderNumber: orderNumber,
          recipientName: recipientName,
          matchedGoogleSheetId: matchedGoogleSheet.id,
          matchType: matchType
        });

        // coupang_personal_order의 사입상태 컬럼 업데이트
        const { error: updateError } = await supabase
          .from('coupang_personal_order')
          .update({ purchase_status: matchedGoogleSheet.id })
          .eq('id', order.id)
          .eq('user_id', user_id);

        if (updateError) {
          console.error(`❌ [ORDER_SEARCH] 업데이트 실패 (ID: ${order.id}):`, updateError);
        } else {
          matchedCount++;
          console.log(`✓ [ORDER_SEARCH] 매칭 성공 (${matchType}): ${orderNumber || recipientName} -> ${matchedGoogleSheet.id}`);
        }
      }
    }

    const processingTime = Date.now() - startTime;

    console.log('✅ [ORDER_SEARCH] 주문 조회 완료:', {
      total_orders: allOrderData.length,
      matched_count: matchedCount,
      processing_time_ms: processingTime
    });

    res.json({
      success: true,
      message: `총 ${matchedCount}개의 주문이 매칭되었습니다.`,
      data: {
        matched_count: matchedCount,
        results: matchResults
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('❌ [ORDER_SEARCH] 주문 조회 실패:', {
      error: error.message,
      stack: error.stack,
      processing_time_ms: processingTime
    });

    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error_code: 'INTERNAL_SERVER_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      processing_time_ms: processingTime
    });
  }
});

module.exports = router;
