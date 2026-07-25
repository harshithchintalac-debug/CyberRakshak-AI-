import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CursorFollower from './CursorFollower'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full fade-in">
        <Outlet />
      </main>
      <CursorFollower />
    </div>
  )
}
