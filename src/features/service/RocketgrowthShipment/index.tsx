import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import ActionButton from '../../../components/ActionButton';
import { supabase } from '../../../config/supabase';
import { processShipmentSizeExcelUpload } from '../../../services/excelUploadService';
import './index.css';

interface ProcessedData {
  barcode: string;
  product: string;
  quantity: number;
  itemId?: string;
  optionId?: string;
  itemName?: string;
  optionName?: string;
  hasData?: boolean;
}

interface ShipmentData {
  boxNumber: string;
  barcode: string;
  product: string;
  quantity: number;
  isEditing?: boolean;
}

const RocketgrowthShipment: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<string>('option1');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  
  // 옵션1 모달 관련 상태
  const [isOption1ModalOpen, setIsOption1ModalOpen] = useState(false);
  const [option1ExcelData, setOption1ExcelData] = useState<any[]>([]);
  const [selectedBarcodeColumn, setSelectedBarcodeColumn] = useState<string>('');
  const [selectedQuantityColumn, setSelectedQuantityColumn] = useState<string>('');
  const [selectedLocationColumn, setSelectedLocationColumn] = useState<string>('');
  const [isSelectingBarcode, setIsSelectingBarcode] = useState(true);
  const [isSelectingQuantity, setIsSelectingQuantity] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [dataStartRow, setDataStartRow] = useState<number>(2);
  
  // 쉽먼트 접수 엑셀 관련 상태
  const [shipmentExcelFile, setShipmentExcelFile] = useState<File | null>(null);

  // 입고 사이즈 관련 상태
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [sizeExcelFile, setSizeExcelFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);

  // 쉽먼트 데이터 수정 함수들
  const [editingCell, setEditingCell] = useState<{index: number, field: string} | null>(null);

  const handleCellClick = (index: number, field: string) => {
    if (field === 'boxNumber' || field === 'quantity') {
      setEditingCell({index, field});
    }
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleShipmentChange = (index: number, field: string, value: string | number) => {
    const updatedShipmentData = [...shipmentData];
    const oldQuantity = updatedShipmentData[index].quantity;
    
    if (field === 'boxNumber') {
      updatedShipmentData[index].boxNumber = value as string;
    } else if (field === 'quantity') {
      const newQuantity = Number(value);
      const quantityDiff = newQuantity - oldQuantity;
      updatedShipmentData[index].quantity = newQuantity;
      
      // 해당 바코드의 로켓그로스 입고요청 데이터도 업데이트
      if (quantityDiff !== 0) {
        const barcode = updatedShipmentData[index].barcode;
        const updatedProcessedData = [...processedData];
        
        const processedIndex = updatedProcessedData.findIndex(item => item.barcode === barcode);
        if (processedIndex !== -1) {
          updatedProcessedData[processedIndex].quantity += quantityDiff;
          setProcessedData(updatedProcessedData);
        }
      }
    }
    setShipmentData(updatedShipmentData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 기존 데이터 초기화
      setProcessedData([]);
      setShipmentData([]);
      setUploadedFile(file);
      
      if (selectedOption === 'option1') {
        readOption1ExcelFile(file);
      } else if (selectedOption === 'option2') {
        processOption2Excel(file);
      }
    }
    
    // input 값 초기화 (같은 파일을 다시 선택할 수 있도록)
    event.target.value = '';
  };

  const processOption2Excel = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

        const allBarcodesCount: { [key: string]: number } = {};
        const shipmentResults: ShipmentData[] = [];
        
        // 각 열을 처리 (각 열은 하나의 박스)
        const maxRows = jsonData.length;
        const maxCols = Math.max(...jsonData.map(row => row.length));

        for (let col = 0; col < maxCols; col++) {
          const boxNumber = jsonData[0]?.[col]?.toString().trim() || `박스${col + 1}`;
          const barcodes: string[] = [];
          
          // 2행부터 바코드 수집 (1행은 박스번호)
          for (let row = 1; row < maxRows; row++) {
            const cellValue = jsonData[row]?.[col];
            if (cellValue && cellValue.toString().trim()) {
              barcodes.push(cellValue.toString().trim());
            }
          }
          
          // 이 박스의 바코드별 개수 계산
          const barcodeCount: { [key: string]: number } = {};
          barcodes.forEach(barcode => {
            barcodeCount[barcode] = (barcodeCount[barcode] || 0) + 1;
            // 전체 바코드 집계에도 추가
            allBarcodesCount[barcode] = (allBarcodesCount[barcode] || 0) + 1;
          });
          
          // 쉽먼트 데이터 생성 (박스별)
          Object.entries(barcodeCount).forEach(([barcode, count]) => {
            shipmentResults.push({
              boxNumber,
              barcode,
              product: '', // 일단 비워둠
              quantity: count
            });
          });
        }
        
        // 모든 바코드 목록 수집
        const allBarcodes = Object.keys(allBarcodesCount);
        
        // 상품 정보 조회
        const productMap = await fetchProductInfoByBarcodes(allBarcodes);
        
        // 로켓그로스 입고요청 데이터 (전체 바코드 집계)
        const processedResults: ProcessedData[] = Object.entries(allBarcodesCount).map(([barcode, count]) => {
          const productInfo = productMap[barcode];
          return {
            barcode,
            product: productInfo?.productName || '-',
            quantity: count,
            itemId: productInfo?.itemId,
            optionId: productInfo?.optionId,
            itemName: productInfo?.itemName,
            optionName: productInfo?.optionName,
            hasData: !!productInfo
          };
        });
        
        // 쉽먼트 데이터에도 상품 정보 적용
        const updatedShipmentResults: ShipmentData[] = shipmentResults.map(item => ({
          ...item,
          product: productMap[item.barcode]?.productName || '-'
        }));
        
        setProcessedData(processedResults);
        setShipmentData(updatedShipmentResults);
      } catch (error) {
        console.error('Excel 파일 처리 중 오류:', error);
        alert('Excel 파일 처리 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  // 옵션1: Excel 파일 읽기 (모달 표시)
  const readOption1ExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

        if (jsonData.length === 0) {
          alert('엑셀 파일에 데이터가 없습니다.');
          return;
        }

        setOption1ExcelData(jsonData);
        setIsOption1ModalOpen(true);
        // 상태 초기화
        setSelectedBarcodeColumn('');
        setSelectedQuantityColumn('');
        setSelectedLocationColumn('');
        setIsSelectingBarcode(true);
        setIsSelectingQuantity(false);
        setIsSelectingLocation(false);
        setDataStartRow(2);
      } catch (error) {
        console.error('Excel 파일 읽기 오류:', error);
        alert('Excel 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 컬럼 인덱스를 엑셀 스타일 문자로 변환 (0->A, 1->B, ...)
  const getExcelColumnName = (index: number): string => {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  };

  // 옵션1 모달 닫기
  const handleOption1ModalClose = () => {
    setIsOption1ModalOpen(false);
    setOption1ExcelData([]);
    setSelectedBarcodeColumn('');
    setSelectedQuantityColumn('');
    setSelectedLocationColumn('');
    setIsSelectingBarcode(true);
    setIsSelectingQuantity(false);
    setIsSelectingLocation(false);
    setDataStartRow(2);
  };

  // 옵션1 컬럼 선택 핸들러
  const handleOption1ColumnSelect = (columnName: string) => {
    if (isSelectingBarcode) {
      setSelectedBarcodeColumn(columnName);
      setIsSelectingBarcode(false);
      setIsSelectingQuantity(true);
    } else if (isSelectingQuantity) {
      setSelectedQuantityColumn(columnName);
      setIsSelectingQuantity(false);
      setIsSelectingLocation(true);
    } else if (isSelectingLocation) {
      setSelectedLocationColumn(columnName);
      setIsSelectingLocation(false);
    }
  };

  // 옵션1 모드 변경 핸들러들
  const handleOption1BarcodeMode = () => {
    setIsSelectingBarcode(true);
    setIsSelectingQuantity(false);
    setIsSelectingLocation(false);
  };

  const handleOption1QuantityMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingQuantity(true);
    setIsSelectingLocation(false);
  };

  const handleOption1LocationMode = () => {
    setIsSelectingBarcode(false);
    setIsSelectingQuantity(false);
    setIsSelectingLocation(true);
  };

  // 옵션1 Excel 데이터 처리
  const handleOption1AddExcelData = async () => {
    if (!selectedBarcodeColumn || !selectedQuantityColumn) {
      alert('바코드와 개수 컬럼을 모두 선택해주세요.');
      return;
    }

    try {
      // 선택된 시작 행부터 데이터 처리
      const dataRows = option1ExcelData.slice(dataStartRow - 1);
      
      // 선택된 컬럼명을 인덱스로 변환
      const barcodeIndex = selectedBarcodeColumn.charCodeAt(0) - 65;
      const quantityIndex = selectedQuantityColumn.charCodeAt(0) - 65;
      const locationIndex = selectedLocationColumn ? selectedLocationColumn.charCodeAt(0) - 65 : -1;

      // 바코드별 데이터 집계
      const barcodeMap: { [key: string]: number } = {};
      const shipmentResults: ShipmentData[] = [];

      for (const row of dataRows) {
        const barcode = row[barcodeIndex]?.toString().trim() || '';
        const quantity = parseInt(row[quantityIndex]) || 0;
        const location = locationIndex >= 0 ? (row[locationIndex]?.toString().trim() || '') : '';

        if (!barcode) continue;

        // 전체 바코드 집계 (로켓그로스 입고요청용)
        barcodeMap[barcode] = (barcodeMap[barcode] || 0) + quantity;

        // 쉽먼트 접수용 데이터 (위치별로 구분)
        shipmentResults.push({
          boxNumber: location || '-',
          barcode,
          product: '', // 나중에 조회
          quantity
        });
      }

      // 모든 바코드 목록 수집
      const allBarcodes = Object.keys(barcodeMap);
      
      // 상품 정보 조회
      const productMap = await fetchProductInfoByBarcodes(allBarcodes);
      
      // 로켓그로스 입고요청 데이터 (전체 바코드 집계)
      const processedResults: ProcessedData[] = Object.entries(barcodeMap).map(([barcode, count]) => {
        const productInfo = productMap[barcode];
        return {
          barcode,
          product: productInfo?.productName || '-',
          quantity: count,
          itemId: productInfo?.itemId,
          optionId: productInfo?.optionId,
          itemName: productInfo?.itemName,
          optionName: productInfo?.optionName,
          hasData: !!productInfo
        };
      });
      
      // 쉽먼트 데이터에도 상품 정보 적용
      const updatedShipmentResults: ShipmentData[] = shipmentResults.map(item => ({
        ...item,
        product: productMap[item.barcode]?.productName || '-'
      }));
      
      setProcessedData(processedResults);
      setShipmentData(updatedShipmentResults);
      
      // 모달 닫기
      handleOption1ModalClose();
    } catch (error) {
      console.error('Excel 데이터 처리 중 오류:', error);
      alert('Excel 데이터 처리 중 오류가 발생했습니다.');
    }
  };

  // 바코드로 상품 정보 조회 (배치 처리)
  const fetchProductInfoByBarcodes = async (barcodes: string[]) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;

      if (!userId) {
        console.error('사용자 ID를 찾을 수 없습니다.');
        return {};
      }

      // 바코드를 배치로 나누어 처리 (한 번에 너무 많이 조회하지 않도록)
      const batchSize = 100;
      const productMap: { [key: string]: {
        productName: string;
        itemId: string;
        optionId: string;
        itemName: string;
        optionName: string;
      } } = {};

      for (let i = 0; i < barcodes.length; i += batchSize) {
        const batch = barcodes.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('extract_coupang_item_all')
          .select('barcode, item_name, option_name, item_id, option_id')
          .eq('user_id', userId)
          .in('barcode', batch)
          .limit(1000);

        if (error) {
          console.error('상품 정보 조회 오류:', error);
          continue;
        }

        // 결과를 맵에 저장
        data.forEach((item: any) => {
          const productName = item.option_name 
            ? `${item.item_name}, ${item.option_name}`
            : item.item_name;
          productMap[item.barcode] = {
            productName,
            itemId: item.item_id,
            optionId: item.option_id,
            itemName: item.item_name,
            optionName: item.option_name
          };
        });
      }

      return productMap;
    } catch (error) {
      console.error('상품 정보 조회 중 예외 발생:', error);
      return {};
    }
  };

  // 쉽먼트 접수 Excel 업로드 핸들러
  const handleShipmentExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setShipmentExcelFile(file);
    }
    
    // input 값 초기화 (같은 파일을 다시 선택할 수 있도록)
    event.target.value = '';
  };

  // 쉽먼트 접수 Excel 다운로드 함수 (데이터 처리 후 저장)
  const handleShipmentExcelDownload = async () => {
    if (!shipmentExcelFile) {
      alert('먼저 엑셀 파일을 업로드해주세요.');
      return;
    }

    if (shipmentData.length === 0) {
      alert('처리할 쉽먼트 데이터가 없습니다.');
      return;
    }

    try {
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `로켓그로스 쉽먼트 ${timestamp}`;

      // 업로드된 파일 읽기
      const fileData = await shipmentExcelFile.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 박스 번호 매핑 생성
      const boxMapping: { [key: string]: number } = {};
      let boxCount = 0;

      if (selectedOption === 'option1') {
        // 옵션1: A열의 박스번호 순서대로 매핑
        const uniqueBoxes: string[] = [];
        shipmentData.forEach(item => {
          if (!uniqueBoxes.includes(item.boxNumber)) {
            uniqueBoxes.push(item.boxNumber);
          }
        });
        uniqueBoxes.forEach((boxName, index) => {
          boxMapping[boxName] = index + 1;
        });
        boxCount = uniqueBoxes.length;
      } else if (selectedOption === 'option2') {
        // 옵션2: 열 순서대로 박스 매핑
        const uniqueBoxes: string[] = [];
        shipmentData.forEach(item => {
          if (!uniqueBoxes.includes(item.boxNumber)) {
            uniqueBoxes.push(item.boxNumber);
          }
        });
        uniqueBoxes.forEach((boxName, index) => {
          boxMapping[boxName] = index + 1;
        });
        boxCount = uniqueBoxes.length;
      }

      // I4에 박스 총 수량 입력
      worksheet['I4'] = { v: boxCount, t: 'n' };

      // E열에서 바코드를 찾아서 해당하는 박스 열에 개수 입력
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
      
      for (let row = range.s.r; row <= range.e.r; row++) {
        const barcodeCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 4 })]; // E열 (0부터 시작하므로 4)
        if (barcodeCell && barcodeCell.v) {
          const barcode = barcodeCell.v.toString();
          
          // 해당 바코드의 쉽먼트 데이터 찾기
          const matchingItems = shipmentData.filter(item => item.barcode === barcode);
          
          matchingItems.forEach(item => {
            const boxNumber = boxMapping[item.boxNumber];
            if (boxNumber) {
              // H열부터 시작 (박스1=H열, 박스2=I열...)
              const colIndex = 7 + boxNumber - 1; // H열이 7번 인덱스
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
              
              // 기존 값이 있다면 더하고, 없다면 새로 입력
              const existingValue = worksheet[cellAddress] ? (worksheet[cellAddress].v || 0) : 0;
              worksheet[cellAddress] = { 
                v: Number(existingValue) + item.quantity, 
                t: 'n' 
              };
            }
          });
        }
      }

      // 파일 다운로드
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } catch (error) {
      console.error('쉽먼트 엑셀 처리 중 오류:', error);
      alert('엑셀 파일 처리 중 오류가 발생했습니다.');
    }
  };

  // 입고 사이즈 Excel 업로드 핸들러
  const handleSizeExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSizeExcelFile(file);
    }
    event.target.value = '';
  };

  // 입고 사이즈 데이터 처리 및 업로드
  const handleSizeDataUpload = async () => {
    if (!sizeExcelFile) {
      alert('엑셀 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);

    try {
      const result = await processShipmentSizeExcelUpload(sizeExcelFile, (stage, current, total) => {
        if (current !== undefined && total !== undefined) {
          setUploadProgress({ current, total, message: stage });
        } else {
          setUploadProgress({ current: 0, total: 0, message: stage });
        }
      });

      if (result.success) {
        alert(`입고 사이즈 xlsx 업로드가 완료되었습니다.\n처리된 데이터: ${result.processedCount}개`);
        console.log('📊 입고 사이즈 엑셀 업로드 성공:', {
          파일명: sizeExcelFile.name,
          처리된행수: result.processedCount,
          전체행수: result.totalRows
        });
      } else {
        throw new Error(result.error || '업로드 실패');
      }

      // 업로드 완료
      setUploadProgress(null);

      // 모달 닫기
      setIsSizeModalOpen(false);
      setSizeExcelFile(null);

    } catch (error: any) {
      setUploadProgress(null);
      console.error('입고 사이즈 엑셀 업로드 실패:', error);
      alert(`입고 사이즈 엑셀 업로드 중 오류가 발생했습니다.\n${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 로켓그로스 입고요청 Excel 다운로드 함수
  const handleRocketgrowthExcelDownload = () => {
    if (processedData.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `로켓그로스 입고 ${timestamp}`;

    // 1-2행은 숨김 처리를 위한 빈 행
    const hiddenRows = [
      [], // 1행
      []  // 2행
    ];

    // 3행: 헤더
    const headers = [
      'No.', '등록상품명', '옵션명', '판매가', '노출상품 ID', '등록상품 ID', '옵션 ID', '판매 방식',
      '24년 총계', '25년 총계', '25년 06월', '25년 07월', '25년 08월', '지난 14일', '2주간\n판매수량',
      '1주간\n판매수량', '판매자\n수수료율', '판매자\n수수료', '쿠팡풀필먼트서비스\n예상 요금(개당)\n(입출고요금+배송료 / 보관료 미포함)',
      '기본 할인액', '할인 적용 예상 요금', '입고 수량 입력\n(필수)', '입고수량에 따른\n2주간 예상 매출', '유통기간 입력\n(해당 시 필수)',
      '유통(소비)기한\n(필수)', '제조일자\n(필수)', '생산년도\n(필수)', '상품바코드\n(필수)', '상품 사이즈\n(필수)',
      '취급주의여부\n(필수)', '판매가능재고', '예상 재고 소진일', '카테고리', '병행수입\n여부', '과세유형'
    ];

    // 4행: 예시 및 설명
    const exampleRow = [
      '예시 및 설명', '스누피 티셔츠', '블랙 S', '25000', '7269865933', '14047501199', '85676422188', '판매자배송',
      '동일상품 기준\n합산 매출\n(로켓그로스 포함)', '동일상품 기준\n합산 매출\n(로켓그로스 포함)', '동일상품 기준\n합산 매출\n(로켓그로스 포함)',
      '동일상품 기준\n합산 매출\n(로켓그로스 포함)', '동일상품 기준\n합산 매출\n(로켓그로스 포함)', '이전 14일 기준\n(단위: 개)',
      '이전 7일 기준\n(단위: 개)', '(단위: 원)', '입고수량을 입력하고\n예상 수수료를 알아보세요\n물류센터의 상품 실측 이후 요금은 달라질 수 있습니다.',
      '판매기간 2주 기준 추천된 수량이며, 판매자가 변경할 수 있습니다.', '입고수량 X 판매가', '일 단위로 입력',
      '상품별 기한이 다를 경우, 가장 빠른 날짜로 입력해 주세요.', '상품별 기한이 다를 경우, 가장 빠른 날짜로 입력해 주세요.',
      '상품별 기한이 다를 경우, 가장 빠른 날짜로 입력해 주세요.', '미입력시 쿠팡 바코드가 자동 생성되며, 상품마다 바코드를 출력해서 부착해야 합니다.',
      '상품 사이즈 분류 기준이 궁금하세요? 바로가기', '취급주의 상품(유리 제품, 칼, 페인트)에 해당할 시 표기해주세요.'
    ];

    // 실제 데이터 행들 생성
    const dataRows = processedData.map((item, index) => {
      const row = new Array(35).fill(''); // AI열까지 35개 컬럼
      
      row[0] = index + 1; // A열: No.
      row[1] = item.itemName || ''; // B열: 등록상품명
      row[2] = item.optionName || ''; // C열: 옵션명
      row[5] = item.itemId || ''; // F열: 등록상품 ID
      row[6] = item.optionId || ''; // G열: 옵션 ID
      row[7] = '로켓그로스'; // H열: 판매 방식
      row[21] = item.quantity; // V열: 입고 수량 입력
      row[27] = item.barcode; // AB열: 상품바코드
      row[28] = 'Small'; // AC열: 상품 사이즈
      row[29] = '해당아님'; // AD열: 취급주의여부
      
      return row;
    });

    // 전체 데이터 구성
    const wsData = [
      ...hiddenRows,
      headers,
      exampleRow,
      ...dataRows
    ];

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 1-2행 숨김 처리
    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][0] = { hidden: true };
    ws['!rows'][1] = { hidden: true };

    // 열 숨김 처리 (D,E,I~U,X~AA,AE~AI)
    if (!ws['!cols']) ws['!cols'] = [];
    
    // D열 (3번 인덱스) 숨김
    ws['!cols'][3] = { hidden: true };
    // E열 (4번 인덱스) 숨김  
    ws['!cols'][4] = { hidden: true };
    
    // I~U열 (8~20번 인덱스) 숨김
    for (let i = 8; i <= 20; i++) {
      ws['!cols'][i] = { hidden: true };
    }
    
    // X~AA열 (23~26번 인덱스) 숨김
    for (let i = 23; i <= 26; i++) {
      ws['!cols'][i] = { hidden: true };
    }
    
    // AE~AI열 (30~34번 인덱스) 숨김
    for (let i = 30; i <= 34; i++) {
      ws['!cols'][i] = { hidden: true };
    }

    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(wb, ws, '로켓그로스 입고');

    // 파일 다운로드
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <div className="rocketgrowth-shipment-container">
      {/* 헤더 영역 */}
      <div className="rocketgrowth-header">
        <h1 className="rocketgrowth-title">로켓그로스 입고</h1>
        <div className="rocketgrowth-upload-section">
          <input
            type="file"
            id="xlsx-upload"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <ActionButton
            variant="success"
            onClick={() => document.getElementById('xlsx-upload')?.click()}
          >
            📊 xlsx 업로드
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={() => setIsSizeModalOpen(true)}
          >
            📏 입고 사이즈
          </ActionButton>
        </div>
      </div>

      {/* 옵션 선택 카드 영역 */}
      <div className="rocketgrowth-options">
        <div 
          className={`option-card ${selectedOption === 'option1' ? 'selected' : ''}`}
          onClick={() => handleOptionSelect('option1')}
        >
          <div className="option-radio">
            <input 
              type="radio" 
              name="shipment-option" 
              value="option1" 
              checked={selectedOption === 'option1'}
              readOnly
            />
          </div>
          <div className="option-content">
            <h3>옵션 1</h3>
            <p>A - 박스번호, B - 바코드, C - 개수</p>
          </div>
        </div>

        <div 
          className={`option-card ${selectedOption === 'option2' ? 'selected' : ''}`}
          onClick={() => handleOptionSelect('option2')}
        >
          <div className="option-radio">
            <input 
              type="radio" 
              name="shipment-option" 
              value="option2" 
              checked={selectedOption === 'option2'}
              readOnly
            />
          </div>
          <div className="option-content">
            <h3>옵션 2</h3>
            <p>1행 - 박스번호, 2행부터 바코드</p>
          </div>
        </div>

      </div>

      {/* 결과 표시 영역 (2분할) */}
      <div className="rocketgrowth-results">
        <div className="result-board left-board">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>로켓그로스 입고요청</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={handleRocketgrowthExcelDownload}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  disabled={processedData.length === 0}
                >
                  <span>⬇️</span>
                  <span>엑셀</span>
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <button
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  disabled={processedData.length === 0}
                >
                  📄
                </button>
              </div>
            </div>
          </div>
          <div className="result-content">
            <div className="result-table-container">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>바코드</th>
                    <th>상품</th>
                    <th>개수</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.length > 0 ? (
                    processedData.map((item, index) => (
                      <tr key={index}>
                        <td style={{ color: item.hasData ? 'inherit' : 'red' }}>{item.barcode}</td>
                        <td style={{ color: item.hasData ? 'inherit' : 'red' }}>{item.product || '-'}</td>
                        <td style={{ color: item.hasData ? 'inherit' : 'red', textAlign: 'center' }}>{item.quantity}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="result-board right-board">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>쉽먼트 접수</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="file"
                id="shipment-xlsx-upload"
                accept=".xlsx,.xls"
                onChange={handleShipmentExcelUpload}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => document.getElementById('shipment-xlsx-upload')?.click()}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <span>⬆️</span>
                  <span>Parcel</span>
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={handleShipmentExcelDownload}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  disabled={!shipmentExcelFile}
                >
                  <span>⬇️</span>
                  <span>엑셀</span>
                </button>
              </div>
            </div>
          </div>
          <div className="result-content">
            <div className="result-table-container">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>박스번호</th>
                    <th>바코드</th>
                    <th>상품명</th>
                    <th>개수</th>
                  </tr>
                </thead>
                <tbody>
                  {shipmentData.length > 0 ? (
                    shipmentData.map((item, index) => (
                      <tr key={index}>
                        <td 
                          onClick={() => handleCellClick(index, 'boxNumber')}
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: editingCell?.index === index && editingCell?.field === 'boxNumber' ? '#f3f4f6' : 'transparent',
                            position: 'relative'
                          }}
                        >
                          {editingCell?.index === index && editingCell?.field === 'boxNumber' ? (
                            <input
                              type="text"
                              value={item.boxNumber}
                              onChange={(e) => handleShipmentChange(index, 'boxNumber', e.target.value)}
                              onBlur={handleCellBlur}
                              autoFocus
                              style={{
                                width: '100%',
                                height: '100%',
                                padding: '8px',
                                border: 'none',
                                background: 'transparent',
                                outline: 'none',
                                fontSize: 'inherit',
                                fontFamily: 'inherit',
                                position: 'absolute',
                                top: '0',
                                left: '0',
                                boxSizing: 'border-box',
                                textAlign: 'center'
                              }}
                            />
                          ) : (
                            <span style={{ padding: '8px', display: 'block' }}>{item.boxNumber}</span>
                          )}
                        </td>
                        <td>{item.barcode}</td>
                        <td>{item.product || '-'}</td>
                        <td 
                          onClick={() => handleCellClick(index, 'quantity')}
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: editingCell?.index === index && editingCell?.field === 'quantity' ? '#f3f4f6' : 'transparent',
                            position: 'relative'
                          }}
                        >
                          {editingCell?.index === index && editingCell?.field === 'quantity' ? (
                            <>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleShipmentChange(index, 'quantity', e.target.value)}
                                onBlur={handleCellBlur}
                                autoFocus
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  padding: '8px',
                                  border: 'none',
                                  background: 'transparent',
                                  outline: 'none',
                                  fontSize: 'inherit',
                                  fontFamily: 'inherit',
                                  position: 'absolute',
                                  top: '0',
                                  left: '0',
                                  boxSizing: 'border-box',
                                  textAlign: 'center',
                                  MozAppearance: 'textfield',
                                  WebkitAppearance: 'none'
                                }}
                              />
                              <style dangerouslySetInnerHTML={{
                                __html: `
                                  input[type="number"]::-webkit-outer-spin-button,
                                  input[type="number"]::-webkit-inner-spin-button {
                                    -webkit-appearance: none;
                                    margin: 0;
                                  }
                                `
                              }} />
                            </>
                          ) : (
                            <span style={{ padding: '8px', display: 'block' }}>{item.quantity}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 옵션1 Excel 업로드 모달 */}
      {isOption1ModalOpen && (
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
            maxWidth: option1ExcelData[0] ? `${Math.min(Math.max(option1ExcelData[0].length * 150, 600), 1200)}px` : '800px',
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
                옵션 1: Excel 데이터 미리보기
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleOption1AddExcelData}
                  disabled={!selectedBarcodeColumn || !selectedQuantityColumn}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: (selectedBarcodeColumn && selectedQuantityColumn) ? '#10b981' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: (selectedBarcodeColumn && selectedQuantityColumn) ? 'pointer' : 'not-allowed'
                  }}
                >
                  추가
                </button>
                <button
                  onClick={handleOption1ModalClose}
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

            {/* 컨트롤 영역 */}
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
                onClick={handleOption1BarcodeMode}
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
                onClick={handleOption1QuantityMode}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isSelectingQuantity ? '#3b82f6' : '#e5e7eb',
                  color: isSelectingQuantity ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                개수 {selectedQuantityColumn && `(${selectedQuantityColumn})`}
              </button>
              <button
                onClick={handleOption1LocationMode}
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
                  <tr>
                    {option1ExcelData[0]?.map((header: any, index: number) => {
                      const columnName = getExcelColumnName(index);
                      return (
                        <th
                          key={index}
                          onClick={() => handleOption1ColumnSelect(columnName)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: 
                              (isSelectingBarcode && selectedBarcodeColumn === columnName) ||
                              (isSelectingQuantity && selectedQuantityColumn === columnName) ||
                              (isSelectingLocation && selectedLocationColumn === columnName)
                                ? '#3b82f6'
                                : selectedBarcodeColumn === columnName || selectedQuantityColumn === columnName || selectedLocationColumn === columnName
                                ? '#e5e7eb'
                                : '#f1f5f9',
                            color: 
                              (isSelectingBarcode && selectedBarcodeColumn === columnName) ||
                              (isSelectingQuantity && selectedQuantityColumn === columnName) ||
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
                  {option1ExcelData.slice(0, dataStartRow - 1).map((row: any[], rowIndex: number) => (
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
                  {option1ExcelData.slice(dataStartRow - 1, dataStartRow + 4).map((row, rowIndex) => (
                    <tr key={rowIndex}>
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
                  {option1ExcelData.length > dataStartRow + 4 && (
                    <tr>
                      <td
                        colSpan={option1ExcelData[0]?.length || 1}
                        style={{
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}
                      >
                        ... 총 {option1ExcelData.length - dataStartRow + 1}개 데이터 행 (상위 5개만 표시)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 입고 사이즈 모달 */}
      {isSizeModalOpen && (
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
            width: '500px',
            padding: '24px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '16px'
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                입고 사이즈 데이터 업로드
              </h2>
              <button
                onClick={() => {
                  setIsSizeModalOpen(false);
                  setSizeExcelFile(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '12px',
                lineHeight: '1.5'
              }}>
                • 엑셀 파일의 17행부터 데이터를 읽습니다<br/>
                • A열: item_id, B열: option_id, F열: shipment_size<br/>
                • 기존 데이터는 업데이트, 새 데이터는 추가됩니다
              </p>

              <input
                type="file"
                id="size-excel-upload"
                accept=".xlsx,.xls"
                onChange={handleSizeExcelUpload}
                style={{ display: 'none' }}
              />

              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: '#f9fafb',
                cursor: 'pointer',
                marginBottom: '20px'
              }}
              onClick={() => document.getElementById('size-excel-upload')?.click()}
              >
                {sizeExcelFile ? (
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#059669' }}>
                      ✅ 파일 선택됨
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                      {sizeExcelFile.name}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '16px' }}>📁</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#374151' }}>
                      클릭하여 Excel 파일 선택
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                      .xlsx, .xls 파일만 지원
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 진행상황 표시 */}
            {uploadProgress && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                border: '1px solid #d1d5db'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>
                    {uploadProgress.message}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {uploadProgress.current.toLocaleString()} / {uploadProgress.total.toLocaleString()}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      width: `${Math.min((uploadProgress.current / uploadProgress.total) * 100, 100)}%`,
                      height: '100%',
                      backgroundColor: '#10b981',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
                <div style={{
                  marginTop: '4px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  {Math.round((uploadProgress.current / uploadProgress.total) * 100)}% 완료
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setIsSizeModalOpen(false);
                  setSizeExcelFile(null);
                  setUploadProgress(null);
                }}
                disabled={isUploading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  opacity: isUploading ? 0.6 : 1
                }}
              >
                취소
              </button>
              <button
                onClick={handleSizeDataUpload}
                disabled={!sizeExcelFile || isUploading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: (!sizeExcelFile || isUploading) ? '#d1d5db' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: (!sizeExcelFile || isUploading) ? 'not-allowed' : 'pointer'
                }}
              >
                {isUploading ? (uploadProgress ? '처리 중...' : '업로드 중...') : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RocketgrowthShipment;