import { useEffect, useState, useRef, useCallback } from 'react';
import { FaPlay, FaPause, FaStop, FaVideo, FaVideoSlash, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import './main.css'

type StreamConnectType = 'notConnected' | 'connecting' | 'connected';

export default function Video() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [streamConnect, setStreamConnect] = useState<StreamConnectType>('notConnected');
    const [pc, setPc] = useState<RTCPeerConnection | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(false);
    const [controlsOpacity, setControlsOpacity] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingDotVisible, setRecordingDotVisible] = useState(true);
    const [muted, setMuted] = useState(true);

    const videoRef = useRef<HTMLVideoElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const dotIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    const iconSize = 30;

    // Format recording time to HH:MM:SS
    const formatTime = useCallback((seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(val => val.toString().padStart(2, '0')).join(':');
    }, []);

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
                if (event.streams && event.streams[0]) {
                    setStream(event.streams[0]);
                    setStreamConnect('connected');
                }
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

    const startRecordStream = () => {
        if (!stream || isRecording) return;

        // iOS-compatible recording format
        const options = { mimeType: 'video/mp4' };

        try {
            recordedChunksRef.current = [];
            const recorder = new MediaRecorder(stream, options);
            recorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);

                // Create download link
                const a = document.createElement('a');
                a.href = url;
                a.download = `stream-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };

            recorder.start();
            setIsRecording(true);

            setRecordingTime(0);
            // Start recording timer
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            // Start blinking animation for red dot
            dotIntervalRef.current = setInterval(() => {
                setRecordingDotVisible(prev => !prev);
            }, 1000);

            resetAutoHideTimer();
        } catch (error) {
            console.error('Recording error:', error);
        }
    };

    const stopRecordStream = () => {
        if (!recorderRef.current || !isRecording) return;

        try {
            recorderRef.current.stop();
            setIsRecording(false);

            // Clear timers
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }

            if (dotIntervalRef.current) {
                clearInterval(dotIntervalRef.current);
                dotIntervalRef.current = null;
            }

            // Reset dot visibility
            setRecordingDotVisible(true);
            resetAutoHideTimer();
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
    };

    const toggleRecordStream = () => {
        if (isRecording) {
            stopRecordStream();
        } else {
            startRecordStream();
        }
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
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            if (dotIntervalRef.current) clearInterval(dotIntervalRef.current);
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
                    muted={muted}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full" />
            )}

            {/* Recording Indicator */}
            {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-2 rounded-full">
                    <div
                        className={`w-3 h-3 rounded-full bg-red-500 transition-opacity duration-300 ${recordingDotVisible ? 'opacity-100' : 'opacity-0'
                            }`}
                    />
                    <span className="text-white font-mono text-sm">
                        {formatTime(recordingTime)}
                    </span>
                </div>
            )}

            {streamConnect === 'notConnected' && (
                <div className="absolute inset-x-0 bottom-20 p-4 h-24 bg-transparent flex gap-10 justify-center items-center">
                    <button
                        onClick={startStream}
                        className="text-white hover:opacity-80 transition-opacity"
                    >
                        <FaPlay size={iconSize} />
                    </button>
                </div>
            )}

            {streamConnect === 'connecting' && (
                <div className="absolute inset-x-0 bottom-20 p-4 h-24 flex gap-10 justify-center items-center">
                    <div className="text-white">
                        <span className="animate-spin rounded-full h-10 w-10 border-b-2 border-white block"></span>
                    </div>
                </div>
            )}

            {streamConnect === 'connected' && controlsVisible && (
                <div
                    className="absolute inset-x-0 bottom-20 p-4 h-24 bg-transparent flex gap-5 justify-center items-center"
                    style={{
                        opacity: controlsOpacity,
                        transition: 'opacity 300ms ease-in-out'
                    }}
                >
                    <button
                        onClick={toggleRecordStream}
                        className="flex flex-col items-center justify-center text-red-500 hover:opacity-80 transition-opacity"
                    >
                        {isRecording ? (
                            <FaVideoSlash size={iconSize} className="animate-pulse" />
                        ) : (
                            <FaVideo size={iconSize} />
                        )}
                    </button>
                    <button
                        onClick={togglePauseStream}
                        className="text-white hover:opacity-80 transition-opacity"
                    >
                        {isPaused ? <FaPlay size={iconSize} /> : <FaPause size={iconSize} />}
                    </button>
                    <button
                        onClick={stopStream}
                        className="text-white hover:opacity-80 transition-opacity"
                    >
                        <FaStop size={iconSize} />
                    </button>
                    <button
                        onClick={() => setMuted(!muted)}
                        className="text-white hover:opacity-80 transition-opacity"
                    >
                        {muted ? (<FaVolumeMute size={iconSize} />) : (<FaVolumeUp size={iconSize} />)}
                    </button>
                </div>
            )}
        </div>
    );
}
