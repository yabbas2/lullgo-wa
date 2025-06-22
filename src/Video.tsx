import { useEffect, useState, useRef } from 'react';
import { FaPlay, FaPause, FaStop, FaCircle } from 'react-icons/fa';
import './main.css'

type StreamConnectType = 'notConnected' | 'connecting' | 'connected';


export default function Video() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [streamConnect, setStreamConnect] = useState<StreamConnectType>('notConnected');
    const [pc, setPc] = useState<RTCPeerConnection | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [controlsOpacity, setControlsOpacity] = useState(0);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Handle controls visibility with animation
    const toggleControls = (visible: boolean, immediate = false) => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }

        if (visible) {
            setControlsVisible(true);
            setControlsOpacity(immediate ? 1 : 0);
            setTimeout(() => setControlsOpacity(1), immediate ? 0 : 10);
        } else {
            setControlsOpacity(0);
            controlsTimeoutRef.current = setTimeout(() => {
                setControlsVisible(false);
            }, 300);
        }
    };

    // Handle video click
    const handleVideoClick = () => {
        if (!controlsVisible) {
            toggleControls(true);
        }
        resetAutoHideTimer();
    };

    // Auto-hide controls after 5 seconds
    const resetAutoHideTimer = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            toggleControls(false);
        }, 5000);
    };

    const startStream = async () => {
        try {
            setStreamConnect('connecting');

            // Create new peer connection
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            // Handle track events
            pc.ontrack = (event) => {
                console.debug('ontrack', event);
                setStream(event.streams[0]);
                setStreamConnect('connected');
            };

            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });

            // Create offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            let sdp = offer.sdp || '';
            // Add required attributes if missing
            if (!sdp.includes('a=setup:actpass')) {
                sdp = sdp.replace(/a=ice-options:trickle\s\n/, 'a=ice-options:trickle\na=setup:actpass\n');
            }

            const response = await fetch('https://rpi.local:8889/feed/whep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/sdp' },
                body: offer.sdp,
            });

            const answer = await response.text();
            await pc.setRemoteDescription({
                type: 'answer',
                sdp: answer
            });

            setPc(pc);
        } catch (error) {
            console.error('Error:', error);
            setStreamConnect('notConnected');
        }
    };

    const togglePauseStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsPaused(!isPaused);
            resetAutoHideTimer();
        }
    };

    const recordStream = () => {
        if (!stream) return;

        const mediaRecorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
            chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `stream-recording-${new Date().toISOString().slice(0, 19)}.webm`;
            a.click();

            URL.revokeObjectURL(url);
        };

        mediaRecorder.start();

        // Stop after 10 seconds for demo
        setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        }, 10000);
    };

    const stopStream = () => {
        if (pc) {
            pc.close();
            setPc(null);
        }
        setStream(null);
        setStreamConnect('notConnected');
        setIsPaused(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    useEffect(() => {
        // Attach stream to video element
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (pc) pc.close();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [pc]);

    return (
        <div
            className="relative w-screen h-screen bg-black"
            onClick={handleVideoClick}
        >
            {stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full" />
            )}

            {streamConnect === 'notConnected' && (
                <div className="absolute inset-x-0 bottom-5 p-4 h-24 bg-transparent flex gap-10 justify-center items-center">
                    <button
                        onClick={startStream}
                        className="text-white hover:opacity-80 transition-opacity"
                    >
                        <FaPlay size={35} />
                    </button>
                </div>
            )}

            {streamConnect === 'connecting' && (
                <div className="absolute inset-x-0 bottom-5 p-4 h-24 flex gap-10 justify-center items-center">
                    <div className="text-white">
                        <span className="animate-spin rounded-full h-10 w-10 border-b-2 border-white block"></span>
                    </div>
                </div>
            )}

            {streamConnect === 'connected' && controlsVisible && (
                <div
                    className="absolute inset-x-0 bottom-5 p-4 h-24 bg-transparent flex gap-10 justify-center items-center"
                    style={{
                        opacity: controlsOpacity,
                        transition: 'opacity 300ms ease-in-out'
                    }}
                >
                    <button
                        onClick={recordStream}
                        className="text-red-500 hover:opacity-80 transition-opacity"
                    >
                        <FaCircle size={35} />
                    </button>
                    <button
                        onClick={togglePauseStream}
                        className="text-white hover:opacity-80 transition-opacity"
                    >
                        {isPaused ? <FaPlay size={35} /> : <FaPause size={35} />}
                    </button>
                    <button
                        onClick={stopStream}
                        className="text-white hover:opacity-80 transition-opacity"
                    >
                        <FaStop size={35} />
                    </button>
                </div>
            )}
        </div>
    );
}
