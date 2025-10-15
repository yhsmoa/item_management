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
    if (allOrderData.length > 0) {
      console.log(`📝 [ORDER_SEARCH] 첫 번째 주문 샘플:`, {
        order_number: allOrderData[0].order_number,
        recipient_name: allOrderData[0].recipient_name
      });
    }

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
        .select('id, order_row, shipment_info, order_qty, order_status_import, order_status_shipment, composition, sheet_name')
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
    if (allGoogleSheetData.length > 0) {
      console.log(`📝 [ORDER_SEARCH] 첫 번째 구글시트 샘플:`, {
        id: allGoogleSheetData[0].id,
        shipment_info: allGoogleSheetData[0].shipment_info
      });
    }

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

      // 3-1. order_number로 먼저 매칭 시도 (포함 검색)
      if (orderNumber) {
        matchedGoogleSheet = allGoogleSheetData.find(sheet => {
          const shipmentInfo = sheet.shipment_info || '';
          // shipment_info에 order_number가 포함되어 있는지 확인
          // 예: "P-14100146147591 홍유정"에서 "14100146147591" 포함 여부
          return shipmentInfo.includes(orderNumber);
        });

        if (matchedGoogleSheet) {
          matchType = 'order_number';
        }
      }

      // 3-2. order_number 매칭 실패 시 recipient_name으로 매칭 (일치 검색)
      if (!matchedGoogleSheet && recipientName) {
        matchedGoogleSheet = allGoogleSheetData.find(sheet => {
          const shipmentInfo = sheet.shipment_info || '';
          // "P-" 제거 후 정확히 일치하는지 확인
          // 예: "P-김흥수"에서 "P-"를 제거하면 "김흥수"
          const nameWithoutPrefix = shipmentInfo.replace(/^P-/, '').trim();
          return nameWithoutPrefix === recipientName;
        });

        if (matchedGoogleSheet) {
          matchType = 'recipient_name';
        }
      }

      // 3-3. 매칭 성공 시 결과 저장 및 업데이트
      if (matchedGoogleSheet) {
        // 취소(C) 시트는 스킵
        if (matchedGoogleSheet.sheet_name === 'C') {
          console.log(`⊘ [ORDER_SEARCH] 취소 시트 스킵: ${orderNumber || recipientName}`);
          continue;
        }

        // 상태 로직 계산
        const orderQty = matchedGoogleSheet.order_qty || 0;
        const orderStatusImport = matchedGoogleSheet.order_status_import || 0;
        const orderStatusShipment = matchedGoogleSheet.order_status_shipment || 0;
        const composition = matchedGoogleSheet.composition || '';
        const sheetName = matchedGoogleSheet.sheet_name || '';

        let purchaseStatus = '';

        // 상태 표시명 매핑
        const sheetNameMap = {
          'N': '신규',
          'P': '결제',
          'O': '진행'
        };

        // 상태 결정 로직
        // 1. 출고 완료: shipment = order_qty (둘 다 0보다 큼)
        if (orderStatusShipment > 0 && orderStatusShipment === orderQty) {
          purchaseStatus = '출고';
          // 출고번호(composition)가 있으면 추가
          if (composition) {
            purchaseStatus = `출고\n${composition}`;
          }
        }
        // 2. 입고 완료: import = order_qty (둘 다 0보다 큼)
        else if (orderStatusImport > 0 && orderStatusImport === orderQty) {
          purchaseStatus = '입고';
        }
        // 3. 나머지: 시트명 그대로 (신규/결제/진행)
        else {
          purchaseStatus = sheetNameMap[sheetName] || sheetName;
        }

        matchResults.push({
          orderId: order.id,
          orderNumber: orderNumber,
          recipientName: recipientName,
          matchedGoogleSheetId: matchedGoogleSheet.order_row, // order_row 사용
          matchType: matchType,
          purchaseStatus: purchaseStatus
        });

        // coupang_personal_order의 사입상태 컬럼 업데이트
        const { error: updateError } = await supabase
          .from('coupang_personal_order')
          .update({ purchase_status: purchaseStatus })
          .eq('id', order.id)
          .eq('user_id', user_id);

        if (updateError) {
          console.error(`❌ [ORDER_SEARCH] 업데이트 실패 (ID: ${order.id}):`, updateError);
        } else {
          matchedCount++;
          console.log(`✓ [ORDER_SEARCH] 매칭 성공 (${matchType}): ${orderNumber || recipientName} -> ${purchaseStatus.split('\n')[0]}`);
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
