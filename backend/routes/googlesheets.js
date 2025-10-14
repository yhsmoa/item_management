const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 안전한 숫자 변환 함수
function safeParseInt(value) {
  if (!value || value.toString().trim() === '' || value === undefined) {
    return null;
  }
  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

// Google Sheets API 인증 설정
function getGoogleSheetsAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  return auth;
}

/**
 * 주문 데이터를 구글시트에 일괄 저장하는 API (기업 수준)
 * @route POST /api/googlesheets/batch-orders
 * @description 여러 주문 데이터를 한 번에 구글시트에 저장
 * @param {string} user_id - 사용자 ID
 * @param {Array} orders - 주문 데이터 배열
 * @returns {Object} 처리 결과
 */
router.post('/batch-orders', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { user_id, orders } = req.body;
    
    console.log('📋 [BATCH_ORDERS] 일괄 주문 처리 시작:', {
      user_id,
      orders_count: orders?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    // 입력 데이터 검증
    if (!user_id || !orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id와 orders 배열이 필요합니다.',
        error_code: 'INVALID_INPUT'
      });
    }

    // 1. 사용자 정보 조회 및 구글시트 ID 확인
    console.log('🔍 [BATCH_ORDERS] 사용자 정보 조회 중...');
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData) {
      console.error('❌ [BATCH_ORDERS] 사용자 데이터 조회 실패:', userError);
      return res.status(404).json({ 
        success: false, 
        message: '사용자 정보를 찾을 수 없습니다.',
        error_code: 'USER_NOT_FOUND'
      });
    }

    const googlesheet_id = userData.googlesheet_id;
    console.log('✅ [BATCH_ORDERS] 구글시트 ID 확인:', googlesheet_id);

    if (!googlesheet_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자에게 연결된 구글시트가 없습니다.',
        error_code: 'GOOGLESHEET_NOT_FOUND'
      });
    }

    // 2. Google Sheets API 인증 및 초기화
    console.log('🔐 [BATCH_ORDERS] Google Sheets API 인증 중...');
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 3. 현재 시트 데이터 확인 (다음 빈 행 계산)
    console.log('📊 [BATCH_ORDERS] 시트 현황 확인 중...');
    const range = '신규!A:T';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googlesheet_id,
      range: range,
    });

    const existingData = response.data.values || [];
    const nextRow = Math.max(2, existingData.length + 1); // 헤더 제외하고 2행부터 시작
    
    console.log('📍 [BATCH_ORDERS] 시트 상태:', {
      existing_rows: existingData.length,
      next_start_row: nextRow
    });

    // 4. 일괄 데이터 준비
    console.log('🔄 [BATCH_ORDERS] 데이터 변환 중...');
    const today = new Date();
    const todayMMDD = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    const todayYYMMDD = String(today.getFullYear()).slice(2) + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    
    const batchData = [];
    const processedOrders = [];

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      
      try {
        // 데이터 검증 (barcode는 선택사항으로 변경)
        if (!order.item_name || !order.option_name || !order.quantity || !order.option_id) {
          console.warn(`⚠️ [BATCH_ORDERS] 주문 ${i + 1} 데이터 불완전:`, order);
          continue;
        }

        // 주문번호 생성 (H-YYMMDD-XXXX 형식)
        const orderNumber = `H-${todayYYMMDD}-${String(nextRow + i - 1).padStart(4, '0')}`;
        
        // 현재 행 번호 (스프레드시트 기준)
        const currentRow = nextRow + i;
        
        // 구글시트 행 데이터 구성 (A~T 컬럼)
        const rowData = [
          todayMMDD,           // A: 오늘 날짜 MMDD (일반 형태)
          orderNumber,         // B: 생성된 주문번호
          order.item_name,     // C: 아이템명
          order.option_name,   // D: 옵션명
          Number(order.quantity), // E: 수량
          order.barcode || '', // F: 바코드 (빈 값 허용)
          `=XLOOKUP($F${currentRow},'출고'!$F:$F,'출고'!G:G,"",0,-1)`, // G: XLOOKUP 수식
          `=XLOOKUP($F${currentRow},'출고'!$F:$F,'출고'!H:H,"",0,-1)`, // H: XLOOKUP 수식
          `=XLOOKUP($F${currentRow},'출고'!$F:$F,'출고'!I:I,"",0,-1)`, // I: XLOOKUP 수식
          `=XLOOKUP($F${currentRow},'출고'!$F:$F,'출고'!J:J,"",0,-1)`, // J: XLOOKUP 수식
          `=XLOOKUP($F${currentRow},'출고'!$F:$F,'출고'!K:K,"",0,-1)`, // K: XLOOKUP 수식
          `=XLOOKUP($F${currentRow},'출고'!$F:$F,'출고'!L:L,"",0,-1)`, // L: XLOOKUP 수식
          '', '', '', '',      // M~P: 빈 값 (향후 확장용)
          '', '', '',          // Q~S: 빈 값 (향후 확장용)
          order.option_id      // T: 옵션 ID
        ];

        batchData.push(rowData);
        processedOrders.push({
          row_number: nextRow + batchData.length - 1,
          item_name: order.item_name,
          option_name: order.option_name,
          quantity: order.quantity,
          option_id: order.option_id
        });

      } catch (error) {
        console.error(`❌ [BATCH_ORDERS] 주문 ${i + 1} 처리 실패:`, error);
      }
    }

    if (batchData.length === 0) {
      return res.status(400).json({
        success: false,
        message: '처리 가능한 주문 데이터가 없습니다.',
        error_code: 'NO_VALID_ORDERS'
      });
    }

    // 5. 구글시트에 일괄 저장
    console.log('💾 [BATCH_ORDERS] 구글시트에 일괄 저장 중...');
    const updateRange = `신규!A${nextRow}:T${nextRow + batchData.length - 1}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: googlesheet_id,
      range: updateRange,
      valueInputOption: 'USER_ENTERED', // 수식이 작동하도록 USER_ENTERED로 변경
      resource: {
        values: batchData
      },
    });

    // 6. XLOOKUP 수식을 값으로 변환 (G~L 컬럼)
    console.log('🔄 [BATCH_ORDERS] XLOOKUP 수식을 값으로 변환 중...');
    
    // G~L 컬럼 범위 설정
    const formulaRange = `신규!G${nextRow}:L${nextRow + batchData.length - 1}`;
    
    // 잠깐 기다려서 수식이 계산되도록 함
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 수식의 계산 결과값 읽기
    const formulaResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: googlesheet_id,
      range: formulaRange,
      valueRenderOption: 'FORMATTED_VALUE' // 계산된 값을 가져옴
    });
    
    const calculatedValues = formulaResponse.data.values || [];
    
    if (calculatedValues.length > 0) {
      // I, J열의 숫자값 처리 (작은따옴표 제거)
      const processedValues = calculatedValues.map(row => {
        return row.map((cell, colIndex) => {
          // I열(인덱스 2), J열(인덱스 3)의 숫자값 처리
          if ((colIndex === 2 || colIndex === 3) && typeof cell === 'string') {
            // 작은따옴표로 시작하는 숫자는 숫자로 변환
            if (cell.startsWith("'") && !isNaN(cell.substring(1))) {
              return Number(cell.substring(1));
            }
            // 숫자 문자열은 숫자로 변환
            if (!isNaN(cell)) {
              return Number(cell);
            }
          }
          return cell;
        });
      });
      
      // 계산된 값을 RAW 형태로 다시 덮어쓰기
      await sheets.spreadsheets.values.update({
        spreadsheetId: googlesheet_id,
        range: formulaRange,
        valueInputOption: 'RAW', // 값만 저장 (수식 제거)
        resource: {
          values: processedValues
        },
      });
      
      console.log('✅ [BATCH_ORDERS] 수식을 값으로 변환 완료:', {
        range: formulaRange,
        converted_rows: processedValues.length
      });
    }
    
    // 7. A열을 텍스트 형식으로 설정하고 값 입력
    console.log('📝 [BATCH_ORDERS] A열을 텍스트 형식으로 설정 중...');
    const startRowIndex = nextRow - 1; // 0-based index
    const endRowIndex = nextRow + batchData.length - 1;
    
    // A열의 셀 형식을 텍스트로 설정
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: googlesheet_id,
      resource: {
        requests: [{
          repeatCell: {
            range: {
              sheetId: 0, // '신규' 시트 ID (첫 번째 시트)
              startRowIndex: startRowIndex,
              endRowIndex: endRowIndex,
              startColumnIndex: 0, // A열
              endColumnIndex: 1    // A열
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'TEXT'
                }
              }
            },
            fields: 'userEnteredFormat.numberFormat'
          }
        }]
      }
    });
    
    // 셀 형식 설정 후 값만 입력
    const dateRange = `신규!A${nextRow}:A${nextRow + batchData.length - 1}`;
    const dateValues = batchData.map(row => [row[0]]); // 작은따옴표 없이 순수 값만
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: googlesheet_id,
      range: dateRange,
      valueInputOption: 'RAW', // RAW로 입력하되 셀 형식은 이미 텍스트로 설정됨
      resource: {
        values: dateValues
      },
    });
    
    console.log('✅ [BATCH_ORDERS] A열 텍스트 형식 설정 완료:', {
      range: dateRange
    });

    const processingTime = Date.now() - startTime;
    
    console.log('✅ [BATCH_ORDERS] 일괄 저장 완료:', {
      total_orders: orders.length,
      processed_orders: processedOrders.length,
      failed_orders: orders.length - processedOrders.length,
      range: updateRange,
      processing_time_ms: processingTime
    });

    // 6. 성공 응답
    res.json({ 
      success: true, 
      message: `${processedOrders.length}개 주문이 성공적으로 처리되었습니다.`,
      data: {
        googlesheet_id,
        range: updateRange,
        processed_count: processedOrders.length,
        failed_count: orders.length - processedOrders.length,
        processing_time_ms: processingTime,
        processed_orders: processedOrders
      },
      metadata: {
        timestamp: new Date().toISOString(),
        user_id,
        sheet_name: '신규'
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('❌ [BATCH_ORDERS] 일괄 처리 실패:', {
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

// 기존 단일 주문 API (하위 호환성)
router.post('/add-order', async (req, res) => {
  try {
    const { user_id, quantity } = req.body;
    
    console.log('🔍 요청 데이터:', { user_id, quantity });
    
    if (!user_id || !quantity) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id와 quantity가 필요합니다.' 
      });
    }

    // 1. users_api 테이블에서 해당 user_id의 googlesheet_id 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData) {
      console.error('❌ 사용자 데이터 조회 실패:', userError);
      return res.status(404).json({ 
        success: false, 
        message: '사용자 정보를 찾을 수 없습니다.' 
      });
    }

    const googlesheet_id = userData.googlesheet_id;
    console.log('✅ 구글시트 ID:', googlesheet_id);

    if (!googlesheet_id) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자에게 연결된 구글시트가 없습니다.' 
      });
    }

    // 2. Google Sheets API 인증
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 3. '신규' 시트의 E열에 데이터 추가
    // 먼저 현재 데이터 범위를 확인해서 빈 행을 찾음
    const range = '신규!E:E';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googlesheet_id,
      range: range,
    });

    // 다음 빈 행 계산 (헤더가 1행이므로 2행부터 시작)
    const existingData = response.data.values || [];
    const nextRow = Math.max(2, existingData.length + 1); // 최소 2행부터 시작

    // 데이터 입력
    const updateRange = `신규!E${nextRow}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: googlesheet_id,
      range: updateRange,
      valueInputOption: 'RAW',
      resource: {
        values: [[quantity]]
      },
    });

    console.log(`✅ 구글시트에 데이터 입력 완료: ${updateRange}에 ${quantity} 입력`);

    res.json({ 
      success: true, 
      message: '주문이 성공적으로 처리되었습니다.',
      data: {
        googlesheet_id,
        range: updateRange,
        quantity
      }
    });

  } catch (error) {
    console.error('❌ 구글시트 연동 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message 
    });
  }
});

