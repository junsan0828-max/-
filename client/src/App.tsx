import { Switch, Route, Redirect, useRoute } from "wouter";
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
import Layout from "./components/Layout";

function App() {
  const [reportMatch, reportParams] = useRoute("/report/:token");
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  // 공개 보고서 페이지 - 인증 불필요
  if (reportMatch && reportParams) {
    return <MemberReport token={reportParams.token} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="ZiantGym" className="w-48 h-auto" />
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
        <Route path="/">{() => <Dashboard />}</Route>
        <Route path="/members">{() => <Members />}</Route>
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
