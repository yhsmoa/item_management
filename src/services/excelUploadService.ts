import { supabase } from '../config/supabase';
import * as XLSX from 'xlsx';

export interface UploadResult {
  success: boolean;
  processedCount: number;
  totalRows: number;
  error?: string;
}

/**
 * 엑셀 데이터 타입 정의 (extract_coupang_item_all 테이블과 매칭)
 */
interface CoupangProductExcelData {
  item_id: string;           // A열
  product_id: string;        // B열  
  option_id: string;         // C열
  item_status: string;       // D열
  barcode: string;           // E열
  vendor_item_id: string;    // F열
  product_name: string;      // G열
  item_name: string;         // H열
  option_name: string;       // I열
  price: string;             // J열
  regular_price: string;     // K열
  sales_status: string;      // L열
  coupang_stock: string;     // M열
  sales_quantity: string;    // N열
  coupang_approval: string;  // O열
  edit_price: string;        // P열
  edit_regular_price: string; // Q열
  edit_sales_status: string; // R열
  edit_coupang_stock: string; // S열
  user_id: string;           // 사용자 ID (런타임에 추가)
}

/**
 * 판매량 엑셀 데이터 타입 정의 (coupang_sales 테이블과 매칭)
 */
interface CoupangSalesExcelData {
  option_id: string;    // A열
  item_id: string;      // D열  
  sales: number;        // I열
  user_id: string;      // 사용자 ID (런타임에 추가)
}

/**
 * 쿠팡 개인 주문 엑셀 데이터 타입 정의 (coupang_personal_order 테이블과 매칭)
 */
interface CoupangPersonalOrderExcelData {
  number: string;                              // A열
  bundle_shipping_number: string;              // B열
  order_number: string;                        // C열
  delivery_company: string;                    // D열
  tracking_number: string;                     // E열
  separate_shipping: string;                   // F열
  separate_shipping_expected_date: string;     // G열
  order_expected_shipping_date: string;        // H열
  shipping_date: string;                       // I열
  order_date: string;                          // J열
  item_name: string;                           // K열
  option_name: string;                         // L열
  product_name: string;                        // M열
  product_id: string;                          // O열
  option_id: string;                           // P열
  initial_registered_product_option: string;  // Q열
  vendor_product_code: string;                 // R열
  barcode: string;                             // S열
  payment_amount: number;                      // U열
  shipping_fee_type: string;                   // V열
  shipping_fee: number;                        // W열
  remote_area_additional_fee: string;          // X열
  qty: number;                                 // Y열
  option_sale_price: number;                   // Z열
  buyer: string;                               // AA열
  buyer_phone: string;                         // AB열
  recipient_name: string;                      // AC열
  recipient_phone: string;                     // AD열
  postal_code: string;                         // AE열
  recipient_address: string;                   // AF열
  delivery_message: string;                    // AG열
  product_additional_message: string;          // AH열
  orderer_additional_message: string;          // AI열
  delivery_completion_date: string;            // AJ열
  purchase_confirmation_date: string;          // AK열
  PCCC: string;                                // AL열
  customs_recipient_phone: string;             // AM열
  etc: string;                                 // AN열
  payment_location: string;                    // AO열
  delivery_type: string;                       // AP열
  id: string;                                  // 고유 ID (런타임에 생성)
  user_id: string;                             // 사용자 ID (런타임에 추가)
}

/**
 * 현재 로그인한 사용자 ID를 가져오는 함수
 */
function getCurrentUserId(): string | null {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return currentUser.id || currentUser.user_id || null;
  } catch (error) {
    return null;
  }
}

/**
 * 문자열로 변환하는 헬퍼 함수 (null, undefined, 숫자 모두 처리)
 */
function parseString(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return String(value).trim();
}

/**
 * 실제 엑셀 파일 처리 및 extract_coupang_item_all 테이블에 저장
 */
