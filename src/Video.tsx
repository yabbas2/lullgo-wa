import React from 'react';
import './main.css'

export default function App() {
    return (
        <div className="w-screen h-screen bg-black">
            <embed src="https://rpi.local:8889/feed/" className="w-full h-full object-contain" />
            {/* <button */}
            {/*     onClick={recordStream} */}
            {/*     onMouseEnter={resetAutoHideTimer} */}
            {/*     className="text-red-500 hover:text-red-400 transition-colors" */}
            {/* > */}
            {/*     <FaVideo size={35} /> */}
            {/* </button> */}
        </div>
    );
}
