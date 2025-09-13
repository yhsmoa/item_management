// 출고 관리 서비스 클래스
import { supabase } from '../../../../config/supabase';

export interface ShipmentData {
  id: string;
  user_id: string;
  item_name: string;
  barcode: string;
  stock: number;
  location: string;
  note: string | null;
}

export interface StockData {
  id: string;
  user_id: string;
  item_name: string;
  barcode: string;
  stock: number;
  location: string;
  note: string | null;
}

export class ShipmentManagerService {
  /**
   * 바코드별 출고 수량 합계 조회
   * @param userId 사용자 ID
   * @returns 바코드별 출고 수량 맵
   */
  static async loadShipmentStockData(userId: string): Promise<{[barcode: string]: number}> {
    try {
      const { data, error } = await supabase
        .from('stocks_shipment')
        .select('barcode, stock')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ 출고 재고 데이터 로드 오류:', error);
        return {};
      }

      const shipmentStockMap: {[barcode: string]: number} = {};
      data?.forEach((item: any) => {
        if (item.barcode && item.stock) {
          const barcode = item.barcode;
          const stock = Number(item.stock) || 0;
          shipmentStockMap[barcode] = (shipmentStockMap[barcode] || 0) + stock;
        }
      });

      console.log('✅ 출고 재고 데이터 로드 완료:', Object.keys(shipmentStockMap).length + '개 바코드');
      return shipmentStockMap;
    } catch (error) {
      console.error('❌ 출고 재고 데이터 로드 실패:', error);
      return {};
    }
  }

  /**
   * 특정 바코드의 현재 출고 데이터 조회
   * @param userId 사용자 ID
   * @param barcode 바코드
   * @returns 출고 데이터 배열
   */
  static async getShipmentDataByBarcode(userId: string, barcode: string): Promise<ShipmentData[]> {
    try {
      const { data, error } = await supabase
        .from('stocks_shipment')
        .select('*')
        .eq('user_id', userId)
        .eq('barcode', barcode)
        .order('id', { ascending: true });

      if (error) {
        console.error('❌ 출고 데이터 조회 오류:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ 출고 데이터 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 바코드의 창고 재고 데이터 조회
   * @param userId 사용자 ID
   * @param barcode 바코드
   * @returns 창고 재고 데이터 배열
   */
  static async getStockDataByBarcode(userId: string, barcode: string): Promise<StockData[]> {
    try {
      const { data, error } = await supabase
        .from('stocks_management')
        .select('*')
        .eq('user_id', userId)
        .eq('barcode', barcode)
        .gt('stock', 0)
        .order('id', { ascending: true });

      if (error) {
        console.error('❌ 창고 재고 데이터 조회 오류:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ 창고 재고 데이터 조회 실패:', error);
      return [];
    }
  }

  /**
   * 출고 수량 증가 처리
   * @param userId 사용자 ID
   * @param barcode 바코드
   * @param increaseAmount 증가할 수량
   * @returns 처리 결과
   */
  static async increaseShipment(
    userId: string, 
    barcode: string, 
    increaseAmount: number
  ): Promise<{success: boolean, message: string}> {
    try {
      console.log(`🔄 [INCREASE] 출고 수량 증가 시작: ${barcode}, +${increaseAmount}`);

      // 1. 현재 출고 데이터에서 이미 사용중인 ID 목록 조회
      const existingShipmentData = await this.getShipmentDataByBarcode(userId, barcode);
      const existingIds = new Set(existingShipmentData.map(item => item.id));

      // 2. 창고 재고에서 필요한 수량만큼 데이터 수집 (이미 출고에 있는 ID는 제외)
      const stockData = await this.getStockDataByBarcode(userId, barcode);
      const availableStockData = stockData.filter(item => !existingIds.has(item.id));
      
      if (availableStockData.length === 0) {
        return { success: false, message: '사용 가능한 창고 재고가 없습니다.' };
      }

      let remainingAmount = increaseAmount;
      const dataToMove: ShipmentData[] = [];

      for (const stockItem of availableStockData) {
        if (remainingAmount <= 0) break;

        const availableStock = stockItem.stock;
        const takeAmount = Math.min(remainingAmount, availableStock);

        dataToMove.push({
          id: stockItem.id,
          user_id: userId,
          item_name: stockItem.item_name,
          barcode: stockItem.barcode,
          stock: takeAmount,
          location: stockItem.location,
          note: stockItem.note
        });

        remainingAmount -= takeAmount;
      }

      if (remainingAmount > 0) {
        return { 
          success: false, 
          message: `사용 가능한 창고 재고 부족: ${increaseAmount - remainingAmount}개만 가능` 
        };
      }

      // 3. stocks_shipment에 데이터 추가 (INSERT 방식 - ID 충돌 없음)
      const { error: insertError } = await supabase
        .from('stocks_shipment')
        .insert(dataToMove);

      if (insertError) {
        console.error('❌ [INCREASE] 출고 데이터 저장 오류:', insertError);
        return { success: false, message: '출고 데이터 저장 실패' };
      }

      console.log(`✅ [INCREASE] 출고 수량 증가 완료: ${barcode}, +${increaseAmount}`);
      return { success: true, message: `${increaseAmount}개 출고 추가 완료` };

    } catch (error) {
      console.error('❌ [INCREASE] 출고 수량 증가 실패:', error);
      return { success: false, message: '출고 수량 증가 처리 중 오류 발생' };
    }
  }

  /**
   * 출고 수량 감소 처리
   * @param userId 사용자 ID
   * @param barcode 바코드
   * @param targetAmount 목표 수량 (현재 수량에서 이 값으로 줄임)
   * @returns 처리 결과
   */
  static async decreaseShipment(
    userId: string, 
    barcode: string, 
    targetAmount: number
  ): Promise<{success: boolean, message: string}> {
    try {
      console.log(`🔄 [DECREASE] 출고 수량 감소 시작: ${barcode}, 목표: ${targetAmount}`);

      // 1. 현재 출고 데이터 조회
      const currentShipmentData = await this.getShipmentDataByBarcode(userId, barcode);
      
      if (currentShipmentData.length === 0) {
        return { success: false, message: '출고 데이터가 없습니다.' };
      }

      const currentTotal = currentShipmentData.reduce((sum, item) => sum + item.stock, 0);
      
      if (targetAmount >= currentTotal) {
        return { success: false, message: '현재 수량보다 큰 값으로 설정할 수 없습니다.' };
      }

      // 2. 제거할 수량 계산
      const removeAmount = currentTotal - targetAmount;
      let remainingToRemove = removeAmount;
      const itemsToDelete: string[] = [];
      const itemsToUpdate: {id: string, newStock: number}[] = [];

      // 3. 뒤에서부터 제거 (LIFO 방식)
      for (let i = currentShipmentData.length - 1; i >= 0 && remainingToRemove > 0; i--) {
        const item = currentShipmentData[i];
        
        if (item.stock <= remainingToRemove) {
          // 전체 삭제
          itemsToDelete.push(item.id);
          remainingToRemove -= item.stock;
        } else {
          // 일부만 삭제 (수량 감소)
          const newStock = item.stock - remainingToRemove;
          itemsToUpdate.push({ id: item.id, newStock });
          remainingToRemove = 0;
        }
      }

      // 4. 데이터베이스 업데이트 실행
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('stocks_shipment')
          .delete()
          .in('id', itemsToDelete)
          .eq('user_id', userId);

        if (deleteError) {
          console.error('❌ [DECREASE] 출고 데이터 삭제 오류:', deleteError);
          return { success: false, message: '출고 데이터 삭제 실패' };
        }
      }

      if (itemsToUpdate.length > 0) {
        for (const updateItem of itemsToUpdate) {
          const { error: updateError } = await supabase
            .from('stocks_shipment')
            .update({ stock: updateItem.newStock })
            .eq('id', updateItem.id)
            .eq('user_id', userId);

          if (updateError) {
            console.error('❌ [DECREASE] 출고 데이터 업데이트 오류:', updateError);
            return { success: false, message: '출고 데이터 업데이트 실패' };
          }
        }
      }

      console.log(`✅ [DECREASE] 출고 수량 감소 완료: ${barcode}, 목표: ${targetAmount}`);
      return { 
        success: true, 
        message: `출고 수량을 ${targetAmount}개로 조정 완료 (${removeAmount}개 감소)` 
      };

    } catch (error) {
      console.error('❌ [DECREASE] 출고 수량 감소 실패:', error);
      return { success: false, message: '출고 수량 감소 처리 중 오류 발생' };
    }
  }

  /**
   * 출고 수량 업데이트 (전체 교체 방식)
   * @param userId 사용자 ID
   * @param barcode 바코드
   * @param currentAmount 현재 수량
   * @param newAmount 새로운 수량
   * @returns 처리 결과
   */
  static async updateShipmentAmount(
    userId: string,
    barcode: string,
    currentAmount: number,
    newAmount: number
  ): Promise<{success: boolean, message: string}> {
    console.log('🆕 [NEW_LOGIC] 새로운 전체 교체 방식 실행!', { barcode, currentAmount, newAmount });
    
    if (newAmount === currentAmount) {
      return { success: true, message: '변경사항이 없습니다.' };
    }

    if (newAmount === 0) {
      // 모든 출고 데이터 삭제
      console.log('🗑️ [NEW_LOGIC] 모든 출고 데이터 삭제 실행');
      return await this.clearAllShipment(userId, barcode);
    }

    // 전체 교체 방식: 기존 데이터 삭제 후 새로 생성
    console.log('🔄 [NEW_LOGIC] 전체 교체 방식 실행');
    return await this.replaceShipmentAmount(userId, barcode, newAmount);
  }

  /**
   * 출고 데이터 전체 교체 (안전한 방식)
   * @param userId 사용자 ID
   * @param barcode 바코드
   * @param targetAmount 목표 수량
   * @returns 처리 결과
   */
  static async replaceShipmentAmount(
    userId: string,
    barcode: string,
    targetAmount: number
  ): Promise<{success: boolean, message: string}> {
    try {
      console.log(`🔄 [REPLACE] 출고 수량 전체 교체 시작: ${barcode}, 목표: ${targetAmount}`);

      // 1. 기존 출고 데이터 삭제
      const { error: deleteError } = await supabase
        .from('stocks_shipment')
        .delete()
        .eq('user_id', userId)
        .eq('barcode', barcode);

      if (deleteError) {
        console.error('❌ [REPLACE] 기존 출고 데이터 삭제 오류:', deleteError);
        return { success: false, message: '기존 출고 데이터 삭제 실패' };
      }

      // 2. 창고 재고에서 필요한 수량만큼 데이터 수집
      const stockData = await this.getStockDataByBarcode(userId, barcode);
      
      if (stockData.length === 0) {
        return { success: false, message: '창고에 재고가 없습니다.' };
      }

      let remainingAmount = targetAmount;
      const dataToInsert: ShipmentData[] = [];

      for (const stockItem of stockData) {
        if (remainingAmount <= 0) break;

        const availableStock = stockItem.stock;
        const takeAmount = Math.min(remainingAmount, availableStock);

        dataToInsert.push({
          id: stockItem.id,
          user_id: userId,
          item_name: stockItem.item_name,
          barcode: stockItem.barcode,
          stock: takeAmount,
          location: stockItem.location,
          note: stockItem.note
        });

        remainingAmount -= takeAmount;
      }

      if (remainingAmount > 0) {
        return { 
          success: false, 
          message: `창고 재고 부족: ${targetAmount - remainingAmount}개만 가능` 
        };
      }

      // 3. 새로운 출고 데이터 삽입
      const { error: insertError } = await supabase
        .from('stocks_shipment')
        .insert(dataToInsert);

      if (insertError) {
        console.error('❌ [REPLACE] 출고 데이터 삽입 오류:', insertError);
        return { success: false, message: '출고 데이터 삽입 실패' };
      }

      console.log(`✅ [REPLACE] 출고 수량 교체 완료: ${barcode}, 목표: ${targetAmount}`);
      return { success: true, message: `출고 수량을 ${targetAmount}개로 설정 완료` };

    } catch (error) {
      console.error('❌ [REPLACE] 출고 수량 교체 실패:', error);
      return { success: false, message: '출고 수량 교체 처리 중 오류 발생' };
    }
  }

  /**
   * 모든 출고 데이터 삭제
   * @param userId 사용자 ID
   * @param barcode 바코드
   * @returns 처리 결과
   */
  static async clearAllShipment(
    userId: string,
    barcode: string
  ): Promise<{success: boolean, message: string}> {
    try {
      const { error } = await supabase
        .from('stocks_shipment')
        .delete()
        .eq('user_id', userId)
        .eq('barcode', barcode);

      if (error) {
        console.error('❌ [CLEAR] 출고 데이터 삭제 오류:', error);
        return { success: false, message: '출고 데이터 삭제 실패' };
      }

      return { success: true, message: '모든 출고 데이터 삭제 완료' };
    } catch (error) {
      console.error('❌ [CLEAR] 출고 데이터 삭제 실패:', error);
      return { success: false, message: '출고 데이터 삭제 처리 중 오류 발생' };
    }
  }
}