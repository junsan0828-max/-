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
import GymPlusDiet from "./pages/gym-plus/GymPlusDiet";
import GymPlusAdminPage from "./pages/GymPlusAdminPage";

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
          <Route path="/gym-plus/diet">{() => <GymPlusDiet />}</Route>
          <Route path="/gym-plus/profile">{() => <GymPlusProfile />}</Route>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    if (window.location.pathname === "/register") return <Register />;
    return <Login />;
  }

  return (
    <Layout>
      <ErrorBoundary>
      <Switch>
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
        <Route path="/attendance">{() => <AttendancePage />}</Route>
        <Route path="/attendance/:id">
          {(params) => <AttendanceCheck memberId={parseInt(params.id!)} />}
        </Route>
        <Route path="/pt">{() => <PT />}</Route>
        <Route path="/trainers">{() => <Trainers />}</Route>
        <Route path="/trainers/:id">
          {(params) => <TrainerDetail trainerId={parseInt(params.id!)} />}
        </Route>
        <Route path="/admin">{() => <Admin />}</Route>
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
