import { FaVideo, FaBell } from 'react-icons/fa';
import { useNavigate } from "react-router";
import { useState } from 'react';
import './main.css'

export default function App() {
    let navigate = useNavigate();
    const [granted, setGranted] = useState(Notification.permission === 'granted');

    async function enableNotification() {
        const permission = await Notification.requestPermission();
        setGranted(permission === 'granted');
        if (permission !== 'granted') {
            console.log('Permission not granted for Notification');
            return;
        }

        const registration = await navigator.serviceWorker.ready;
        try {
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.VAPID_PUBLIC_KEY!),
            });

            // Send subscription to your backend
            await fetch('https://rpi.local:5000/api/save-subscription', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' },
            });

            console.log('User is subscribed:', subscription);
        } catch (err) {
            console.log('Failed to subscribe the user: ', err);
        }

        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('Received a message from service worker:', event.data);
        });
    }

    // Helper function
    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    };

    return (
        <div className="w-screen h-screen bg-black items-center justify-center flex flex-row">
            <button
                onClick={() => { navigate("/video") }}
                className="text-white-500 transition-colors mx-5"
            >
                <FaVideo size={35} />
            </button>
            <button
                onClick={() => { enableNotification() }}
                className="text-white-500 transition-colors mx-5 disabled:opacity-50"
                disabled={granted}
            >
                <FaBell size={35} />
            </button>
        </div>
    );
}
