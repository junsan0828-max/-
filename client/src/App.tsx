import { Switch, Route, Redirect, useRoute, useLocation } from "wouter";
import { Component, type ReactNode } from "react";
import { trpc } from "./lib/trpc";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-red-400 font-semibold">오류가 발생했습니다</p>
          <p className="text-sm text-muted-foreground">{(this.state.error as Error).message}</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => { this.setState({ error: null }); window.history.back(); }}
          >
            뒤로가기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import GymDashboard from "./pages/GymDashboard";
import Members from "./pages/Members";
import MemberForm from "./pages/MemberForm";
import MemberDetail from "./pages/MemberDetail";
import TrainerDetail from "./pages/TrainerDetail";
import ParQ from "./pages/ParQ";
import AttendancePage from "./pages/AttendancePage";
import AttendanceCheck from "./pages/AttendanceCheck";
import MemberReport from "./pages/MemberReport";
import Trainers from "./pages/Trainers";
import Admin from "./pages/Admin";
import PT from "./pages/PT";
import Profile from "./pages/Profile";
import SettlementReport from "./pages/SettlementReport";
import TrainerSettlement from "./pages/TrainerSettlement";
import LeadsPage from "./pages/Leads";
import ContractPrint from "./pages/ContractPrint";
import MyWorkPage from "./pages/MyWork";
import RevenuePage from "./pages/Revenue";
import ExpensesPage from "./pages/Expenses";
import MarketingPage from "./pages/Marketing";
import AiAnalysisPage from "./pages/AiAnalysis";
import AdminMembers from "./pages/AdminMembers";
import AccessManagement from "./pages/AccessManagement";
import KioskCheckin from "./pages/KioskCheckin";
import TransferPage from "./pages/TransferPage";
import RefundContractPage from "./pages/RefundContractPage";
import TrainingManual, { TrainingManualWrite, TrainingManualDetail } from "./pages/TrainingManual";
import MemberReRegister from "./pages/MemberReRegister";
import WorkManagementPage from "./pages/WorkManagement";
import RegistrationManagement from "./pages/RegistrationManagement";
import TeamManagementPage from "./pages/TeamManagement";
import LandingPageAdmin from "./pages/LandingPageAdmin";
import DataManagementPage from "./pages/DataManagement";
import ConsultantDataRecordPage from "./pages/ConsultantDataRecord";
import Layout from "./components/Layout";
import GymPlusLogin from "./pages/gym-plus/GymPlusLogin";
import GymPlusLayout from "./pages/gym-plus/GymPlusLayout";
import GymPlusDashboard from "./pages/gym-plus/GymPlusDashboard";
import GymPlusVideos from "./pages/gym-plus/GymPlusVideos";
import GymPlusVideoPlayer from "./pages/gym-plus/GymPlusVideoPlayer";
import GymPlusEvents from "./pages/gym-plus/GymPlusEvents";
import GymPlusEventDetail from "./pages/gym-plus/GymPlusEventDetail";
import GymPlusWorkout from "./pages/gym-plus/GymPlusWorkout";
import GymPlusMembership from "./pages/gym-plus/GymPlusMembership";
import GymPlusProfile from "./pages/gym-plus/GymPlusProfile";
import GymPlusAdminPage from "./pages/GymPlusAdminPage";
import GymPlusMessages from "./pages/gym-plus/GymPlusMessages";
import Landing from "./pages/Landing";

// ZIANTGYM+ 회원앱 (통합관리 시스템과 완전 분리)
function GymPlusApp() {
  const [location] = useLocation();
  const { data: gymMember, isLoading } = trpc.gymPlus.memberMe.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">로딩 중...</p>
      </div>
    );
  }

  if (location === "/gym-plus/login" || !gymMember) {
    return <GymPlusLogin />;
  }

  return (
    <GymPlusLayout>
      <ErrorBoundary>
        <Switch>
          <Route path="/gym-plus">{() => <GymPlusDashboard />}</Route>
          <Route path="/gym-plus/videos">{() => <GymPlusVideos />}</Route>
          <Route path="/gym-plus/videos/:id">
            {(params) => <GymPlusVideoPlayer videoId={parseInt(params.id!)} />}
          </Route>
          <Route path="/gym-plus/events">{() => <GymPlusEvents />}</Route>
          <Route path="/gym-plus/events/:id">
            {(params) => <GymPlusEventDetail eventId={parseInt(params.id!)} />}
          </Route>
          <Route path="/gym-plus/workout">{() => <GymPlusWorkout />}</Route>
          <Route path="/gym-plus/membership">{() => <GymPlusMembership />}</Route>
          <Route path="/gym-plus/profile">{() => <GymPlusProfile />}</Route>
          <Route path="/gym-plus/messages">{() => <GymPlusMessages />}</Route>
          <Route>{() => <Redirect to="/gym-plus" />}</Route>
        </Switch>
      </ErrorBoundary>
    </GymPlusLayout>
  );
}

