import { useControlPlaneSession } from './hooks/useControlPlaneSession'
import MissingEnvScreen from './components/MissingEnvScreen'
import LoginScreen from './components/LoginScreen'
import ConsoleScreen from './components/ConsoleScreen'

function App() {
  const { envStatus, session, booting, setSession, signOut } = useControlPlaneSession()

  if (!envStatus.hasUrl || !envStatus.hasAnonKey) return <MissingEnvScreen />
  if (booting) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Opening console...</main>
  if (!session) return <LoginScreen onSignedIn={setSession} />
  return <ConsoleScreen session={session} onSignOut={signOut} />
}

export default App
