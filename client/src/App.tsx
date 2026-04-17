import { Switch, Route, Redirect } from "wouter";
import { trpc } from "./lib/trpc";
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
import Trainers from "./pages/Trainers";
import Admin from "./pages/Admin";
import PT from "./pages/PT";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";

function App() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    if (window.location.pathname === "/register") return <Register />;
    return <Login />;
  }

  return (
    <Layout>
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
        <Route path="/profile">{() => <Profile />}</Route>
        <Route>{() => <Redirect to="/" />}</Route>
      </Switch>
    </Layout>
  );
}

export default App;