function App() {
  const [reportMatch, reportParams] = useRoute("/report/:token");
  const [location] = useLocation();
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  // ZIANTGYM+ 회원앱 (Layout 밖에서 독립 렌더)
  if (location.startsWith("/gym-plus")) {
    return <GymPlusApp />;
  }

  // ZIANTGYM+ 어드민 (Layout 밖에서 독립 렌더)
  if (location === "/admin/gymplus") {
    return <GymPlusAdminPage />;
  }

  // 공개 보고서 / 계약서 페이지 - 인증 불필요
  if (reportMatch && reportParams) {
    return <MemberReport token={reportParams.token} />;
  }
  if (window.location.pathname === "/contract-print") {
    return <ContractPrint />;
  }
  if (window.location.pathname === "/kiosk") {
    return <KioskCheckin />;
  }
  const transferMatch = window.location.pathname.match(/^\/transfer\/([^/]+)$/);
  if (transferMatch) {
    return <TransferPage token={transferMatch[1]} />;
  }
  const refundMatch = window.location.pathname.match(/^\/refund\/([^/]+)$/);
  if (refundMatch) {
    return <RefundContractPage token={refundMatch[1]} />;
  }

  // ziantgym.com 도메인은 항상 랜딩페이지
  const hostname = window.location.hostname;
  if (hostname === "ziantgym.com" || hostname === "www.ziantgym.com") {
    return <Landing />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    );
  }

  // /landing 경로 직접 접근
  if (location === "/landing") {
    return <Landing />;
  }

  if (!user) {
    if (window.location.pathname === "/register") return <Register />;
    return <Login />;
  }

  return (
    <Layout>
      <ErrorBoundary>
      <Switch>
        <Route path="/landing">{() => <Landing />}</Route>
        <Route path="/">{() => (user?.role === "admin" || user?.role === "sub_admin") ? <GymDashboard /> : user?.role === "consultant" ? <LeadsPage /> : <Dashboard />}</Route>
        <Route path="/gym-dashboard">{() => <GymDashboard />}</Route>
        <Route path="/my-work">{() => <MyWorkPage />}</Route>
        <Route path="/leads">{() => <LeadsPage />}</Route>
        <Route path="/revenue">{() => <RevenuePage />}</Route>
        <Route path="/expenses">{() => <ExpensesPage />}</Route>
        <Route path="/marketing">{() => <MarketingPage />}</Route>
        <Route path="/ai-analysis">{() => <AiAnalysisPage />}</Route>
        <Route path="/members">{() => (user?.role === "admin" || user?.role === "sub_admin") ? <AdminMembers /> : <Members />}</Route>
        <Route path="/members/new">{() => <MemberForm />}</Route>
        <Route path="/members/re-register">{() => <MemberReRegister />}</Route>
        <Route path="/trainers/:id/members/new">
          {(params) => <MemberForm defaultTrainerId={parseInt(params.id!)} />}
        </Route>
        <Route path="/members/:id/edit">
          {(params) => <MemberForm memberId={parseInt(params.id!)} />}
        </Route>
        <Route path="/members/:id/parq">
          {(params) => <ParQ memberId={parseInt(params.id!)} />}
        </Route>
        <Route path="/members/:id">
          {(params) => <MemberDetail memberId={parseInt(params.id!)} />}
        </Route>
        <Route path="/attendance/:id">
          {(params) => <AttendanceCheck memberId={parseInt(params.id!)} />}
        </Route>
        <Route path="/attendance">{() => <AttendancePage />}</Route>
        <Route path="/pt">{() => <PT />}</Route>
        <Route path="/trainers">{() => <Trainers />}</Route>
        <Route path="/trainers/:id">
          {(params) => <TrainerDetail trainerId={parseInt(params.id!)} />}
        </Route>
        <Route path="/access">{() => <AccessManagement />}</Route>
        <Route path="/training-manual/new">{() => <TrainingManualWrite />}</Route>
        <Route path="/training-manual/:id/edit">{(params) => <TrainingManualWrite id={parseInt(params.id!)} />}</Route>
        <Route path="/training-manual/:id">{(params) => <TrainingManualDetail id={parseInt(params.id!)} />}</Route>
        <Route path="/training-manual">{() => <TrainingManual />}</Route>
        <Route path="/work-management">{() => <WorkManagementPage />}</Route>
        <Route path="/registration">{() => <RegistrationManagement />}</Route>
        <Route path="/team-management">{() => <TeamManagementPage />}</Route>
        <Route path="/landing-admin">{() => <LandingPageAdmin />}</Route>
        <Route path="/data-management">{() => <DataManagementPage />}</Route>
        <Route path="/consultant-records">{() => <ConsultantDataRecordPage />}</Route>
        <Route path="/admin">{() => (user?.role === "admin" || user?.role === "sub_admin") ? <Admin /> : <Redirect to="/" />}</Route>
        <Route path="/settlement">{() => <SettlementReport />}</Route>
        <Route path="/trainer-settlement">{() => <TrainerSettlement />}</Route>
        <Route path="/profile">{() => <Profile />}</Route>
        <Route>{() => <Redirect to="/" />}</Route>
      </Switch>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
