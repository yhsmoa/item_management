import React, { useState, useEffect } from 'react';
import './UserProfilePage.css';
import { saveUserApiInfo, getUserApiInfo, UserApiData } from '../../services/userApiService';

/**
 * 개인정보 수정 페이지 컴포넌트
 * - 사용자가 쿠팡 API 정보를 등록/수정할 수 있는 페이지
 * - 업체명, 업체코드, Access Key, Secret Key 입력 기능 제공
 * - 구글 시트 API 정보 입력 기능 추가
 * - Supabase users_api 테이블에 직접 저장 (RLS 보안)
 */
const UserProfilePage: React.FC = () => {
  // 현재 로그인한 사용자 정보 가져오기
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // API 정보 폼 데이터 상태 관리
  const [apiData, setApiData] = useState({
    coupang_name: '',           // 쿠팡 업체명
    coupang_code: '',           // 쿠팡 업체코드  
    coupang_access_key: '',      // 쿠팡 Access Key
    coupang_secret_key: '',      // 쿠팡 Secret Key
    googlesheet_id: '',         // 구글 시트 id
    googlesheet_name: ''        // 구글 시트명
  });

  // 로딩 상태 및 에러 메시지 관리
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * 컴포넌트 마운트 시 기존 API 정보 로드 + 🧹 메모리 누수 방지
   */
  useEffect(() => {
    console.log('🔄 UserProfilePage 컴포넌트 마운트됨');
    loadUserApiInfo();
    
    // 🧹 cleanup 함수: 컴포넌트 언마운트 시 메모리 정리
    return () => {
      console.log('🧹 UserProfilePage 컴포넌트 언마운트 - 메모리 정리 중...');
      
      // 폼 데이터 초기화 (민감한 정보 메모리에서 제거)
      setApiData({
        coupang_name: '',
        coupang_code: '',
        coupang_access_key: '',
        coupang_secret_key: '',
        googlesheet_id: '',
        googlesheet_name: ''
      });
      
      // 메시지 상태 초기화
      setErrorMessage('');
      setSuccessMessage('');
      setIsLoading(false);
      
      console.log('✅ UserProfilePage 메모리 정리 완료');
    };
  }, []);

  /**
   * 기존 사용자 API 정보 로드 (Supabase 직접 연결)
   */
  const loadUserApiInfo = async () => {
    if (!currentUser.id) return;

    try {
      console.log('🔍 사용자 API 정보 조회 시도...');
      
      // Supabase users_api 테이블에서 직접 조회
      const result = await getUserApiInfo(currentUser.id);
      
      if (result.success && result.data) {
        console.log('✅ 기존 데이터 발견, 로드 완료');
        
        // 기존 데이터를 폼에 로드
        setApiData({
          coupang_name: result.data.coupang_name || '',
          coupang_code: result.data.coupang_code || '',
          coupang_access_key: result.data.coupang_access_key || '',
          coupang_secret_key: result.data.coupang_secret_key || '',
          googlesheet_id: result.data.googlesheet_id || '',
          googlesheet_name: result.data.googlesheet_name || ''
        });
        
        setSuccessMessage('📋 기존 데이터를 불러왔습니다.');
      } else {
        console.log('📄 저장된 API 정보가 없습니다.');
      }

    } catch (error: any) {
      console.error('❌ API 정보 로드 에러:', error);
      setErrorMessage('API 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  /**
   * 입력 필드 변경 핸들러
   * - 사용자가 입력 필드에 값을 입력할 때 상태 업데이트
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setApiData(prev => ({
      ...prev,
      [name]: value
    }));
    // 메시지 초기화
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  /**
   * 폼 유효성 검사
   * - 필수 필드 입력 확인
   */
  const validateForm = (): boolean => {
    // 쿠팡 필수 필드 검사
    const requiredFields = ['coupang_name', 'coupang_code', 'coupang_access_key', 'coupang_secret_key'];
    for (const field of requiredFields) {
      if (!apiData[field as keyof typeof apiData].trim()) {
        setErrorMessage('쿠팡 API 정보를 모두 입력해주세요.');
        return false;
      }
    }

    return true;
  };

  /**
   * API 정보 저장 핸들러
   * - 폼 유효성 검사 후 Supabase users_api 테이블에 직접 저장
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser?.id) {
      setErrorMessage('사용자 정보가 없습니다.');
      return;
    }

    // 필수 필드 검증
    if (!apiData.coupang_name.trim() || !apiData.coupang_code.trim() || 
        !apiData.coupang_access_key.trim() || !apiData.coupang_secret_key.trim()) {
      setErrorMessage('모든 쿠팡 API 정보를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const saveData: UserApiData = {
        user_id: currentUser.id,
        coupang_name: apiData.coupang_name.trim(),
        coupang_code: apiData.coupang_code.trim(),
        coupang_access_key: apiData.coupang_access_key.trim(),
        coupang_secret_key: apiData.coupang_secret_key.trim(),
        googlesheet_id: apiData.googlesheet_id.trim(),
        googlesheet_name: apiData.googlesheet_name.trim()
      };

      console.log('💾 API 정보 저장 중...', { user_id: saveData.user_id });
      
      // Supabase users_api 테이블에 직접 저장
      const result = await saveUserApiInfo(saveData);
      
      if (result.success) {
        console.log('✅ API 정보 저장 성공');
        setSuccessMessage('✅ API 정보가 성공적으로 저장되었습니다.');
        setErrorMessage('');
      } else {
        console.error('❌ API 정보 저장 실패:', result.error);
        setErrorMessage(result.error || 'API 정보 저장에 실패했습니다.');
        setSuccessMessage('');
      }
    } catch (error: any) {
      console.error('❌ 저장 중 예외 발생:', error);
      setErrorMessage('저장 중 오류가 발생했습니다.');
      setSuccessMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="user-profile-container">
      <div className="user-profile-content">
        {/* 페이지 메인 제목 */}
        <h1 className="user-profile-title">개인정보 입력</h1>
        
        <div className="user-profile-form-container">
          {/* 쿠팡 API 정보 입력 섹션 */}
          <h2 className="user-profile-section-title">쿠팡 API 정보</h2>
          <div className="user-profile-form-section">
            {/* 쿠팡 업체명 입력 필드 */}
            <div className="user-profile-input-group">
              <label className="user-profile-input-label">쿠팡 업체명</label>
              <input
                type="text"
                name="coupang_name"
                placeholder="쿠팡 업체명을 입력하세요"
                value={apiData.coupang_name}
                onChange={handleInputChange}
                className="user-profile-input"
              />
            </div>
            
            {/* 쿠팡 업체코드 입력 필드 */}
            <div className="user-profile-input-group">
              <label className="user-profile-input-label">쿠팡 업체코드</label>
              <input
                type="text"
                name="coupang_code"
                placeholder="쿠팡 업체코드를 입력하세요"
                value={apiData.coupang_code}
                onChange={handleInputChange}
                className="user-profile-input"
              />
            </div>
            
            {/* 쿠팡 Access Key 입력 필드 */}
            <div className="user-profile-input-group">
              <label className="user-profile-input-label">쿠팡 Access Key</label>
              <input
                type="text"
                name="coupang_access_key"
                placeholder="쿠팡 Access Key를 입력하세요"
                value={apiData.coupang_access_key}
                onChange={handleInputChange}
                className="user-profile-input"
              />
            </div>
            
            {/* 쿠팡 Secret Key 입력 필드 */}
            <div className="user-profile-input-group">
              <label className="user-profile-input-label">쿠팡 Secret Key</label>
              <input
                type="password"
                name="coupang_secret_key"
                placeholder="쿠팡 Secret Key를 입력하세요"
                value={apiData.coupang_secret_key}
                onChange={handleInputChange}
                className="user-profile-input"
              />
            </div>
          </div>

          {/* 구분선 */}
          <hr className="user-profile-divider" />

          {/* 구글 시트 API 정보 입력 섹션 */}
          <h2 className="user-profile-section-title">구글 시트 API 정보</h2>
          <div className="user-profile-form-section">
            {/* 구글 시트 id 입력 필드 */}
            <div className="user-profile-input-group">
              <label className="user-profile-input-label">구글 시트 id</label>
              <input
                type="text"
                name="googlesheet_id"
                placeholder="구글 시트 id를 입력하세요"
                value={apiData.googlesheet_id}
                onChange={handleInputChange}
                className="user-profile-input"
              />
            </div>
            
            {/* 구글 시트명 입력 필드 */}
            <div className="user-profile-input-group">
              <label className="user-profile-input-label">구글 시트명</label>
              <input
                type="text"
                name="googlesheet_name"
                placeholder="구글 시트명을 입력하세요"
                value={apiData.googlesheet_name}
                onChange={handleInputChange}
                className="user-profile-input"
              />
            </div>
          </div>
          
          {/* 에러 메시지 표시 */}
          {errorMessage && (
            <div className="user-profile-error-message">{errorMessage}</div>
          )}
          
          {/* 성공 메시지 표시 */}
          {successMessage && (
            <div className="user-profile-success-message">{successMessage}</div>
          )}
          
          {/* 저장 버튼 */}
          <div className="user-profile-button-container">
            <button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="user-profile-submit-button"
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage; 