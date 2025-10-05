import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import UserProfilePage from '../features/auth/UserProfilePage';
import DashboardPage from '../features/dashboard/DashboardPage';
import ProductListPage from '../features/products/ProductListPage';
import ViewsPage from '../features/products/ViewsPage';
import ProductAdd from '../features/products/ProductAdd';
import ChinaOrderListPage from '../features/chinaorder/ChinaOrderListPage';
import StockManagement from '../features/stocks/StockManagement';
import StocksScan from '../features/stocks/StocksScan';
import OutboundPreparation from '../features/stocks/OutboundPreparation';
import ChinaorderCart from '../features/chinaorder/ChinaOrderCart';
import ChinaorderConfirm from '../features/chinaorder/ChinaorderConfirm';
import ChinaorderDelivery from '../features/chinaorder/ChinaorderDelivery';
import ChinaorderRecords from '../features/chinaorder/ChinaorderRecords';
import CoupangOrders from '../features/orders/CoupangOrders';
import SmartstoreOrders from '../features/orders/SmartstoreOrders';
import ReturnItems from '../features/service/ReturnItems';
import RocketgrowthShipment from '../features/service/RocketgrowthShipment';
import MainLayout from '../layouts/MainLayout';

/**
 * 로그인 상태 확인 함수
 * - localStorage에서 currentUser 정보를 확인
 * - 로그인 여부에 따라 true/false 반환
 */
const isAuthenticated = (): boolean => {
  const currentUser = localStorage.getItem('currentUser');
  return currentUser !== null;
};

/**
 * 보호된 라우트 컴포넌트
 * - 로그인이 필요한 페이지에 대한 접근 제어
 * - 로그인되지 않은 경우 로그인 페이지로 리다이렉트
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return isAuthenticated() ? (
    <MainLayout>{children}</MainLayout>
  ) : (
    <Navigate to="/login" replace />
  );
};

/**
 * 인증 라우트 컴포넌트
 * - 로그인/회원가입 페이지에 대한 접근 제어
 * - 이미 로그인된 경우 대시보드로 리다이렉트
 */
const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return isAuthenticated() ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <>{children}</>
  );
};

/**
 * 애플리케이션 라우터 컴포넌트
 * - React Router를 사용하여 애플리케이션의 모든 라우팅을 관리
 * - URL 경로에 따라 적절한 페이지 컴포넌트를 렌더링
 * - 인증 상태에 따른 라우팅 보호 기능 포함
 * - SPA(Single Page Application)의 네비게이션 역할
 */
const AppRouter: React.FC = () => {
  return (
    // React Router의 BrowserRouter로 전체 애플리케이션을 감싸기
    <Router>
      {/* 라우트 정의 영역 */}
      <Routes>
        {/* 루트 경로 - 로그인 상태에 따라 분기 */}
        <Route 
          path="/" 
          element={
            isAuthenticated() ? 
            <Navigate to="/dashboard" replace /> : 
            <Navigate to="/login" replace />
          } 
        />
        
        {/* 로그인 페이지 - 이미 로그인된 경우 대시보드로 이동 */}
        <Route 
          path="/login" 
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          } 
        />
        
        {/* 회원가입 페이지 - 이미 로그인된 경우 대시보드로 이동 */}
        <Route 
          path="/register" 
          element={
            <AuthRoute>
              <RegisterPage />
            </AuthRoute>
          } 
        />
        
        {/* 대시보드 페이지 - 로그인 필요 */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 상품 목록 페이지 - 로그인 필요 */}
        <Route 
          path="/products/list" 
          element={
            <ProtectedRoute>
              <ProductListPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 상품 등록 페이지 - 로그인 필요 */}
        <Route 
          path="/products/add" 
          element={
            <ProtectedRoute>
              <ProductAdd />
            </ProtectedRoute>
          } 
        />
        
        {/* 쿠팡 조회수 관리 페이지 - 로그인 필요 */}
        <Route 
          path="/products/views" 
          element={
            <ProtectedRoute>
              <ViewsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 중국 주문 목록 페이지 - 로그인 필요 */}
        <Route 
          path="/chinaorder/list" 
          element={
            <ProtectedRoute>
              <ChinaOrderListPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 중국 주문 요청 목록 페이지 - 로그인 필요 */}
        <Route 
          path="/chinaorder/chinaorder-cart" 
          element={
            <ProtectedRoute>
              <ChinaorderCart />
            </ProtectedRoute>
          } 
        />
        
        {/* 중국 주문 확정 페이지 - 로그인 필요 */}
        <Route 
          path="/chinaorder/chinaorder-confirm" 
          element={
            <ProtectedRoute>
              <ChinaorderConfirm />
            </ProtectedRoute>
          } 
        />
        
        {/* 중국 주문 출고중 페이지 - 로그인 필요 */}
        <Route 
          path="/chinaorder/chinaorder-delivery" 
          element={
            <ProtectedRoute>
              <ChinaorderDelivery />
            </ProtectedRoute>
          } 
        />
        
        {/* 중국 주문 과거 주문 페이지 - 로그인 필요 */}
        <Route 
          path="/chinaorder/chinaorder-records" 
          element={
            <ProtectedRoute>
              <ChinaorderRecords />
            </ProtectedRoute>
          } 
        />
        
        {/* 쿠팡 주문 관리 페이지 - 로그인 필요 */}
        <Route 
          path="/order-management/coupang" 
          element={
            <ProtectedRoute>
              <CoupangOrders />
            </ProtectedRoute>
          } 
        />
        
        {/* 스마트스토어 주문 관리 페이지 - 로그인 필요 */}
        <Route 
          path="/order-management/smartstore" 
          element={
            <ProtectedRoute>
              <SmartstoreOrders />
            </ProtectedRoute>
          } 
        />
        
        {/* 재고 관리 페이지 - 로그인 필요 */}
        <Route 
          path="/stocks/management" 
          element={
            <ProtectedRoute>
              <StockManagement />
            </ProtectedRoute>
          } 
        />
        
        {/* 재고 스캔 페이지 - 로그인 필요 */}
        <Route 
          path="/stocks/scan" 
          element={
            <ProtectedRoute>
              <StocksScan />
            </ProtectedRoute>
          } 
        />
        
        {/* 출고 준비 페이지 - 로그인 필요 */}
        <Route 
          path="/stocks/outbound-preparation" 
          element={
            <ProtectedRoute>
              <OutboundPreparation />
            </ProtectedRoute>
          } 
        />
        
        {/* 반출 관리 페이지 - 로그인 필요 */}
        <Route 
          path="/service/return-items" 
          element={
            <ProtectedRoute>
              <ReturnItems />
            </ProtectedRoute>
          } 
        />
        
        {/* 로켓그로스 입고 페이지 - 로그인 필요 */}
        <Route 
          path="/marketing/promotion" 
          element={
            <ProtectedRoute>
              <RocketgrowthShipment />
            </ProtectedRoute>
          } 
        />
        
        {/* 개인정보 수정 페이지 - 로그인 필요 */}
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          } 
        />
        
        {/* 잘못된 경로에 대한 폴백 - 로그인 상태에 따라 분기 */}
        <Route 
          path="*" 
          element={
            isAuthenticated() ? 
            <Navigate to="/dashboard" replace /> : 
            <Navigate to="/login" replace />
          } 
        />
      </Routes>
    </Router>
  );
};

export default AppRouter; 