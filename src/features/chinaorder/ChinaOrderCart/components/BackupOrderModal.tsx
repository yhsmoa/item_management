import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './BackupOrderModal.css';

interface BackupOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

/**
 * 주문 데이터베이스 백업용 모달
 * 대량 엑셀 업로드 기능만 제공
 */
const BackupOrderModal: React.FC<BackupOrderModalProps> = ({ isOpen, onClose, onSave }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  /**
   * 엑셀 템플릿 다운로드
   */
  const handleDownloadTemplate = () => {
    // 템플릿 데이터 구조 (AddOrderModal과 동일)
    const templateData = [
      {
        '날짜': '',
        '주문번호': '',
        '등록상품명': '',
        '옵션명': '',
        '수량': '',
        '바코드': '',
        '중국옵션1': '',
        '중국옵션2': '',
        '위안': '',
        '총위안': '',
        '이미지URL': '',
        '중국링크': '',
        '진행': '',
        '확인': '',
        '취소': '',
        '출고': '',
        '비고': '',
        '주문확인번호': '',
        '출고확인번호': '',
        '옵션ID': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '백업템플릿');

    XLSX.writeFile(workbook, '주문백업_템플릿.xlsx');
  };

  /**
   * 파일 선택 핸들러
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      console.log('📁 파일 선택됨:', file.name);
    }
  };

  /**
   * 파일 제거
   */
  const handleRemoveFile = () => {
    setSelectedFile(null);
    // input 요소 초기화
    const fileInput = document.getElementById('backup-excel-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  /**
   * 저장 버튼 클릭 (현재는 기능 없음, 추후 구현)
   */
  const handleSave = async () => {
    if (!selectedFile) {
      alert('백업할 엑셀 파일을 선택해주세요.');
      return;
    }

    setIsProcessing(true);

    try {
      // TODO: 백업 로직 구현
      console.log('💾 백업 처리 시작:', selectedFile.name);

      // 파일 읽기 예시 (추후 구현)
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('📊 엑셀 데이터:', jsonData);

        onSave(jsonData);
        onClose();
      };
      reader.readAsBinaryString(selectedFile);

    } catch (error) {
      console.error('❌ 백업 처리 실패:', error);
      alert('백업 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="backup-modal-overlay" onClick={onClose}>
      <div className="backup-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* 모달 헤더 */}
        <div className="backup-modal-header">
          <h2>주문 데이터베이스 백업</h2>
          <button className="backup-modal-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 모달 바디 */}
        <div className="backup-modal-body">
          {/* 대량엑셀 섹션 */}
          <div className="backup-section">
            <div className="backup-section-header">
              <h3>백업할 주문 엑셀 추가</h3>
            </div>

            <div className="backup-section-content">
              {/* 템플릿 다운로드 버튼 */}
              <button
                className="backup-template-button"
                onClick={handleDownloadTemplate}
              >
                📥 템플릿.xlsx
              </button>

              {/* 파일 선택 영역 */}
              <div className="backup-file-upload-area">
                <input
                  type="file"
                  id="backup-excel-file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <label htmlFor="backup-excel-file" className="backup-file-upload-label">
                  📎 파일 선택
                </label>

                {selectedFile && (
                  <div className="backup-selected-file">
                    <span className="backup-file-name">{selectedFile.name}</span>
                    <button
                      className="backup-file-remove-button"
                      onClick={handleRemoveFile}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {!selectedFile && (
                <p className="backup-help-text">
                  엑셀 파일을 선택하면 주문 데이터베이스에 백업됩니다.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="backup-modal-footer">
          <button
            className="backup-cancel-button"
            onClick={onClose}
            disabled={isProcessing}
          >
            취소
          </button>
          <button
            className="backup-save-button"
            onClick={handleSave}
            disabled={!selectedFile || isProcessing}
          >
            {isProcessing ? '처리 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupOrderModal;
