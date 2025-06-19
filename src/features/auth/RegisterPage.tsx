import React, { useState } from 'react';
import styled from 'styled-components';
import { registerUser, RegisterData } from '../../services/authService';

/**
 * 회원가입 페이지 컴포넌트
 * - 판매자가 새로운 계정을 생성할 수 있는 페이지
 * - 개인정보 입력, 약관 동의, 휴대폰 인증 기능 제공
 * - Supabase를 통한 데이터 저장
 */
const RegisterPage: React.FC = () => {
  // 회원가입 폼 데이터 상태 관리
  const [formData, setFormData] = useState({
    username: '',        // 사용자 아이디
    password: '',        // 비밀번호
    confirmPassword: '', // 비밀번호 확인
    name: '',           // 실명
    email: '',          // 이메일 주소
    phone: ''           // 휴대폰 번호
  });

  // 약관 동의 상태 관리
  const [agreements, setAgreements] = useState({
    all: false,         // 전체 동의
    age: false,         // 만 19세 이상 확인
    terms: false,       // 서비스 이용약관
    privacy: false,     // 개인정보 처리방침
    marketing: false    // 마케팅 정보 수신 동의 (선택)
  });

  // 로딩 상태 및 에러 메시지 관리
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    // 에러 메시지 초기화
    if (errorMessage) setErrorMessage('');
  };

  /**
   * 약관 동의 체크박스 변경 핸들러
   * - '모두 동의' 체크 시 모든 항목 자동 체크
   * - 개별 항목 체크 시 모든 항목이 체크되면 '모두 동의'도 자동 체크
   */
  const handleAgreementChange = (key: string) => {
    if (key === 'all') {
      // '모두 동의' 클릭 시 모든 항목을 동일한 상태로 설정
      const newValue = !agreements.all;
      setAgreements({
        all: newValue,
        age: newValue,
        terms: newValue,
        privacy: newValue,
        marketing: newValue
      });
    } else {
      // 개별 항목 클릭 시
      setAgreements(prev => {
        const newAgreements = { ...prev, [key]: !prev[key as keyof typeof prev] };
        const { all, ...others } = newAgreements;
        // 모든 개별 항목이 체크되었는지 확인
        const allChecked = Object.values(others).every(Boolean);
        return { ...newAgreements, all: allChecked };
      });
    }
  };

  /**
   * 폼 유효성 검사
   * - 필수 필드 입력 확인
   * - 비밀번호 일치 확인
   * - 필수 약관 동의 확인
   */
  const validateForm = (): boolean => {
    // 필수 필드 검사
    const requiredFields = ['username', 'password', 'confirmPassword', 'name', 'email', 'phone'];
    for (const field of requiredFields) {
      if (!formData[field as keyof typeof formData].trim()) {
        setErrorMessage('모든 필드를 입력해주세요.');
        return false;
      }
    }

    // 비밀번호 일치 확인
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return false;
    }

    // 비밀번호 최소 길이 검사 (4자 이상)
    if (formData.password.length < 4) {
      setErrorMessage('비밀번호는 최소 4자 이상이어야 합니다.');
      return false;
    }

    // 필수 약관 동의 확인 (마케팅 동의는 선택사항)
    if (!agreements.age || !agreements.terms || !agreements.privacy) {
      setErrorMessage('필수 약관에 동의해주세요.');
      return false;
    }

    return true;
  };

  /**
   * 회원가입 제출 핸들러
   * - 폼 유효성 검사 후 Supabase users 테이블에 데이터 저장
   */
  const handleSubmit = async () => {
    // 유효성 검사
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Supabase users 테이블에 저장할 데이터 준비
      const userData: RegisterData = {
        id: formData.username,              // 아이디
        password: formData.password,        // 패스워드
        name: formData.name,               // 이름
        email: formData.email,             // 이메일주소
        contact_number: formData.phone     // 연락처
      };

      console.log('📝 회원가입 데이터 준비:', userData);

      // authService를 통해 회원가입 처리
      const result = await registerUser(userData);

      if (result.success) {
        console.log('✅ 회원가입 성공!');
        
        alert(`회원가입이 완료되었습니다!\n아이디: ${formData.username}\n이름: ${formData.name}`);
        
        // 폼 초기화
        setFormData({
          username: '',
          password: '',
          confirmPassword: '',
          name: '',
          email: '',
          phone: ''
        });
        setAgreements({
          all: false,
          age: false,
          terms: false,
          privacy: false,
          marketing: false
        });

      } else {
        // 회원가입 실패
        setErrorMessage(result.error || '회원가입에 실패했습니다.');
      }

    } catch (error: any) {
      console.error('❌ 회원가입 에러:', error);
      setErrorMessage(`회원가입 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <RegisterCard>
        {/* 로고 영역 */}
        <Logo>아이템 관리</Logo>
        
        {/* 페이지 제목 */}
        <Title>쿠팡과 함께 비즈니스를 시작하세요!</Title>
        
        <Form>
            {/* 개인정보 입력 섹션 */}
            <FormSection>
              {/* 아이디 입력 필드 */}
              <Input
                type="text"
                name="username"
                placeholder="아이디"
                value={formData.username}
                onChange={handleInputChange}
              />
              
              {/* 비밀번호 입력 필드 - PasswordContainer 제거하여 크기 통일 */}
              <Input
                type="password"
                name="password"
                placeholder="비밀번호 (4자 이상)"
                value={formData.password}
                onChange={handleInputChange}
              />
              
              {/* 비밀번호 확인 입력 필드 */}
              <Input
                type="password"
                name="confirmPassword"
                placeholder="비밀번호 확인"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
              
              {/* 이름 입력 필드 */}
              <Input
                type="text"
                name="name"
                placeholder="이름"
                value={formData.name}
                onChange={handleInputChange}
              />
              
              {/* 이메일 입력 필드 */}
              <Input
                type="email"
                name="email"
                placeholder="이메일"
                value={formData.email}
                onChange={handleInputChange}
              />
              
              {/* 휴대폰 번호 입력 및 인증 버튼 */}
              <PhoneContainer>
                <Input
                  type="tel"
                  name="phone"
                  placeholder="휴대폰번호('-'제외)"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
                {/* 휴대폰 인증번호 발송 버튼 */}
                <VerifyButton>인증번호</VerifyButton>
              </PhoneContainer>

              {/* 에러 메시지 표시 */}
              {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}

              {/* 회원가입 버튼 */}
              <RegisterButton 
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? '회원가입 중...' : '회원가입'}
              </RegisterButton>
            </FormSection>
            
            {/* 약관 동의 섹션 */}
            <AgreementSection>
              {/* 전체 동의 체크박스 */}
              <AgreementItem>
                <Checkbox
                  type="checkbox"
                  checked={agreements.all}
                  onChange={() => handleAgreementChange('all')}
                />
                <AgreementText strong>모두 동의합니다</AgreementText>
              </AgreementItem>
              
              {/* 전체 동의에 대한 설명 텍스트 */}
              <AgreementDescription>
                모든 동의는 필수 및 선택 목적에 동의하는 것과 동일하며, 개별 동의에 따라 동의를 할 수도 있습니다.
              </AgreementDescription>
              
              {/* 개별 약관 동의 목록 */}
              <AgreementList>
                {/* 만 19세 이상 확인 (필수) */}
                <AgreementItem>
                  <Checkbox
                    type="checkbox"
                    checked={agreements.age}
                    onChange={() => handleAgreementChange('age')}
                  />
                  <AgreementText>[필수] 만 19세 이상입니다</AgreementText>
                </AgreementItem>
                
                {/* 서비스 이용약관 동의 (필수) */}
                <AgreementItem>
                  <Checkbox
                    type="checkbox"
                    checked={agreements.terms}
                    onChange={() => handleAgreementChange('terms')}
                  />
                  <AgreementText>[필수] 쿠팡 서비스 이용약관</AgreementText>
                  <ArrowIcon>›</ArrowIcon> {/* 약관 상세보기 화살표 */}
                </AgreementItem>
                
                {/* 전자금융거래 이용약관 동의 (필수) */}
                <AgreementItem>
                  <Checkbox
                    type="checkbox"
                    checked={agreements.privacy}
                    onChange={() => handleAgreementChange('privacy')}
                  />
                  <AgreementText>[필수] 쿠팡페이(주) 전자금융거래 이용약관</AgreementText>
                  <ArrowIcon>›</ArrowIcon> {/* 약관 상세보기 화살표 */}
                </AgreementItem>
                
                {/* 마케팅 정보 수신 동의 (선택) */}
                <AgreementItem>
                  <Checkbox
                    type="checkbox"
                    checked={agreements.marketing}
                    onChange={() => handleAgreementChange('marketing')}
                  />
                  <AgreementText>[선택] 마케팅 정보 수신 동의</AgreementText>
                  <ArrowIcon>›</ArrowIcon> {/* 약관 상세보기 화살표 */}
                </AgreementItem>
              </AgreementList>
            </AgreementSection>
        </Form>
      </RegisterCard>
    </Container>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 전체 컨테이너 - 페이지 전체를 감싸는 최상위 컨테이너
 * - 로그인 페이지와 동일한 스타일
 * - 전체 화면 높이 설정
 * - 오프화이트 배경색
 * - 중앙 정렬을 위한 flexbox 설정
 */
const Container = styled.div`
  min-height: 100vh;
  background: #FAFAFA;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

/**
 * 회원가입 카드 - 회원가입 폼을 감싸는 흰색 카드
 * - 로그인 페이지와 동일한 스타일로 통일
 * - 둥근 모서리와 그림자 효과
 * - 최대 너비를 더 크게 설정 (600px)
 */
const RegisterCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 48px 40px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
  border: 1px solid #F0F0F0;
`;

/**
 * 로고 스타일 - '아이템 관리' 텍스트
 * - 로그인 페이지와 동일한 스타일
 */
const Logo = styled.h1`
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 32px;
  color: #2D3748;
  letter-spacing: -0.5px;
`;

/**
 * 페이지 제목 스타일 - 메인 헤딩
 * - 로그인 페이지의 Title과 동일한 스타일
 */
const Title = styled.h2`
  font-size: 18px;
  color: #4A5568;
  margin-bottom: 40px;
  font-weight: 500;
`;

/**
 * 폼 컨테이너 - 입력 필드들을 세로로 배치
 * - 로그인 페이지와 동일한 스타일
 */
const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/**
 * 폼 섹션 - 개인정보 입력 필드들을 감싸는 영역
 * - 입력 필드들을 세로로 배치
 * - 약관 동의 섹션과 구분
 */
const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
`;

/**
 * 입력 필드 공통 스타일 - 모든 텍스트 입력란에 적용
 * - 포커스 시 테두리 색상 변경 및 그림자 효과
 * - 부드러운 전환 애니메이션
 * ⭐ 폼 크기 설정 위치: 여기서 모든 입력 필드의 크기가 결정됩니다!
 */
const Input = styled.input`
  padding: 16px;           /* 📏 상하좌우 패딩 - 입력 필드 내부 여백 */
  border: 1px solid #E2E8F0;
  border-radius: 8px;      /* 📐 모서리 둥글기 */
  font-size: 14px;         /* 📝 글자 크기 */
  width: 100%;             /* 📐 너비 - 부모 컨테이너의 100% */
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
 * 휴대폰 입력 컨테이너 - 휴대폰 번호 입력과 인증 버튼을 가로로 배치
 * - 입력 필드는 확장, 버튼은 고정 크기
 */
const PhoneContainer = styled.div`
  display: flex;
  gap: 12px;
  
  input {
    flex: 1;    /* 📐 입력 필드가 남는 공간을 모두 차지 */
  }
`;

/**
 * 인증 버튼 스타일 - 휴대폰 인증번호 발송 버튼
 * - 회색 배경의 보조 버튼
 * - 텍스트 줄바꿈 방지
 */
const VerifyButton = styled.button`
  padding: 16px 20px;
  background: #E2E8F0;
  color: #4A5568;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  
  &:hover {
    background: #CBD5E0;
  }
`;

/**
 * 에러 메시지 스타일 - 유효성 검사 실패 시 표시
 * - 빨간색 텍스트로 사용자 주의 환기
 */
const ErrorMessage = styled.div`
  color: #E53E3E;
  font-size: 14px;
  text-align: center;
  padding: 12px;
  background: #FED7D7;
  border-radius: 8px;
  border: 1px solid #FEB2B2;
`;

/**
 * 회원가입 버튼 스타일 - 메인 액션 버튼
 * - 어두운 배경색과 흰색 텍스트
 * - 로딩 상태일 때 비활성화
 * - 호버 효과 및 애니메이션
 */
const RegisterButton = styled.button<{ disabled?: boolean }>`
  background: ${props => props.disabled ? '#A0AEC0' : '#2D3748'};
  color: white;
  border: none;
  padding: 18px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  margin-top: 16px;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.disabled ? '#A0AEC0' : '#1A202C'};
    transform: ${props => props.disabled ? 'none' : 'translateY(-1px)'};
  }
  
  &:active {
    transform: ${props => props.disabled ? 'none' : 'translateY(0)'};
  }
