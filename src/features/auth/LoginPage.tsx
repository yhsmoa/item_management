import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { loginUser, LoginData } from '../../services/authService';

/**
 * 로그인 페이지 컴포넌트
 * - 판매자가 로그인할 수 있는 메인 페이지
 * - 아이디/비밀번호 입력, 로그인, 회원가입 이동 기능 제공
 * - localStorage에서 사용자 데이터 확인하여 로그인 처리
 */
const LoginPage: React.FC = () => {
  // 페이지 이동을 위한 라우터 훅
  const navigate = useNavigate();
  
  // 사용자 입력 상태 관리
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // 로딩 상태 및 에러 메시지 관리
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * 입력 필드 변경 시 에러 메시지 초기화
   */
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      if (errorMessage) setErrorMessage('');
    };
  };

  /**
   * 로그인 버튼 클릭 핸들러
   * Supabase users 테이블에서 사용자 데이터를 확인하여 로그인 처리
   */
  const handleLogin = async () => {
    // 입력값 검증
    if (!username.trim()) {
      setErrorMessage('아이디를 입력해주세요.');
      return;
    }
    
    if (!password.trim()) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // 로그인 데이터 준비
      const loginData: LoginData = {
        id: username,
        password: password
      };

      console.log('🚀 로그인 시도:', { id: username });

      // authService를 통해 로그인 처리
      const result = await loginUser(loginData);

      if (result.success && result.user) {
        // 로그인 성공
        console.log('✅ 로그인 성공!');
        
        // 로그인한 사용자 정보를 localStorage에 저장 (세션 관리)
        localStorage.setItem('currentUser', JSON.stringify({
          id: result.user.id,
          user_id: result.user.id,    // user_id도 함께 저장
          name: result.user.name,
          email: result.user.email,
          contact_number: result.user.contact_number,
          loginTime: new Date().toISOString()
        }));
        
        console.log('💾 사용자 세션 정보 저장 완료');
        
        // 로딩 효과를 위한 1초 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 대시보드 페이지로 이동
        window.location.href = '/dashboard';
        
      } else {
        // 로그인 실패
        setErrorMessage(result.error || '아이디 및 패스워드를 확인해주세요.');
      }
      
    } catch (error: any) {
      console.error('❌ 로그인 에러:', error);
      setErrorMessage('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 회원가입 버튼 클릭 핸들러
   * React Router를 사용하여 회원가입 페이지로 이동
   */
  const handleSignup = () => {
    navigate('/register');
  };

  return (
    <Container>
      <LoginCard>
        {/* 로고 영역 - '아이템 관리' 텍스트 */}
        <Logo>아이템 관리</Logo>
        
        {/* 페이지 제목 */}
        <Title>판매자 로그인</Title>
        
        <Form>
          {/* 아이디 입력 필드 */}
          <Input
            type="text"
            value={username}
            onChange={handleInputChange(setUsername)}
            placeholder="아이디"
          />
          
          {/* 비밀번호 입력 필드 */}
          <Input
            type="password"
            value={password}
            onChange={handleInputChange(setPassword)}
            placeholder="비밀번호"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
          />
          
          {/* 에러 메시지 표시 */}
          {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
          
          {/* 로그인 실행 버튼 */}
          <LoginButton 
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </LoginButton>
          
          {/* 아이디/비밀번호 찾기 링크 영역 */}
          <LinkContainer>
            <Link href="#">아이디 찾기</Link>
            <Separator>|</Separator>
            <Link href="#">비밀번호 찾기</Link>
          </LinkContainer>
          
          {/* 회원가입 페이지로 이동하는 버튼 */}
          <SignupButton onClick={handleSignup}>
            판매자 회원가입
          </SignupButton>
          
          {/* 하단 정보 영역 - 지원센터 및 언어 선택 */}
          <CenterInfo>
            <CenterTitle>판매자 지원 센터</CenterTitle>
            <CenterSubtitle>판매자가 궁금한 것 체험해보세요</CenterSubtitle>
            
            {/* 언어 선택 드롭다운 (현재는 UI만 구현) */}
            <LanguageSelector>
              <LanguageIcon>🌐</LanguageIcon>
              <span>한국어</span>
              <DropdownIcon>▼</DropdownIcon>
            </LanguageSelector>
          </CenterInfo>
        </Form>
      </LoginCard>
    </Container>
  );
};

/* ===================== 스타일드 컴포넌트 영역 ===================== */

/**
 * 전체 컨테이너 - 페이지 전체를 감싸는 최상위 컨테이너
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
 * 로그인 카드 - 로그인 폼을 감싸는 흰색 카드
 * - 둥근 모서리와 그림자 효과
 * - 반응형 너비 설정
 */
const LoginCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 48px 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
  border: 1px solid #F0F0F0;
`;

/**
 * 로고 스타일 - 페이지 상단의 '아이템 관리' 로고
 * - 굵은 폰트와 적절한 간격
 */
const Logo = styled.h1`
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 32px;
  color: #2D3748;
  letter-spacing: -0.5px;
`;

/**
 * 제목 스타일 - '판매자 로그인' 텍스트
 */
const Title = styled.h2`
  font-size: 18px;
  color: #4A5568;
  margin-bottom: 40px;
  font-weight: 500;
`;

/**
 * 폼 컨테이너 - 입력 필드들을 세로로 배치
 */
const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/**
 * 입력 필드 공통 스타일 - 아이디, 비밀번호 입력란
 * - 포커스 시 색상 변경 및 그림자 효과
 * - 부드러운 전환 애니메이션
 */
const Input = styled.input`
  padding: 18px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  font-size: 16px;
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
 * 에러 메시지 스타일 - 로그인 실패 시 표시
 * - 빨간색 텍스트로 사용자 주의 환기
 * - 패스워드 입력란과 로그인 버튼 사이에 위치
 */
const ErrorMessage = styled.div`
  color: #E53E3E;
  font-size: 14px;
  text-align: center;
  padding: 12px 16px;
  background: #FED7D7;
  border-radius: 8px;
  margin: 8px 0;
  border: 1px solid #FEB2B2;
`;

/**
 * 로그인 버튼 스타일 - 메인 액션 버튼
 * - 어두운 배경색과 흰색 텍스트
 * - 호버 시 색상 변경 및 위로 올라가는 효과
 * - 로딩 상태일 때 비활성화
 */
const LoginButton = styled.button<{ disabled?: boolean }>`
  background: ${props => props.disabled ? '#A0AEC0' : '#2D3748'};
  color: white;
  border: none;
  padding: 18px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  margin-top: 8px;
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
 * 링크 컨테이너 - 아이디/비밀번호 찾기 링크들을 가로로 배치
 */
const LinkContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin: 8px 0 24px 0;
`;

/**
 * 링크 스타일 - 아이디 찾기, 비밀번호 찾기 링크
 * - 호버 시 색상 변경 및 밑줄 효과
 */
const Link = styled.a`
  color: #718096;
  text-decoration: none;
  font-size: 14px;
  
  &:hover {
    color: #2D3748;
    text-decoration: underline;
  }
`;

/**
 * 구분자 스타일 - 링크 사이의 '|' 문자
 */
const Separator = styled.span`
  color: #CBD5E0;
  font-size: 14px;
`;

/**
 * 회원가입 버튼 스타일 - 보조 액션 버튼
 * - 흰색 배경에 테두리
 * - 호버 시 배경색 변경 및 위로 올라가는 효과
 */
const SignupButton = styled.button`
  background: white;
  color: #4A5568;
  border: 1px solid #E2E8F0;
  padding: 18px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #F7FAFC;
    border-color: #CBD5E0;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

/**
 * 센터 정보 영역 - 하단의 지원센터 및 언어 선택 영역
 * - 상단에 구분선 추가
 */
const CenterInfo = styled.div`
  margin-top: 40px;
  padding-top: 32px;
  border-top: 1px solid #E2E8F0;
`;

/**
 * 센터 제목 스타일 - '판매자 지원 센터' 텍스트
 */
const CenterTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #2D3748;
  margin-bottom: 6px;
`;

/**
 * 센터 부제목 스타일 - 설명 텍스트
 */
const CenterSubtitle = styled.div`
  font-size: 13px;
  color: #718096;
  margin-bottom: 20px;
`;

/**
 * 언어 선택기 스타일 - 하단의 언어 드롭다운 UI
 * - 호버 시 배경색 변경
 */
const LanguageSelector = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #4A5568;
  margin: 0 auto;
  width: fit-content;
  background: white;
  transition: all 0.2s;
  
  &:hover {
    border-color: #CBD5E0;
    background: #F7FAFC;
  }
`;

/**
 * 언어 아이콘 스타일 - 지구본 이모지
 */
const LanguageIcon = styled.span`
  font-size: 16px;
`;

/**
 * 드롭다운 아이콘 스타일 - 화살표 아이콘
 */
const DropdownIcon = styled.span`
  font-size: 10px;
  color: #A0AEC0;
`;

export default LoginPage; 