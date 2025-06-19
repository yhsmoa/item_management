import { supabase } from '../config/supabase';

export interface ImageInfoResult {
  success: boolean;
  totalProcessed: number;
  totalSaved: number;
  error: string | null;
}

export const importImageInfoFromItemAll = async (
  selectedItems: string[],
  progressCallback: (current: number, total: number, message: string) => void
): Promise<ImageInfoResult> => {
  try {
    const total = selectedItems.length || 100; // 시뮬레이션용
    
    for (let i = 0; i < total; i++) {
      progressCallback(i + 1, total, `일반쿠팡 API 처리 중... (${i + 1}/${total})`);
      await new Promise(resolve => setTimeout(resolve, 100)); // 시뮬레이션
    }
    
    return {
      success: true,
      totalProcessed: total,
      totalSaved: total,
      error: null
    };
  } catch (error) {
    console.error('일반쿠팡 API 오류:', error);
    return {
      success: false,
      totalProcessed: 0,
      totalSaved: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
};

export const importImageInfoFromItemAllRocketGrowth = async (
  selectedItems: string[],
  progressCallback: (current: number, total: number, message: string) => void
): Promise<ImageInfoResult> => {
  try {
    const total = selectedItems.length || 50; // 시뮬레이션용
    
    for (let i = 0; i < total; i++) {
      progressCallback(i + 1, total, `로켓그로스 API 처리 중... (${i + 1}/${total})`);
      await new Promise(resolve => setTimeout(resolve, 100)); // 시뮬레이션
    }
    
    return {
      success: true,
      totalProcessed: total,
      totalSaved: total,
      error: null
    };
  } catch (error) {
    console.error('로켓그로스 API 오류:', error);
    return {
      success: false,
      totalProcessed: 0,
      totalSaved: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}; 