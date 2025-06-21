import './main.css'

export default function App() {
    return (
        <div className="w-screen h-screen bg-black">
            <embed src="https://rpi.local:8889/feed/" className="w-full h-full object-contain" />
        </div>
    );
}
