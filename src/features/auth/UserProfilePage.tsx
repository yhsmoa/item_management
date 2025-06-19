import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import MainLayout from '../../layouts/MainLayout';
import { saveUserApiInfo, getUserApiInfo, UserApiData } from '../../services/userApiService';

/**
 * 개인정보 수정 페이지 컴포넌트
 * - 사용자가 쿠팡 API 정보를 등록/수정할 수 있는 페이지
 * - 업체명, 업체코드, Access Key, Secret Key 입력 기능 제공
 * - 구글 시트 API 정보 입력 기능 추가
 * - Supabase를 통한 데이터 저장
 */
const UserProfilePage: React.FC = () => {
  // 현재 로그인한 사용자 정보 가져오기
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // API 정보 폼 데이터 상태 관리
  const [formData, setFormData] = useState({
    coupangName: '',           // 쿠팡 업체명
    coupangCode: '',           // 쿠팡 업체코드  
    coupangAccessKey: '',      // 쿠팡 Access Key
    coupangSecretKey: '',      // 쿠팡 Secret Key
    googleSheetId: '',         // 구글 시트 id
    googleSheetName: ''        // 구글 시트명
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
      setFormData({
        coupangName: '',
        coupangCode: '',
        coupangAccessKey: '',
        coupangSecretKey: '',
        googleSheetId: '',
        googleSheetName: ''
      });
      
      // 메시지 상태 초기화
      setErrorMessage('');
      setSuccessMessage('');
      setIsLoading(false);
      
      console.log('✅ UserProfilePage 메모리 정리 완료');
    };
  }, []);

  /**
   * 기존 사용자 API 정보 로드
   */
  const loadUserApiInfo = async () => {
    if (!currentUser.id) return;

    try {
      const result = await getUserApiInfo(currentUser.id);
      if (result.success && result.data) {
        setFormData({
          coupangName: result.data.coupang_name || '',
          coupangCode: result.data.coupang_code || '',
          coupangAccessKey: result.data.coupang_access_key || '',
          coupangSecretKey: result.data.coupang_secret_key || '',
          googleSheetId: result.data.googlesheet_id || '',
          googleSheetName: result.data.googlesheet_name || ''
        });
      }
    } catch (error: any) {
      console.error('❌ API 정보 로드 에러:', error);
    }
  };

  /**
   * 입력 필드 변경 핸들러
   * - 사용자가 입력 필드에 값을 입력할 때 상태 업데이트
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
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
    const requiredFields = ['coupangName', 'coupangCode', 'coupangAccessKey', 'coupangSecretKey'];
    for (const field of requiredFields) {
      if (!formData[field as keyof typeof formData].trim()) {
        setErrorMessage('쿠팡 API 정보를 모두 입력해주세요.');
        return false;
      }
    }

    return true;
  };

  /**
   * API 정보 저장 핸들러
   * - 폼 유효성 검사 후 Supabase users_api 테이블에 데이터 저장
   */
  const handleSubmit = async () => {
    // 유효성 검사
    if (!validateForm()) {
      return;
    }

    if (!currentUser.id) {
      setErrorMessage('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Supabase users_api 테이블에 저장할 데이터 준비
      const apiData: UserApiData = {
        user_id: currentUser.id,
        coupang_name: formData.coupangName,
        coupang_code: formData.coupangCode,
        coupang_access_key: formData.coupangAccessKey,
        coupang_secret_key: formData.coupangSecretKey,
        googlesheet_id: formData.googleSheetId,
        googlesheet_name: formData.googleSheetName
      };

      // userApiService를 통해 API 정보 저장 처리
      const result = await saveUserApiInfo(apiData);

      if (result.success) {
        setSuccessMessage('API 정보가 성공적으로 저장되었습니다.');
      } else {
        // 저장 실패
        setErrorMessage(result.error || 'API 정보 저장에 실패했습니다.');
      }

    } catch (error: any) {
      console.error('❌ API 정보 저장 에러:', error);
      setErrorMessage(`API 정보 저장 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <Container>
        <Content>
          {/* 페이지 메인 제목 */}
          <Title>개인정보 입력</Title>
          
          <FormContainer>
            {/* 쿠팡 API 정보 입력 섹션 */}
            <SectionTitle>쿠팡 API 정보</SectionTitle>
            <FormSection>
              {/* 쿠팡 업체명 입력 필드 */}
              <InputGroup>
                <InputLabel>쿠팡 업체명</InputLabel>
                <Input
                  type="text"
                  name="coupangName"
                  placeholder="쿠팡 업체명을 입력하세요"
                  value={formData.coupangName}
                  onChange={handleInputChange}
                />
              </InputGroup>
              
              {/* 쿠팡 업체코드 입력 필드 */}
              <InputGroup>
                <InputLabel>쿠팡 업체코드</InputLabel>
                <Input
                  type="text"
                  name="coupangCode"
                  placeholder="쿠팡 업체코드를 입력하세요"
                  value={formData.coupangCode}
                  onChange={handleInputChange}
                />
              </InputGroup>
              
              {/* 쿠팡 Access Key 입력 필드 */}
              <InputGroup>
                <InputLabel>쿠팡 Access Key</InputLabel>
                <Input
                  type="text"
                  name="coupangAccessKey"
                  placeholder="쿠팡 Access Key를 입력하세요"
                  value={formData.coupangAccessKey}
                  onChange={handleInputChange}
                />
              </InputGroup>
              
              {/* 쿠팡 Secret Key 입력 필드 */}
              <InputGroup>
                <InputLabel>쿠팡 Secret Key</InputLabel>
                <Input
                  type="password"
                  name="coupangSecretKey"
                  placeholder="쿠팡 Secret Key를 입력하세요"
                  value={formData.coupangSecretKey}
                  onChange={handleInputChange}
                />
              </InputGroup>
            </FormSection>

            {/* 구분선 */}
            <Divider />

            {/* 구글 시트 API 정보 입력 섹션 */}
            <SectionTitle>구글 시트 API 정보</SectionTitle>
            <FormSection>
              {/* 구글 시트 id 입력 필드 */}
              <InputGroup>
                <InputLabel>구글 시트 id</InputLabel>
                <Input
                  type="text"
                  name="googleSheetId"
                  placeholder="구글 시트 id를 입력하세요"
                  value={formData.googleSheetId}
                  onChange={handleInputChange}
                />
              </InputGroup>
              
              {/* 구글 시트명 입력 필드 */}
              <InputGroup>
                <InputLabel>구글 시트명</InputLabel>
                <Input
                  type="text"
                  name="googleSheetName"
                  placeholder="구글 시트명을 입력하세요"
                  value={formData.googleSheetName}
                  onChange={handleInputChange}
                />
              </InputGroup>
            </FormSection>
            
            {/* 에러 메시지 표시 */}
            {errorMessage && (
              <ErrorMessage>{errorMessage}</ErrorMessage>
            )}
            
            {/* 성공 메시지 표시 */}
            {successMessage && (
              <SuccessMessage>{successMessage}</SuccessMessage>
            )}
            
            {/* 저장 버튼 */}
            <ButtonContainer>
              <SubmitButton 
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? '저장 중...' : '저장'}
              </SubmitButton>
            </ButtonContainer>
          </FormContainer>
        </Content>
      </Container>
    </MainLayout>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 전체 컨테이너 - 페이지 전체를 감싸는 최상위 컨테이너
 * - MainLayout 내부에서 사용되므로 사이드바와 탑바 고려
 * - 사이드바가 있는 경우 화면의 남은 공간에서 중앙 정렬
 * - 오프화이트 배경색
 */
const Container = styled.div`
  min-height: calc(100vh - 64px);
  background: #FAFAFA;
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

/**
 * 콘텐츠 영역 - 실제 내용이 들어가는 영역
 * - 최대 너비 제한 및 중앙 정렬
 * - 완전한 중앙 정렬을 위한 수정
 */
const Content = styled.div`
  width: 100%;
  max-width: 500px;
  padding: 40px 0;
`;

/**
 * 페이지 제목 스타일 - 메인 헤딩 (RegisterPage와 동일)
 * - 큰 폰트 크기와 굵은 글씨
 * - 중앙 정렬
 */
const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #2D3748;
  text-align: center;
  margin-bottom: 40px;
  letter-spacing: -0.5px;
`;

/**
 * 폼 컨테이너 - 실제 폼을 감싸는 흰색 카드 (RegisterPage와 동일)
 * - 둥근 모서리와 그림자 효과
 * - 충분한 내부 패딩
 * - 전체 너비 사용으로 완전한 중앙 정렬
 */
const FormContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  border: 1px solid #F0F0F0;
  width: 100%;
`;

/**
 * 섹션 제목 스타일
 */
const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #2D3748;
  margin-bottom: 24px;
  padding-bottom: 8px;
`;

/**
 * 폼 섹션 - API 정보 입력 필드들을 감싸는 영역
 * - 입력 필드들을 세로로 배치
 */
const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 32px;
`;

/**
 * 입력 그룹 - 라벨과 입력필드를 함께 감싸는 컨테이너
 */
const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/**
 * 입력 라벨 스타일
 */
const InputLabel = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #4A5568;
  margin-bottom: 4px;
`;

/**
 * 입력 필드 공통 스타일 - 모든 텍스트 입력란에 적용
 * - 포커스 시 테두리 색상 변경 및 그림자 효과
 * - 부드러운 전환 애니메이션
 */
const Input = styled.input`
  padding: 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 14px;
  width: 100%;
  transition: all 0.2s;
  background: #FAFAFA;
  
  &:focus {
    outline: none;
    border-color: #4A5568;
    background: white;
    box-shadow: 0 0 0 3px rgba(74, 85, 104, 0.1);
  }
  
  &::placeholder {
    color: #A0AEC0;
  }
`;

/**
 * 구분선 스타일
 */
const Divider = styled.hr`
  border: none;
  height: 1px;
  background: linear-gradient(to right, transparent, #E2E8F0, transparent);
  margin: 32px 0;
`;

/**
 * 에러 메시지 스타일
 */
const ErrorMessage = styled.div`
  color: #e53e3e;
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
`;

/**
 * 성공 메시지 스타일
 */
const SuccessMessage = styled.div`
  color: #38a169;
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
`;

/**
 * 버튼 컨테이너 - 저장 버튼을 가운데 정렬
 */
const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 32px;
`;

/**
 * 저장 버튼 스타일 - 메인 액션 버튼 (RegisterPage와 동일한 색상)
 * - 어두운 배경색과 흰색 텍스트
 * - 로딩 상태일 때 비활성화
 * - 호버 효과 및 애니메이션
 */
const SubmitButton = styled.button<{ disabled?: boolean }>`
  background: ${props => props.disabled ? '#A0AEC0' : '#2D3748'};
  color: white;
  border: none;
  padding: 18px 40px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  min-width: 120px;
  
  &:hover {
    background: ${props => props.disabled ? '#A0AEC0' : '#1A202C'};
    transform: ${props => props.disabled ? 'none' : 'translateY(-1px)'};
  }
  
  &:active {
    transform: ${props => props.disabled ? 'none' : 'translateY(0)'};
  }
`;

export default UserProfilePage; 