export const processProductExcelUpload = async (
  file: File,
  progressCallback: (stage: string, current?: number, total?: number) => void
): Promise<UploadResult> => {
  try {
    // 1. 사용자 ID 확인
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('로그인한 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
    }
    
    progressCallback('엑셀 파일 읽기 중...', 0, 100);
    
    // 2. 엑셀 파일 파싱
    const data = await parseProductExcelFile(file);
    
    if (data.length === 0) {
      throw new Error('엑셀 파일에 유효한 데이터가 없습니다.');
    }
    
    progressCallback('데이터베이스에 저장 중...', 50, 100);
    
    // 3. 데이터베이스에 저장
    const saveResult = await saveProductDataToSupabase(data, userId, (current, total) => {
      const percentage = Math.floor(50 + (current / total) * 50);
      progressCallback(`데이터 저장 중... (${current}/${total})`, percentage, 100);
    });
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || '데이터 저장에 실패했습니다.');
    }
    
    progressCallback('업로드 완료', 100, 100);
    
    return {
      success: true,
      processedCount: saveResult.savedCount,
      totalRows: data.length
    };
  } catch (error) {
    return {
      success: false,
      processedCount: 0,
      totalRows: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
};

/**
 * 엑셀 파일을 파싱하여 CoupangProductExcelData 배열로 변환
 */
async function parseProductExcelFile(file: File): Promise<CoupangProductExcelData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 첫 번째 시트 선택
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 시트를 JSON 배열로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: ''
        }) as any[][];
        
        if (jsonData.length < 4) {
          throw new Error('엑셀 파일에 유효한 데이터가 없습니다. 최소 4행 이상이어야 합니다.');
        }
        
        const processedData: CoupangProductExcelData[] = [];
        let validDataCount = 0;
        
        // 4행부터 데이터 시작 (인덱스 3부터)
        for (let i = 3; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          // 빈 행 건너뛰기 (A열에 데이터가 없는 경우)
          if (!row || row.length === 0 || !row[0]) {
            continue;
          }
          
          validDataCount++;
          
          // A열~S열을 순서대로 매핑
          const rowData: CoupangProductExcelData = {
            item_id: parseString(row[0]),           // A열
            product_id: parseString(row[1]),        // B열
            option_id: parseString(row[2]),         // C열
            item_status: parseString(row[3]),       // D열
            barcode: parseString(row[4]),           // E열
            vendor_item_id: parseString(row[5]),    // F열
            product_name: parseString(row[6]),      // G열
            item_name: parseString(row[7]),         // H열
            option_name: parseString(row[8]),       // I열
            price: parseString(row[9]),             // J열
            regular_price: parseString(row[10]),    // K열
            sales_status: parseString(row[11]),     // L열
            coupang_stock: parseString(row[12]),    // M열
            sales_quantity: parseString(row[13]),   // N열
            coupang_approval: parseString(row[14]), // O열
            edit_price: parseString(row[15]) || '', // P열
            edit_regular_price: parseString(row[16]) || '', // Q열
            edit_sales_status: parseString(row[17]) || '', // R열
            edit_coupang_stock: parseString(row[18]) || '', // S열
            user_id: '' // 나중에 설정
          };
          
          processedData.push(rowData);
        }
        
        resolve(processedData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    
    // 파일을 ArrayBuffer로 읽기
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 파싱된 데이터를 Supabase의 extract_coupang_item_all 테이블에 저장
 */
async function saveProductDataToSupabase(
  data: CoupangProductExcelData[],
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; savedCount: number; error?: string }> {
  try {
    // 1. 데이터에 user_id 추가 및 중복 제거
    const dataWithUserId = data.map(item => ({
      ...item,
      user_id: userId
    }));
    
    // 중복 제거 및 유효성 검사 (option_id 기준)
    const uniqueData = dataWithUserId.filter((item, index, array) => {
      // option_id가 비어있는 데이터 제외
      if (!item.option_id || item.option_id.trim() === '') {
        return false;
      }
      
      // 중복 제거 (첫 번째 발견된 것만 유지)
      return array.findIndex(i => i.option_id === item.option_id) === index;
    });
    
    // 2. 배치 단위로 데이터 Upsert (50개씩 처리) - option_id 기준으로 업데이트
    const BATCH_SIZE = 50;
    let savedCount = 0;
    
    for (let i = 0; i < uniqueData.length; i += BATCH_SIZE) {
      const batch = uniqueData.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      const { error } = await supabase
        .from('extract_coupang_item_all')
        .upsert(batch, { 
          onConflict: 'option_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        throw new Error(`배치 ${batchNum} Upsert 실패: ${error.message}`);
      }
      
      savedCount += batch.length;
      onProgress?.(savedCount, uniqueData.length);
    }
    
    return {
      success: true,
      savedCount: savedCount
    };
  } catch (error) {
    return {
      success: false,
      savedCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 판매량 엑셀 파일을 처리하여 coupang_sales 테이블에 저장
 * @param file 업로드할 엑셀 파일
 * @param onProgress 진행률 콜백 함수
 * @returns 처리 결과
 */
export async function processSalesExcelUpload(
  file: File,
  onProgress?: (stage: string, current?: number, total?: number) => void
): Promise<UploadResult> {
  try {
    // 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('로그인 정보를 찾을 수 없습니다.');
    }

    onProgress?.('파일 읽는 중...', 0, 100);

    // 엑셀 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    onProgress?.('데이터 변환 중...', 20, 100);

    // JSON으로 변환 (1행은 헤더이므로 range 옵션으로 2행부터 시작)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,  // 배열 형태로 변환
      range: 1    // 2행부터 시작 (0-based index)
    }) as any[][];

    if (!jsonData || jsonData.length === 0) {
      throw new Error('엑셀 파일에 데이터가 없습니다.');
    }

    onProgress?.('데이터 검증 중...', 40, 100);

    // 데이터 변환 및 검증
    const salesData: CoupangSalesExcelData[] = [];
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // 빈 행 건너뛰기
      if (!row || row.length === 0) continue;
      
      const optionId = String(row[0]); // A열
      const itemId = String(row[3]);   // D열 (0-based index로 3)
      const salesValue = row[8];         // I열 (0-based index로 8)
      
      // 필수 필드 검증
      if (!optionId || !itemId) {
        console.warn(`⚠️ ${i + 2}행: option_id 또는 item_id가 누락되어 건너뜁니다.`);
        continue;
      }
      
      // sales 값 검증 및 변환
      const sales = parseFloat(String(salesValue)) || 0;
      
      salesData.push({
        option_id: optionId,
        item_id: itemId,
        sales: sales,
        user_id: userId
      });
    }

    if (salesData.length === 0) {
      throw new Error('처리할 수 있는 데이터가 없습니다.');
    }

    onProgress?.('데이터베이스에 저장 중...', 60, 100);

    // 기존 데이터 삭제 (같은 user_id)
    const { error: deleteError } = await supabase
      .from('coupang_sales')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('기존 데이터 삭제 실패:', deleteError);
      throw new Error(`기존 데이터 삭제 실패: ${deleteError.message}`);
    }

    onProgress?.('새 데이터 삽입 중...', 80, 100);

    // 새 데이터 삽입 (배치 단위로 처리)
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < salesData.length; i += batchSize) {
      const batch = salesData.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('coupang_sales')
        .insert(batch);

      if (insertError) {
        console.error(`배치 ${Math.floor(i / batchSize) + 1} 삽입 실패:`, insertError);
        throw new Error(`데이터 삽입 실패: ${insertError.message}`);
      }

      insertedCount += batch.length;
      
      // 진행률 업데이트
      const progress = 80 + (insertedCount / salesData.length) * 20;
      onProgress?.('데이터 저장 중...', Math.round(progress), 100);
    }

    onProgress?.('완료', 100, 100);

    console.log(`✅ 판매량 데이터 업로드 완료: ${insertedCount}개 행 처리`);

    return {
      success: true,
      processedCount: insertedCount,
      totalRows: jsonData.length,
    };

  } catch (error) {
    console.error('❌ 판매량 엑셀 업로드 실패:', error);
    
    return {
      success: false,
      processedCount: 0,
      totalRows: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * 쿠팡 개인 주문 엑셀 파일 처리 및 coupang_personal_order 테이블에 저장
 */
export const processPersonalOrderExcelUpload = async (
  file: File,
  progressCallback: (stage: string, current?: number, total?: number) => void
): Promise<UploadResult> => {
  try {
    // 1. 사용자 ID 확인
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('로그인한 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
    }
    
    progressCallback('엑셀 파일 읽기 중...', 0, 100);
    
    // 2. 엑셀 파일 파싱
    const data = await parsePersonalOrderExcelFile(file);
    
    if (data.length === 0) {
      throw new Error('엑셀 파일에 유효한 데이터가 없습니다.');
    }
    
    progressCallback('데이터베이스에 저장 중...', 50, 100);
    
    // 3. 데이터베이스에 저장
    const saveResult = await savePersonalOrderDataToSupabase(data, userId, (current: number, total: number) => {
      const percentage = Math.floor(50 + (current / total) * 50);
      progressCallback(`데이터 저장 중... (${current}/${total})`, percentage, 100);
    });
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || '데이터 저장에 실패했습니다.');
    }
    
    progressCallback('업로드 완료', 100, 100);
    
    return {
      success: true,
      processedCount: saveResult.savedCount,
      totalRows: data.length
    };
  } catch (error) {
    return {
      success: false,
      processedCount: 0,
      totalRows: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
};

/**
 * 엑셀 파일을 파싱하여 CoupangPersonalOrderExcelData 배열로 변환
 */
async function parsePersonalOrderExcelFile(file: File): Promise<CoupangPersonalOrderExcelData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 첫 번째 시트 선택
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 시트를 JSON 배열로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: ''
        }) as any[][];
        
        if (jsonData.length < 2) {
          throw new Error('엑셀 파일에 유효한 데이터가 없습니다. 최소 2행 이상이어야 합니다.');
        }
        
        const processedData: CoupangPersonalOrderExcelData[] = [];
        let validDataCount = 0;
        
        // 2행부터 데이터 시작 (인덱스 1부터) - 헤더가 있다고 가정
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          // 빈 행 건너뛰기 (A열에 데이터가 없는 경우)
          if (!row || row.length === 0 || !row[0]) {
            continue;
          }
          
          validDataCount++;
          
          // 컬럼별 매핑 (Excel 컬럼과 배열 인덱스 매칭)
          const orderNumber = parseString(row[2]);  // C열 - order_number
          const optionId = parseString(row[14]);    // O열 - option_id
          
          const rowData: CoupangPersonalOrderExcelData = {
            number: parseString(row[0]),                               // A열
            bundle_shipping_number: parseString(row[1]),               // B열
            order_number: orderNumber,                                 // C열
            delivery_company: parseString(row[3]),                     // D열
            tracking_number: parseString(row[4]),                      // E열
            separate_shipping: parseString(row[5]),                    // F열
            separate_shipping_expected_date: parseString(row[6]),      // G열
            order_expected_shipping_date: parseString(row[7]),         // H열
            shipping_date: parseString(row[8]),                        // I열
            order_date: parseString(row[9]),                           // J열
            item_name: parseString(row[10]),                           // K열
            option_name: parseString(row[11]),                         // L열
            product_name: parseString(row[12]),                        // M열
            product_id: parseString(row[13]),                          // N열
            option_id: optionId,                                       // O열
            initial_registered_product_option: parseString(row[15]),   // P열
            vendor_product_code: parseString(row[16]),                 // Q열
            barcode: parseString(row[17]),                             // R열
            payment_amount: parseFloat(parseString(row[18])) || 0,     // S열
            shipping_fee_type: parseString(row[19]),                   // T열
            shipping_fee: parseFloat(parseString(row[20])) || 0,       // U열
            remote_area_additional_fee: parseString(row[21]),          // V열
            qty: parseFloat(parseString(row[22])) || 0,                // W열
            option_sale_price: parseFloat(parseString(row[23])) || 0,  // X열
            buyer: parseString(row[24]),                               // Y열
            buyer_phone: parseString(row[25]),                         // Z열
            recipient_name: parseString(row[26]),                      // AA열
            recipient_phone: parseString(row[27]),                     // AB열
            postal_code: parseString(row[28]),                         // AC열
            recipient_address: parseString(row[29]),                   // AD열
            delivery_message: parseString(row[30]),                    // AE열
            product_additional_message: parseString(row[31]),          // AF열
            orderer_additional_message: parseString(row[32]),          // AG열
            delivery_completion_date: parseString(row[33]),            // AH열
            purchase_confirmation_date: parseString(row[34]),          // AI열
            PCCC: parseString(row[35]),                                // AJ열
            customs_recipient_phone: parseString(row[36]),             // AK열
            etc: parseString(row[37]),                                 // AL열
            payment_location: parseString(row[38]),                    // AM열
            delivery_type: parseString(row[39]),                       // AN열
            id: '', // 나중에 생성
            user_id: '' // 나중에 설정
          };
          
          processedData.push(rowData);
        }
        
        resolve(processedData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    
    // 파일을 ArrayBuffer로 읽기
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 파싱된 개인 주문 데이터를 Supabase의 coupang_personal_order 테이블에 저장
 */
async function savePersonalOrderDataToSupabase(
  data: CoupangPersonalOrderExcelData[],
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; savedCount: number; error?: string }> {
  try {
    // 1. 데이터에 user_id와 ID 설정
    const dataWithMetadata = data.map((item) => ({
      ...item,
      user_id: userId, // 현재 로그인한 사용자 ID 사용
      id: item.order_number && item.option_id ? `${item.order_number}-${item.option_id}` : '' // order_number + "-" + option_id
    }));
    
    // 2. 배치 단위로 데이터 Upsert (50개씩 처리) - id 기준으로 중복 처리
    const BATCH_SIZE = 50;
    let savedCount = 0;
    
    for (let i = 0; i < dataWithMetadata.length; i += BATCH_SIZE) {
      const batch = dataWithMetadata.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      const { error } = await supabase
        .from('coupang_personal_order')
        .upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        throw new Error(`배치 ${batchNum} Upsert 실패: ${error.message}`);
      }
      
      savedCount += batch.length;
      onProgress?.(savedCount, dataWithMetadata.length);
    }
    
    return {
      success: true,
      savedCount: savedCount
    };
  } catch (error) {
    return {
      success: false,
      savedCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
} 