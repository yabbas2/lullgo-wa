import { useEffect, useState, useRef, useCallback } from 'react';
import { FaPlay, FaPause, FaStop, FaVideo, FaVideoSlash, FaVolumeMute, FaVolumeUp, FaSlidersH, FaArrowLeft } from 'react-icons/fa';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { useNavigate } from "react-router";
import './main.css'

type StreamConnectType = 'notConnected' | 'connecting' | 'connected';
type ResolutionType = '1080p' | '720p' | '640x480 (low)' | '320x240 (very low)';

export default function Video() {
    const resolutions = {
        '1080p': { width: 1920, height: 1080 },
        '720p': { width: 1280, height: 720 },
        '640x480 (low)': { width: 640, height: 480 },
        '320x240 (very low)': { width: 320, height: 240 },
    };

    let navigate = useNavigate();

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
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [resolution, setResolution] = useState<ResolutionType>('320x240 (very low)');
    const [brightness, setBrightness] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const dotIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

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

    const onIrBrightnessChange = async (value: number[]) => {
        const brightnessValue = value[0];
        setBrightness(brightnessValue);
        try {
            await fetch('https://rpi.local:5001/api/set-ir-brightness', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brightness: brightnessValue }),
            });
        } catch (error) {
            console.error('Error setting infrared brightness:', error);
        }
    }

    const onVideoResolutionChange = async (value: ResolutionType) => {
        setResolution(value);
        // const { width, height } = resolutions[value];
        // try {
        //     const reponse = await fetch('https://rpi.local:9997/v3/config/paths/patch/cam', {
        //         method: 'PATCH',
        //         headers: { 'Content-Type': 'application/json' },
        //         body: JSON.stringify({ rpiCameraWidth: width, rpiCameraHeight: height }),
        //     });
        //     if (reponse.ok) {
        //         console.log('Resolution updated successfully!');
        //     }
        // } catch (error) {
        //     console.error('Error setting video resolution:', error);
        // }
    }

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

            <div className="absolute top-6 left-6">
                <Card
                    onClick={() => navigate(-1)}
                    className="text-white border-white bg-transparent h-10 w-15 flex flex-col items-center justify-center active:bg-gray-500"
                >
                    <CardContent>
                        <FaArrowLeft size={25} />
                    </CardContent>
                </Card>
            </div>

            {streamConnect === 'connected' && controlsVisible && (
                <div
                    className="absolute top-6 right-6"
                    style={{
                        opacity: controlsOpacity,
                        transition: 'opacity 300ms ease-in-out'
                    }}
                >
                    <Card
                        onClick={() => setIsSettingsOpen(true)}
                        className="text-white border-white bg-transparent h-10 w-15 flex flex-col items-center justify-center active:bg-gray-500"
                    >
                        <CardContent>
                            <FaSlidersH size={25} />
                        </CardContent>
                    </Card>
                </div>
            )}

            {isRecording && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full">
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
                <div className="absolute inset-x-0 bottom-20 p-4 h-24 bg-transparent flex justify-center items-center">
                    <Card
                        onClick={startStream}
                        className="text-white border-white bg-transparent h-15 w-20 flex flex-col items-center justify-center active:bg-gray-500"
                    >
                        <CardContent>
                            <FaPlay size={30} />
                        </CardContent>
                    </Card>
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
                    className="absolute inset-x-0 bottom-20 h-24 bg-transparent flex gap-6 justify-center items-center"
                    style={{
                        opacity: controlsOpacity,
                        transition: 'opacity 300ms ease-in-out'
                    }}
                >
                    <Card
                        onClick={toggleRecordStream}
                        className="text-red-500 border-red-500 bg-transparent h-10 w-15 flex flex-col items-center justify-center active:bg-red-300"
                    >
                        <CardContent>
                            {isRecording ? (
                                <FaVideoSlash size={25} className="animate-pulse" />
                            ) : (
                                <FaVideo size={25} />
                            )}
                        </CardContent>
                    </Card>
                    <Card
                        onClick={togglePauseStream}
                        className="text-white border-white bg-transparent h-10 w-15 flex flex-col items-center justify-center active:bg-gray-500"
                    >
                        <CardContent>
                            {isPaused ? <FaPlay size={25} /> : <FaPause size={25} />}
                        </CardContent>
                    </Card>
                    <Card
                        onClick={stopStream}
                        className="text-white border-white bg-transparent h-10 w-15 flex flex-col items-center justify-center active:bg-gray-500"
                    >
                        <CardContent>
                            <FaStop size={25} />
                        </CardContent>
                    </Card>
                    <Card
                        onClick={() => setMuted(!muted)}
                        className="text-white border-white bg-transparent h-10 w-15 flex flex-col items-center justify-center active:bg-gray-500"
                    >
                        <CardContent>
                            {muted ? (<FaVolumeMute size={25} />) : (<FaVolumeUp size={25} />)}
                        </CardContent>
                    </Card>
                </div>
            )}

            <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DrawerContent className="bg-black border-white">
                    <DrawerHeader>
                        <DrawerTitle className="text-white text-2xl">Stream Settings</DrawerTitle>
                        <DrawerDescription className="text-white">Adjust your stream preferences below</DrawerDescription>
                    </DrawerHeader>
                    <div className="flex flex-col justify-center items-center py-4 px-10">
                        <div className="flex flex-col justify-center items-center w-full">
                            <p className="text-white text-sm mb-2">Infrared light brightness: {brightness}%</p>
                            <div className="flex flex-row justify-center items-center w-full gap-3">
                                <p className="text-white text-sm">0</p>
                                <Slider defaultValue={[0]} step={10} onValueChange={(val) => onIrBrightnessChange(val)} value={[brightness]} />
                                <p className="text-white text-sm">100</p>
                            </div>
                        </div>
                        <Separator className="my-4" />
                        <div className="flex flex-col justify-center items-center w-full">
                            <p className="text-white text-sm mb-2">Video quality</p>
                            <Select onValueChange={(value: ResolutionType) => onVideoResolutionChange(value)} defaultValue='320x240 (very low)' value={resolution} disabled={true}>
                                <SelectTrigger className="w-full text-white" style={{ backgroundColor: "black", fontSize: 13, border: "solid 1px white" }}>{resolution}</SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Resolutions</SelectLabel>
                                        {Object.keys(resolutions).map((res) => (
                                            <SelectItem key={res} value={res}>{res}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center items-center pb-4 px-10">
                        <DrawerFooter>
                            <DrawerClose asChild>
                                <Card className="text-white border-white bg-transparent h-10 w-20 flex flex-col items-center justify-center active:bg-gray-500">
                                    <CardContent>Done</CardContent>
                                </Card>
                            </DrawerClose>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
