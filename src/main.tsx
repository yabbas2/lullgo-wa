import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router";
import './index.css'
import App from './App.tsx'
import Video from './Video.tsx'

createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <Routes>
            <Route index path="/" element={<App />} />
            <Route path="/video" element={<Video />} />
        </Routes>
    </BrowserRouter>,
)
