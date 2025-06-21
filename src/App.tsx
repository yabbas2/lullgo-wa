import { FaVideo } from 'react-icons/fa';
import { useNavigate } from "react-router";
import './main.css'

export default function App() {
    let navigate = useNavigate();

    async function enableNotification() {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Permission not granted for Notification');
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        try {
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.VAPID_PUBLIC_KEY,
            });

            // Send the subscription to your server
            // const response = await fetch('/api/subscribe', {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //   },
            //   body: JSON.stringify(subscription),
            // });

            console.log('User is subscribed:', subscription);
        } catch (err) {
            console.log('Failed to subscribe the user: ', err);
        }

        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('Received a message from service worker:', event.data);
        });
    }

    return (
        <div className="w-screen h-screen bg-black items-center justify-center flex flex-col">
            <button
                onClick={() => { navigate("/video") }}
                className="text-white-500 transition-colors my-5"
            >
                <FaVideo size={35} />
            </button>
            <button
                onClick={() => { enableNotification() }}
                className="text-white-500 transition-colors my-5 disabled:opacity-50"
                disabled={Notification.permission === 'granted'}
            >
                Enable Notification
            </button>
        </div>
    );
}
