// Custom hook for managing views data
import { useState, useCallback } from 'react';

export const useViewsData = () => {
  // State management for views data
  const [itemViewsData, setItemViewsData] = useState<{[key: string]: string[]}>({});
  const [viewsDataByDate, setViewsDataByDate] = useState<Array<{[key: string]: string}>>([]);
  const [coupangSalesData, setCoupangSalesData] = useState<{[key: string]: number}>({});

  // Render function for period sales (Coupang sales data)
  const renderPeriodSales = useCallback((row: any) => {
    const optionId = String(row.option_id);
    const sales = coupangSalesData[optionId];
    
    if (sales && sales > 0) {
      return sales;
    }
    return '-';
  }, [coupangSalesData]);

  // Helper function to get view count by date index
  const getViewCountByDate = useCallback((itemId: string, dateIndex: number) => {
    return viewsDataByDate[dateIndex]?.[itemId] || '-';
  }, [viewsDataByDate]);

  // Helper function to check if item should be shown in 사입보기 based on period sales
  const hasPeriodSales = useCallback((itemId: string, optionId: string) => {
    const optionIdStr = String(optionId);
    const periodSales = coupangSalesData[optionIdStr] || 0;
    return periodSales > 0;
  }, [coupangSalesData]);

  return {
    // State
    itemViewsData,
    viewsDataByDate,
    coupangSalesData,
    
    // Setters
    setItemViewsData,
    setViewsDataByDate,
    setCoupangSalesData,
    
    // Functions
    renderPeriodSales,
    getViewCountByDate,
    hasPeriodSales
  };
};