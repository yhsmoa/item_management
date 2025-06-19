import { supabase } from '../config/supabase';

// XLSX 라이브러리를 window 객체에 추가
declare global {
  interface Window {
    XLSX: any;
  }
}

/**
 * 쿠팡 상품 데이터 타입 정의 (A:S 열 순서)
 */
export interface CoupangProductExcelData {
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
  edit_price: string;        // P열 (빈 값)
  edit_regular_price: string; // Q열 (빈 값)
  edit_sales_status: string; // R열 (빈 값)
  edit_coupang_stock: string; // S열 (빈 값)
  user_id: string;           // 사용자 ID
}

/**
 * 엑셀 컬럼 매핑 (0부터 시작하는 인덱스)
 */
const EXCEL_COLUMN_MAPPING = {
  item_id: 0,           // A열
  product_id: 1,        // B열
  option_id: 2,         // C열
  item_status: 3,       // D열
  barcode: 4,           // E열
  vendor_item_id: 5,    // F열
  product_name: 6,      // G열
  item_name: 7,         // H열
  option_name: 8,       // I열
  price: 9,             // J열
  regular_price: 10,    // K열
  sales_status: 11,     // L열
  coupang_stock: 12,    // M열
  sales_quantity: 13,   // N열
  coupang_approval: 14, // O열
  edit_price: 15,       // P열
  edit_regular_price: 16, // Q열
  edit_sales_status: 17, // R열
  edit_coupang_stock: 18, // S열
};

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
 * 엑셀 파일을 읽어서 파싱하는 함수
 * 'data' 시트의 4행부터 데이터를 읽어옴 (3행까지는 헤더)
 * 
 * @param file - 업로드된 엑셀 파일
 * @returns Promise<CoupangProductExcelData[]> - 파싱된 상품 데이터 배열
 */
