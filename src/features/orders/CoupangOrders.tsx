import React, { useState, useRef, useEffect } from 'react';
import './CoupangOrders.css';
import { processPersonalOrderExcelUpload } from '../../services/excelUploadService';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';
import DashboardStatsCard from '../products/ProductListPage/components/DashboardStatsCard';

/**
 * 쿠팡 주문 데이터 타입
 */
interface CoupangOrderData {
  id: string;
  order_number: string;
  product_id: string;
  option_id: string;
  separate_shipping: string;
  order_date: string;
  order_expected_shipping_date: string;
  item_name: string;
  option_name: string;
  qty: number;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  recipient_address: string;
  delivery_message: string;
  user_id: string;
  // 계산된 필드들
  sequence?: number;
  total_qty?: number;
  stock_qty?: number;
  purchase_qty?: number;
  // 엑셀 다운로드용 전체 필드들
  number?: string;
  bundle_shipping_number?: string;
  delivery_company?: string;
  tracking_number?: string;
  separate_shipping_expected_date?: string;
  shipping_date?: string;
  product_name?: string;
  initial_registered_product_option?: string;
  vendor_product_code?: string;
  barcode?: string;
  payment_amount?: number;
  shipping_fee_type?: string;
  shipping_fee?: number;
  remote_area_additional_fee?: string;
  option_sale_price?: number;
  buyer?: string;
  buyer_phone?: string;
  product_additional_message?: string;
  orderer_additional_message?: string;
  delivery_completion_date?: string;
  purchase_confirmation_date?: string;
  PCCC?: string;
  customs_recipient_phone?: string;
  etc?: string;
  payment_location?: string;
  delivery_type?: string;
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
 * 날짜 포맷팅 함수 (YYYY-MM-DD HH:MM:SS+00 -> YYYY-MM-DD)
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD 형태로 변환
  } catch (error) {
    return dateString.split(' ')[0] || dateString.split('T')[0] || dateString;
  }
}

/**
 * 쿠팡 주문 관리 페이지
 * - 쿠팡에서 들어온 주문들을 관리하는 페이지
 */
const CoupangOrders: React.FC = () => {
  // State 정의
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCategory, setSearchCategory] = useState('등록상품명');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [orderData, setOrderData] = useState<CoupangOrderData[]>([]);
  const [filteredOrderData, setFilteredOrderData] = useState<CoupangOrderData[]>([]);
  const [stockData, setStockData] = useState<Map<string, number>>(new Map());
  const [stockDetailData, setStockDetailData] = useState<Map<string, Array<{location: string, stock: number}>>>(new Map());
  const [purchaseData, setPurchaseData] = useState<Map<string, number>>(new Map());
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ stage: '', current: 0, total: 100 });
  const [multiFileProgress, setMultiFileProgress] = useState({ currentFile: 0, totalFiles: 0, fileName: '' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<CoupangOrderData | null>(null);
  const [clearDataBeforeUpload, setClearDataBeforeUpload] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 통계 데이터 계산 - 실시간으로 업데이트되는 데이터 기준
  const stats = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let overdueCount = 0;        // 출고지연
    let upcomingCount = 0;       // 출고임박 (3일 남은 것)
    let readyToShipCount = 0;    // 바로출고 (창고 > 0)
    let noOrderCount = 0;        // 미주문 (사입 = 0 또는 "")
    let barcodeErrorCount = 0;   // 바코드 오류 (barcode = "")
    
    orderData.forEach(order => {
      const barcode = order.barcode || '';
      
      // 바코드 오류 체크
      if (!order.barcode || order.barcode.trim() === '') {
        barcodeErrorCount++;
      }
      
      // 실시간 사입 수량 계산
      const purchaseQty = barcode ? (purchaseData.get(barcode) || 0) : 0;
      
      // 미주문 체크 (사입이 0이거나 없는 경우)
      if (purchaseQty === 0) {
        noOrderCount++;
      }
      
      // 실시간 창고 재고 계산
      const stockQty = barcode ? (stockData.get(barcode) || 0) : 0;
      
      // 출고가능 체크 (창고 재고 > 0)
      if (stockQty > 0) {
        readyToShipCount++;
      }
      
      // 출고 날짜 관련 체크
      if (order.order_expected_shipping_date) {
        const orderDateObj = new Date(order.order_expected_shipping_date);
        orderDateObj.setHours(0, 0, 0, 0);
        
        const diffTime = orderDateObj.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // 출고지연 (출고예정일이 지난 경우)
        if (diffDays < 0) {
          overdueCount++;
        } 
        // 출고임박 (3일 이하 남은 경우, 하지만 지나지 않은 경우)
        else if (diffDays <= 3) {
          upcomingCount++;
        }
      }
    });
    
    return {
      total: orderData.length,
      overdue: overdueCount,
      upcoming: upcomingCount,
      readyToShip: readyToShipCount,
      noOrder: noOrderCount,
      barcodeError: barcodeErrorCount
    };
  }, [orderData, stockData, purchaseData]);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 창고 위치 표시 텍스트 생성 함수
   * @param barcode 바코드
   * @param qty 주문 수량
   * @returns 창고 위치 표시 텍스트
   */
  const generateWarehouseText = (barcode: string, qty: number): string => {
    if (!barcode || qty <= 0) return '';
    
    const stockDetails = stockDetailData.get(barcode) || [];
    if (stockDetails.length === 0) return '';
    
    // 재고량 기준으로 내림차순 정렬
    const sortedStocks = [...stockDetails].sort((a, b) => b.stock - a.stock);
    
    if (sortedStocks.length === 0) return '';
    
    // 전체 재고 합계 계산
    const totalStock = sortedStocks.reduce((sum, item) => sum + item.stock, 0);
    
    // qty만큼 필요한 재고를 어떻게 분배할지 계산
    let remainingQty = qty;
    const selectedStocks: Array<{location: string, stock: number, usedQty: number}> = [];
    
    for (const stockItem of sortedStocks) {
      if (remainingQty <= 0) break;
      
      const usedQty = Math.min(stockItem.stock, remainingQty);
      selectedStocks.push({
        location: stockItem.location,
        stock: stockItem.stock,
        usedQty: usedQty
      });
      remainingQty -= usedQty;
    }
    
    // 결과 텍스트 생성
    const result = selectedStocks.map(item => {
      if (item.stock === item.usedQty && item.usedQty < qty) {
        // 해당 위치의 모든 재고를 사용하는 경우 (그리고 qty보다 작은 경우)
        return `[${item.location} -> ${item.stock}]`;
      } else if (item.stock > item.usedQty || item.usedQty === qty) {
        // 해당 위치에 여분이 있거나, 이 위치에서 모든 qty를 충족하는 경우
        return `[${item.location} -> ${item.stock}]`;
      } else {
        return `[${item.location} -> ${item.stock}]`;
      }
    });
    
    return result.join('\n');
  };

  // 재고 데이터 로드 함수
  const loadStockData = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      return;
    }

    try {
      // stocks_management 테이블에서 배치로 모든 데이터 가져오기
      let allStockData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data: batch, error } = await supabase
          .from('stocks_management')
          .select('barcode, stock, location')
          .eq('user_id', userId)
          .not('barcode', 'is', null)
          .neq('barcode', '')
          .range(from, to);

        if (error) {
          console.error('재고 데이터 조회 실패:', error);
          break;
        }

        if (batch && batch.length > 0) {
          allStockData = [...allStockData, ...batch];
          hasMore = batch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 바코드별 재고 합계 및 상세 정보 계산
      const stockMap = new Map<string, number>();
      const stockDetailMap = new Map<string, Array<{location: string, stock: number}>>();
      
      allStockData.forEach(item => {
        const barcode = item.barcode;
        const stock = item.stock || 0;
        const location = item.location || '';
        
        // 재고 합계 계산
        const currentStock = stockMap.get(barcode) || 0;
        stockMap.set(barcode, currentStock + stock);
        
        // 재고 상세 정보 저장 (stock이 0보다 큰 경우만)
        if (stock > 0) {
          const currentDetails = stockDetailMap.get(barcode) || [];
          currentDetails.push({ location, stock });
          stockDetailMap.set(barcode, currentDetails);
        }
      });

      setStockData(stockMap);
      setStockDetailData(stockDetailMap);
    } catch (error) {
      console.error('재고 데이터 로드 오류:', error);
    }
  };

  // 주문 데이터에 계산된 필드 추가하는 함수
  const calculateOrderFields = (orders: CoupangOrderData[]): CoupangOrderData[] => {
    // order_expected_shipping_date 기준으로 정렬 (오름차순)
    const sortedOrders = [...orders].sort((a, b) => {
      const dateA = new Date(a.order_expected_shipping_date || '9999-12-31');
      const dateB = new Date(b.order_expected_shipping_date || '9999-12-31');
      return dateA.getTime() - dateB.getTime();
    });

    // 바코드별 전체 qty 계산
    const barcodeQtyMap = new Map<string, number>();
    sortedOrders.forEach(order => {
      if (order.barcode) {
        const currentQty = barcodeQtyMap.get(order.barcode) || 0;
        barcodeQtyMap.set(order.barcode, currentQty + order.qty);
      }
    });

    // 바코드별 순서 계산을 위한 누적 카운터
    const barcodeSequenceMap = new Map<string, number>();

    return sortedOrders.map(order => {
      const barcode = order.barcode || '';
      
      // 순서 계산
      let sequence = 0;
      if (barcode) {
        const currentSequence = barcodeSequenceMap.get(barcode) || 0;
        sequence = currentSequence + 1;
        barcodeSequenceMap.set(barcode, currentSequence + order.qty);
      }

      // 전체 qty 계산
      const total_qty = barcode ? barcodeQtyMap.get(barcode) || 0 : 0;

      // 창고 재고 계산
      const stock_qty = barcode ? stockData.get(barcode) || 0 : 0;

      // 사입 수량 계산
      const purchase_qty = barcode ? purchaseData.get(barcode) || 0 : 0;

      return {
        ...order,
        sequence,
        total_qty,
        stock_qty,
        purchase_qty
      };
    });
  };

  // 데이터 로드 함수
  const loadOrderData = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('사용자 ID를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);
    try {
      // 배치로 모든 주문 데이터 가져오기
      let allOrderData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data: batch, error } = await supabase
          .from('coupang_personal_order')
          .select('*')
          .eq('user_id', userId)
          .range(from, to);

        if (error) {
          console.error('데이터 로드 실패:', error);
          alert('주문 데이터를 불러오는데 실패했습니다.');
          return;
        }

        if (batch && batch.length > 0) {
          allOrderData = [...allOrderData, ...batch];
          hasMore = batch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 재고 데이터도 함께 로드
      await loadStockData();

      // 계산된 필드 추가
      const processedData = calculateOrderFields(allOrderData);

      setOrderData(processedData);
      setFilteredOrderData(processedData);

      // 사입 수량 계산 (비동기적으로 실행)
      setTimeout(() => {
        calculatePurchaseQuantities();
      }, 100);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      alert('주문 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadOrderData();
  }, []);

  // stockData나 purchaseData가 변경될 때마다 계산된 필드 업데이트
  useEffect(() => {
    if (orderData.length > 0) {
      const processedData = calculateOrderFields(orderData);
      setFilteredOrderData(processedData);
    }
  }, [orderData, stockData, stockDetailData, purchaseData]);

  // 카드 클릭 핸들러
  const handleCardClick = (filterType: string) => {
    if (activeFilter === filterType) {
      // 같은 필터를 다시 클릭하면 필터 해제
      setActiveFilter('');
      const processedData = calculateOrderFields(orderData);
      setFilteredOrderData(processedData);
    } else {
      // 새로운 필터 적용
      setActiveFilter(filterType);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let filtered = [...orderData];
      
      switch (filterType) {
        case 'overdue':
          // 출고지연: 출고예정일이 지난 건들
          filtered = orderData.filter(order => {
            if (!order.order_expected_shipping_date) return false;
            const orderDateObj = new Date(order.order_expected_shipping_date);
            orderDateObj.setHours(0, 0, 0, 0);
            const diffTime = orderDateObj.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays < 0;
          });
          break;
        case 'upcoming':
          // 출고임박: 출고예정일이 3일 이하 남은 것 (하지만 지나지 않은 것)
          filtered = orderData.filter(order => {
            if (!order.order_expected_shipping_date) return false;
            const orderDateObj = new Date(order.order_expected_shipping_date);
            orderDateObj.setHours(0, 0, 0, 0);
            const diffTime = orderDateObj.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 3;
          });
          break;
        case 'readyToShip':
          // 출고가능: 창고 재고 > 0
          filtered = orderData.filter(order => {
            const barcode = order.barcode || '';
            const stockQty = barcode ? (stockData.get(barcode) || 0) : 0;
            return stockQty > 0;
          });
          break;
        case 'noOrder':
          // 미주문: 사입이 0이거나 없는 경우
          filtered = orderData.filter(order => {
            const barcode = order.barcode || '';
            const purchaseQty = barcode ? (purchaseData.get(barcode) || 0) : 0;
            return purchaseQty === 0;
          });
          break;
        case 'barcodeError':
          // 바코드 오류: barcode가 빈 문자열인 경우
          filtered = orderData.filter(order => !order.barcode || order.barcode.trim() === '');
          break;
        default:
          filtered = orderData;
      }
      
      const processedData = calculateOrderFields(filtered);
      setFilteredOrderData(processedData);
    }
    
    setCurrentPage(1);
    setSelectedOrders(new Set());
  };

  // 수취인 정보 모달 열기
  const handleRecipientClick = (order: CoupangOrderData) => {
    setSelectedRecipient(order);
    setShowRecipientModal(true);
  };
  
  // 날짜별 폰트 배경색과 스타일 결정 함수
  const getDateStyle = (orderDate: string): React.CSSProperties => {
    if (!orderDate) return {};
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const orderDateObj = new Date(orderDate);
    orderDateObj.setHours(0, 0, 0, 0);
    
    const diffTime = orderDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 오늘이거나 지난 날짜인 경우 진한 빨간색
    if (diffDays <= 0) {
      return {
        backgroundColor: '#f44336', // 진한 빨간색
        color: 'white',
        fontWeight: 'bold',
        padding: '2px 6px',
        borderRadius: '4px',
        display: 'inline-block'
      };
    }
    // 오늘로부터 3일 이내인 경우 진한 주황색
    else if (diffDays <= 3) {
      return {
        backgroundColor: '#ff9800', // 진한 주황색
        color: 'white',
        fontWeight: 'bold',
        padding: '2px 6px',
        borderRadius: '4px',
        display: 'inline-block'
      };
    }
    
    return {};
  };

  // 검색 핸들러
  const handleSearch = () => {
    let dataToFilter = orderData;
    
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase().trim();
      dataToFilter = orderData.filter(order => {
        switch (searchCategory) {
          case '등록상품명':
            return order.item_name.toLowerCase().includes(keyword);
          case '주문번호':
            return order.order_number.toLowerCase().includes(keyword);
          case '수취인정보':
            return order.recipient_name.toLowerCase().includes(keyword);
          case '바코드':
            return (order.barcode || '').toLowerCase().includes(keyword);
          default:
            return false;
        }
      });
    }

    // 계산된 필드 추가하여 정렬
    const processedData = calculateOrderFields(dataToFilter);
    setFilteredOrderData(processedData);
  };

  // xlsx 다운로드 핸들러
  const handleXlsxDownload = () => {
    // 체크된 데이터가 있으면 체크된 데이터만, 없으면 전체 데이터
    let dataToDownload = filteredOrderData;
    if (selectedOrders.size > 0) {
      dataToDownload = filteredOrderData.filter(order => selectedOrders.has(order.id));
    }

    if (dataToDownload.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    try {
      // 컬럼 헤더를 A~AO 순서로 정의
      const headers = [
        '번호', // A
        '묶음배송번호', // B
        '주문번호', // C
        '택배사', // D
        '운송장번호', // E
        '분리배송 Y/N', // F
        '분리배송 출고예정일', // G
        '주문시 출고예정일', // H
        '출고일(발송일)', // I
        '주문일', // J
        '등록상품명', // K
        '등록옵션명', // L
        '노출상품명(옵션명)', // M
        '노출상품ID', // N
        '옵션ID', // O
        '최초등록등록상품명/옵션명', // P
        '업체상품코드', // Q
        '바코드', // R
        '결제액', // S
        '배송비구분', // T
        '배송비', // U
        '도서산간 추가배송비', // V
        '구매수(수량)', // W
        '옵션판매가(판매단가)', // X
        '구매자', // Y
        '구매자전화번호', // Z
        '수취인이름', // AA
        '수취인전화번호', // AB
        '우편번호', // AC
        '수취인 주소', // AD
        '배송메세지', // AE
        '상품별 추가메시지', // AF
        '주문자 추가메시지', // AG
        '배송완료일', // AH
        '구매확정일자', // AI
        '개인통관번호(PCCC)', // AJ
        '통관용수취인전화번호', // AK
        '기타', // AL
        '결제위치', // AM
        '배송유형', // AN
        '창고' // AO
      ];

      // 데이터 준비 (각 행마다 A~AO 컬럼 순서대로)
      const excelData = dataToDownload.map(order => [
        order.number || '', // A
        order.bundle_shipping_number || '', // B
        order.order_number || '', // C
        order.delivery_company || '', // D
        order.tracking_number || '', // E
        order.separate_shipping || '', // F
        order.separate_shipping_expected_date || '', // G
        order.order_expected_shipping_date || '', // H
        order.shipping_date || '', // I
        order.order_date || '', // J
        order.item_name || '', // K
        order.option_name || '', // L
        order.product_name || '', // M
        order.product_id || '', // N
        order.option_id || '', // O
        order.initial_registered_product_option || '', // P
        order.vendor_product_code || '', // Q
        order.barcode || '', // R
        order.payment_amount || '', // S
        order.shipping_fee_type || '', // T
        order.shipping_fee || '', // U
        order.remote_area_additional_fee || '', // V
        order.qty || 0, // W
        order.option_sale_price || '', // X
        order.buyer || '', // Y
        order.buyer_phone || '', // Z
        order.recipient_name || '', // AA
        order.recipient_phone || '', // AB
        order.postal_code || '', // AC
        order.recipient_address || '', // AD
        order.delivery_message || '', // AE
        order.product_additional_message || '', // AF
        order.orderer_additional_message || '', // AG
        order.delivery_completion_date || '', // AH
        order.purchase_confirmation_date || '', // AI
        order.PCCC || '', // AJ
        order.customs_recipient_phone || '', // AK
        order.etc || '', // AL
        order.payment_location || '', // AM
        order.delivery_type || '', // AN
        generateWarehouseText(order.barcode || '', order.qty) // AO
      ]);

      // 헤더를 첫 번째 행으로 추가
      const worksheetData = [headers, ...excelData];

      // 워크시트 생성
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // 헤더 행에 회색 배경 스타일 적용
      const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) ws[cellAddress] = { v: '', t: 's' };
        
        ws[cellAddress].s = {
          fill: {
            fgColor: { rgb: "D3D3D3" } // 회색 배경
          }
        };
      }
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      // 파일명 생성 (deliveryList_YYYY-MM-DD-HH-MM-SS)
      const now = new Date();
      const fileName = `deliveryList_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}.xlsx`;
      
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 체크박스 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredOrderData.map(order => order.id));
      setSelectedOrders(allIds);
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // 선택된 주문 삭제 핸들러
  const handleDeleteSelected = () => {
    if (selectedOrders.size === 0) {
      alert('삭제할 주문을 선택해주세요.');
      return;
    }
    setShowDeleteModal(true);
  };

  // 삭제 확인 핸들러
  const handleConfirmDelete = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('로그인한 사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const selectedIds = Array.from(selectedOrders);
      
      // 배치 삭제 수행
      const { error } = await supabase
        .from('coupang_personal_order')
        .delete()
        .in('id', selectedIds)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`삭제 실패: ${error.message}`);
      }

      alert(`${selectedOrders.size}건의 주문이 삭제되었습니다.`);
      
      // 선택 해제 및 데이터 새로고침
      setSelectedOrders(new Set());
      setShowDeleteModal(false);
      await loadOrderData();
      
    } catch (error) {
      console.error('삭제 오류:', error);
      alert(`삭제 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 사입 수량 계산 함수
   * - 각 바코드별로 chinaorder_googlesheet에서 order_status_ordering 합계 - order_status_cancel 합계를 계산
   */
  const calculatePurchaseQuantities = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      console.log('🔄 사입 수량 계산 시작...');
      
      // 현재 주문 데이터에서 바코드 목록 추출
      const currentData = filteredOrderData.length > 0 ? filteredOrderData : orderData;
      const barcodeSet = new Set<string>();
      currentData.forEach(order => {
        if (order.barcode && order.barcode.trim() !== '') {
          barcodeSet.add(order.barcode);
        }
      });
      const barcodes = Array.from(barcodeSet);

      if (barcodes.length === 0) {
        console.log('⚠️ 바코드가 있는 주문 데이터가 없습니다.');
        return;
      }

      console.log(`📋 처리할 바코드 개수: ${barcodes.length}개`);

      const purchaseMap = new Map<string, number>();

      // 배치 처리로 chinaorder_googlesheet 데이터 조회
      const BATCH_SIZE = 100;
      
      for (let i = 0; i < barcodes.length; i += BATCH_SIZE) {
        const batchBarcodes = barcodes.slice(i, i + BATCH_SIZE);
        
        console.log(`📦 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(barcodes.length / BATCH_SIZE)} 처리 중...`);
        
        // 모든 데이터를 가져오기 위해 페이징 처리
        let allData: any[] = [];
        let page = 0;
        let hasMore = true;
        const pageSize = 1000; // 한 번에 1000개씩 조회
        
        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          
          const { data: batch, error } = await supabase
            .from('chinaorder_googlesheet')
            .select('barcode, order_status_ordering, order_status_cancel')
            .eq('user_id', userId)
            .in('barcode', batchBarcodes)
            .not('barcode', 'is', null)
            .neq('barcode', '')
            .range(from, to);

          if (error) {
            console.error('❌ chinaorder_googlesheet 조회 오류:', error);
            throw error;
          }

          if (batch && batch.length > 0) {
            allData = [...allData, ...batch];
            hasMore = batch.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        // 각 바코드별로 사입 수량 계산
        for (const barcode of batchBarcodes) {
          const barcodeData = allData.filter(item => item.barcode === barcode);
          
          let totalOrdering = 0;
          let totalCancel = 0;
          
          for (const item of barcodeData) {
            const ordering = parseFloat(item.order_status_ordering || '0') || 0;
            const cancel = parseFloat(item.order_status_cancel || '0') || 0;
            
            totalOrdering += ordering;
            totalCancel += cancel;
          }
          
          const purchaseQty = Math.max(0, totalOrdering - totalCancel);
          purchaseMap.set(barcode, purchaseQty);
          
          console.log(`📊 ${barcode}: 진행(${totalOrdering}) - 취소(${totalCancel}) = 사입(${purchaseQty})`);
        }
      }

      setPurchaseData(purchaseMap);
      console.log('✅ 사입 수량 계산 완료');

    } catch (error) {
      console.error('❌ 사입 수량 계산 실패:', error);
    }
  };

  /**
   * 바코드 조회 핸들러
   * - coupang_personal_order의 item_name, option_name과
   * - extract_coupang_item_all의 item_name, option_name이 일치하는 경우
   * - extract_coupang_item_all의 barcode를 가져와서 업데이트
   */
  const handleBarcodeSearch = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('로그인한 사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. coupang_personal_order 테이블에서 현재 사용자의 데이터 조회 (제한 없음)
      const { data: orderData, error: orderError } = await supabase
        .from('coupang_personal_order')
        .select('id, item_name, option_name')
        .eq('user_id', userId)
        .range(0, 99999);  // 최대 100,000개까지 조회

      if (orderError) {
        throw new Error(`주문 데이터 조회 실패: ${orderError.message}`);
      }

      if (!orderData || orderData.length === 0) {
        alert('조회할 주문 데이터가 없습니다.');
        return;
      }

      // 2. extract_coupang_item_all 테이블에서 바코드가 있는 데이터 조회 (페이징으로 전체 조회)
      let allItemData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data: batch, error: itemError } = await supabase
          .from('extract_coupang_item_all')
          .select('item_name, option_name, barcode')
          .eq('user_id', userId)
          .not('barcode', 'is', null)
          .neq('barcode', '')
          .range(from, to);

        if (itemError) {
          throw new Error(`상품 데이터 조회 실패: ${itemError.message}`);
        }

        if (batch && batch.length > 0) {
          allItemData = [...allItemData, ...batch];
          hasMore = batch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      const itemData = allItemData;

      if (!itemData || itemData.length === 0) {
        alert('바코드가 있는 상품 데이터가 없습니다.');
        return;
      }

      // 3. 매칭 및 업데이트 수행
      let updateCount = 0;
      const updates: { id: string; barcode: string }[] = [];

      // Map을 사용하여 빠른 검색 구현
      const itemBarcodeMap = new Map<string, string>();
      itemData.forEach(item => {
        const key = `${item.item_name}|${item.option_name}`;
        itemBarcodeMap.set(key, item.barcode);
      });

      /**
       * option_name의 마지막 공백 기준으로 순서를 변경하는 함수
       * 예: "블랙 [무릎] 66" -> "66 블랙 [무릎]"
       */
      const swapLastSpace = (optionName: string): string => {
        const lastSpaceIndex = optionName.lastIndexOf(' ');
        if (lastSpaceIndex === -1) return optionName;
        
        const lastPart = optionName.substring(lastSpaceIndex + 1);
        const firstPart = optionName.substring(0, lastSpaceIndex);
        return `${lastPart} ${firstPart}`;
      };

      // 매칭되는 바코드 찾기
      orderData.forEach(order => {
        const key = `${order.item_name}|${order.option_name}`;
        let barcode = itemBarcodeMap.get(key);
        
        // 1차 시도: 원본 그대로 검색
        if (!barcode) {
          // 2차 시도: option_name 순서 변경하여 검색
          const swappedOptionName = swapLastSpace(order.option_name);
          const swappedKey = `${order.item_name}|${swappedOptionName}`;
          barcode = itemBarcodeMap.get(swappedKey);
        }
        
        if (barcode) {
          updates.push({ id: order.id, barcode });
        }
      });

      // 4. 배치 업데이트 수행
      if (updates.length > 0) {
        const BATCH_SIZE = 50;
        
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE);
          
          // 각 배치를 개별 업데이트
          for (const update of batch) {
            const { error: updateError } = await supabase
              .from('coupang_personal_order')
              .update({ barcode: update.barcode })
              .eq('id', update.id)
              .eq('user_id', userId);

            if (updateError) {
              console.error(`업데이트 실패 (ID: ${update.id}):`, updateError);
            } else {
              updateCount++;
            }
          }
        }
      }

      // 5. 결과 메시지 표시
      console.log(`조회된 주문 데이터: ${orderData.length}개`);
      console.log(`조회된 상품 데이터 (바코드 있음): ${itemData.length}개`);
      console.log(`매칭 시도: ${orderData.length}개, 매칭 성공: ${updates.length}개`);
      
      alert(`바코드 조회 완료!\n조회된 주문: ${orderData.length}개\n조회된 상품 (바코드 있음): ${itemData.length}개\n매칭 성공: ${updateCount}개`);
      
      // 6. 데이터 새로고침
      await loadOrderData();
      
    } catch (error) {
      console.error('바코드 조회 오류:', error);
      alert(`바코드 조회 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Excel 업로드 핸들러
  const handleXlsxUpload = () => {
    setShowUploadModal(true);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 파일 확장자 검증
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(fileExtension)) {
        alert(`${file.name}은(는) Excel 파일(.xlsx, .xls)이 아닙니다. 업로드를 중단합니다.`);
        return;
      }
    }

    setIsUploading(true);
    setMultiFileProgress({ currentFile: 0, totalFiles: fileArray.length, fileName: '' });
    setUploadProgress({ stage: '업로드 시작...', current: 0, total: 100 });

    let totalProcessedCount = 0;
    const failedFiles: string[] = [];

    try {
      // 데이터 초기화 (전체 업로드 시작 전에 한 번만 - 첫 번째 파일 처리 전에만)
      if (clearDataBeforeUpload) {
        setUploadProgress({ stage: '기존 데이터 초기화 중...', current: 5, total: 100 });
        
        const userId = getCurrentUserId();
        if (userId) {
          const { error: deleteError } = await supabase
            .from('coupang_personal_order')
            .delete()
            .eq('user_id', userId);

          if (deleteError) {
            throw new Error(`기존 데이터 삭제 실패: ${deleteError.message}`);
          }
        }
      }

      // 모든 파일을 순차적으로 업로드
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setMultiFileProgress({ currentFile: i + 1, totalFiles: fileArray.length, fileName: file.name });
        setUploadProgress({ stage: `${file.name} 처리 중...`, current: 0, total: 100 });

        try {
          // 각 파일은 초기화 없이 추가로 업로드
          const result = await processPersonalOrderExcelUpload(file, (stage, current, total) => {
            setUploadProgress({ stage: `${file.name} - ${stage}`, current: current || 0, total: total || 100 });
          });

          if (result.success) {
            totalProcessedCount += result.processedCount || 0;
          } else {
            failedFiles.push(`${file.name}: ${result.error}`);
          }
        } catch (error) {
          failedFiles.push(`${file.name}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      // 결과 메시지 표시
      let message = `업로드 완료!\n총 ${totalProcessedCount}개의 주문 데이터가 저장되었습니다.`;
      if (failedFiles.length > 0) {
        message += `\n\n실패한 파일 (${failedFiles.length}개):\n${failedFiles.join('\n')}`;
      }
      alert(message);
      
      setShowUploadModal(false);
      // 주문 데이터를 다시 로드
      await loadOrderData();
    } catch (error) {
      alert(`업로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({ stage: '', current: 0, total: 100 });
      setMultiFileProgress({ currentFile: 0, totalFiles: 0, fileName: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="coupang-orders-container">
      {/* 페이지 헤더 */}
      <div className="coupang-orders-page-header">
        <h1 className="coupang-orders-page-title">쿠팡 주문 관리</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="coupang-orders-button coupang-orders-button-success"
              onClick={handleXlsxDownload}
              disabled={isUploading || isLoading}
            >
              ▼ xlsx 다운로드
            </button>
            <button 
              className="coupang-orders-button coupang-orders-button-success"
              onClick={handleXlsxUpload}
              disabled={isUploading}
            >
              {isUploading ? '업로드 중...' : '▲ xlsx 업로드'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="coupang-orders-button coupang-orders-button-secondary"
              onClick={handleBarcodeSearch}
              disabled={isLoading || isUploading}
            >
              {isLoading ? '조회 중...' : '바코드 조회'}
            </button>
            <button 
              className="coupang-orders-button coupang-orders-button-info"
              onClick={calculatePurchaseQuantities}
              disabled={isLoading || isUploading}
            >
              사입 조회
            </button>
          </div>
        </div>
      </div>

      {/* 통계 카드 섹션 */}
      <div className="coupang-orders-stats-section">
        <div className="coupang-orders-stats-grid">
          <DashboardStatsCard 
            title="전체주문" 
            value={stats.total} 
            color="default" 
            onClick={() => handleCardClick('')}
            active={activeFilter === ''}
          />
          <DashboardStatsCard 
            title="출고지연" 
            value={stats.overdue} 
            color="red" 
            onClick={() => handleCardClick('overdue')}
            active={activeFilter === 'overdue'}
          />
          <DashboardStatsCard 
            title="출고임박" 
            value={stats.upcoming} 
            color="orange" 
            onClick={() => handleCardClick('upcoming')}
            active={activeFilter === 'upcoming'}
          />
          <DashboardStatsCard 
            title="출고가능" 
            value={stats.readyToShip} 
            color="blue" 
            onClick={() => handleCardClick('readyToShip')}
            active={activeFilter === 'readyToShip'}
          />
          <DashboardStatsCard 
            title="미주문" 
            value={stats.noOrder} 
            color="orange" 
            onClick={() => handleCardClick('noOrder')}
            active={activeFilter === 'noOrder'}
          />
          <DashboardStatsCard 
            title="바코드 오류" 
            value={stats.barcodeError} 
            color="red" 
            onClick={() => handleCardClick('barcodeError')}
            active={activeFilter === 'barcodeError'}
          />
        </div>
      </div>

      {/* 검색 섹션 */}
      <div className="coupang-orders-filter-section">
        <div className="coupang-orders-search-container">
          <label className="coupang-orders-label">검색</label>
          <div className="coupang-orders-search-wrapper">
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="coupang-orders-search-select"
            >
              <option value="등록상품명">등록상품명</option>
              <option value="주문번호">주문번호</option>
              <option value="수취인정보">수취인정보</option>
              <option value="바코드">바코드</option>
            </select>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="검색어를 입력하세요..."
              className="coupang-orders-search-input"
            />
            <button 
              onClick={handleSearch}
              className="coupang-orders-search-button"
            >
              🔍
            </button>
          </div>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="coupang-orders-table-section">
        {/* 테이블 헤더 */}
        <div className="coupang-orders-table-header-section">
          <div className="coupang-orders-table-info">
            <div className="coupang-orders-data-count">
              총 {filteredOrderData.length}개 주문
            </div>
          </div>
          <div className="coupang-orders-table-actions">
            <button 
              className="coupang-orders-button coupang-orders-button-danger"
              onClick={handleDeleteSelected}
              disabled={isLoading || selectedOrders.size === 0}
              style={{ 
                opacity: selectedOrders.size === 0 ? 0.5 : 1,
                cursor: selectedOrders.size === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              삭제 ({selectedOrders.size})
            </button>
          </div>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="coupang-orders-table-container">
          <table className="coupang-orders-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === filteredOrderData.length && filteredOrderData.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: '120px', textAlign: 'center' }}>주문번호</th>
                <th style={{ width: '100px', textAlign: 'center' }}>분리배송</th>
                <th style={{ width: '120px', textAlign: 'center' }}>출고예정일</th>
                <th style={{ width: '350px', textAlign: 'left' }}>등록상품명 & 옵션명</th>
                <th style={{ width: '80px', textAlign: 'center' }}>주문개수</th>
                <th style={{ width: '200px', textAlign: 'center' }}>수취인정보</th>
                <th style={{ width: '40px', textAlign: 'center' }}>순서</th>
                <th style={{ width: '40px', textAlign: 'center' }}>전체</th>
                <th style={{ width: '40px', textAlign: 'center' }}>사입</th>
                <th style={{ width: '100px', textAlign: 'left' }}>창고</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : filteredOrderData.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    {searchKeyword ? '검색 결과가 없습니다.' : '주문 데이터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredOrderData.map((order, index) => (
                  <tr key={order.id || index}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {order.order_number}<br/>
                      {order.product_id}<br/>
                      {order.option_id}
                    </td>
                    <td style={{ textAlign: 'center' }}>{order.separate_shipping}</td>
                    <td style={{ textAlign: 'center' }}>
                      {formatDate(order.order_date)}<br/>
                      <span style={getDateStyle(order.order_expected_shipping_date)}>
                        {formatDate(order.order_expected_shipping_date)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      {order.item_name}<br/>
                      {order.option_name}<br/>
                      {order.barcode || ''}
                    </td>
                    <td style={{ textAlign: 'center' }}>{order.qty}</td>
                    <td 
                      style={{ 
                        textAlign: 'center', 
                        cursor: 'pointer', 
                        color: '#000000'
                      }}
                      onClick={() => handleRecipientClick(order)}
                    >
                      {order.recipient_name}
                    </td>
                    <td style={{ textAlign: 'center' }}>{order.sequence || ''}</td>
                    <td style={{ textAlign: 'center' }}>{order.total_qty || ''}</td>
                    <td style={{ textAlign: 'center' }}>{order.purchase_qty || ''}</td>
                    <td style={{ 
                      textAlign: 'left', 
                      whiteSpace: 'pre-line',
                      fontSize: '12px',
                      lineHeight: '1.2',
                      padding: '4px'
                    }}>
                      {generateWarehouseText(order.barcode || '', order.qty)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel 업로드 모달 */}
      {showUploadModal && (
        <div className="coupang-orders-modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="coupang-orders-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coupang-orders-modal-header">
              <h3>쿠팡 주문 Excel 업로드</h3>
              {!isUploading && (
                <button 
                  className="coupang-orders-modal-close"
                  onClick={() => setShowUploadModal(false)}
                >
                  ×
                </button>
              )}
            </div>
            
            <div className="coupang-orders-modal-content">
              {!isUploading ? (
                <>
                  <div className="coupang-orders-upload-options">
                    <label className="coupang-orders-checkbox-container">
                      <input
                        type="checkbox"
                        checked={clearDataBeforeUpload}
                        onChange={(e) => setClearDataBeforeUpload(e.target.checked)}
                      />
                      <span className="coupang-orders-checkbox-label">
                        업로드 전 기존 데이터 삭제 (권장)
                      </span>
                    </label>
                    <p className="coupang-orders-upload-option-hint">
                      체크 해제 시 기존 데이터와 병합되며, 동일한 주문번호-옵션ID는 덮어씌워집니다.
                    </p>
                  </div>
                  <div className="coupang-orders-upload-area" onClick={handleFileSelect}>
                    <div className="coupang-orders-upload-icon">📁</div>
                    <p>Excel 파일을 선택하세요 (여러 파일 선택 가능)</p>
                    <p className="coupang-orders-upload-hint">
                      .xlsx, .xls 파일만 지원됩니다
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    multiple
                    style={{ display: 'none' }}
                  />
                </>
              ) : (
                <div className="coupang-orders-upload-progress">
                  <div className="coupang-orders-progress-info">
                    {multiFileProgress.totalFiles > 1 && (
                      <div className="coupang-orders-multi-file-progress">
                        <p>파일 {multiFileProgress.currentFile} / {multiFileProgress.totalFiles}</p>
                        <p className="coupang-orders-current-file">현재: {multiFileProgress.fileName}</p>
                      </div>
                    )}
                    <p>{uploadProgress.stage}</p>
                    <div className="coupang-orders-progress-bar">
                      <div 
                        className="coupang-orders-progress-fill"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    <p>{uploadProgress.current}% 완료</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 수취인 정보 모달 */}
      {showRecipientModal && selectedRecipient && (
        <div className="coupang-orders-modal-overlay" onClick={() => setShowRecipientModal(false)}>
          <div className="coupang-orders-modal coupang-orders-recipient-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coupang-orders-modal-header">
              <h3>수취인 정보</h3>
              <button 
                className="coupang-orders-modal-close"
                onClick={() => setShowRecipientModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="coupang-orders-modal-content">
              <div className="coupang-orders-recipient-info">
                <div className="coupang-orders-recipient-field">
                  <label>수취인명:</label>
                  <span>{selectedRecipient.recipient_name}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>연락처:</label>
                  <span>{selectedRecipient.recipient_phone}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>우편번호:</label>
                  <span>{selectedRecipient.postal_code}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>주소:</label>
                  <span>{selectedRecipient.recipient_address}</span>
                </div>
                <div className="coupang-orders-recipient-field">
                  <label>배송메시지:</label>
                  <span>{selectedRecipient.delivery_message}</span>
                </div>
              </div>
              
              <div className="coupang-orders-recipient-actions">
                <button 
                  className="coupang-orders-button coupang-orders-button-secondary"
                  onClick={() => setShowRecipientModal(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="coupang-orders-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="coupang-orders-modal coupang-orders-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coupang-orders-modal-header">
              <h3>주문 삭제 확인</h3>
              <button 
                className="coupang-orders-modal-close"
                onClick={() => setShowDeleteModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="coupang-orders-modal-content">
              <div className="coupang-orders-delete-message">
                <p>선택된 <strong>{selectedOrders.size}건</strong>의 주문을 삭제하시겠습니까?</p>
                <p className="coupang-orders-delete-warning">삭제된 데이터는 복구할 수 없습니다.</p>
              </div>
              
              <div className="coupang-orders-delete-actions">
                <button 
                  className="coupang-orders-button coupang-orders-button-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button 
                  className="coupang-orders-button coupang-orders-button-danger"
                  onClick={handleConfirmDelete}
                  disabled={isLoading}
                >
                  {isLoading ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoupangOrders; 