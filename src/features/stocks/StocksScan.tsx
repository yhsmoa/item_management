import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../config/supabase';
import '../products/ProductListPage/index.css';

/**
 * 재고 스캔 페이지 컴포넌트
 * - 바코드/QR코드 스캔을 통한 재고 확인
 * - 수동 입력 기능
 * - 스캔 기록 관리
 * - 메모리 최적화 적용
 */
function StocksScan() {
  // 📊 메모리 사용량 모니터링을 위한 상수
  const MAX_STOCK_DATA_SIZE = 10000; // 최대 재고 데이터 개수 (1000 -> 10000으로 증가)
  const MAX_SCAN_HISTORY_SIZE = 10; // 최대 스캔 기록 개수
  const MAX_EXCEL_DATA_SIZE = 10000; // 최대 엑셀 데이터 개수 (5000 -> 10000으로 증가)

  // State 정의
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [currentStock, setCurrentStock] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 엑셀 업로드 관련 State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [selectedBarcodeColumn, setSelectedBarcodeColumn] = useState<string>('');
  const [selectedQuantityColumn, setSelectedQuantityColumn] = useState<string>('');
  const [selectedLocationColumn, setSelectedLocationColumn] = useState<string>('');
  const [selectedProductNameColumn, setSelectedProductNameColumn] = useState<string>('');
  const [selectedOptionNameColumn, setSelectedOptionNameColumn] = useState<string>('');
  const [selectedNoteColumn, setSelectedNoteColumn] = useState<string>('');
  const [isSelectingBarcode, setIsSelectingBarcode] = useState(true);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [isSelectingProductName, setIsSelectingProductName] = useState(false);
  const [isSelectingOptionName, setIsSelectingOptionName] = useState(false);
  const [isSelectingNote, setIsSelectingNote] = useState(false);
  const [dataStartRow, setDataStartRow] = useState<number>(2);
  const [excelType, setExcelType] = useState<'stock' | 'deliveryList'>('stock');
  
  // 재고 관리 테이블 데이터
  const [stockManagementData, setStockManagementData] = useState<any[]>([]);
  
  // 선택된 항목들 관리
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // 위치 편집 관리
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [editingLocationValue, setEditingLocationValue] = useState<string>('');
  
  // 새로운 입력 폼 상태 관리
  const [inputBarcode, setInputBarcode] = useState<string>('');
  const [inputQuantity, setInputQuantity] = useState<string>('1');
  const [inputLocation, setInputLocation] = useState<string>('');
  const [inputNote, setInputNote] = useState<string>('');
  
  // 재고 추가 로딩 상태
  const [isStockAddLoading, setIsStockAddLoading] = useState(false);
  const [stockAddProgress, setStockAddProgress] = useState({ current: 0, total: 0 });
  
  // 재고 차감 로딩 상태
  const [isStockSubtractLoading, setIsStockSubtractLoading] = useState(false);
  const [stockSubtractProgress, setStockSubtractProgress] = useState({ current: 0, total: 0 });
  
  // 입력 ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 바코드 입력 핸들러
  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanResult(e.target.value);
  };

  // 바코드 스캔/검색 핸들러
  const handleScan = async () => {
    if (!scanResult.trim()) {
      alert('바코드를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    
    try {
      // TODO: 실제 재고 조회 API 호출
      // 임시 데이터
      const mockStockData = {
        barcode: scanResult,
        productName: scanResult.includes('SKU001') ? '여성 원피스 SM-HDHSHS3D36_22 로키나' : 
                    scanResult.includes('SKU002') ? '여성 반바지 FW-HDHSYJ5B23_13 와미스' : '상품을 찾을 수 없습니다',
        sku: scanResult.includes('SKU001') ? 'SKU001' : 
             scanResult.includes('SKU002') ? 'SKU002' : '알 수 없음',
        currentStock: scanResult.includes('SKU001') ? 50 : 
                     scanResult.includes('SKU002') ? 25 : 0,
        minStock: 10,
        location: 'A-1-001',
        lastUpdated: new Date().toLocaleDateString(),
        found: scanResult.includes('SKU001') || scanResult.includes('SKU002')
      };

      setCurrentStock(mockStockData);
      
      // 스캔 기록에 추가
      const newScanRecord = {
        id: Date.now(),
        barcode: scanResult,
        timestamp: new Date().toLocaleString(),
        productName: mockStockData.productName,
        stock: mockStockData.currentStock,
        found: mockStockData.found
      };
      
      setScanHistory(prev => [newScanRecord, ...prev.slice(0, 9)]); // 최근 10개만 유지
      
    } catch (error) {
      console.error('❌ 재고 조회 에러:', error);
      alert('재고 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  // 스캔 결과 초기화
  const handleClear = () => {
    setScanResult('');
    setCurrentStock(null);
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // 카메라 스캔 시뮬레이션 (실제 구현 시에는 barcode scanner 라이브러리 사용)
  const handleCameraScan = () => {
    setIsScanning(true);
    // 시뮬레이션: 2초 후 샘플 바코드 생성
    setTimeout(() => {
      const sampleBarcodes = ['SKU001', 'SKU002', '1234567890123'];
      const randomBarcode = sampleBarcodes[Math.floor(Math.random() * sampleBarcodes.length)];
      setScanResult(randomBarcode);
      setIsScanning(false);
      // 자동으로 검색 실행
      handleScan();
    }, 2000);
  };

  // 엑셀 업로드 버튼 클릭 핸들러
  const handleExcelUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readExcelFile(file);
    }
  };

  // 📂 실제 엑셀 파일 읽기 함수 (메모리 최적화)
  const readExcelFile = useCallback((file: File) => {
    // 파일 크기 검증 (10MB 제한)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      alert('파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.');
      return;
    }
    

    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // 첫 번째 시트 선택
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 시트를 JSON 배열로 변환 (헤더 포함)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,  // 배열 형태로 반환
          defval: ''  // 빈 셀은 빈 문자열로 처리
        }) as any[][];
        
        if (jsonData.length === 0) {
          alert('엑셀 파일에 데이터가 없습니다.');
          return;
        }
        
        // 📊 대용량 데이터 처리 시 메모리 확인
        if (jsonData.length > MAX_EXCEL_DATA_SIZE) {
          const confirm = window.confirm(`파일에 ${jsonData.length}개의 행이 있습니다. 최대 ${MAX_EXCEL_DATA_SIZE}개 행만 처리됩니다. 계속하시겠습니까?`);
          if (!confirm) return;
          
          console.warn(`⚠️ 대용량 엑셀 데이터: ${jsonData.length}개 행을 ${MAX_EXCEL_DATA_SIZE}개로 제한`);
          jsonData.splice(MAX_EXCEL_DATA_SIZE);
        }
        

        
        setExcelData(jsonData);
        setIsModalOpen(true);
        setSelectedBarcodeColumn('');
        setSelectedQuantityColumn('');
        setSelectedLocationColumn('');
        setSelectedProductNameColumn('');
        setSelectedOptionNameColumn('');
        setSelectedNoteColumn('');
        setIsSelectingBarcode(true);
        setIsSelectingLocation(false);
        setIsSelectingProductName(false);
        setIsSelectingOptionName(false);
        setIsSelectingNote(false);
        setDataStartRow(2);
        
      } catch (error) {
        console.error('❌ 엑셀 파일 읽기 오류:', error);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
      } finally {
        // 🧹 FileReader 메모리 정리
        reader.onload = null;
        reader.onerror = null;
      }
    };
    
    reader.onerror = () => {
      alert('파일을 읽는 중 오류가 발생했습니다.');
      // 🧹 FileReader 메모리 정리
      reader.onload = null;
      reader.onerror = null;
    };
    
    // 파일을 binary string으로 읽기
    reader.readAsBinaryString(file);
    
    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 모달 닫기
  const handleModalClose = () => {
    setIsModalOpen(false);
    setExcelData([]);
    setSelectedBarcodeColumn('');
    setSelectedQuantityColumn('');
    setSelectedLocationColumn('');
    setSelectedProductNameColumn('');
    setSelectedOptionNameColumn('');
    setSelectedNoteColumn('');
    setIsSelectingBarcode(true);
    setIsSelectingLocation(false);
    setIsSelectingProductName(false);
    setIsSelectingOptionName(false);
    setIsSelectingNote(false);
    setDataStartRow(2);
    setExcelType('stock');
  };

  // 컬럼 인덱스를 엑셀 스타일 문자로 변환 (0->A, 1->B, ..., 25->Z, 26->AA)
  const getExcelColumnName = (index: number): string => {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  };

  // 엑셀 스타일 컬럼명을 인덱스로 변환 (A->0, B->1, ..., Z->25, AA->26)
  const getColumnIndex = (columnName: string): number => {
    let result = 0;
    for (let i = 0; i < columnName.length; i++) {
      result = result * 26 + (columnName.charCodeAt(i) - 64);
    }
    return result - 1;
  };

  // 컬럼 선택 핸들러
  const handleColumnSelect = (columnName: string) => {
    if (isSelectingBarcode) {
      setSelectedBarcodeColumn(columnName);
      setIsSelectingBarcode(false);
      // 바코드 선택 후 개수 선택 모드로 전환
    } else if (isSelectingLocation) {
      setSelectedLocationColumn(columnName);
      setIsSelectingLocation(false);
      // 위치 선택 후 비고 선택 모드로 전환
      setIsSelectingNote(true);
    } else if (isSelectingNote) {
      setSelectedNoteColumn(columnName);
      setIsSelectingNote(false);
      // 비고 선택 후 상품명 선택 모드로 전환
      setIsSelectingProductName(true);
    } else if (isSelectingProductName) {
      setSelectedProductNameColumn(columnName);
      setIsSelectingProductName(false);
      // 상품명 선택 후 옵션명 선택 모드로 전환
      setIsSelectingOptionName(true);
    } else if (isSelectingOptionName) {
      setSelectedOptionNameColumn(columnName);
      setIsSelectingOptionName(false);
    } else {
      // 개수 선택 후 위치 선택 모드로 전환
      setSelectedQuantityColumn(columnName);
      setIsSelectingLocation(true);
    }
  };

  // 바코드 선택 모드로 변경
  const handleBarcodeMode = () => {
    setIsSelectingBarcode(true);
    setIsSelectingLocation(false);
    setIsSelectingProductName(false);
    setIsSelectingOptionName(false);
    setIsSelectingNote(false);
  };

  // 개수 선택 모드로 변경
  const handleQuantityMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingLocation(false);
    setIsSelectingProductName(false);
    setIsSelectingOptionName(false);
    setIsSelectingNote(false);
  };

  // 위치 선택 모드로 변경
  const handleLocationMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingLocation(true);
    setIsSelectingProductName(false);
    setIsSelectingOptionName(false);
    setIsSelectingNote(false);
  };

  // 비고 선택 모드로 변경
  const handleNoteMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingLocation(false);
    setIsSelectingProductName(false);
    setIsSelectingOptionName(false);
    setIsSelectingNote(true);
  };

  // 상품명 선택 모드로 변경
  const handleProductNameMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingLocation(false);
    setIsSelectingProductName(true);
    setIsSelectingOptionName(false);
    setIsSelectingNote(false);
  };

  // 옵션명 선택 모드로 변경
  const handleOptionNameMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingLocation(false);
    setIsSelectingProductName(false);
    setIsSelectingOptionName(true);
    setIsSelectingNote(false);
  };

  /**
   * deliveryList 데이터 처리 함수
   * R열(바코드), K열(상품명), L열(옵션명), AO열(창고) 사용
   */
  const handleDeliveryListData = async () => {
    // 선택된 시작 행부터 데이터 처리
    const dataRows = excelData.slice(dataStartRow - 1);

    console.log('deliveryList 처리:', {
      전체행수: excelData.length,
      시작행: dataStartRow,
      처리행수: dataRows.length
    });

    // R=17, K=10, L=11, AO=40 (0-based index)
    const barcodeIndex = 17; // R열
    const productNameIndex = 10; // K열
    const optionNameIndex = 11; // L열
    const warehouseIndex = 40; // AO열

    const newStockData: any[] = [];

    /**
     * 창고 데이터 파싱 함수
     * 다양한 형태의 창고 데이터를 파싱
     */
    const parseWarehouseData = (warehouseText: string): Array<{location: string, stock: number}> => {
      if (!warehouseText || warehouseText.trim() === '') return [];

      console.log('원본 창고 데이터:', warehouseText);

      const results: Array<{location: string, stock: number}> = [];

      // 줄바꿈으로 분리
      const lines = warehouseText.split(/[\n\r]+/).filter(line => line.trim() !== '');

      for (const line of lines) {
        console.log('처리할 라인:', line);

        // 패턴 1: [LOCATION -> STOCK] 형태
        let match = line.match(/\[([^[\]]+)\s*->\s*(\d+)\]/);
        if (match) {
          const location = match[1].trim();
          const stock = parseInt(match[2]) || 0;
          if (location && stock > 0) {
            results.push({ location, stock });
            console.log('패턴1 매칭:', { location, stock });
            continue;
          }
        }

        // 패턴 2: MBOXXX 1 (공백으로 구분)
        match = line.match(/^(MBOX\d+)\s+(\d+)$/);
        if (match) {
          const location = match[1].trim();
          const stock = parseInt(match[2]) || 0;
          if (location && stock > 0) {
            results.push({ location, stock });
            console.log('패턴2 매칭:', { location, stock });
            continue;
          }
        }

        // 패턴 3: 단순히 MBOXXX만 있는 경우 (재고 1로 간주)
        match = line.match(/^(MBOX\d+)$/);
        if (match) {
          const location = match[1].trim();
          results.push({ location, stock: 1 });
          console.log('패턴3 매칭:', { location, stock: 1 });
          continue;
        }
      }

      return results;
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const barcode = row[barcodeIndex] || '';
      const productName = row[productNameIndex] || '';
      const optionName = row[optionNameIndex] || '';
      const warehouseData = row[warehouseIndex] || '';

      console.log(`행 ${i + 1}:`, {
        barcode,
        productName,
        optionName,
        warehouseData: warehouseData ? `${warehouseData}` : '없음',
        전체컬럼수: row.length
      });

      if (!barcode.trim()) {
        console.log(`행 ${i + 1}: 바코드 없음, 건너뜀`);
        continue; // 빈 바코드 건너뛰기
      }
      
      // 상품명 조합
      let fullProductName = '';
      if (productName && optionName) {
        fullProductName = `${productName}, ${optionName}`;
      } else if (productName) {
        fullProductName = productName;
      } else {
        fullProductName = `상품 ${barcode}`;
      }
      
      // 창고 데이터 파싱
      const warehouseItems = parseWarehouseData(warehouseData.toString());

      console.log(`행 ${i + 1} 창고파싱:`, warehouseItems);

      if (warehouseItems.length > 0) {
        // 파싱된 각 창고 위치별로 개별 아이템 생성
        for (const warehouseItem of warehouseItems) {
          const { location, stock } = warehouseItem;
          
          const itemId = `${location}=${barcode}`;
          
          // 동일한 ID가 이미 있는지 확인
          const existingItemIndex = newStockData.findIndex(item => item.id === itemId);
          
          if (existingItemIndex >= 0) {
            // 기존 항목이 있으면 수량만 합산
            newStockData[existingItemIndex].quantity += stock;
          } else {
            // 새 항목 추가
            newStockData.push({
              id: itemId,
              barcode: barcode,
              productName: fullProductName,
              quantity: stock,
              location: location,
              note: '', // 비고는 비워두기
              timestamp: new Date().toLocaleString()
            });
          }
        }
      }
    }

    console.log('최종 newStockData:', newStockData);

    // 재고 관리 테이블에 데이터 추가
    setStockManagementData(prev => {
      const updated = [...prev];
      
      newStockData.forEach(newItem => {
        const existingIndex = updated.findIndex(item => item.id === newItem.id);
        if (existingIndex >= 0) {
          // 기존 항목이 있으면 수량 합산
          updated[existingIndex].quantity += newItem.quantity;
        } else {
          // 새 항목 추가
          updated.unshift(newItem);
        }
      });
      
      return updated;
    });
    
    // 모달 닫기
    handleModalClose();
  };

  // 엑셀 데이터 추가 확인
  const handleAddExcelData = async () => {
    if (excelType === 'stock') {
      if (!selectedBarcodeColumn || !selectedQuantityColumn) {
        alert('바코드와 개수 컬럼을 모두 선택해주세요.');
        return;
      }
    }
    
    // deliveryList 처리
    if (excelType === 'deliveryList') {
      await handleDeliveryListData();
      return;
    }

    // 선택된 시작 행부터 데이터 처리 (dataStartRow는 1-based, 배열은 0-based)
    const dataRows = excelData.slice(dataStartRow - 1);
    
    // 선택된 컬럼명(A, B, C...)을 인덱스로 변환
    const barcodeIndex = getColumnIndex(selectedBarcodeColumn);
    const quantityIndex = getColumnIndex(selectedQuantityColumn);
    const locationIndex = selectedLocationColumn ? getColumnIndex(selectedLocationColumn) : -1;
    const noteIndex = selectedNoteColumn ? getColumnIndex(selectedNoteColumn) : -1;
    const productNameIndex = selectedProductNameColumn ? getColumnIndex(selectedProductNameColumn) : -1;
    const optionNameIndex = selectedOptionNameColumn ? getColumnIndex(selectedOptionNameColumn) : -1;

    // 각 바코드별로 상품명을 조회해서 설정
    const newStockData: any[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const barcode = row[barcodeIndex] || '';
      const quantity = parseInt(row[quantityIndex]) || 0;
      const location = locationIndex >= 0 ? (row[locationIndex] || '') : '';
      const note = noteIndex >= 0 ? (row[noteIndex] || '') : '';
      
      if (!barcode.trim()) continue; // 빈 바코드 제거
      
      // 상품명 처리 로직
      let productName = '';
      
      // 엑셀에서 상품명/옵션명이 선택된 경우
      if (productNameIndex >= 0) {
        const excelProductName = row[productNameIndex] || '';
        const excelOptionName = optionNameIndex >= 0 ? (row[optionNameIndex] || '') : '';
        
        if (excelProductName) {
          // 상품명과 옵션명 조합
          if (excelOptionName) {
            productName = `${excelProductName}, ${excelOptionName}`;
          } else {
            productName = excelProductName;
          }
        }
      }
      
      // 엑셀에서 상품명을 가져오지 못한 경우 Supabase에서 조회
      if (!productName) {
        try {
          const { data: productData, error } = await supabase
            .from('extract_coupang_item_all')
            .select('item_name, option_name')
            .eq('barcode', barcode.trim())
            .maybeSingle();
          
          if (!error && productData) {
            const itemName = productData.item_name || '';
            const optionName = productData.option_name || '';
            productName = `${itemName} ${optionName}`.trim();
          }
        } catch (err) {
          // 오류 시 기본값 사용
        }
      }
      
      // 최종적으로 상품명이 없으면 기본값 설정
      if (!productName) {
        productName = `상품 ${barcode}`;
      }
      
      const itemId = `${location || 'A-1-001'}=${barcode}`;
      
      // 동일한 ID가 이미 있는지 확인
      const existingItemIndex = newStockData.findIndex(item => item.id === itemId);
      
      if (existingItemIndex >= 0) {
        // 기존 항목이 있으면 수량만 합산
        newStockData[existingItemIndex].quantity += quantity;
      } else {
        // 새 항목 추가
        newStockData.push({
          id: itemId,
          barcode: barcode,
          productName: productName,
          quantity: quantity,
          location: location || 'A-1-001',
          note: note,
          timestamp: new Date().toLocaleString()
        });
      }
    }

    // 재고 관리 테이블에 데이터 추가 (기존 데이터와 중복 체크)
    setStockManagementData(prev => {
      const updated = [...prev];
      
      newStockData.forEach(newItem => {
        const existingIndex = updated.findIndex(item => item.id === newItem.id);
        if (existingIndex >= 0) {
          // 기존 항목이 있으면 수량 합산
          updated[existingIndex].quantity += newItem.quantity;
        } else {
          // 새 항목 추가
          updated.unshift(newItem);
        }
      });
      
      return updated;
    });
    
    // 모달 닫기
    handleModalClose();
  };

  // 추가 버튼 활성화 조건
  const isAddButtonEnabled = excelType === 'deliveryList' || (selectedBarcodeColumn && selectedQuantityColumn);

  // 현재 사용자 ID 가져오기
  const getCurrentUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id) {
        return user.id; // 실제 user ID 반환
      }
      
      // 대체 방법: localStorage에서 가져오기
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        return userData.id || userData.email || 'temp_user';
      }
      
      return 'temp_user'; // 임시 사용자 ID
    } catch (error) {
      console.error('❌ 사용자 정보 가져오기 오류:', error);
      return 'temp_user';
    }
  };

  // 재고 데이터 로드 함수
  const loadStockManagementData = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('❌ 로그인된 사용자가 없습니다.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('stocks_management')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: false });

      if (error) {
        console.error('❌ 재고 데이터 로드 오류:', error);
        if (error.code === '42703' || error.code === '42P01') {
          console.log('ℹ️ stocks_management 테이블이 존재하지 않습니다. 테이블을 먼저 생성해주세요.');
        }
        return;
      }

      setStockManagementData(data || []);
    } catch (err) {
      console.error('❌ 재고 데이터 로드 예외:', err);
    }
  };

  // 🧹 컴포넌트 언마운트 시 메모리 정리 (메모리 누수 방지)
  useEffect(() => {
    console.log('🔄 StocksScan 컴포넌트 마운트됨');
    
    // cleanup 함수: 컴포넌트 언마운트 시 실행
    return () => {
      console.log('🧹 StocksScan 컴포넌트 언마운트 - 메모리 정리 중...');
      
      // 대용량 상태 데이터 정리
      setStockManagementData([]);
      setScanHistory([]);
      setExcelData([]);
      
      // 파일 입력 정리
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      console.log('✅ 메모리 정리 완료');
    };
  }, []);

  // 📊 stockManagementData 메모리 최적화 - 최대 크기 제한
  const optimizedStockData = useMemo(() => {
    if (stockManagementData.length > MAX_STOCK_DATA_SIZE) {
      console.warn(`⚠️ 재고 데이터가 최대 크기(${MAX_STOCK_DATA_SIZE})를 초과했습니다. 최신 ${MAX_STOCK_DATA_SIZE}개만 유지합니다.`);
      return stockManagementData.slice(0, MAX_STOCK_DATA_SIZE);
    }
    
    return stockManagementData;
  }, [stockManagementData]);

  // 🔄 scanHistory 메모리 최적화 - 최대 크기 제한
  const optimizedScanHistory = useMemo(() => {
    if (scanHistory.length > MAX_SCAN_HISTORY_SIZE) {
      return scanHistory.slice(0, MAX_SCAN_HISTORY_SIZE);
    }
    return scanHistory;
  }, [scanHistory]);

  // 재고 추가 핸들러
  const handleStockAdd = async () => {
    if (stockManagementData.length === 0) {
      alert('추가할 재고 데이터가 없습니다. 먼저 엑셀 파일을 업로드해주세요.');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 로딩 상태 시작
    setIsStockAddLoading(true);
    setStockAddProgress({ current: 0, total: stockManagementData.length });

    try {

      // 🗺️ 동일한 바코드+위치를 미리 그룹화하여 중복 처리 방지
      const groupedData = new Map<string, any>();
      
      stockManagementData.forEach(item => {
        const location = item.location || 'A-1-001';
        const barcode = item.barcode?.trim() || '';
        const key = `${location}=${barcode}`;
        const quantity = parseInt(item.quantity || item.stock || 0);
        
        if (groupedData.has(key)) {
          const existing = groupedData.get(key);
          existing.totalQuantity += quantity;
          existing.count += 1;
        } else {
          groupedData.set(key, {
            id: key, // location=barcode 형태로 ID 설정
            barcode: barcode,
            location: location,
            itemName: item.productName || item.item_name || `상품-${barcode}`,
            note: item.note || '',
            totalQuantity: quantity,
            count: 1,
            originalItem: item
          });
        }
      });

      const groupedItems = Array.from(groupedData.values());
      
      // 🧹 메모리 정리: Map 객체 명시적 해제
      groupedData.clear();

      // 🚀 배치 처리로 성능 최적화
      setStockAddProgress({ current: 10, total: 100 });
      
      // 변수 초기화
      let successCount = 0;
      let updateCount = 0;
      let insertCount = 0;
      let errorCount = 0;
      let errorDetails: string[] = [];
      
      // 🔍 1단계: 기존 재고 데이터 일괄 조회 (item_name도 함께 조회)
      const BATCH_SIZE = 100;
      const allIds = groupedItems.map(item => item.id);
      const existingStockMap = new Map();

      for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
        const batchIds = allIds.slice(i, i + BATCH_SIZE);

        try {
          const { data: existingStocks, error: batchError } = await supabase
            .from('stocks_management')
            .select('id, stock, item_name')
            .eq('user_id', userId)
            .in('id', batchIds);

          if (batchError) {
            console.error('배치 조회 오류:', batchError);
            continue;
          }

          existingStocks?.forEach(stock => {
            existingStockMap.set(stock.id, stock);
          });
        } catch (err) {
          console.error('배치 조회 예외:', err);
        }
        
        // 진행률 업데이트 (10% ~ 50% 구간)
        const progressPercent = Math.round(10 + ((i + BATCH_SIZE) / allIds.length * 40));
        setStockAddProgress({ current: progressPercent, total: 100 });
      }

      // 🔄 2단계: 업데이트/삽입 데이터 준비
      setStockAddProgress({ current: 50, total: 100 });
      
      const toUpdate: any[] = [];
      const toInsert: any[] = [];
      
      groupedItems.forEach(item => {
        const { id, barcode, location, itemName, note, totalQuantity } = item;
        
        // 바코드가 없는 경우만 오류로 처리
        if (!barcode) {
          errorCount++;
          const errorMsg = `바코드: ${barcode || '비어있음'}, 위치: ${location} (오류: 바코드 누락)`;
          errorDetails.push(errorMsg);
          return;
        }
        
        // 수량이 0이거나 잘못된 경우 조용히 건너뛰기 (pass)
        if (isNaN(totalQuantity) || totalQuantity <= 0) {
          return;
        }

        const existingStock = existingStockMap.get(id);
        
        if (existingStock) {
          // 기존 재고 업데이트 (수량만 추가)
          const newStock = (existingStock.stock || 0) + totalQuantity;
          toUpdate.push({
            id: id,
            stock: newStock  // stock만 포함
          });
          updateCount++;
        } else {
          // 새 재고 삽입
          const insertData: any = {
            id: id,
            user_id: userId,
            item_name: itemName,
            barcode: barcode,
            stock: totalQuantity,
            location: location
          };
          
          if (note && note.trim() !== '') {
            insertData.note = note;
          }
          
          toInsert.push(insertData);
          insertCount++;
        }
      });

      // 🚀 3단계: 배치 업데이트 및 삽입 (UPDATE와 INSERT 분리)
      setStockAddProgress({ current: 70, total: 100 });

      // 배치 UPDATE 실행 (수량만 업데이트)
      if (toUpdate.length > 0) {
        for (const item of toUpdate) {
          try {
            const { error: updateError } = await supabase
              .from('stocks_management')
              .update({ stock: item.stock })  // stock만 업데이트
              .eq('id', item.id);

            if (updateError) {
              console.error('개별 업데이트 오류:', updateError);
              errorDetails.push(`ID: ${item.id} (업데이트 실패)`);
              errorCount++;
              updateCount--;
            }
          } catch (err) {
            console.error('개별 업데이트 예외:', err);
            errorDetails.push(`ID: ${item.id} (업데이트 예외)`);
            errorCount++;
            updateCount--;
          }
        }
      }

      // 배치 삽입 실행
      if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);
          
          try {
            const { error: insertError } = await supabase
              .from('stocks_management')
              .insert(batch);

            if (insertError) {
              console.error('배치 삽입 오류:', insertError);
              
              // note 컬럼 문제인 경우 note 제거 후 재시도
              if (insertError.message?.includes('note')) {
                const batchWithoutNote = batch.map(item => {
                  const { note, ...itemWithoutNote } = item;
                  return itemWithoutNote;
                });
                
                const { error: retryError } = await supabase
                  .from('stocks_management')
                  .insert(batchWithoutNote);
                
                if (retryError) {
                  console.error('배치 재시도 오류:', retryError);
                  batch.forEach(item => {
                    errorDetails.push(`ID: ${item.id} (삽입 재시도 실패)`);
                    errorCount++;
                    insertCount--;
                  });
                }
              } else {
                batch.forEach(item => {
                  errorDetails.push(`ID: ${item.id} (삽입 실패)`);
                  errorCount++;
                  insertCount--;
                });
              }
            }
          } catch (err) {
            console.error('배치 삽입 예외:', err);
            batch.forEach(item => {
              errorDetails.push(`ID: ${item.id} (삽입 예외)`);
              errorCount++;
              insertCount--;
            });
          }
        }
      }

      successCount = updateCount + insertCount;

      setStockAddProgress({ current: 100, total: 100 });

      if (errorCount > 0) {
        const errorMessage = `처리 완료!\n성공: ${successCount}개\n오류: ${errorCount}개\n\n오류 상세 (최대 10개만 표시):\n${errorDetails.slice(0, 10).join('\n')}${errorDetails.length > 10 ? '\n\n... 및 기타 ' + (errorDetails.length - 10) + '개 오류' : ''}`;
        alert(errorMessage);
      } else {
        alert(`${successCount}개 항목의 재고가 성공적으로 추가되었습니다!\n업데이트: ${updateCount}개\n신규추가: ${insertCount}개`);
      }

      // 테이블 초기화
      setStockManagementData([]);
    } catch (err) {
      alert('재고 추가 중 오류가 발생했습니다.');
    } finally {
      // 로딩 상태 해제
      setIsStockAddLoading(false);
      setStockAddProgress({ current: 0, total: 0 });
    }
  };

  // 재고 차감 핸들러
  const handleStockSubtract = async () => {
    if (stockManagementData.length === 0) {
      alert('차감할 재고 데이터가 없습니다. 먼저 엑셀 파일을 업로드해주세요.');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 로딩 상태 시작
    setIsStockSubtractLoading(true);
    setStockSubtractProgress({ current: 0, total: stockManagementData.length });

    try {
      // 테이블 존재 여부 먼저 확인
      const { error: tableCheckError } = await supabase
        .from('stocks_management')
        .select('count(*)', { count: 'exact' })
        .limit(0);

      if (tableCheckError) {
        if (tableCheckError.code === '42703' || tableCheckError.code === '42P01' || tableCheckError.message?.includes('does not exist')) {
          alert('stocks_management 테이블이 존재하지 않습니다. Supabase에서 stocks_management_table.sql을 실행하여 테이블을 먼저 생성해주세요.');
          return;
        }
      }

      let successCount = 0;
      let notFoundCount = 0;
      let errorCount = 0;
      let errorDetails: string[] = []; // 오류 상세 정보

      // 🗺️ 동일한 바코드+위치를 미리 그룹화하여 중복 처리 방지
      const groupedData = new Map<string, any>();
      
      stockManagementData.forEach(item => {
        const location = item.location || 'A-1-001';
        const barcode = item.barcode?.trim() || '';
        const key = `${location}=${barcode}`;
        const quantity = parseInt(item.quantity || item.stock || 0);
        
        if (groupedData.has(key)) {
          const existing = groupedData.get(key);
          existing.totalQuantity += quantity;
        } else {
          groupedData.set(key, {
            id: key, // location=barcode 형태로 ID 설정
            barcode: barcode,
            location: location,
            note: item.note || '',
            totalQuantity: quantity
          });
        }
      });

      const groupedItems = Array.from(groupedData.values());
      
      // 🧹 메모리 정리: Map 객체 명시적 해제
      groupedData.clear();

      // 🚀 배치 처리: 기존 데이터를 청크 단위로 조회 (URL 길이 제한 방지)
      setStockSubtractProgress({ current: 10, total: 100 });
      
      const CHUNK_SIZE = 50; // 한번에 50개씩 처리
      const allIds = groupedItems.map(item => item.id);
      const existingMap = new Map();
      
      // ID 배열을 청크로 나누어 처리
      for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
        const chunk = allIds.slice(i, i + CHUNK_SIZE);
        
        const { data: existingRecords, error: batchSelectError } = await supabase
          .from('stocks_management')
          .select('id, stock')
          .eq('user_id', userId)
          .in('id', chunk);

        if (batchSelectError) {
          console.error('배치 조회 오류:', batchSelectError);
          continue; // 이 청크는 건너뛰고 계속 진행
        }

        // 조회된 데이터를 Map에 추가
        existingRecords?.forEach(record => {
          existingMap.set(record.id, record);
        });
      }

      // 📝 업데이트할 데이터 준비
      const toUpdate: any[] = [];

      setStockSubtractProgress({ current: 50, total: 100 });

      let processedSubtractCount = 0;
      groupedItems.forEach((item, index) => {
        const { id, barcode, totalQuantity } = item;
        
        // 바코드가 없는 경우만 오류로 처리
        if (!barcode) {
          errorCount++;
          const errorMsg = `바코드: ${barcode || '비어있음'} (오류: 바코드 누락)`;
          errorDetails.push(errorMsg);
          processedSubtractCount++;
          return;
        }
        
        // 수량이 0이거나 잘못된 경우 조용히 건너뛰기 (pass)
        if (isNaN(totalQuantity) || totalQuantity <= 0) {
          processedSubtractCount++;
          return;
        }

        const existing = existingMap.get(id);
        if (existing) {
          // 기존 데이터가 있으면 재고 수량 차감
          const currentStock = parseInt(existing.stock) || 0;
          const newStock = Math.max(0, currentStock - totalQuantity);
          toUpdate.push({
            id: id,
            stock: newStock
          });
          successCount++;
        } else {
          notFoundCount++;
          errorDetails.push(`바코드: ${barcode}, ID: ${id} (오류: 기존 재고 데이터 없음)`);
        }
        
        processedSubtractCount++;
        // 진행률 업데이트 (50% ~ 70% 구간)
        const progressPercent = Math.round(50 + (processedSubtractCount / groupedItems.length * 20));
        setStockSubtractProgress({ current: progressPercent, total: 100 });
      });

      // 🚀 배치 업데이트 실행 (청크 단위)
      setStockSubtractProgress({ current: 80, total: 100 });
      
      if (toUpdate.length > 0) {
        for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
          const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
          
          for (const item of chunk) {
            const { error: updateError } = await supabase
              .from('stocks_management')
              .update({ stock: item.stock })
              .eq('id', item.id);

            if (updateError) {
              console.error('개별 업데이트 오류:', updateError);
              errorDetails.push(`ID: ${item.id} (오류: 데이터베이스 업데이트 실패)`);
              errorCount++;
              successCount--;
            }
          }
        }
      }

      setStockSubtractProgress({ current: 100, total: 100 });

      if (errorCount > 0 || notFoundCount > 0) {
        const errorMessage = `차감 완료!\n성공: ${successCount}개\n재고없음: ${notFoundCount}개\n오류: ${errorCount}개\n\n오류 상세 (최대 10개만 표시):\n${errorDetails.slice(0, 10).join('\n')}${errorDetails.length > 10 ? '\n\n... 및 기타 ' + (errorDetails.length - 10) + '개 오류' : ''}`;
        alert(errorMessage);
      } else {
        alert(`${successCount}개 항목의 재고가 성공적으로 차감되었습니다!`);
      }

      // 테이블 초기화
      setStockManagementData([]);
    } catch (err) {
      alert('재고 차감 중 오류가 발생했습니다.');
    } finally {
      // 로딩 상태 해제
      setIsStockSubtractLoading(false);
      setStockSubtractProgress({ current: 0, total: 0 });
    }
  };

  // 체크박스 선택 핸들러
  const handleItemSelect = (itemId: number) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // 전체 선택 핸들러
  const handleSelectAll = () => {
    if (selectedItems.length === stockManagementData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(stockManagementData.map(item => item.id));
    }
  };

  // 위치 편집 시작
  const handleLocationEdit = (item: any) => {
    setEditingLocationId(item.id);
    setEditingLocationValue(item.location || '');
  };

  // 위치 편집 저장
  const handleLocationSave = async () => {
    if (editingLocationId === null) return;
    
    // 로컬 데이터 업데이트
    setStockManagementData(prev =>
      prev.map(item =>
        item.id === editingLocationId
          ? { ...item, location: editingLocationValue }
          : item
      )
    );
    
    setEditingLocationId(null);
    setEditingLocationValue('');
  };

  // 위치 편집 취소
  const handleLocationCancel = () => {
    setEditingLocationId(null);
    setEditingLocationValue('');
  };

  // Enter 키로 다음 위치로 이동
  const handleLocationKeyPress = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLocationSave();
      
      // 다음 행의 위치로 이동
      const nextIndex = currentIndex + 1;
      if (nextIndex < stockManagementData.length) {
        const nextItem = stockManagementData[nextIndex];
        setTimeout(() => {
          handleLocationEdit(nextItem);
        }, 100);
      }
    } else if (e.key === 'Escape') {
      handleLocationCancel();
    }
  };

  // 위치 불러오기 버튼 핸들러
  const handleLoadLocations = async () => {
    if (stockManagementData.length === 0) {
      alert('위치를 불러올 재고 데이터가 없습니다.');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    let updateCount = 0;
    const updatedData = [...stockManagementData];

    // 각 바코드별로 위치 조회
    for (let i = 0; i < updatedData.length; i++) {
      const item = updatedData[i];
      if (!item.barcode) continue;

      try {
        // Supabase에서 해당 바코드의 위치 조회
        const { data: locationData, error } = await supabase
          .from('stocks_management')
          .select('location')
          .eq('user_id', userId)
          .eq('barcode', item.barcode.trim())
          .maybeSingle();

        if (!error && locationData && locationData.location) {
          updatedData[i] = { ...updatedData[i], location: locationData.location };
          updateCount++;
        }
      } catch (err) {
        // 오류 시 해당 항목은 건너뛰기
      }
    }

    // 업데이트된 데이터 적용
    setStockManagementData(updatedData);
    
    if (updateCount > 0) {
      alert(`${updateCount}개 항목의 위치 정보를 불러왔습니다.`);
    } else {
      alert('불러올 위치 정보가 없습니다.');
    }
  };

  // 새로운 바코드 입력 처리 함수
  const handleBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputBarcode(e.target.value);
  };

  // 개수 입력 처리 함수
  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputQuantity(e.target.value);
  };

  // 위치 입력 처리 함수  
  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputLocation(e.target.value);
  };

  // 바코드 입력 폼에서 Enter 키 처리
  const handleBarcodeInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSingleItem();
    }
  };

  // 단일 아이템 추가 함수 (로컬 목록에만 추가)
  const handleAddSingleItem = async () => {
    if (!inputBarcode.trim()) {
      alert('바코드를 입력해주세요.');
      return;
    }

    const barcode = inputBarcode.trim();
    const quantity = parseInt(inputQuantity) || 1;
    const location = inputLocation.trim() || 'A-1-001';
    const note = inputNote.trim();

    // Supabase에서 상품명 조회
    let productName = '';
    try {
      const { data: productData, error } = await supabase
        .from('extract_coupang_item_all')
        .select('item_name, option_name')
        .eq('barcode', barcode)
        .maybeSingle();
      
      if (!error && productData) {
        const itemName = productData.item_name || '';
        const optionName = productData.option_name || '';
        productName = `${itemName} ${optionName}`.trim();
      }
    } catch (err) {
      // 오류 시 빈 문자열 사용
    }

    // 최종적으로 상품명이 없으면 기본값 설정
    if (!productName) {
      productName = `상품-${barcode}`;
    }

    const itemId = `${location}=${barcode}`;
    
    // 동일한 ID가 이미 있는지 확인
    const existingItemIndex = stockManagementData.findIndex(item => item.id === itemId);

    if (existingItemIndex !== -1) {
      // 기존 아이템이 있으면 수량 추가
      setStockManagementData(prev =>
        prev.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: (item.quantity || item.stock || 0) + quantity }
            : item
        )
      );
    } else {
      // 새 아이템 추가
      const newItem = {
        id: itemId,
        barcode: barcode,
        productName: productName,
        quantity: quantity,
        location: location,
        note: note,
        timestamp: new Date().toLocaleString()
      };
      setStockManagementData(prev => [newItem, ...prev]);
    }

    // 입력 폼 초기화 (바코드만 초기화, 개수와 위치는 유지)
    setInputBarcode('');
    
    // 바코드 입력 필드에 포커스
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  return (
    <div className="product-list-container">
      {/* 페이지 헤더 */}
      <div className="product-list-page-header">
        <h1 className="product-list-page-title">재고 관리</h1>
        <p style={{ color: '#6b7280', marginTop: '8px' }}>
          재고를 관리하고 엑셀을 통해 재고를 업데이트하세요
        </p>
      </div>

      {/* 버튼들 - 보드 위쪽 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* 왼쪽: xlsx 추가 버튼 */}
        <button
          onClick={handleExcelUpload}
          className="product-list-button product-list-button-success"
          style={{ minWidth: '120px' }}
        >
          📄 xlsx 추가
        </button>
        
        {/* 오른쪽: 재고 추가/차감 버튼들 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleStockAdd}
            className="product-list-button product-list-button-primary"
            style={{ minWidth: '120px' }}
          >
            ➕ 재고 추가
          </button>
          <button
            onClick={handleStockSubtract}
            style={{ 
              minWidth: '120px',
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ➖ 재고 차감
          </button>
        </div>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* 바코드 입력 섹션 */}
      <div className="product-list-filter-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 바코드, 개수, 위치 입력 폼 */}
          <div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'end' }}>
              {/* 바코드 입력 */}
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>바코드</label>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={inputBarcode}
                  onChange={handleBarcodeInputChange}
                  onKeyPress={handleBarcodeInputKeyPress}
                  placeholder="바코드를 입력하세요..."
                  className="product-list-search-input"
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
              
              {/* 개수 입력 */}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>개수</label>
                <input
                  type="number"
                  value={inputQuantity}
                  onChange={handleQuantityInputChange}
                  placeholder="1"
                  min="1"
                  className="product-list-search-input"
                  style={{ width: '100%', textAlign: 'center' }}
                />
              </div>
              
              {/* 위치 입력 */}
              <div style={{ flex: 1.5 }}>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>위치</label>
                <input
                  type="text"
                  value={inputLocation}
                  onChange={handleLocationInputChange}
                  placeholder="위치 (선택사항)"
                  className="product-list-search-input"
                  style={{ width: '100%' }}
                />
              </div>
              
              {/* 비고 입력 */}
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>비고</label>
                <input
                  type="text"
                  value={inputNote}
                  onChange={(e) => setInputNote(e.target.value)}
                  placeholder="비고 (선택사항)"
                  className="product-list-search-input"
                  style={{ width: '100%' }}
                />
              </div>
              
              {/* 입력 버튼 */}
              <button
                onClick={handleAddSingleItem}
                disabled={!inputBarcode.trim()}
                className="product-list-button product-list-button-primary"
                style={{ minWidth: '100px' }}
              >
                입력
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* 스캔 결과 섹션 */}
      {currentStock && (
        <div className="product-list-table-section">
          <div className="product-list-table-header-section">
            <div className="product-list-table-info">
              <div className="product-list-data-count">
                스캔 결과
              </div>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            {currentStock.found ? (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '20px',
                backgroundColor: '#f8fafc',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <strong>상품명:</strong>
                  <div style={{ marginTop: '4px', fontSize: '14px' }}>{currentStock.productName}</div>
                </div>
                <div>
                  <strong>SKU:</strong>
                  <div style={{ marginTop: '4px', fontSize: '14px' }}>{currentStock.sku}</div>
                </div>
                <div>
                  <strong>현재 재고:</strong>
                  <div style={{ 
                    marginTop: '4px', 
                    fontSize: '18px', 
                    fontWeight: 'bold',
                    color: currentStock.currentStock <= currentStock.minStock ? '#ef4444' : '#10b981'
                  }}>
                    {currentStock.currentStock}개
                  </div>
                </div>
                <div>
                  <strong>최소 재고:</strong>
                  <div style={{ marginTop: '4px', fontSize: '14px' }}>{currentStock.minStock}개</div>
                </div>
                <div>
                  <strong>보관 위치:</strong>
                  <div style={{ marginTop: '4px', fontSize: '14px' }}>{currentStock.location}</div>
                </div>
                <div>
                  <strong>마지막 업데이트:</strong>
                  <div style={{ marginTop: '4px', fontSize: '14px' }}>{currentStock.lastUpdated}</div>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                color: '#dc2626'
              }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                  상품을 찾을 수 없습니다
                </div>
                <div style={{ fontSize: '14px' }}>
                  바코드: {currentStock.barcode}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 재고 관리 테이블 섹션 */}
      <div className="product-list-table-section">
        <div className="product-list-table-header-section">
          <div className="product-list-table-info">
            <div className="product-list-data-count">
              재고 관리 목록 ({optimizedStockData.length}개)
            </div>
          </div>
          <div className="product-list-action-buttons">
            <button
              onClick={handleLoadLocations}
              className="product-list-button product-list-button-primary"
              style={{ marginRight: '8px' }}
            >
              위치 불러오기
            </button>
            <button
              onClick={() => {
                if (selectedItems.length === 0) {
                  alert('삭제할 항목을 선택해주세요.');
                  return;
                }
                if (window.confirm(`선택된 ${selectedItems.length}개 항목을 삭제하시겠습니까?`)) {
                  setStockManagementData(prev => prev.filter(item => !selectedItems.includes(item.id)));
                  setSelectedItems([]);
                }
              }}
              className="product-list-button product-list-button-danger"
            >
              삭제
            </button>
          </div>
        </div>

        <div className="product-list-table-container">
          <table className="product-list-table">
            <thead className="product-list-table-header">
              <tr>
                <th className="product-list-table-header-cell" style={{ width: '60px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={optimizedStockData.length > 0 && selectedItems.length === optimizedStockData.length}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </th>
                <th className="product-list-table-header-cell" style={{ width: '180px', textAlign: 'center' }}>바코드</th>
                <th className="product-list-table-header-cell" style={{ width: '250px', textAlign: 'left' }}>상품명</th>
                <th className="product-list-table-header-cell" style={{ width: '100px', textAlign: 'center' }}>재고</th>
                <th className="product-list-table-header-cell" style={{ width: '120px', textAlign: 'center' }}>위치</th>
                <th className="product-list-table-header-cell" style={{ width: '150px', textAlign: 'center' }}>비고</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {optimizedStockData.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    fontSize: '16px' 
                  }}>
                    재고 데이터가 없습니다. xlsx 파일을 추가해주세요.
                  </td>
                </tr>
              )}
                              {optimizedStockData.map((stock, index) => (
                <tr 
                  key={stock.id} 
                  className="product-list-table-row"
                  style={{ 
                    backgroundColor: selectedItems.includes(stock.id) ? '#dbeafe' : 'transparent'
                  }}
                >
                  <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedItems.includes(stock.id)}
                      onChange={() => handleItemSelect(stock.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </td>
                  <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', fontFamily: 'monospace', fontSize: '16px' }}>
                    {stock.barcode}
                  </td>
                  <td className="product-list-table-cell" style={{ textAlign: 'left', padding: '12px', fontSize: '16px' }}>
                    {stock.item_name || stock.productName}
                  </td>
                  <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', fontWeight: 'bold', fontSize: '16px' }}>
                    {stock.stock || stock.quantity}
                  </td>
                  <td className="product-list-table-cell" style={{ textAlign: 'center', padding: '12px', fontSize: '16px' }}>
                    {editingLocationId === stock.id ? (
                      <input
                        type="text"
                        value={editingLocationValue}
                        onChange={(e) => setEditingLocationValue(e.target.value)}
                        onKeyPress={(e) => handleLocationKeyPress(e, index)}
                        onBlur={handleLocationSave}
                        autoFocus
                        style={{
                          width: '100px',
                          padding: '4px 8px',
                          fontSize: '16px',
                          textAlign: 'center',
                          border: 'none',
                          outline: 'none',
                          backgroundColor: '#fffbeb',
                          borderRadius: '4px'
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => handleLocationEdit(stock)}
                        style={{
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          minHeight: '20px',
                          display: 'inline-block',
                          minWidth: '60px',
                          fontSize: '16px'
                        }}
                      >
                        {stock.location || '클릭해서 입력'}
                      </span>
                    )}
                  </td>
                  <td className="product-list-table-cell" style={{ textAlign: 'left', padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                    {stock.note || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 엑셀 업로드 모달 */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '95%',
            maxWidth: excelData[0] ? `${Math.min(Math.max(excelData[0].length * 150, 600), 1200)}px` : '800px',
            maxHeight: '85%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                엑셀 데이터 미리보기
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleAddExcelData}
                  disabled={!isAddButtonEnabled}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isAddButtonEnabled ? '#10b981' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: isAddButtonEnabled ? 'pointer' : 'not-allowed'
                  }}
                >
                  추가
                </button>
                <button
                  onClick={handleModalClose}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
              </div>
            </div>

            {/* 엑셀 타입 선택 및 데이터 시작 행 선택 */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '20px'
            }}>
              {/* 라디오 옵션 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="excelType"
                    value="stock"
                    checked={excelType === 'stock'}
                    onChange={(e) => setExcelType(e.target.value as 'stock' | 'deliveryList')}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>재고 엑셀</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="excelType"
                    value="deliveryList"
                    checked={excelType === 'deliveryList'}
                    onChange={(e) => setExcelType(e.target.value as 'stock' | 'deliveryList')}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>deliveryList</span>
                </label>
              </div>
              
              <div style={{ width: '1px', height: '30px', backgroundColor: '#d1d5db' }}></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: '#374151' }}>데이터 시작 행:</label>
                <select
                  value={dataStartRow}
                  onChange={(e) => setDataStartRow(parseInt(e.target.value))}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(row => (
                    <option key={row} value={row}>{row}행</option>
                  ))}
                </select>
              </div>
              
              <div style={{ width: '1px', height: '30px', backgroundColor: '#d1d5db' }}></div>
              
              {/* deliveryList가 아닌 경우에만 컬럼 선택 버튼 표시 */}
              {excelType === 'stock' && (
                <>
                  <button
                    onClick={handleBarcodeMode}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isSelectingBarcode ? '#3b82f6' : '#e5e7eb',
                      color: isSelectingBarcode ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    바코드 {selectedBarcodeColumn && `(${selectedBarcodeColumn})`}
                  </button>
                  <button
                    onClick={handleQuantityMode}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: !isSelectingBarcode && !isSelectingLocation && !isSelectingProductName && !isSelectingOptionName && !isSelectingNote ? '#3b82f6' : '#e5e7eb',
                      color: !isSelectingBarcode && !isSelectingLocation && !isSelectingProductName && !isSelectingOptionName && !isSelectingNote ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    개수 {selectedQuantityColumn && `(${selectedQuantityColumn})`}
                  </button>
                  <button
                    onClick={handleLocationMode}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isSelectingLocation ? '#3b82f6' : '#e5e7eb',
                      color: isSelectingLocation ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    위치 {selectedLocationColumn && `(${selectedLocationColumn})`}
                  </button>
                  <button
                    onClick={handleNoteMode}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isSelectingNote ? '#3b82f6' : '#e5e7eb',
                      color: isSelectingNote ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    비고 {selectedNoteColumn && `(${selectedNoteColumn})`}
                  </button>
                  <button
                    onClick={handleProductNameMode}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isSelectingProductName ? '#3b82f6' : '#e5e7eb',
                      color: isSelectingProductName ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    상품명 {selectedProductNameColumn && `(${selectedProductNameColumn})`}
                  </button>
                  <button
                    onClick={handleOptionNameMode}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isSelectingOptionName ? '#3b82f6' : '#e5e7eb',
                      color: isSelectingOptionName ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    옵션명 {selectedOptionNameColumn && `(${selectedOptionNameColumn})`}
                  </button>
                </>
              )}
              
              {/* deliveryList인 경우 설명 텍스트 표시 */}
              {excelType === 'deliveryList' && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px solid #0ea5e9',
                  fontSize: '14px',
                  color: '#0c4a6e'
                }}>
                  deliveryList 모드: R열(바코드), K열(상품명), L열(옵션명), AO열(창고) 자동 처리
                </div>
              )}
            </div>

            {/* 미리보기 테이블 */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1px solid #e2e8f0'
              }}>
                <thead>
                  {/* 엑셀 스타일 컬럼 헤더 (A, B, C...) */}
                  <tr>
                    {excelData[0]?.map((header: any, index: number) => {
                      const columnName = getExcelColumnName(index);
                      return (
                        <th
                          key={index}
                          onClick={() => handleColumnSelect(columnName)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: 
                              (isSelectingBarcode && selectedBarcodeColumn === columnName) ||
                              (!isSelectingBarcode && !isSelectingLocation && !isSelectingProductName && !isSelectingOptionName && !isSelectingNote && selectedQuantityColumn === columnName) ||
                              (isSelectingLocation && selectedLocationColumn === columnName) ||
                              (isSelectingNote && selectedNoteColumn === columnName) ||
                              (isSelectingProductName && selectedProductNameColumn === columnName) ||
                              (isSelectingOptionName && selectedOptionNameColumn === columnName)
                                ? '#3b82f6'
                                : selectedBarcodeColumn === columnName || selectedQuantityColumn === columnName || selectedLocationColumn === columnName || selectedNoteColumn === columnName || selectedProductNameColumn === columnName || selectedOptionNameColumn === columnName
                                ? '#e5e7eb'
                                : '#f1f5f9',
                            color: 
                              (isSelectingBarcode && selectedBarcodeColumn === columnName) ||
                              (!isSelectingBarcode && !isSelectingLocation && !isSelectingProductName && !isSelectingOptionName && !isSelectingNote && selectedQuantityColumn === columnName) ||
                              (isSelectingLocation && selectedLocationColumn === columnName) ||
                              (isSelectingNote && selectedNoteColumn === columnName) ||
                              (isSelectingProductName && selectedProductNameColumn === columnName) ||
                              (isSelectingOptionName && selectedOptionNameColumn === columnName)
                                ? 'white'
                                : '#374151',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}
                        >
                          {columnName}
                        </th>
                      );
                    })}
                  </tr>
                  {/* 실제 데이터 헤더 행들 표시 */}
                  {excelData.slice(0, dataStartRow - 1).map((row: any[], rowIndex: number) => (
                    <tr key={`header-${rowIndex}`}>
                      {row.map((cell: any, cellIndex: number) => (
                        <th
                          key={cellIndex}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: 'normal',
                            color: '#6b7280'
                          }}
                        >
                          {cell}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {excelData.slice(dataStartRow - 1, dataStartRow + 4).map((row, rowIndex) => (
                    <tr key={rowIndex} style={{
                      backgroundColor: rowIndex === 0 ? '#fffbeb' : 'white'
                    }}>
                      {row.map((cell: any, cellIndex: number) => (
                        <td
                          key={cellIndex}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center',
                            fontSize: '13px'
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {excelData.length > dataStartRow + 4 && (
                    <tr>
                      <td
                        colSpan={excelData[0]?.length || 1}
                        style={{
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}
                      >
                        ... 총 {excelData.length - dataStartRow + 1}개 데이터 행 (상위 5개만 표시)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 재고 추가 로딩 모달 */}
      {isStockAddLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '32px',
            width: '400px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#374151'
            }}>
              재고 데이터 추가 중...
            </div>
            
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px'
            }}>
              <div style={{
                width: `${stockAddProgress.total > 0 ? (stockAddProgress.current / stockAddProgress.total) * 100 : 0}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            
            <div style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              {stockAddProgress.current}%
            </div>
          </div>
        </div>
      )}

      {/* 재고 차감 로딩 모달 */}
      {isStockSubtractLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '32px',
            width: '400px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#374151'
            }}>
              재고 데이터 차감 중...
            </div>
            
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px'
            }}>
              <div style={{
                width: `${stockSubtractProgress.total > 0 ? (stockSubtractProgress.current / stockSubtractProgress.total) * 100 : 0}%`,
                height: '100%',
                backgroundColor: '#ef4444',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            
            <div style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              {stockSubtractProgress.current}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StocksScan; 