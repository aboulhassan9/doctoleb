import { Loader2 } from 'lucide-react'
import { useControlPlaneSession } from './hooks/useControlPlaneSession'
import MissingEnvScreen from './components/MissingEnvScreen'
import LoginScreen from './components/LoginScreen'
import ConsoleScreen from './components/ConsoleScreen'

function App() {
  const { envStatus, session, booting, setSession, signOut } = useControlPlaneSession()

  if (!envStatus.hasUrl || !envStatus.hasAnonKey) return <MissingEnvScreen />
  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950">
        <span className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
          Opening console
        </span>
      </main>
    )
  }
  if (!session) return <LoginScreen onSignedIn={setSession} />
  return <ConsoleScreen session={session} onSignOut={signOut} />
}

export default App
