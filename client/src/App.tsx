import { Switch, Route, Redirect } from "wouter";
import { trpc } from "./lib/trpc";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import MemberForm from "./pages/MemberForm";
import MemberDetail from "./pages/MemberDetail";
import TrainerDetail from "./pages/TrainerDetail";
import Trainers from "./pages/Trainers";
import Admin from "./pages/Admin";
import PT from "./pages/PT";
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
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/members" component={Members} />
        <Route path="/members/new" component={MemberForm} />
        <Route path="/members/:id/edit">
          {(params) => <MemberForm memberId={parseInt(params.id)} />}
        </Route>
        <Route path="/members/:id">
          {(params) => <MemberDetail memberId={parseInt(params.id)} />}
        </Route>
        <Route path="/pt" component={PT} />
        <Route path="/trainers" component={Trainers} />
        <Route path="/trainers/:id">
          {(params) => <TrainerDetail trainerId={parseInt(params.id)} />}
        </Route>
        <Route path="/admin" component={Admin} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Layout>
  );
}

export default App;