`;

/**
 * 약관 동의 섹션 - 약관 동의 관련 UI들을 감싸는 영역
 * - 상단에 구분선 추가
 * - 개인정보 입력 섹션과 시각적으로 구분
 */
const AgreementSection = styled.div`
  border-top: 1px solid #E2E8F0;
  padding-top: 24px;
`;

/**
 * 약관 동의 항목 - 각각의 체크박스와 텍스트를 감싸는 컨테이너
 * - 체크박스, 텍스트, 화살표를 가로로 배치
 */
const AgreementItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  position: relative;
`;

/**
 * 체크박스 스타일 - 약관 동의 체크박스
 * - 적절한 크기 설정
 * - 커서 포인터 효과
 */
const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

/**
 * 약관 텍스트 스타일 - 약관 제목 텍스트
 * - 강조 표시가 필요한 경우 굵은 글씨
 * - 나머지 공간을 모두 차지하도록 flex 설정
 */
const AgreementText = styled.span<{ strong?: boolean }>`
  font-size: 14px;
  color: ${props => props.strong ? '#2D3748' : '#4A5568'};
  font-weight: ${props => props.strong ? '600' : '400'};
  flex: 1;
`;

/**
 * 약관 설명 텍스트 - '모두 동의' 아래의 상세 설명
 * - 작은 폰트 크기와 회색 텍스트
 * - 체크박스 너비만큼 왼쪽 마진 추가
 */
const AgreementDescription = styled.p`
  font-size: 12px;
  color: #718096;
  margin: 8px 0 16px 30px;
  line-height: 1.4;
`;

/**
 * 약관 목록 컨테이너 - 개별 약관 항목들을 세로로 배치
 */
const AgreementList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

/**
 * 화살표 아이콘 스타일 - 약관 상세보기 화살표
 * - 호버 시 색상 변경
 * - 클릭 가능한 포인터 커서
 */
const ArrowIcon = styled.span`
  font-size: 16px;
  color: #A0AEC0;
  cursor: pointer;
  
  &:hover {
    color: #718096;
  }
`;

export default RegisterPage; 