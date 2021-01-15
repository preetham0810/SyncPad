import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import NotePage from './pages/NotePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/notes/:id" element={<NotePage />} />
    </Routes>
  )
}