/**
 * Google Sheets에서 데이터를 읽어와 Supabase에 저장하는 API
 * @route POST /api/googlesheets/import-data
 * @description '진행' 시트의 데이터를 읽어와서 chinaorder_googlesheet 테이블에 저장
 */
router.post('/import-data', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { user_id } = req.body;
    
    console.log('🎯 [ENDPOINT] /api/googlesheets/import-data 엔드포인트 호출됨!');
    console.log('📥 [IMPORT_DATA] 구글시트 데이터 가져오기 시작:', {
      user_id,
      timestamp: new Date().toISOString(),
      전체_요청_body: req.body,
      요청_헤더: req.headers
    });
    
    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id가 필요합니다.',
        error_code: 'INVALID_INPUT'
      });
    }

    // 1. 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData || !userData.googlesheet_id) {
      return res.status(404).json({ 
        success: false, 
        message: '사용자의 구글시트 정보를 찾을 수 없습니다.',
        error_code: 'GOOGLESHEET_NOT_FOUND'
      });
    }

    // 2. Google Sheets API로 '진행' 시트 데이터 읽기
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // '진행' 시트 데이터 읽기
    const progressResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.googlesheet_id,
      range: '진행!A:S', // A부터 S열까지
    });

    const progressRows = progressResponse.data.values || [];

    if (progressRows.length <= 1) {
      return res.json({
        success: true,
        message: '가져올 데이터가 없습니다.',
        data: { imported_count: 0, progress_count: 0 }
      });
    }

    // 3. 기존 '진행' 데이터 초기화
    console.log('🗑️ [IMPORT_DATA] 기존 진행 데이터 초기화 중...');
    const { error: deleteProgressError } = await supabase
      .from('chinaorder_googlesheet')
      .delete()
      .eq('user_id', user_id);

    if (deleteProgressError) {
      console.error('❌ [IMPORT_DATA] 기존 데이터 삭제 실패:', deleteProgressError);
      return res.status(500).json({
        success: false,
        message: '기존 데이터 삭제 중 오류가 발생했습니다.',
        error_code: 'DELETE_ERROR'
      });
    }

    // 4. '진행' 시트 데이터 변환 (첫 행은 헤더이므로 제외)
    const progressDataRows = progressRows.slice(1);
    const progressTransformedData = progressDataRows.map(row => ({
      user_id,
      china_order_number: row[1] || `AUTO_${Date.now()}_${index}`, // B열 - 고유값 생성
      order_number: '', // 빈값
      option_id: row[19] || '', // T열
      date: row[0] || '', // A열
      item_name: row[2] || '', // C열
      option_name: row[3] || '', // D열
      barcode: row[5] || '', // F열
      order_qty: safeParseInt(row[4]), // E열
      china_option1: row[6] || '', // G열
      china_option2: row[7] || '', // H열
      china_price: row[8] || null, // I열 - null 처리
      china_total_price: row[9] || null, // J열 - null 처리
      img_url: row[10] || '', // K열
      china_link: row[11] || '', // L열
      order_status_ordering: safeParseInt(row[12]), // M열
      order_status_import: safeParseInt(row[13]), // N열
      order_status_cancel: safeParseInt(row[14]), // O열
      order_status_shipment: safeParseInt(row[15]), // P열
      note: row[16] || '', // Q열 (수정: 17->16)
      confirm_order_id: row[17] || '', // R열 (수정: 18->17)
      confirm_shipment_id: row[18] || '' // S열 (수정: 19->18)
    }));

    // 5. Supabase에 '진행' 데이터 저장
    if (progressTransformedData.length > 0) {
      const { error: progressInsertError } = await supabase
        .from('chinaorder_googlesheet')
        .insert(progressTransformedData);

      if (progressInsertError) {
        console.error('❌ [IMPORT_DATA] 데이터베이스 저장 실패:', progressInsertError);
        return res.status(500).json({
          success: false,
          message: '데이터베이스 저장 중 오류가 발생했습니다.',
          error_code: 'DATABASE_ERROR'
        });
      }
    }

    const processingTime = Date.now() - startTime;

    console.log('✅ [IMPORT_DATA] 데이터 가져오기 완료:', {
      progress_count: progressTransformedData.length,
      processing_time_ms: processingTime
    });

    res.json({
      success: true,
      message: `진행: ${progressTransformedData.length}개의 데이터를 성공적으로 가져왔습니다.`,
      data: {
        progress_count: progressTransformedData.length,
        processing_time_ms: processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('❌ [IMPORT_DATA] 데이터 가져오기 실패:', {
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

/**
 * '신규' 시트 데이터를 직접 읽어서 반환 (Supabase 저장 안함)
 * @route POST /api/googlesheets/read-new-sheet
 * @description 신규주문 페이지에서 구글 시트 데이터를 직접 읽기
 */
router.post('/read-new-sheet', async (req, res) => {
  const startTime = Date.now();

  try {
    const { user_id } = req.body;

    console.log('🎯 [READ_NEW_SHEET] 신규 시트 직접 읽기 시작:', {
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

    // 1. 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData || !userData.googlesheet_id) {
      return res.status(404).json({
        success: false,
        message: '사용자의 구글시트 정보를 찾을 수 없습니다.',
        error_code: 'GOOGLESHEET_NOT_FOUND'
      });
    }

    // 2. Google Sheets API로 '신규' 시트 데이터 읽기
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const newResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.googlesheet_id,
      range: '신규!A:S', // A부터 S열까지
    });

    const newRows = newResponse.data.values || [];

    console.log('📊 [READ_NEW_SHEET] 신규 시트 원본 데이터:', {
      총_행수: newRows.length,
      첫번째_행_헤더: newRows[0]
    });

    // 헤더가 없거나 데이터가 없는 경우
    if (newRows.length === 0) {
      return res.json({
        success: true,
        message: '신규 시트가 비어있습니다.',
        data: []
      });
    }

    // 3. 데이터 변환 (첫 행은 헤더이므로 제외)
    const newDataRows = newRows.slice(1);
    const transformedData = newDataRows.map((row, index) => ({
      china_order_number: row[1] || '', // B열
      date: row[0] || '', // A열
      item_name: row[2] || '', // C열
      option_name: row[3] || '', // D열
      order_quantity: safeParseInt(row[4]), // E열
      barcode: row[5] || '', // F열
      china_option1: row[6] || '', // G열
      china_option2: row[7] || '', // H열
      china_price: row[8] || '', // I열
      china_total_price: row[9] || '', // J열
      image_url: row[10] || '', // K열
      china_link: row[11] || '', // L열
      order_status_ordering: row[12] || '', // M열
      order_status_check: row[13] || '', // N열
      order_status_cancel: row[14] || '', // O열
      order_status_shipment: row[15] || '', // P열
      remark: row[16] || '', // Q열
      confirm_order_id: row[17] || '', // R열
      confirm_shipment_id: row[18] || '', // S열
      option_id: row[19] || '' // T열
    }));

    const processingTime = Date.now() - startTime;

    console.log('✅ [READ_NEW_SHEET] 신규 시트 읽기 완료:', {
      data_count: transformedData.length,
      processing_time_ms: processingTime
    });

    res.json({
      success: true,
      message: `${transformedData.length}개의 신규 데이터를 불러왔습니다.`,
      data: transformedData,
      processing_time_ms: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('❌ [READ_NEW_SHEET] 신규 시트 읽기 실패:', {
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

/**
 * 단건 주문 데이터를 구글시트에 저장
 * @route POST /api/googlesheets/add-single-order
 */
router.post('/add-single-order', async (req, res) => {
  try {
    const { user_id, orderItems, productName } = req.body;

    console.log('📝 [ADD_SINGLE_ORDER] 단건 주문 저장 시작:', { user_id, items_count: orderItems?.length });

    if (!user_id || !orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'user_id와 orderItems가 필요합니다.'
      });
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData) {
      console.error('❌ [ADD_SINGLE_ORDER] 사용자 조회 실패:', userError);
      return res.status(404).json({
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.'
      });
    }

    const googlesheet_id = userData.googlesheet_id;
    console.log('✅ [ADD_SINGLE_ORDER] 구글시트 ID:', googlesheet_id);

    if (!googlesheet_id) {
      return res.status(400).json({
        success: false,
        message: '사용자에게 연결된 구글시트가 없습니다.'
      });
    }

    // Google Sheets API 인증
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 현재 시트 데이터 확인 (다음 빈 행 찾기)
    const range = '신규!A:L';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googlesheet_id,
      range: range,
    });

    const existingData = response.data.values || [];
    const nextRow = Math.max(2, existingData.length + 1); // 헤더 제외하고 2행부터 시작

    console.log('📍 [ADD_SINGLE_ORDER] 다음 입력 행:', nextRow);

    // 데이터 행 생성
    const rows = orderItems.map(item => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const totalPrice = quantity * unitPrice;

      return [
        '',                           // A: 빈 값
        '',                           // B: 빈 값
        productName || '',            // C: 등록상품명
        item.optionName || '',        // D: 옵션명
        quantity,                     // E: 수량
        item.barcode || '',           // F: 바코드
        item.chinaOption1 || '',      // G: 중국옵션 1
        item.chinaOption2 || '',      // H: 중국옵션 2
        unitPrice,                    // I: 단가
        totalPrice,                   // J: 총금액 (단가 * 수량)
        item.imageUrl || '',          // K: 이미지 URL
        item.linkUrl || ''            // L: 사이트 URL
      ];
    });

    // 데이터 입력
    const updateRange = `신규!A${nextRow}:L${nextRow + rows.length - 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: googlesheet_id,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: rows
      },
    });

    console.log('✅ [ADD_SINGLE_ORDER] 데이터 입력 완료:', {
      range: updateRange,
      rows_count: rows.length
    });

    res.json({
      success: true,
      message: `${rows.length}개 주문이 성공적으로 저장되었습니다.`,
      data: {
        googlesheet_id,
        range: updateRange,
        rows_count: rows.length,
        next_row: nextRow
      }
    });

  } catch (error) {
    console.error('❌ [ADD_SINGLE_ORDER] 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 대량엑셀 업로드 - 엑셀 데이터를 구글시트에 저장
 * @route POST /api/googlesheets/upload-bulk-excel
 */
router.post('/upload-bulk-excel', async (req, res) => {
  try {
    const { user_id, excelData } = req.body;

    console.log('📊 [UPLOAD_BULK_EXCEL] 대량엑셀 업로드 시작:', { user_id, rows_count: excelData?.length });

    if (!user_id || !excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'user_id와 excelData가 필요합니다.'
      });
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData) {
      console.error('❌ [UPLOAD_BULK_EXCEL] 사용자 조회 실패:', userError);
      return res.status(404).json({
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.'
      });
    }

    const googlesheet_id = userData.googlesheet_id;
    console.log('✅ [UPLOAD_BULK_EXCEL] 구글시트 ID:', googlesheet_id);

    if (!googlesheet_id) {
      return res.status(400).json({
        success: false,
        message: '사용자에게 연결된 구글시트가 없습니다.'
      });
    }

    // Google Sheets API 인증
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 현재 시트 데이터 확인 (다음 빈 행 찾기)
    const range = '신규!A:L';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googlesheet_id,
      range: range,
    });

    const existingData = response.data.values || [];
    const nextRow = Math.max(2, existingData.length + 1); // 헤더 제외하고 2행부터 시작

    console.log('📍 [UPLOAD_BULK_EXCEL] 다음 입력 행:', nextRow);

    // 엑셀 데이터를 구글시트에 입력 (헤더 제외된 데이터)
    const rows = excelData;

    // 데이터 입력
    const updateRange = `신규!A${nextRow}:L${nextRow + rows.length - 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: googlesheet_id,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: rows
      },
    });

    console.log('✅ [UPLOAD_BULK_EXCEL] 데이터 입력 완료:', {
      range: updateRange,
      rows_count: rows.length
    });

    res.json({
      success: true,
      message: `${rows.length}개 행이 성공적으로 저장되었습니다.`,
      data: {
        googlesheet_id,
        range: updateRange,
        rows_count: rows.length,
        next_row: nextRow
      }
    });

  } catch (error) {
    console.error('❌ [UPLOAD_BULK_EXCEL] 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 쿠팡엑셀 업로드 - 쿠팡 엑셀 데이터를 구글시트로 변환하여 저장
 * @route POST /api/googlesheets/upload-coupang-excel
 */
router.post('/upload-coupang-excel', async (req, res) => {
  try {
    const { user_id, excelData } = req.body;

    console.log('🛒 [UPLOAD_COUPANG_EXCEL] 쿠팡엑셀 업로드 시작:', { user_id, rows_count: excelData?.length });

    if (!user_id || !excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'user_id와 excelData가 필요합니다.'
      });
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData) {
      console.error('❌ [UPLOAD_COUPANG_EXCEL] 사용자 조회 실패:', userError);
      return res.status(404).json({
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.'
      });
    }

    const googlesheet_id = userData.googlesheet_id;
    console.log('✅ [UPLOAD_COUPANG_EXCEL] 구글시트 ID:', googlesheet_id);

    if (!googlesheet_id) {
      return res.status(400).json({
        success: false,
        message: '사용자에게 연결된 구글시트가 없습니다.'
      });
    }

    // Google Sheets API 인증
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 현재 시트 데이터 확인 (다음 빈 행 찾기)
    const range = '신규!A:Q';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googlesheet_id,
      range: range,
    });

    const existingData = response.data.values || [];
    const nextRow = Math.max(2, existingData.length + 1); // 헤더 제외하고 2행부터 시작

    console.log('📍 [UPLOAD_COUPANG_EXCEL] 다음 입력 행:', nextRow);

    // 쿠팡 엑셀 데이터를 구글시트 형식으로 변환
    // 엑셀 열 인덱스: K=10, L=11, W=22, R=17, C=2, AA=26 (0-based)
    const rows = excelData.map(row => {
      // C & " " & AA 조합 (C열 + 공백 + AA열) -> 비고란에는 C열만 저장
      const remarkValue = row[2] || '';  // C열만 비고란에 저장

      // AA열 (수취인명) -> V열에 "P-수취인명" 형식으로 저장
      const recipientName = row[26] ? `P-${row[26]}` : '';

      return [
        '',                    // A: 빈 값
        '',                    // B: 빈 값
        row[10] || '',         // C: K열 -> C열
        row[11] || '',         // D: L열 -> D열
        row[22] || '',         // E: W열 -> E열
        row[17] || '',         // F: R열 -> F열
        '',                    // G: 빈 값
        '',                    // H: 빈 값
        '',                    // I: 빈 값
        '',                    // J: 빈 값
        '',                    // K: 빈 값
        '',                    // L: 빈 값
        '',                    // M: 빈 값
        '',                    // N: 빈 값
        '',                    // O: 빈 값
        '',                    // P: 빈 값
        remarkValue,           // Q: C열만 (비고)
        '',                    // R: 빈 값
        '',                    // S: 빈 값
        '',                    // T: 빈 값
        '',                    // U: 빈 값
        recipientName          // V: P-AA열 (개인주문 정보)
      ];
    });

    // 데이터 입력
    const updateRange = `신규!A${nextRow}:V${nextRow + rows.length - 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: googlesheet_id,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: rows
      },
    });

    console.log('✅ [UPLOAD_COUPANG_EXCEL] 데이터 입력 완료:', {
      range: updateRange,
      rows_count: rows.length
    });

    res.json({
      success: true,
      message: `${rows.length}개 쿠팡 주문이 성공적으로 저장되었습니다.`,
      data: {
        googlesheet_id,
        range: updateRange,
        rows_count: rows.length,
        next_row: nextRow
      }
    });

  } catch (error) {
    console.error('❌ [UPLOAD_COUPANG_EXCEL] 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Google Sheets 5개 시트에서 데이터를 읽어와 Supabase에 저장하는 API
 * @route POST /api/googlesheets/import-data-all
 * @description 신규, 결제, 진행, 출고, 취소 시트의 데이터를 읽어와서 chinaorder_googlesheet_all 테이블에 저장
 */
router.post('/import-data-all', async (req, res) => {
  const startTime = Date.now();

  try {
    const { user_id } = req.body;

    console.log('🎯 [ENDPOINT] /api/googlesheets/import-data-all 엔드포인트 호출됨!');
    console.log('📥 [IMPORT_DATA_ALL] 전체 시트 데이터 가져오기 시작:', {
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

    // 1. 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData || !userData.googlesheet_id) {
      return res.status(404).json({
        success: false,
        message: '사용자의 구글시트 정보를 찾을 수 없습니다.',
        error_code: 'GOOGLESHEET_NOT_FOUND'
      });
    }

    const googlesheet_id = userData.googlesheet_id;
    console.log('✅ [IMPORT_DATA_ALL] 구글시트 ID:', googlesheet_id);

    // 2. Google Sheets API 인증
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 3. 기존 데이터 초기화
    console.log('🗑️ [IMPORT_DATA_ALL] 기존 데이터 초기화 중...');
    const { error: deleteError } = await supabase
      .from('chinaorder_googlesheet_all')
      .delete()
      .eq('user_id', user_id);

    if (deleteError) {
      console.error('❌ [IMPORT_DATA_ALL] 기존 데이터 삭제 실패:', deleteError);
      return res.status(500).json({
        success: false,
        message: '기존 데이터 삭제 중 오류가 발생했습니다.',
        error_code: 'DELETE_ERROR'
      });
    }

    console.log('✅ [IMPORT_DATA_ALL] 기존 데이터 삭제 완료');

    // 4. 시트별로 데이터 읽기 및 변환
    const sheetConfigs = [
      { name: '신규', code: 'N', range: '신규!A:V' },
      { name: '결제', code: 'P', range: '결제!A:V' },
      { name: '진행', code: 'O', range: '진행!A:V' },
      { name: '출고', code: 'D', range: '출고!A:V' },
      { name: '취소', code: 'C', range: '취소!A:V' }
    ];

    let totalInserted = 0;
    let businessCode = 'HI'; // 기본값

    for (const sheetConfig of sheetConfigs) {
      console.log(`📊 [IMPORT_DATA_ALL] ${sheetConfig.name} 시트 처리 중...`);

      try {
        // 시트 데이터 읽기
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: googlesheet_id,
          range: sheetConfig.range,
        });

        const rows = response.data.values || [];

        // 헤더만 있거나 데이터가 없는 경우
        if (rows.length <= 1) {
          console.log(`⚠️ [IMPORT_DATA_ALL] ${sheetConfig.name} 시트 데이터 없음 (헤더만 존재 또는 빈 시트)`);
          continue;
        }

        // B1 셀에서 사업자 코드 읽기 (첫 번째 시트에서만)
        if (sheetConfig.name === '신규' && rows.length > 0 && rows[0][1]) {
          businessCode = rows[0][1];
          console.log(`🏢 [IMPORT_DATA_ALL] 사업자 코드: ${businessCode}`);
        }

        // 데이터 변환 (첫 행은 헤더이므로 제외)
        const dataRows = rows.slice(1).filter(row => {
          // 빈 행 필터링 (모든 셀이 비어있거나 undefined인 행 제외)
          return row && row.some(cell => cell !== null && cell !== undefined && cell !== '');
        });
        const transformedData = dataRows.map((row, index) => {
          const rowNumber = index + 1;
          const id = `${businessCode}-${sheetConfig.code}-${rowNumber}`;

          return {
            id,
            user_id,
            order_number: row[0] || '', // A열
            option_id: row[19] || '', // T열
            china_order_number: row[1] || '', // B열
            date: row[0] || '', // A열
            item_name: row[2] || '', // C열
            option_name: row[3] || '', // D열
            barcode: row[5] || '', // F열
            order_qty: safeParseInt(row[4]), // E열
            china_option1: row[6] || '', // G열
            china_option2: row[7] || '', // H열
            china_price: row[8] || null, // I열
            china_total_price: row[9] || null, // J열
            img_url: row[10] || '', // K열
            china_link: row[11] || '', // L열
            order_status_ordering: safeParseInt(row[12]), // M열
            note: row[16] || '', // Q열
            confirm_order_id: row[17] || '', // R열
            confirm_shipment_id: row[18] || '', // S열
            composition: row[19] || '', // T열
            order_status_import: safeParseInt(row[13]), // N열
            order_status_cancel: safeParseInt(row[14]), // O열
            order_status_shipment: safeParseInt(row[15]), // P열
            sheet_name: sheetConfig.code,
            shipment_info: row[21] || '' // V열
          };
        });

        // Supabase에 배치 삽입 (500개씩)
        if (transformedData.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < transformedData.length; i += BATCH_SIZE) {
            const batch = transformedData.slice(i, i + BATCH_SIZE);

            const { error: insertError } = await supabase
              .from('chinaorder_googlesheet_all')
              .insert(batch);

            if (insertError) {
              console.error(`❌ [IMPORT_DATA_ALL] ${sheetConfig.name} 데이터 삽입 실패:`, insertError);
              return res.status(500).json({
                success: false,
                message: `${sheetConfig.name} 데이터 삽입 중 오류가 발생했습니다.`,
                error_code: 'DATABASE_INSERT_ERROR',
                error: insertError.message
              });
            }

            totalInserted += batch.length;
            console.log(`✅ [IMPORT_DATA_ALL] ${sheetConfig.name} 배치 삽입 완료 (${i + batch.length}/${transformedData.length})`);
          }

          console.log(`✅ [IMPORT_DATA_ALL] ${sheetConfig.name} 시트 완료: ${transformedData.length}개 저장`);
        }

      } catch (sheetError) {
        console.error(`❌ [IMPORT_DATA_ALL] ${sheetConfig.name} 시트 처리 실패:`, sheetError);
        // 시트가 없거나 오류가 있어도 다음 시트 계속 처리
        continue;
      }
    }

    const processingTime = Date.now() - startTime;

    console.log('✅ [IMPORT_DATA_ALL] 전체 데이터 가져오기 완료:', {
      total_inserted: totalInserted,
      processing_time_ms: processingTime
    });

    res.json({
      success: true,
      message: `총 ${totalInserted}개의 데이터를 성공적으로 가져왔습니다.`,
      data: {
        total_count: totalInserted,
        business_code: businessCode,
        processing_time_ms: processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('❌ [IMPORT_DATA_ALL] 데이터 가져오기 실패:', {
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

/**
 * 구글 시트 '신규' 데이터 읽기 (검증용)
 * @route POST /api/googlesheets/read-china-orders
 */
router.post('/read-china-orders', async (req, res) => {
  const startTime = Date.now();

  try {
    const { user_id } = req.body;

    console.log('🔍 [READ_CHINA_ORDERS] 신규 시트 데이터 읽기 시작:', { user_id });

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id가 필요합니다.',
        error_code: 'INVALID_INPUT'
      });
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData || !userData.googlesheet_id) {
      return res.status(404).json({
        success: false,
        message: '사용자의 구글시트 정보를 찾을 수 없습니다.',
        error_code: 'GOOGLESHEET_NOT_FOUND'
      });
    }

    // Google Sheets API로 '신규' 시트 데이터 읽기
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.googlesheet_id,
      range: '신규!A:T',
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: '신규 시트가 비어있습니다.',
        data: []
      });
    }

    // 데이터 변환 (첫 행은 헤더이므로 제외)
    const dataRows = rows.slice(1);
    const transformedData = dataRows.map((row, index) => ({
      date: row[0] || '',
      china_order_number: row[1] || '',
      item_name: row[2] || '',
      option_name: row[3] || '',
      order_quantity: safeParseInt(row[4]),
      barcode: row[5] || '',
      china_option1: row[6] || '',
      china_option2: row[7] || '',
      china_price: row[8] || '',
      china_total_price: row[9] || '',
      image_url: row[10] || '',
      china_link: row[11] || '',
      order_status_ordering: row[12] || '',
      order_status_check: row[13] || '',
      order_status_cancel: row[14] || '',
      order_status_shipment: row[15] || '',
      remark: row[16] || '',
      confirm_order_id: row[17] || '',
      confirm_shipment_id: row[18] || '',
      option_id: row[19] || ''
    }));

    const processingTime = Date.now() - startTime;

    console.log('✅ [READ_CHINA_ORDERS] 읽기 완료:', {
      data_count: transformedData.length,
      processing_time_ms: processingTime
    });

    res.json({
      success: true,
      message: `${transformedData.length}개 데이터를 불러왔습니다.`,
      data: transformedData,
      processing_time_ms: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('❌ [READ_CHINA_ORDERS] 읽기 실패:', {
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

/**
 * 구글 시트 '신규' 전체 데이터 저장 (덮어쓰기)
 * @route POST /api/googlesheets/save-all-china-orders
 */
router.post('/save-all-china-orders', async (req, res) => {
  const startTime = Date.now();

  try {
    const { user_id, orders } = req.body;

    console.log('💾 [SAVE_ALL_CHINA_ORDERS] 전체 저장 시작:', {
      user_id,
      orders_count: orders?.length || 0
    });

    if (!user_id || !orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: 'user_id와 orders 배열이 필요합니다.',
        error_code: 'INVALID_INPUT'
      });
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users_api')
      .select('googlesheet_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData || !userData.googlesheet_id) {
      return res.status(404).json({
        success: false,
        message: '사용자의 구글시트 정보를 찾을 수 없습니다.',
        error_code: 'GOOGLESHEET_NOT_FOUND'
      });
    }

    // Google Sheets API
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 기존 데이터 전체 삭제 (헤더 제외)
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.googlesheet_id,
      range: '신규!A:T',
    });

    const existingRows = readResponse.data.values || [];

    // 2행부터 마지막 행까지 삭제 (헤더는 유지)
    if (existingRows.length > 1) {
      const clearRange = `신규!A2:T${existingRows.length}`;
      await sheets.spreadsheets.values.clear({
        spreadsheetId: userData.googlesheet_id,
        range: clearRange,
      });
      console.log('🗑️ [SAVE_ALL_CHINA_ORDERS] 기존 데이터 삭제 완료:', clearRange);
    }

    // 데이터 변환 (구글 시트 형식)
    const rows = orders.map(order => [
      order.date || '',
      order.china_order_number || '',
      order.item_name || '',
      order.option_name || '',
      order.order_quantity || '',
      order.barcode || '',
      order.china_option1 || '',
      order.china_option2 || '',
      order.china_price || '',
      order.china_total_price || '',
      order.image_url || '',
      order.china_link || '',
      order.order_status_ordering || '',
      order.order_status_check || '',
      order.order_status_cancel || '',
      order.order_status_shipment || '',
      order.remark || order.note || '',
      order.confirm_order_id || '',
      order.confirm_shipment_id || '',
      order.option_id || ''
    ]);

    // 데이터 저장 (2행부터)
    if (rows.length > 0) {
      const updateRange = `신규!A2:T${1 + rows.length}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: userData.googlesheet_id,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: rows
        },
      });

      console.log('✅ [SAVE_ALL_CHINA_ORDERS] 데이터 저장 완료:', {
        range: updateRange,
        rows_count: rows.length
      });
    }

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      message: `${rows.length}개 데이터가 저장되었습니다.`,
      data: {
        googlesheet_id: userData.googlesheet_id,
        saved_count: rows.length,
        processing_time_ms: processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('❌ [SAVE_ALL_CHINA_ORDERS] 저장 실패:', {
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