export async function parseProductExcelFile(file: File): Promise<CoupangProductExcelData[]> {
  // XLSX 라이브러리 동적 로딩
  if (!window.XLSX) {
    const XLSX_MODULE = await import('xlsx');
    window.XLSX = XLSX_MODULE.default || XLSX_MODULE;
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        console.log('📊 엑셀 파일 파싱 시작...');
        console.log('📂 파일 정보:', {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified).toLocaleString()
        });
        
        // 엑셀 파일 데이터를 Uint8Array로 변환
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // 제한된 보기 및 보안 파일도 처리할 수 있도록 옵션 설정
        let workbook: any;
        try {
          // 첫 번째 시도: 일반적인 읽기
          workbook = window.XLSX.read(data, { 
            type: 'array',
            cellFormula: false, // 수식 무시
            cellHTML: false, // HTML 무시
            cellNF: false, // 숫자 형식 무시
            cellStyles: false, // 스타일 무시
            cellText: true, // 텍스트만 읽기
            cellDates: false, // 날짜 형식 무시
            bookVBA: false, // VBA 무시
            password: '', // 비밀번호 빈값
            WTF: false // 엄격 모드 비활성화
          });
        } catch (firstError) {
          console.warn('⚠️ 첫 번째 읽기 시도 실패, 호환 모드로 재시도:', firstError);
          
          try {
            // 두 번째 시도: 더 관대한 옵션
            workbook = window.XLSX.read(data, { 
              type: 'array',
              cellText: false, // 텍스트 모드 비활성화
              cellFormula: false,
              cellHTML: false,
              cellNF: false,
              cellStyles: false,
              cellDates: false,
              bookVBA: false,
              password: '',
              WTF: true, // 경고 무시 모드
              raw: true // 원시 데이터 모드
            });
          } catch (secondError) {
            console.warn('⚠️ 두 번째 읽기 시도 실패, 기본 모드로 재시도:', secondError);
            
            // 세 번째 시도: 최소 옵션
            workbook = window.XLSX.read(data, { 
              type: 'array'
            });
          }
        }
        
        console.log('📋 워크북 시트 목록:', workbook.SheetNames);
        
        // 모든 시트의 데이터 행 수 확인
        workbook.SheetNames.forEach((sheetName: string) => {
          const sheet = workbook.Sheets[sheetName];
          const sheetData = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
          console.log(`📋 시트 "${sheetName}": ${sheetData.length}행`);
        });
        
        // 'data' 시트 찾기 (대소문자 구분 없이)
        let worksheet = workbook.Sheets['data'];
        let usedSheetName = 'data';
        
        if (!worksheet) {
          // 'data' 시트가 없으면 다른 이름으로 찾아보기
          const dataSheetName = workbook.SheetNames.find((name: string) => 
            name.toLowerCase() === 'data' || 
            name.toLowerCase().includes('data') ||
            name === 'Sheet1' || // 기본 시트명도 시도
            name === '시트1'
          );
          
          if (dataSheetName) {
            worksheet = workbook.Sheets[dataSheetName];
            usedSheetName = dataSheetName;
            console.log(`📋 "${dataSheetName}" 시트를 사용합니다.`);
          } else {
            // 첫 번째 시트 사용
            const firstSheetName = workbook.SheetNames[0];
            worksheet = workbook.Sheets[firstSheetName];
            usedSheetName = firstSheetName;
            console.log(`📋 첫 번째 시트 "${firstSheetName}"를 사용합니다.`);
          }
        } else {
          console.log('📋 "data" 시트를 사용합니다.');
        }
        
        console.log(`📋 최종 사용 시트: "${usedSheetName}"`);
        console.log('📋 워크시트 범위:', worksheet['!ref']);
        
        if (!worksheet) {
          throw new Error('엑셀 파일에서 사용할 수 있는 시트를 찾을 수 없습니다.');
        }
        
        // 워크시트를 JSON 배열로 변환 (안정적인 방법)
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '', // 빈 셀을 빈 문자열로 처리
          raw: false, // 원시 값이 아닌 포맷된 값 사용
          blankrows: false, // 빈 행 제외
          range: undefined // 전체 범위 사용
        });
        
        console.log('📋 엑셀 원본 데이터 총 행 수:', jsonData.length);
        console.log('📋 엑셀 원본 데이터 (처음 5행):', jsonData.slice(0, 5));
        
        // 4행부터 데이터 처리 (인덱스 3부터 시작, 3행까지는 헤더)
        const processedData: CoupangProductExcelData[] = [];
        
        console.log('🔍 데이터 처리 시작 - 4행부터 데이터 매핑...');
        
        // 문자열 변환 함수 (null, undefined, 빈 값을 빈 문자열로 변환)
        const parseString = (value: any): string => {
          if (value === null || value === undefined || value === '') return '';
          return value.toString().trim();
        };
        
        // 실제 데이터 행 개수 확인
        let validDataCount = 0;
        for (let i = 3; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          // 빈 행 건너뛰기 (A열에 데이터가 없는 경우)
          if (!row || row.length === 0 || !row[0]) {
            continue;
          }
          
          validDataCount++;
          
          // 너무 많은 로그를 방지하기 위해 처음 3개와 마지막 3개만 로그
          if (validDataCount <= 3 || i >= jsonData.length - 3) {
            console.log(`🔍 행 ${i + 1} (데이터 ${validDataCount}): A=${row[0]}, B=${row[1]}, C=${row[2]}`);
          }
          
          // A열~S열을 순서대로 지정된 컬럼에 매핑
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
            edit_price: parseString(row[15]) || '', // P열 (빈 값이면 빈 문자열)
            edit_regular_price: parseString(row[16]) || '', // Q열 (빈 값이면 빈 문자열)
            edit_sales_status: parseString(row[17]) || '', // R열 (빈 값이면 빈 문자열)
            edit_coupang_stock: parseString(row[18]) || '', // S열 (빈 값이면 빈 문자열)
            user_id: '' // 나중에 설정
          };
          
          processedData.push(rowData);
        }
        
        console.log(`✅ 엑셀 파싱 완료: ${processedData.length}개 행 처리`);
        
        if (processedData.length > 0) {
          console.log('📝 첫 번째 데이터 샘플:', processedData[0]);
          console.log('📝 첫 번째 데이터 상세:');
          console.log('   item_id:', processedData[0]?.item_id);
          console.log('   product_id:', processedData[0]?.product_id);
          console.log('   option_id:', processedData[0]?.option_id);
          
          if (processedData.length > 1) {
            console.log('📝 마지막 데이터 샘플:', processedData[processedData.length - 1]);
          }
          
          // 데이터 유효성 검사
          const validItems = processedData.filter(item => item.item_id && item.item_id.trim());
          const invalidItems = processedData.length - validItems.length;
          
          console.log(`📊 데이터 품질 검사: 유효 ${validItems.length}개, 무효 ${invalidItems}개`);
          
          if (invalidItems > 0) {
            console.warn(`⚠️ ${invalidItems}개의 행에 item_id가 없습니다.`);
          }
        } else {
          console.error('❌ 파싱된 데이터가 없습니다.');
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
 * 기존 사용자 데이터를 삭제하고 새 데이터로 교체
 * 
 * @param data - 저장할 상품 데이터 배열
 * @param userId - 현재 로그인한 사용자 ID
 * @param onProgress - 진행상황 콜백 함수
 * @returns Promise<{success: boolean, savedCount: number, error?: string}>
 */
export async function saveProductDataToSupabase(
  data: CoupangProductExcelData[],
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; savedCount: number; error?: string }> {
  try {
    console.log(`🚀 데이터베이스 저장 시작: ${data.length}개 행`);
    
    // 1. 기존 사용자 데이터 삭제
    onProgress?.(0, data.length);
    console.log(`🗑️ 기존 데이터 삭제 중... (user_id: ${userId})`);
    
    try {
      const { error: deleteError } = await supabase
        .from('extract_coupang_item_all')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('❌ 기존 데이터 삭제 오류:', deleteError);
        throw deleteError;
      }
      
      console.log('✅ 기존 데이터 삭제 완료');
      
      // 삭제 후 잠시 대기 (DB 정리 시간)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ 데이터 삭제 실패:', error);
      throw error;
    }
    
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
    const emptyOptionIds = dataWithUserId.filter(item => !item.option_id || item.option_id.trim() === '').length;
    
    console.log(`🔄 user_id 추가 및 데이터 정리 완료:`);
    console.log(`   원본: ${dataWithUserId.length}개`);
    console.log(`   유효 데이터: ${uniqueData.length}개`);
    console.log(`   제외된 항목: ${duplicateCount}개 (중복: ${duplicateCount - emptyOptionIds}개, 빈 option_id: ${emptyOptionIds}개)`);
    
    console.log('📝 첫 번째 데이터 샘플 (user_id 포함):', {
      item_id: uniqueData[0]?.item_id,
      option_id: uniqueData[0]?.option_id,
      product_name: uniqueData[0]?.product_name,
      user_id: uniqueData[0]?.user_id
    });
    
    // 3. 배치 단위로 데이터 저장 (대용량 파일을 위해 50개씩 처리)
    const BATCH_SIZE = 50;
    let savedCount = 0;
    
    for (let i = 0; i < uniqueData.length; i += BATCH_SIZE) {
      const batch = uniqueData.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(uniqueData.length / BATCH_SIZE);
      
      console.log(`💾 배치 ${batchNum}/${totalBatches} 저장 중... (${batch.length}개 데이터)`);
      
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`💾 배치 ${batchNum}/${totalBatches} 시도 ${retryCount + 1}/${maxRetries + 1}...`);
          
          const { error, data: upsertedData } = await supabase
            .from('extract_coupang_item_all')
            .upsert(batch, { 
              onConflict: 'option_id', // Primary Key는 option_id 하나
              ignoreDuplicates: false 
            })
            .select('item_id'); // 삽입된 데이터 확인
          
          if (error) {
            console.error(`❌ 배치 ${batchNum} 저장 오류 (시도 ${retryCount + 1}):`, {
              error: error,
              batchData: batch.slice(0, 2), // 첫 2개만 로그
              batchSize: batch.length
            });
            
            if (retryCount < maxRetries) {
              retryCount++;
              const waitTime = Math.pow(2, retryCount) * 1000; // 지수적 백오프
              console.log(`⏳ ${waitTime/1000}초 후 재시도...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            } else {
              throw new Error(`배치 ${batchNum} 최대 재시도 횟수 초과: ${error.message}`);
            }
          }
          
                    // 성공
          savedCount += batch.length;
          console.log(`✅ 배치 ${batchNum}/${totalBatches} upsert 완료: ${batch.length}개 (누적: ${savedCount}/${uniqueData.length})`);
          
          // 진행상황 업데이트
          if (onProgress) {
            onProgress(savedCount, uniqueData.length);
          }
          
          // 배치 간 잠시 대기 (서버 부하 방지)
          if (i + BATCH_SIZE < uniqueData.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // 매 20배치마다 가비지 컬렉션 유도 (메모리 정리)
              if (batchNum % 20 === 0 && typeof window !== 'undefined' && window.gc) {
                console.log(`🧹 메모리 정리 중... (배치 ${batchNum})`);
                window.gc();
              }
            }
          
          break; // 성공하면 재시도 루프 종료
          
        } catch (error) {
          console.error(`❌ 배치 ${batchNum} 처리 중 예외 (시도 ${retryCount + 1}):`, error);
          
          if (retryCount < maxRetries) {
            retryCount++;
            const waitTime = Math.pow(2, retryCount) * 1000; // 지수적 백오프
            console.log(`⏳ ${waitTime/1000}초 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            throw new Error(`배치 ${batchNum} 최대 재시도 횟수 초과: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          }
        }
      }
    }
    
    console.log(`🎉 모든 데이터 저장 완료: ${savedCount}개 행`);
    
    return {
      success: true,
      savedCount
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

/**
 * 엑셀 파일 업로드 및 처리 통합 함수
 * 파일 검증 → 파싱 → 데이터베이스 저장까지 전체 프로세스 처리
 * 
 * @param file - 업로드된 엑셀 파일
 * @param onProgress - 진행상황 콜백 함수
 * @returns Promise<{success: boolean, processedCount: number, error?: string}>
 */
export async function processProductExcelUpload(
  file: File,
  onProgress?: (stage: string, current?: number, total?: number) => void
): Promise<{ success: boolean; processedCount: number; error?: string }> {
  try {
    // 1. 파일 검증
    onProgress?.('파일 검증 중...');
    console.log('🔍 파일 검증 시작:', file.name, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
    
    // 파일 확장자 검증
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      throw new Error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
    }
    
    // 파일 크기 검증 (50MB 제한으로 증가)
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('파일 크기는 50MB 이하여야 합니다.');
    }
    
    console.log('✅ 파일 검증 완료');
    
    // 2. 엑셀 파일 파싱
    onProgress?.('엑셀 파일 파싱 중...');
    console.log('📊 엑셀 파싱 시작...');
    
    const parsedData = await parseProductExcelFile(file);
    
    if (parsedData.length === 0) {
      throw new Error('파싱된 데이터가 없습니다. 엑셀 형식을 확인해주세요.');
    }
    
    console.log(`✅ 엑셀 파싱 완료: ${parsedData.length}개 행`);
    
    // 3. 현재 로그인한 사용자 ID 가져오기
    const userId = getCurrentUserId();
    
    if (!userId) {
      throw new Error('로그인 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
    }
    
    console.log('🔑 사용자 ID 확인:', userId);
    
    // 4. 데이터베이스 저장
    onProgress?.('데이터베이스 저장 중...', 0, parsedData.length);
    console.log('💾 데이터베이스 저장 시작...');
    
    const result = await saveProductDataToSupabase(parsedData, userId, (current: number, total: number) => {
      onProgress?.('데이터베이스 저장 중...', current, total);
    });
    
    if (!result.success) {
      throw new Error(result.error || '데이터베이스 저장 실패');
    }
    
    console.log(`🎉 전체 프로세스 완료: ${result.savedCount}개 데이터 저장`);
    
    return {
      success: true,
      processedCount: result.savedCount
    };
    
  } catch (error) {
    console.error('❌ 엑셀 처리 오류:', error);
    return {
      success: false,
      processedCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
} 