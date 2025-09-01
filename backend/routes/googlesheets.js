const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

        // 구글시트 행 데이터 구성 (A~T 컬럼)
        const rowData = [
          todayMMDD,           // A: 오늘 날짜 MMDD
          '',                  // B: 빈 값
          order.item_name,     // C: 아이템명
          order.option_name,   // D: 옵션명
          Number(order.quantity), // E: 수량
          order.barcode || '', // F: 바코드 (빈 값 허용)
          '', '', '', '', '',  // G~K: 빈 값 (향후 확장용)
          '', '', '', '', '',  // L~P: 빈 값 (향후 확장용)
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
      valueInputOption: 'RAW',
      resource: {
        values: batchData
      },
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
    
    console.log('📥 [IMPORT_DATA] 구글시트 데이터 가져오기 시작:', {
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

    // 2. Google Sheets API로 '진행' 및 '신규' 시트 데이터 읽기
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // '진행' 시트 데이터 읽기
    const progressResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.googlesheet_id,
      range: '진행!A:S', // A부터 S열까지
    });

    // '신규' 시트 데이터 읽기
    const newResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: userData.googlesheet_id,
      range: '신규!A:S', // A부터 S열까지
    });

    const progressRows = progressResponse.data.values || [];
    const newRows = newResponse.data.values || [];
    
    if (progressRows.length <= 1 && newRows.length <= 1) {
      return res.json({
        success: true,
        message: '가져올 데이터가 없습니다.',
        data: { imported_count: 0, progress_count: 0, new_count: 0 }
      });
    }

    // 3. 기존 데이터 초기화
    console.log('🗑️ [IMPORT_DATA] 기존 데이터 초기화 중...');
    const { error: deleteProgressError } = await supabase
      .from('chinaorder_googlesheet')
      .delete()
      .eq('user_id', user_id);

    const { error: deleteNewError } = await supabase
      .from('chinaorder_new')
      .delete()
      .eq('user_id', user_id);

    if (deleteProgressError || deleteNewError) {
      console.error('❌ [IMPORT_DATA] 기존 데이터 삭제 실패:', { deleteProgressError, deleteNewError });
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
      china_order_number: row[1] || '', // B열
      order_number: '', // 빈값
      option_id: row[19] || '', // T열
      date: row[0] || '', // A열
      item_name: row[2] || '', // C열
      option_name: row[3] || '', // D열
      barcode: row[5] || '', // F열
      order_qty: row[4] ? parseInt(row[4]) : null, // E열
      china_option1: row[6] || '', // G열
      china_option2: row[7] || '', // H열
      china_price: row[8] || '', // I열
      china_total_price: row[9] || '', // J열
      img_url: row[10] || '', // K열
      china_link: row[11] || '', // L열
      order_status_ordering: row[12] ? parseInt(row[12]) : null, // M열
      order_status_import: row[13] ? parseInt(row[13]) : null, // N열
      order_status_cancel: row[14] ? parseInt(row[14]) : null, // O열
      order_status_shipment: row[15] ? parseInt(row[15]) : null, // P열
      note: row[17] || '', // Q열
      confirm_order_id: row[18] || '', // R열
      confirm_shipment_id: row[19] || '' // S열
    }));

    // 5. '신규' 시트 데이터 변환 (첫 행은 헤더이므로 제외)
    const newDataRows = newRows.slice(1);
    const newTransformedData = newDataRows.map(row => ({
      user_id,
      china_order_number: row[1] || '', // B열
      order_number: '', // 빈값
      option_id: row[19] || '', // T열
      date: row[0] || '', // A열
      item_name: row[2] || '', // C열
      option_name: row[3] || '', // D열
      barcode: row[5] || '', // F열
      order_qty: row[4] ? parseInt(row[4]) : null, // E열
      china_option1: row[6] || '', // G열
      china_option2: row[7] || '', // H열
      china_price: row[8] || '', // I열
      china_total_price: row[9] || '', // J열
      img_url: row[10] || '', // K열
      china_link: row[11] || '', // L열
      order_status_ordering: row[12] ? parseInt(row[12]) : null, // M열
      order_status_import: row[13] ? parseInt(row[13]) : null, // N열
      order_status_cancel: row[14] ? parseInt(row[14]) : null, // O열
      order_status_shipment: row[15] ? parseInt(row[15]) : null, // P열
      note: row[17] || '', // Q열
      confirm_order_id: row[18] || '', // R열
      confirm_shipment_id: row[19] || '' // S열
    }));

    // 6. Supabase에 데이터 저장
    let progressInsertError = null;
    let newInsertError = null;

    // '진행' 데이터를 chinaorder_googlesheet에 저장
    if (progressTransformedData.length > 0) {
      const { data: progressInsertData, error } = await supabase
        .from('chinaorder_googlesheet')
        .insert(progressTransformedData);
      progressInsertError = error;
    }

    // '신규' 데이터를 chinaorder_new에 저장  
    if (newTransformedData.length > 0) {
      const { data: newInsertData, error } = await supabase
        .from('chinaorder_new')
        .insert(newTransformedData);
      newInsertError = error;
    }

    if (progressInsertError || newInsertError) {
      console.error('❌ [IMPORT_DATA] 데이터베이스 저장 실패:', { progressInsertError, newInsertError });
      return res.status(500).json({
        success: false,
        message: '데이터베이스 저장 중 오류가 발생했습니다.',
        error_code: 'DATABASE_ERROR'
      });
    }

    const processingTime = Date.now() - startTime;
    const totalImported = progressTransformedData.length + newTransformedData.length;
    
    console.log('✅ [IMPORT_DATA] 데이터 가져오기 완료:', {
      progress_count: progressTransformedData.length,
      new_count: newTransformedData.length,
      total_imported: totalImported,
      processing_time_ms: processingTime
    });

    res.json({
      success: true,
      message: `진행: ${progressTransformedData.length}개, 신규: ${newTransformedData.length}개의 데이터를 성공적으로 가져왔습니다.`,
      data: {
        progress_count: progressTransformedData.length,
        new_count: newTransformedData.length,
        total_imported: totalImported,
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

module.exports = router;