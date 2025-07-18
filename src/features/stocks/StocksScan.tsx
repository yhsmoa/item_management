import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../config/supabase';
import '../products/ProductListPage.css';

/**
 * 재고 스캔 페이지 컴포넌트
 * - 바코드/QR코드 스캔을 통한 재고 확인
 * - 수동 입력 기능
 * - 스캔 기록 관리
 * - 메모리 최적화 적용
 */
function StocksScan() {
  // 📊 메모리 사용량 모니터링을 위한 상수
  const MAX_STOCK_DATA_SIZE = 1000; // 최대 재고 데이터 개수
  const MAX_SCAN_HISTORY_SIZE = 10; // 최대 스캔 기록 개수
  const MAX_EXCEL_DATA_SIZE = 5000; // 최대 엑셀 데이터 개수 (약 1MB)

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
  const [isSelectingBarcode, setIsSelectingBarcode] = useState(true);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [dataStartRow, setDataStartRow] = useState<number>(2);
  
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
        setIsSelectingBarcode(true);
        setIsSelectingLocation(false);
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
    setIsSelectingBarcode(true);
    setIsSelectingLocation(false);
    setDataStartRow(2);
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

  // 컬럼 선택 핸들러
  const handleColumnSelect = (columnName: string) => {
    if (isSelectingBarcode) {
      setSelectedBarcodeColumn(columnName);
      setIsSelectingBarcode(false);
      // 바코드 선택 후 자동으로 개수 선택 모드로 전환 (기존 동작 유지)
    } else if (isSelectingLocation) {
      setSelectedLocationColumn(columnName);
      setIsSelectingLocation(false);
    } else {
      // 개수 선택 후 자동으로 위치 선택 모드로 전환
      setSelectedQuantityColumn(columnName);
      setIsSelectingLocation(true);
    }
  };

  // 바코드 선택 모드로 변경
  const handleBarcodeMode = () => {
    setIsSelectingBarcode(true);
    setIsSelectingLocation(false);
  };

  // 개수 선택 모드로 변경
  const handleQuantityMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingLocation(false);
  };

  // 위치 선택 모드로 변경
  const handleLocationMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingLocation(true);
  };

  // 엑셀 데이터 추가 확인
  const handleAddExcelData = async () => {
    if (!selectedBarcodeColumn || !selectedQuantityColumn) {
      alert('바코드와 개수 컬럼을 모두 선택해주세요.');
      return;
    }

    // 선택된 시작 행부터 데이터 처리 (dataStartRow는 1-based, 배열은 0-based)
    const dataRows = excelData.slice(dataStartRow - 1);
    
    // 선택된 컬럼명(A, B, C...)을 인덱스로 변환
    const barcodeIndex = selectedBarcodeColumn.charCodeAt(0) - 65; // A=0, B=1, C=2...
    const quantityIndex = selectedQuantityColumn.charCodeAt(0) - 65;
    const locationIndex = selectedLocationColumn ? selectedLocationColumn.charCodeAt(0) - 65 : -1;

    // 각 바코드별로 상품명을 조회해서 설정
    const newStockData: any[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const barcode = row[barcodeIndex] || '';
      const quantity = parseInt(row[quantityIndex]) || 0;
      const location = locationIndex >= 0 ? (row[locationIndex] || '') : '';
      
      if (!barcode.trim()) continue; // 빈 바코드 제거
      
      // Supabase에서 상품명 조회
      let productName = `상품 ${barcode}`; // 기본값
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
      
      newStockData.push({
        id: Date.now() + i,
        barcode: barcode,
        productName: productName,
        quantity: quantity,
        location: location, // 엑셀에서 선택한 위치 데이터 또는 빈 문자열
        timestamp: new Date().toLocaleString()
      });
    }

    // 재고 관리 테이블에 데이터 추가
    setStockManagementData(prev => [...newStockData, ...prev]);
    
    // 모달 닫기
    handleModalClose();
  };

  // 추가 버튼 활성화 조건 (바코드와 개수만 필수, 위치는 선택사항)
  const isAddButtonEnabled = selectedBarcodeColumn && selectedQuantityColumn;

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
    if (optimizedStockData.length === 0) {
      alert('추가할 재고 데이터가 없습니다. 먼저 엑셀 파일을 업로드해주세요.');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      // 테이블 존재 여부 먼저 확인
      const { error: tableCheckError } = await supabase
        .from('stocks_management')
        .select('count(*)', { count: 'exact' })
        .limit(0);

      if (tableCheckError) {
        console.error('❌ 테이블 확인 오류:', tableCheckError);
        if (tableCheckError.code === '42703' || tableCheckError.code === '42P01' || tableCheckError.message?.includes('does not exist')) {
          alert('stocks_management 테이블이 존재하지 않습니다. Supabase에서 stocks_management_table.sql을 실행하여 테이블을 먼저 생성해주세요.');
          return;
        }
      }

      let successCount = 0;
      let updateCount = 0;
      let insertCount = 0;
      let errorCount = 0;

      // 🗺️ 동일한 바코드+위치를 미리 그룹화하여 중복 처리 방지 (메모리 최적화)
      
      const groupedData = new Map<string, any>();
      
      optimizedStockData.forEach(item => {
        const key = `${item.barcode?.trim() || ''}_${item.location || 'A-1-001'}`;
        const quantity = parseInt(item.quantity || item.stock || 0);
        
        if (groupedData.has(key)) {
          const existing = groupedData.get(key);
          existing.totalQuantity += quantity;
          existing.count += 1;
        } else {
          groupedData.set(key, {
            barcode: item.barcode?.trim() || '',
            location: item.location || 'A-1-001',
            itemName: item.productName || item.item_name || `상품-${item.barcode}`,
            totalQuantity: quantity,
            count: 1,
            originalItem: item
          });
        }
      });

      const groupedItems = Array.from(groupedData.values());
      
      // 🧹 메모리 정리: Map 객체 명시적 해제
      groupedData.clear();

      for (let i = 0; i < groupedItems.length; i++) {
        const groupedItem = groupedItems[i];
        const { barcode, location, itemName, totalQuantity, count } = groupedItem;

        // 바코드나 수량이 없는 경우 건너뛰기
        if (!barcode || !barcode.trim()) {
          errorCount++;
          continue;
        }

        if (isNaN(totalQuantity) || totalQuantity <= 0) {
          errorCount++;
          continue;
        }

        try {
          // 1. 먼저 기존 데이터가 있는지 확인
          const { data: existingData, error: selectError } = await supabase
            .from('stocks_management')
            .select('id, stock')
            .eq('user_id', userId)
            .eq('barcode', barcode)
            .eq('location', location)
            .maybeSingle();

          if (selectError) {
            errorCount++;
            continue;
          }

          if (existingData) {
            // 2. 기존 데이터가 있으면 재고 수량 합산
            const currentStock = parseInt(existingData.stock) || 0;
            const newStock = currentStock + totalQuantity;
            
            const { error: updateError } = await supabase
              .from('stocks_management')
              .update({ 
                stock: newStock
              })
              .eq('id', existingData.id);

            if (updateError) {
              errorCount++;
            } else {
              updateCount++;
              successCount++;
            }
          } else {
            // 3. 기존 데이터가 없으면 새로 추가
            const { error: insertError } = await supabase
              .from('stocks_management')
              .insert({
                user_id: userId,
                item_name: itemName,
                barcode: barcode,
                stock: totalQuantity,
                location: location
              });

            if (insertError) {
              errorCount++;
            } else {
              insertCount++;
              successCount++;
            }
          }
        } catch (itemError) {
          errorCount++;
        }
      }

      if (errorCount > 0) {
        alert(`처리 완료!\n성공: ${successCount}개\n오류: ${errorCount}개`);
      } else {
        alert(`${successCount}개 항목의 재고가 성공적으로 추가되었습니다!\n업데이트: ${updateCount}개\n신규추가: ${insertCount}개`);
      }

      // 테이블 초기화
      setStockManagementData([]);
    } catch (err) {
      alert('재고 추가 중 오류가 발생했습니다.');
    }
  };

  // 재고 차감 핸들러
  const handleStockSubtract = async () => {
    if (optimizedStockData.length === 0) {
      alert('차감할 재고 데이터가 없습니다. 먼저 엑셀 파일을 업로드해주세요.');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

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

      for (let i = 0; i < stockManagementData.length; i++) {
        const item = stockManagementData[i];

        // 바코드나 수량이 없는 경우 건너뛰기
        if (!item.barcode || !item.barcode.trim()) {
          errorCount++;
          continue;
        }

        const quantityToSubtract = parseInt(item.quantity || item.stock || 0);
        if (isNaN(quantityToSubtract) || quantityToSubtract <= 0) {
          errorCount++;
          continue;
        }

        try {
          // 동일한 바코드 + 위치가 이미 존재하는지 확인
          const itemLocation = item.location || 'A-1-001';
          const { data: existingData, error: selectError } = await supabase
            .from('stocks_management')
            .select('*')
            .eq('user_id', userId)
            .eq('barcode', item.barcode.trim())
            .eq('location', itemLocation)
            .single();

          if (selectError && selectError.code !== 'PGRST116') {
            errorCount++;
            continue;
          }

          if (existingData) {
            // 기존 데이터가 있으면 재고 수량 차감
            const newStock = Math.max(0, existingData.stock - quantityToSubtract);
            
            const { error: updateError } = await supabase
              .from('stocks_management')
              .update({ 
                stock: newStock
              })
              .eq('id', existingData.id);

            if (updateError) {
              errorCount++;
            } else {
              successCount++;
            }
          } else {
            notFoundCount++;
          }
        } catch (itemError) {
          errorCount++;
        }
      }

      if (errorCount > 0 || notFoundCount > 0) {
        alert(`차감 완료!\n성공: ${successCount}개\n재고없음: ${notFoundCount}개\n오류: ${errorCount}개`);
      } else {
        alert(`${successCount}개 항목의 재고가 성공적으로 차감되었습니다!`);
      }

      // 테이블 초기화
      setStockManagementData([]);
    } catch (err) {
      alert('재고 차감 중 오류가 발생했습니다.');
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

  // 단일 아이템 추가 함수
  const handleAddSingleItem = async () => {
    if (!inputBarcode.trim()) {
      alert('바코드를 입력해주세요.');
      return;
    }

    const barcode = inputBarcode.trim();
    const quantity = parseInt(inputQuantity) || 1;
    const location = inputLocation.trim();

    // Supabase에서 상품명 조회
    let productName = ''; // 기본값은 빈 문자열
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

    // 동일한 바코드 + 위치가 이미 있는지 확인
    const existingItemIndex = stockManagementData.findIndex(
      item => item.barcode === barcode && (item.location || '') === location
    );

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
        id: Date.now(),
        barcode: barcode,
        productName: productName,
        quantity: quantity,
        location: location,
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

      {/* xlsx 추가 버튼 - board 외부 위쪽 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={handleExcelUpload}
          className="product-list-button product-list-button-success"
          style={{ minWidth: '120px' }}
        >
          📄 xlsx 추가
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* 바코드 입력 섹션 */}
      <div className="product-list-filter-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 바코드, 개수, 위치 입력 폼 */}
          <div>
            <label className="product-list-label">재고 입력</label>
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

      {/* 재고 관리 액션 버튼 섹션 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '16px', 
        margin: '20px 0',
        maxWidth: '800px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <button
          onClick={handleStockAdd}
          className="product-list-button product-list-button-primary"
          style={{ 
            flex: 1,
            minWidth: '250px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 24px',
            fontSize: '16px'
          }}
        >
          ➕ 재고 추가
        </button>
        <button
          onClick={handleStockSubtract}
          style={{ 
            flex: 1,
            minWidth: '250px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          ➖ 재고 차감
        </button>
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
                <th className="product-list-table-header-cell" style={{ width: '300px', textAlign: 'left' }}>상품명</th>
                <th className="product-list-table-header-cell" style={{ width: '100px', textAlign: 'center' }}>재고</th>
                <th className="product-list-table-header-cell" style={{ width: '120px', textAlign: 'center' }}>위치</th>
              </tr>
            </thead>
            <tbody className="product-list-table-body">
              {optimizedStockData.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ 
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

            {/* 데이터 시작 행 선택 및 컬럼 선택 버튼 */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px'
            }}>
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
                  backgroundColor: !isSelectingBarcode && !isSelectingLocation ? '#3b82f6' : '#e5e7eb',
                  color: !isSelectingBarcode && !isSelectingLocation ? 'white' : '#374151',
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
                              (!isSelectingBarcode && !isSelectingLocation && selectedQuantityColumn === columnName) ||
                              (isSelectingLocation && selectedLocationColumn === columnName)
                                ? '#3b82f6'
                                : selectedBarcodeColumn === columnName || selectedQuantityColumn === columnName || selectedLocationColumn === columnName
                                ? '#e5e7eb'
                                : '#f1f5f9',
                            color: 
                              (isSelectingBarcode && selectedBarcodeColumn === columnName) ||
                              (!isSelectingBarcode && !isSelectingLocation && selectedQuantityColumn === columnName) ||
                              (isSelectingLocation && selectedLocationColumn === columnName)
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
    </div>
  );
}

export default StocksScan; 