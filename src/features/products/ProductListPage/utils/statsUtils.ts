// Statistics calculation utility functions

export interface Stats {
  total: number;
  rocketInventory: number;
  personalOrder: number;
  warehouseStock: number;
  storageFee: number;
  inputData: number;
}

export const calculateStats = (
  data: any[], 
  orderableQuantityData: {[key: string]: any} = {},
  orderQuantityData: {[key: string]: number} = {},
  warehouseStockData: {[key: string]: number} = {},
  storageFeesData: {[key: string]: any} = {},
  inputValues: {[key: string]: string} = {}
): Stats => {
  return {
    total: data.length,
    // 로켓그로스 재고: 쿠팡재고(orderable_quantity) > 0
    rocketInventory: data.filter(item => {
      const orderableQty = orderableQuantityData[item.option_id]?.orderable_quantity;
      return orderableQty && Number(orderableQty) > 0;
    }).length,
    // 개인주문: 개인주문 열 > 0 (현재는 사용하지 않으므로 0으로 처리)
    personalOrder: 0,
    // 창고재고: 창고재고 > 0
    warehouseStock: data.filter(item => {
      const warehouseQty = warehouseStockData[item.barcode];
      return warehouseQty && Number(warehouseQty) > 0;
    }).length,
    // 창고비: storage fee > 0
    storageFee: data.filter(item => {
      const storageFee = storageFeesData[item.option_id]?.monthly_storage_fee;
      return storageFee && Number(storageFee) > 0;
    }).length,
    // 입력: 입력 열에 값이 있는 것들
    inputData: Object.keys(inputValues).filter(key => {
      const value = inputValues[key];
      return value && value.trim() !== '' && Number(value) > 0;
    }).length
  };
};