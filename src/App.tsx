import { FaPhotoVideo, FaBell, FaDownload } from 'react-icons/fa';
import { useNavigate } from "react-router";
import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card"
import Logo from './assets/images/bw_logo.png'
import './main.css'

export default function App() {
    let navigate = useNavigate();
    const [granted, setGranted] = useState(Notification.permission === 'granted');

    async function enableNotification() {
        if (granted) return;

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
        <div className="w-screen h-screen bg-black items-center justify-center flex flex-col gap-10">
            <img
                src={Logo}
                alt="thumbnail"
                style={{ width: '180px', height: '180px', objectFit: 'cover' }}
            />
            <p className="text-white text-6xl antialiased font-atma">Lullgo</p>
            <div className="h-20"></div>
            <div className="w-full items-center justify-center flex flex-row gap-5">
                <Card
                    onClick={() => { navigate("/video") }}
                    className="h-full text-white bg-transparent flex-col items-center justify-center active:bg-gray-500 transition-opacity"
                >
                    <CardContent>
                        <FaPhotoVideo size={40} />
                    </CardContent>
                </Card>
                <div className="h-full items-center justify-center flex flex-col gap-3">
                    <Card
                        onClick={enableNotification}
                        className={`${granted ? 'text-gray-700 border-gray-700' : 'text-white border-white'} bg-transparent h-15 w-15 flex flex-col items-center justify-center active:bg-gray-500`}
                    >
                        <CardContent>
                            <FaBell size={25} />
                        </CardContent>
                    </Card>
                    <Card className="text-gray-700 border-gray-700 bg-transparent h-15 w-15 flex flex-col items-center justify-center active:bg-gray-500">
                        <CardContent>
                            <FaDownload size={25} />
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className="h-10"></div>
        </div>
    );
}
