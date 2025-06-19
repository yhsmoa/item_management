import { supabase } from '../config/supabase';

// XLSX 라이브러리를 window 객체에 추가
declare global {
  interface Window {
    XLSX: any;
  }
}

export interface RocketInventoryUploadResult {
  success: boolean;
  processedCount: number;
  totalRows: number;
  error: string | null;
}

export interface RocketInventoryData {
  inventory_id: string;
  option_id: string;
  sku_id: string;
  product_name: string;
  option_name: string;
  offer_condition: string;
  orderable_quantity: number;
  pending_inbounds: number;
  item_winner: number;
  sales_last_7_days: number;
  sales_last_30_days: number;
  sales_quantity_last_7_days: number;
  sales_quantity_last_30_days: number;
  recommanded_inboundquantity: number;
  monthly_storage_fee: number;
  sku_age_in_30days: number;
  sku_age_in_60days: number;
  product_listing_date: string;
  user_id: string;
}

const getCurrentUserId = (): string | null => {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return currentUser.id || currentUser.user_id || null;
  } catch (error) {
    console.error('❌ 사용자 정보 읽기 오류:', error);
    return null;
  }
};

const parseRocketInventoryExcelFile = async (file: File): Promise<RocketInventoryData[]> => {
  // XLSX 라이브러리 동적 로딩
  if (!window.XLSX) {
    const XLSX_MODULE = await import('xlsx');
    window.XLSX = XLSX_MODULE.default || XLSX_MODULE;
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        console.log('📊 로켓 인벤토리 엑셀 파일 파싱 시작...');
        
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = window.XLSX.read(data, { type: 'array' });
        
        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
          throw new Error('엑셀 파일에서 사용할 수 있는 시트를 찾을 수 없습니다.');
        }
        
        // 워크시트를 JSON 배열로 변환 (상품등록과 동일한 옵션)
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '', // 빈 셀을 빈 문자열로 처리
          raw: false, // 원시 값이 아닌 포맷된 값 사용
          blankrows: false, // 빈 행 제외
          range: undefined // 전체 범위 사용
        });
        
        console.log('📋 로켓 인벤토리 엑셀 원본 데이터 총 행 수:', jsonData.length);
        console.log('📋 원본 데이터 첫 5행:', jsonData.slice(0, 5));
        console.log('📋 헤더 행 (1행):', jsonData[0]);
        console.log('📋 첫 번째 데이터 행 (2행):', jsonData[1]);
        
        const processedData: RocketInventoryData[] = [];
        const userId = getCurrentUserId();
        
        if (!userId) {
          throw new Error('로그인 사용자 정보를 찾을 수 없습니다.');
        }
        
        // 헤더 행을 건너뛰고 데이터 처리 (2행까지는 헤더, 3행부터 데이터)
        for (let i = 2; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          if (!row || row.length === 0 || !row[0]) {
            continue; // 빈 행 건너뛰기
          }
          
          // 처음 3개 행만 상세 로그
          if (i <= 3) {
            console.log(`🔍 행 ${i + 1} 원본 데이터:`, row);
            console.log(`🔍 행 ${i + 1} 길이: ${row.length}, 첫 5개 값:`, row.slice(0, 5));
          }
          
          // 숫자 변환 함수 - null 허용
          const parseNumber = (value: any): number | null => {
            if (value === null || value === undefined || value === '') return null;
            const num = Number(value);
            return isNaN(num) ? null : num;
          };
          
          // 문자열 변환 함수
          const parseString = (value: any): string => {
            if (value === null || value === undefined) return '';
            return value.toString().trim();
          };
          
          // 날짜 변환 함수
          const parseDate = (value: any): string => {
            if (value === null || value === undefined || value === '') return '';
            // 엑셀 날짜를 문자열로 변환
            try {
              if (typeof value === 'number') {
                // 엑셀 날짜 시리얼 번호인 경우
                const date = new Date((value - 25569) * 86400 * 1000);
                return date.toISOString().split('T')[0];
              }
              return parseString(value);
            } catch (error) {
              return parseString(value);
            }
          };
          
          // 안전한 데이터 처리 - A열(인덱스) 건너뛰고 B열부터 매핑
          const rowData: any = {
            user_id: userId,
            inventory_id: parseString(row[1]) || null,        // B열
            option_id: parseString(row[2]) || null,           // C열
            sku_id: parseString(row[3]) || null,              // D열
            product_name: parseString(row[4]) || null,        // E열
            option_name: parseString(row[5]) || null,         // F열
            offer_condition: parseString(row[6]) || null,     // G열
            orderable_quantity: parseNumber(row[7]) || null,  // H열
            pending_inbounds: parseNumber(row[8]) || null,    // I열
            item_winner: parseNumber(row[9]) || null,         // J열
            sales_last_7_days: parseNumber(row[10]) || null,  // K열
            sales_last_30_days: parseNumber(row[11]) || null, // L열
            sales_quantity_last_7_days: parseNumber(row[12]) || null,    // M열
            sales_quantity_last_30_days: parseNumber(row[13]) || null,   // N열
            recommanded_inboundquantity: parseNumber(row[14]) || null,   // O열
            monthly_storage_fee: parseNumber(row[17]) || null,           // R열
            sku_age_in_30days: parseNumber(row[18]) || null,             // S열
            sku_age_in_60days: (parseNumber(row[19]) || 0) + (parseNumber(row[20]) || 0) + (parseNumber(row[21]) || 0) + (parseNumber(row[22]) || 0) + (parseNumber(row[23]) || 0) || null, // sum(T:X)열
            product_listing_date: parseDate(row[26]) || null             // AA열 (26 = AA)
          };
          
          // 처음 3개 행만 매핑 결과 로그
          if (i <= 3) {
            console.log(`🔍 행 ${i + 1} 매핑 결과:`, {
              inventory_id: rowData.inventory_id,
              option_id: rowData.option_id,
              sku_id: rowData.sku_id,
              product_name: rowData.product_name
            });
          }
          
          processedData.push(rowData);
        }
        
        console.log(`✅ 로켓 인벤토리 엑셀 파싱 완료: ${processedData.length}개 행 처리`);
        resolve(processedData);
      } catch (error) {
        console.error('❌ 로켓 인벤토리 엑셀 파싱 오류:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

const saveRocketInventoryDataToSupabase = async (
  data: RocketInventoryData[],
  progressCallback: (stage: string, current?: number, total?: number) => void
): Promise<{ success: boolean; savedCount: number; error?: string }> => {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('로그인 사용자 정보를 찾을 수 없습니다.');
    }
    
    console.log(`🚀 coupang_rocket_inventory 테이블에 데이터 저장 시작: ${data.length}개 행`);
    
    // 먼저 테이블 구조 확인
    try {
             const { data: sampleData, error: sampleError } = await supabase
         .from('coupang_rocket_inventory')
         .select('*')
         .limit(1);
      
      if (sampleError) {
        console.error('❌ 테이블 구조 확인 오류:', sampleError);
        console.log('📋 테이블이 존재하지 않거나 접근 권한이 없을 수 있습니다.');
      } else {
        console.log('✅ 테이블 접근 성공');
        if (sampleData && sampleData.length > 0) {
          console.log('📋 기존 데이터 샘플:', Object.keys(sampleData[0]));
        } else {
          console.log('📋 테이블이 비어있음');
        }
      }
    } catch (testError) {
      console.error('❌ 테이블 접근 테스트 실패:', testError);
    }
    
    // 1. 기존 사용자 데이터 삭제
    progressCallback('기존 로켓 인벤토리 데이터 삭제 중...', 0, data.length);
    console.log(`🗑️ 기존 데이터 삭제 중... (user_id: ${userId})`);
    
    // 삭제 전 기존 데이터 개수 확인
    const { count: beforeCount, error: countError } = await supabase
      .from('coupang_rocket_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (!countError) {
      console.log(`📊 삭제 전 기존 데이터 개수: ${beforeCount}개`);
    }
    
         const { error: deleteError } = await supabase
       .from('coupang_rocket_inventory')
       .delete()
       .eq('user_id', userId);
    
    if (deleteError) {
      console.error('❌ 기존 데이터 삭제 오류:', deleteError);
      console.error('❌ 삭제 오류 상세:', deleteError.message);
      throw deleteError;
    }
    
    // 삭제 후 확인
    const { count: afterCount, error: afterCountError } = await supabase
      .from('coupang_rocket_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (afterCountError) {
      console.error('❌ 삭제 후 확인 실패:', afterCountError);
    }
    
    console.log(`✅ 기존 데이터 삭제 완료: ${afterCount}개 남음`);
    
    // 삭제 후 잠시 대기 (DB 정리 시간)
    if (beforeCount && beforeCount > 0) {
      console.log('⏳ 데이터베이스 정리를 위해 1초 대기...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
        // 2. 데이터 필터링 (option_id가 없는 행만 제외)
    const validData = data.filter((item, index) => {
      if (!item.option_id || item.option_id.trim() === '') {
        console.log(`⚠️ option_id 없는 행 제외: ${index + 1}번째 행`);
        return false;
      }
      return true;
    });
    
    console.log(`📊 데이터 분석:`);
    console.log(`  - 원본 데이터: ${data.length}개`);
    console.log(`  - option_id 없는 행 제외: ${data.length - validData.length}개`);
    console.log(`  - 최종 저장될 데이터: ${validData.length}개`);
    console.log(`  ⚠️ 중복 제거 로직 비활성화: 모든 유효한 데이터 저장`);
    
         // 3. 새 데이터 저장 (배치 처리)
     const BATCH_SIZE = 50;
     let savedCount = 0;
     
     for (let i = 0; i < validData.length; i += BATCH_SIZE) {
       const batchRaw = validData.slice(i, i + BATCH_SIZE);
       
       // 배치 내 중복 option_id 제거 (마지막 항목 유지)
       const uniqueBatch = [];
       const seenOptionIds = new Set();
       
       for (let j = batchRaw.length - 1; j >= 0; j--) {
         const item = batchRaw[j];
         if (item.option_id && !seenOptionIds.has(item.option_id)) {
           seenOptionIds.add(item.option_id);
           uniqueBatch.unshift(item);
         }
       }
       
       const batch = uniqueBatch;
       const batchNum = Math.floor(i / BATCH_SIZE) + 1;
       const totalBatches = Math.ceil(validData.length / BATCH_SIZE);
       
       progressCallback(`로켓 인벤토리 데이터 저장 중 (${batchNum}/${totalBatches})...`, i, validData.length);
      
      console.log(`💾 배치 ${batchNum}/${totalBatches} 저장 중... (${batch.length}개 데이터)`);
      console.log(`🔍 배치 ${batchNum} 데이터 샘플:`, batch[0]);
      console.log(`🔍 배치 ${batchNum} 데이터 샘플 키들:`, Object.keys(batch[0]));
      console.log(`🔍 실제 저장될 데이터 구조:`, {
        inventory_id: batch[0].inventory_id,
        option_id: batch[0].option_id,
        sku_id: batch[0].sku_id,
        product_name: batch[0].product_name
      });
      
             const { error, data: insertedData } = await supabase
         .from('coupang_rocket_inventory')
         .upsert(batch, { 
           onConflict: 'option_id', // Primary Key는 option_id
           ignoreDuplicates: false 
         })
         .select('option_id');
      
      if (error) {
        console.error(`❌ 배치 ${batchNum} 저장 오류:`, error);
        console.error(`❌ 실패한 데이터 샘플:`, batch[0]);
        throw new Error(`배치 ${batchNum} 저장 실패: ${error.message}`);
      }
      
      savedCount += batch.length;
      console.log(`✅ 배치 ${batchNum}/${totalBatches} 저장 완료: ${batch.length}개 (누적: ${savedCount}/${validData.length})`);
    }
    
    console.log(`✅ 모든 로켓 인벤토리 데이터 저장 완료: ${savedCount}개`);
    
    return {
      success: true,
      savedCount: savedCount
    };
  } catch (error) {
    console.error('❌ 로켓 인벤토리 데이터 저장 실패:', error);
    return {
      success: false,
      savedCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
};

export const processRocketInventoryExcelUpload = async (
  file: File,
  progressCallback: (stage: string, current?: number, total?: number) => void
): Promise<RocketInventoryUploadResult> => {
  try {
    // 1. 파일 검증
    progressCallback('파일 검증 중...', 0, 100);
    console.log('🔍 로켓 인벤토리 파일 검증 시작:', file.name);
    
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      throw new Error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
    }
    
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('파일 크기는 50MB 이하여야 합니다.');
    }
    
    // 2. 엑셀 파일 파싱
    progressCallback('로켓 인벤토리 파일 파싱 중...', 10, 100);
    const parsedData = await parseRocketInventoryExcelFile(file);
    
    if (parsedData.length === 0) {
      throw new Error('파싱된 데이터가 없습니다. 엑셀 형식을 확인해주세요.');
    }
    
    // 3. 데이터베이스 저장
    console.log(`🔍 저장할 데이터 샘플:`, parsedData.slice(0, 2));
    progressCallback('coupang_rocket_inventory 테이블에 저장 중...', 50, 100);
    const saveResult = await saveRocketInventoryDataToSupabase(parsedData, progressCallback);
    
    if (!saveResult.success) {
      console.error(`❌ 저장 실패 상세:`, saveResult.error);
      throw new Error(saveResult.error || '데이터 저장 실패');
    }
    
    progressCallback('coupang_rocket_inventory 테이블에 저장 완료', 100, 100);
    
    return {
      success: true,
      processedCount: saveResult.savedCount,
      totalRows: parsedData.length,
      error: null
    };
  } catch (error) {
    console.error('❌ 로켓 인벤토리 업로드 오류:', error);
    return {
      success: false,
      processedCount: 0,
      totalRows: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}; 