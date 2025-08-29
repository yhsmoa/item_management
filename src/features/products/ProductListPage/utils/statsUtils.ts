// Statistics calculation utility functions

export interface Stats {
  total: number;
  notItemPartner: number;
  outOfStock: number;
  rejected: number;
  selling: number;
  tempSave: number;
}

export const calculateStats = (data: any[]): Stats => {
  return {
    total: data.length,
    notItemPartner: data.filter(item => !item.is_item_partner).length,
    outOfStock: data.filter(item => item.sales_status === 'OUTOFSTOCK').length,
    rejected: data.filter(item => item.status === 'REJECT').length,
    selling: data.filter(item => item.sales_status === 'ONSALE').length,
    tempSave: data.filter(item => item.status === 'TEMP_SAVE').length
  };
};