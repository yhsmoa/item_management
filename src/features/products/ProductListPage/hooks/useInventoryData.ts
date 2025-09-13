// Custom hook for managing inventory data
import { useState, useCallback } from 'react';

export const useInventoryData = () => {
  // State management for inventory data
  const [rocketInventoryOptionIds, setRocketInventoryOptionIds] = useState<Set<string>>(new Set());
  const [rocketInventoryData, setRocketInventoryData] = useState<{[key: string]: any}>({});
  const [orderQuantityData, setOrderQuantityData] = useState<{[key: string]: number}>({});
  const [warehouseStockData, setWarehouseStockData] = useState<{[key: string]: number}>({});
  const [purchaseStatusData, setPurchaseStatusData] = useState<{[key: string]: number}>({});
  const [shipmentStockData, setShipmentStockData] = useState<{[key: string]: number}>({});

  // Render functions for inventory-related data
  const renderOrderableQuantity = useCallback((row: any) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.orderable_quantity || row.stock || 0;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return numValue > 0 ? numValue : '-';
  }, [rocketInventoryData]);

  const renderOrderQuantity = useCallback((row: any) => {
    const value = row.barcode && orderQuantityData[String(row.barcode)];
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? numValue : '-';
  }, [orderQuantityData]);

  const renderWarehouseStock = useCallback((row: any) => {
    const barcode = String(row.barcode || '').trim();
    const value = barcode && warehouseStockData[barcode];
    const numValue = typeof value === 'number' ? value : 0;
    
    return numValue > 0 ? numValue : '-';
  }, [warehouseStockData]);

  const renderPurchaseStatus = useCallback((row: any) => {
    const barcode = String(row.barcode || '').trim();
    const value = barcode && purchaseStatusData[barcode];
    const numValue = typeof value === 'number' ? value : 0;
    
    return numValue > 0 ? numValue : '-';
  }, [purchaseStatusData]);

  const renderRecommendedQuantity = useCallback((row: any) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.recommanded_inboundquantity;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? numValue : '-';
  }, [rocketInventoryData]);

  const renderStorageFee = useCallback((row: any) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.monthly_storage_fee;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? numValue : '-';
  }, [rocketInventoryData]);

  const render7DaysSales = useCallback((row: any) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_7_days;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? numValue : '-';
  }, [rocketInventoryData]);

  const render30DaysSales = useCallback((row: any) => {
    const value = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_30_days;
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0);
    return value && numValue > 0 ? numValue : '-';
  }, [rocketInventoryData]);

  const renderShipmentStock = useCallback((row: any) => {
    const barcode = String(row.barcode || '').trim();
    const value = barcode && shipmentStockData[barcode];
    const numValue = typeof value === 'number' ? value : 0;
    
    return numValue > 0 ? numValue : '-';
  }, [shipmentStockData]);

  const shouldHighlightRow = useCallback((row: any) => {
    const sales7Days = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_7_days;
    const sales30Days = row.option_id && rocketInventoryData[row.option_id]?.sales_quantity_last_30_days;
    
    return (sales7Days && sales7Days > 0) || (sales30Days && sales30Days > 0);
  }, [rocketInventoryData]);

  return {
    // State
    rocketInventoryOptionIds,
    rocketInventoryData,
    orderQuantityData,
    warehouseStockData,
    purchaseStatusData,
    shipmentStockData,
    
    // Setters
    setRocketInventoryOptionIds,
    setRocketInventoryData,
    setOrderQuantityData,
    setWarehouseStockData,
    setPurchaseStatusData,
    setShipmentStockData,
    
    // Functions
    renderOrderableQuantity,
    renderOrderQuantity,
    renderWarehouseStock,
    renderPurchaseStatus,
    renderRecommendedQuantity,
    renderStorageFee,
    render7DaysSales,
    render30DaysSales,
    renderShipmentStock,
    shouldHighlightRow
  };
};