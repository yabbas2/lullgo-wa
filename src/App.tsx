import React from 'react';
import { FaVideo } from 'react-icons/fa';
import { useNavigate } from "react-router";
import './main.css'

export default function App() {
    let navigate = useNavigate();

    return (
        <div className="w-screen h-screen bg-black items-center justify-center flex flex-col">
            <button
                onClick={() => {navigate("/video")}}
                className="text-white-500 transition-colors"
            >
                <FaVideo size={35} />
            </button>
        </div>
    );
}
