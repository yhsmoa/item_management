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
