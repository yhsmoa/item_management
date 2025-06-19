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
 * 현재 로그인한 사용자 ID를 가져오는 함수
 */
function getCurrentUserId(): string | null {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return currentUser.id || currentUser.user_id || null;
  } catch (error) {
    console.error('❌ 사용자 정보 읽기 오류:', error);
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
    console.log('🚀 상품등록 엑셀 업로드 시작:', file.name);
    
    // 1. 사용자 ID 확인
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('로그인한 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
    }
    
    progressCallback('엑셀 파일 읽기 중...', 0, 100);
    
    // 2. 엑셀 파일 파싱
    const data = await parseProductExcelFile(file);
    console.log(`📊 엑셀 파싱 완료: ${data.length}개 행`);
    
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
    console.log(`✅ 상품등록 엑셀 업로드 완료: ${saveResult.savedCount}개 저장`);
    
    return {
      success: true,
      processedCount: saveResult.savedCount,
      totalRows: data.length
    };
  } catch (error) {
    console.error('❌ 상품등록 엑셀 업로드 오류:', error);
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
  console.log('📂 엑셀 파일 파싱 시작:', file.name);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        console.log('📋 워크북 시트:', workbook.SheetNames);
        
        // 첫 번째 시트 선택
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
                 // 시트를 JSON 배열로 변환
         const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
           header: 1,
           defval: ''
         }) as any[][];
        
        console.log(`📊 엑셀 총 ${jsonData.length}개 행 읽음`);
        
        if (jsonData.length < 4) {
          throw new Error('엑셀 파일에 유효한 데이터가 없습니다. 최소 4행 이상이어야 합니다.');
        }
        
        // 헤더 확인 (3행까지는 헤더)
        console.log('📝 헤더 행들:');
        for (let i = 0; i < Math.min(3, jsonData.length); i++) {
          console.log(`   ${i + 1}행:`, jsonData[i]?.slice(0, 5)); // 처음 5개 컬럼만
        }
        
        const processedData: CoupangProductExcelData[] = [];
        let validDataCount = 0;
        
        // 4행부터 데이터 시작 (인덱스 3부터)
        console.log('🔄 데이터 행 처리 시작 (4행부터)...');
        
        for (let i = 3; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          // 빈 행 건너뛰기 (A열에 데이터가 없는 경우)
          if (!row || row.length === 0 || !row[0]) {
            continue;
          }
          
          validDataCount++;
          
          // 처음 3개와 마지막 3개만 로그
          if (validDataCount <= 3 || i >= jsonData.length - 3) {
            console.log(`🔍 행 ${i + 1} (데이터 ${validDataCount}): A=${row[0]}, B=${row[1]}, C=${row[2]}`);
          }
          
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
        
        console.log(`✅ 엑셀 파싱 완료: ${processedData.length}개 행 처리`);
        
        if (processedData.length > 0) {
          console.log('📝 첫 번째 데이터 샘플:', processedData[0]);
          
          // 데이터 유효성 검사
          const validItems = processedData.filter(item => item.item_id && item.item_id.trim());
          const invalidItems = processedData.length - validItems.length;
          
          console.log(`📊 데이터 품질 검사: 유효 ${validItems.length}개, 무효 ${invalidItems}개`);
          
          if (invalidItems > 0) {
            console.warn(`⚠️ ${invalidItems}개의 행에 item_id가 없습니다.`);
          }
        }
        
        resolve(processedData);
      } catch (error) {
        console.error('❌ 엑셀 파싱 오류:', error);
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
    console.log(`🚀 데이터베이스 저장 시작: ${data.length}개 행`);
    
    // 1. 기존 사용자 데이터 삭제
    onProgress?.(0, data.length);
    console.log(`🗑️ 기존 데이터 삭제 중... (user_id: ${userId})`);
    
    const { error: deleteError } = await supabase
      .from('extract_coupang_item_all')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('❌ 기존 데이터 삭제 오류:', deleteError);
      throw deleteError;
    }
    
    console.log('✅ 기존 데이터 삭제 완료');
    
    // 삭제 후 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. 새 데이터에 user_id 추가 및 중복 제거
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
    
    const duplicateCount = dataWithUserId.length - uniqueData.length;
    console.log(`🔄 데이터 정리 완료: 원본 ${dataWithUserId.length}개 → 유효 ${uniqueData.length}개 (제외: ${duplicateCount}개)`);
    
    // 3. 배치 단위로 데이터 저장 (50개씩 처리)
    const BATCH_SIZE = 50;
    let savedCount = 0;
    
    for (let i = 0; i < uniqueData.length; i += BATCH_SIZE) {
      const batch = uniqueData.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(uniqueData.length / BATCH_SIZE);
      
      console.log(`💾 배치 ${batchNum}/${totalBatches} 저장 중... (${batch.length}개)`);
      
      const { error } = await supabase
        .from('extract_coupang_item_all')
        .upsert(batch, { 
          onConflict: 'option_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`❌ 배치 ${batchNum} 저장 오류:`, error);
        throw new Error(`배치 ${batchNum} 저장 실패: ${error.message}`);
      }
      
      savedCount += batch.length;
      onProgress?.(savedCount, uniqueData.length);
      console.log(`✅ 배치 ${batchNum}/${totalBatches} 완료: ${batch.length}개 (누적: ${savedCount}/${uniqueData.length})`);
    }
    
    console.log(`✅ 데이터베이스 저장 완료: ${savedCount}개`);
    
    return {
      success: true,
      savedCount: savedCount
    };
  } catch (error) {
    console.error('❌ 데이터베이스 저장 오류:', error);
    return {
      success: false,
      savedCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
} 