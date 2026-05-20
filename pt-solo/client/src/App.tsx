import { Switch, Route, Redirect, useRoute, useLocation } from "wouter";
import { Component, type ReactNode } from "react";
import { trpc } from "./lib/trpc";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import MemberForm from "./pages/MemberForm";
import MemberDetail from "./pages/MemberDetail";
import ParQ from "./pages/ParQ";
import AttendancePage from "./pages/AttendancePage";
import AttendanceCheck from "./pages/AttendanceCheck";
import MemberReport from "./pages/MemberReport";
import PT from "./pages/PT";
import Profile from "./pages/Profile";
import TrainerSettlement from "./pages/TrainerSettlement";
import ContractPrint from "./pages/ContractPrint";
import AdminTrainers from "./pages/AdminTrainers";
import AdminTrainerDetail from "./pages/AdminTrainerDetail";
import AdminNotices from "./pages/AdminNotices";
import AdminFitStepPlus from "./pages/AdminFitStepPlus";
import AdminPoints from "./pages/AdminPoints";
import AdminRegistrations from "./pages/AdminRegistrations";
import Leads from "./pages/Leads";
import Workshop from "./pages/Workshop";
import Layout from "./components/Layout";
import FitStepPlusLogin from "./pages/fit-step-plus/FitStepPlusLogin";
import FitStepPlusLayout from "./pages/fit-step-plus/FitStepPlusLayout";
import FitStepPlusDashboard from "./pages/fit-step-plus/FitStepPlusDashboard";
import FitStepPlusVideos from "./pages/fit-step-plus/FitStepPlusVideos";
import FitStepPlusVideoPlayer from "./pages/fit-step-plus/FitStepPlusVideoPlayer";
import FitStepPlusEvents from "./pages/fit-step-plus/FitStepPlusEvents";
import FitStepPlusEventDetail from "./pages/fit-step-plus/FitStepPlusEventDetail";
import FitStepPlusWorkout from "./pages/fit-step-plus/FitStepPlusWorkout";
import FitStepPlusMembership from "./pages/fit-step-plus/FitStepPlusMembership";
import FitStepPlusProfile from "./pages/fit-step-plus/FitStepPlusProfile";

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

// FIT STEP+ 회원앱 (트레이너별 독립 공간)
function FitStepPlusApp({ trainerId }: { trainerId: number }) {
  const [location] = useLocation();
  const { data: gymMember, isLoading: memberLoading } = trpc.fitStepPlus.memberMe.useQuery();
  const { data: adminUser, isLoading: adminLoading } = trpc.auth.me.useQuery();

  if (memberLoading || adminLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-sm">로딩 중...</p></div>;

  const isAdmin = adminUser?.role === "admin";
  const loginPath = `/fit-step-plus/${trainerId}/login`;

  if (!isAdmin) {
    if (location === loginPath || !gymMember) {
      return <FitStepPlusLogin trainerId={trainerId} />;
    }
    if (gymMember.trainerId !== trainerId) {
      return <FitStepPlusLogin trainerId={trainerId} />;
    }
  }

  return (
    <FitStepPlusLayout trainerId={trainerId}>
      <ErrorBoundary>
        <Switch>
          <Route path={`/fit-step-plus/${trainerId}`}>{() => <FitStepPlusDashboard trainerId={trainerId} />}</Route>
          <Route path={`/fit-step-plus/${trainerId}/videos`}>{() => <FitStepPlusVideos trainerId={trainerId} />}</Route>
          <Route path={`/fit-step-plus/${trainerId}/videos/:id`}>
            {(params) => <FitStepPlusVideoPlayer videoId={parseInt(params.id!)} trainerId={trainerId} />}
          </Route>
          <Route path={`/fit-step-plus/${trainerId}/events`}>{() => <FitStepPlusEvents trainerId={trainerId} />}</Route>
          <Route path={`/fit-step-plus/${trainerId}/events/:id`}>
            {(params) => <FitStepPlusEventDetail eventId={parseInt(params.id!)} trainerId={trainerId} />}
          </Route>
          <Route path={`/fit-step-plus/${trainerId}/workout`}>{() => <FitStepPlusWorkout />}</Route>
          <Route path={`/fit-step-plus/${trainerId}/membership`}>{() => <FitStepPlusMembership />}</Route>
          <Route path={`/fit-step-plus/${trainerId}/profile`}>{() => <FitStepPlusProfile />}</Route>
          <Route>{() => <Redirect to={`/fit-step-plus/${trainerId}`} />}</Route>
        </Switch>
      </ErrorBoundary>
    </FitStepPlusLayout>
  );
}

function App() {
  const [reportMatch, reportParams] = useRoute("/report/:token");
  const [fitStepMatch, fitStepParams] = useRoute("/fit-step-plus/:trainerId/:rest*");
  const [fitStepRootMatch, fitStepRootParams] = useRoute("/fit-step-plus/:trainerId");
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  if (reportMatch && reportParams) {
    return <MemberReport token={reportParams.token} />;
  }

  if (window.location.pathname === "/contract-print") {
    return <ContractPrint />;
  }

  // FIT STEP+ 회원앱 라우트 (트레이너 로그인 불필요)
  const fspTrainerId = fitStepParams?.trainerId ?? fitStepRootParams?.trainerId;
  if ((fitStepMatch || fitStepRootMatch) && fspTrainerId) {
    const tid = parseInt(fspTrainerId);
    if (!isNaN(tid)) return <FitStepPlusApp trainerId={tid} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1a00ff" }}>
        <svg viewBox="0 0 440 180" className="w-72" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* 외곽 평행사변형 */}
          <polygon points="36,8 428,8 404,172 12,172" stroke="white" strokeWidth="10" fill="none" />
          {/* 내곽 평행사변형 */}
          <polygon points="50,24 414,24 390,156 26,156" stroke="white" strokeWidth="5" fill="none" />
          {/* F. */}
          <text x="54" y="138" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="110" fill="white" fontStyle="italic">F.</text>
          {/* 삼각형 */}
          <polygon points="200,32 280,148 120,148" fill="white" />
          {/* E */}
          <text x="292" y="138" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="110" fill="white" fontStyle="italic">E</text>
        </svg>
      </div>
    );
  }

  if (!user) {
    if (window.location.pathname === "/register") return <Register />;
    if (window.location.pathname === "/login") return <Login />;
    return <Login />;
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Switch>
          <Route path="/">{() => <Dashboard />}</Route>
          <Route path="/members">{() => <Redirect to="/pt" />}</Route>
          <Route path="/members/new">{() => <MemberForm />}</Route>
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
          <Route path="/leads">{() => <Leads />}</Route>
          <Route path="/profile">{() => <Profile />}</Route>
          <Route path="/settlement">{() => <TrainerSettlement />}</Route>
          <Route path="/workshop">{() => <Workshop />}</Route>
          <Route path="/points">{() => <Redirect to="/profile" />}</Route>
          <Route path="/admin/trainers/:id">
            {(params) => <AdminTrainerDetail trainerId={parseInt(params.id!)} />}
          </Route>
          <Route path="/admin/registrations">{() => <AdminRegistrations />}</Route>
          <Route path="/admin/trainers">{() => <AdminTrainers />}</Route>
          <Route path="/admin/points">{() => <AdminPoints />}</Route>
          <Route path="/admin/notices">{() => <AdminNotices />}</Route>
          <Route path="/admin/fit-step-plus">{() => <AdminFitStepPlus />}</Route>
          <Route>{() => <Redirect to="/" />}</Route>
        </Switch>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
