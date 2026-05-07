import { Switch, Route, Redirect, useRoute } from "wouter";
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
import TrainingLog from "./pages/TrainingLog";
import Leads from "./pages/Leads";
import Layout from "./components/Layout";

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

function App() {
  const [reportMatch, reportParams] = useRoute("/report/:token");
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  if (reportMatch && reportParams) {
    return <MemberReport token={reportParams.token} />;
  }

  if (window.location.pathname === "/contract-print") {
    return <ContractPrint />;
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
          <Route path="/members">{() => <Members />}</Route>
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
          <Route path="/training-log">{() => <TrainingLog />}</Route>
          <Route path="/leads">{() => <Leads />}</Route>
          <Route path="/profile">{() => <Profile />}</Route>
          <Route path="/settlement">{() => <TrainerSettlement />}</Route>
          <Route path="/admin/trainers/:id">
            {(params) => <AdminTrainerDetail trainerId={parseInt(params.id!)} />}
          </Route>
          <Route path="/admin/trainers">{() => <AdminTrainers />}</Route>
          <Route path="/admin/notices">{() => <AdminNotices />}</Route>
          <Route>{() => <Redirect to="/" />}</Route>
        </Switch>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
