import { useEffect, useState } from "react";
import "./App.css";

function App() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [status, setStatus] = useState("");
    const [username, setUsername] = useState("");
    const [playerName, setPlayerName] = useState("");
    const [players, setPlayers] = useState([]);
    const [ws, setWs] = useState(null);
    const [playerPositions, setPlayerPositions] = useState({});
    const [isVoiceDetected, setIsVoiceDetected] = useState(false); // Estado para detectar voz

    // Función para capturar el audio del micrófono y analizarlo
    const startAudioStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            console.log("Audio stream obtenido:", stream);

            // Crear un AudioContext para procesar el audio
            const audioContext = new (window.AudioContext ||
                window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);

            // Configurar el AnalyserNode
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            // Detectar si hay sonido
            const detectVoice = () => {
                analyser.getByteFrequencyData(dataArray);

                // Sumamos todos los valores de frecuencias para determinar si hay actividad de voz
                const sum = dataArray.reduce((a, b) => a + b, 0);
                const average = sum / bufferLength;

                // Si el valor promedio es mayor que un umbral, consideramos que hay voz
                if (average > 10) {
                    setIsVoiceDetected(true); // Hay voz
                } else {
                    setIsVoiceDetected(false); // No hay voz
                }

                requestAnimationFrame(detectVoice);
            };

            detectVoice(); // Iniciar la detección de voz

            return stream;
        } catch (error) {
            console.error("Error al obtener el audio del micrófono:", error);
            return null;
        }
    };

    useEffect(() => {
        startAudioStream(); // Iniciar la captura de audio

        // WebSocket y otros hooks...
    }, []);

    // Colocar el color del LED en función de la detección de voz
    useEffect(() => {
        const ledElement = document.getElementById("ledChatOn");

        if (ledElement) {
            if (isVoiceDetected) {
                ledElement.style.backgroundColor = "green"; // Si hay voz, poner verde
            } else {
                ledElement.style.backgroundColor = "red"; // Si no hay voz, poner rojo
            }
        }
    }, [isVoiceDetected]); // Se ejecuta cada vez que `isVoiceDetected` cambie

    useEffect(() => {
        const websocket = new WebSocket(
            "wss://6a04-95-18-11-25.ngrok-free.app"
        );

        websocket.addEventListener("open", () => {
            setStatus("Usuario conectado");
        });

        websocket.addEventListener("message", (e) => {
            const msgData = e.data;
            const message = JSON.parse(msgData);

            console.log(`Mensaje recibido: ${message}`);

            if (message.type === "chat") {
                setMessages((prevMessages) => [...prevMessages, message]);
            } else if (message.type === "players") {
                setPlayers(message.players);

                setPlayerPositions((prevPositions) => {
                    const updatedPositions = { ...prevPositions };
                    message.players.forEach((player) => {
                        if (!updatedPositions[player]) {
                            updatedPositions[player] = { left: 0, top: 0 };
                        }
                    });
                    return updatedPositions;
                });
            } else if (message.type === "move") {
                setPlayerPositions((prevPositions) => ({
                    ...prevPositions,
                    [message.username]: message.coord,
                }));
            }
        });

        websocket.addEventListener("close", () => {
            setStatus("Usuario desconectado");
        });

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, []);

    const sendMessage = (message) => {
        if (message && username && ws) {
            const messageObj = {
                type: "chat",
                username: username,
                message: message,
            };
            ws.send(JSON.stringify(messageObj));
        }
    };

    const sendCoord = (coord) => {
        if (coord && ws) {
            const coordObj = {
                type: "move",
                username: coord.username,
                coord: coord.coord,
            };
            ws.send(JSON.stringify(coordObj));
        }
    };

    const joinGame = () => {
        if (playerName && ws) {
            const playerObj = {
                type: "join",
                playerName: playerName,
            };
            ws.send(JSON.stringify(playerObj));
        }
    };

    const movePlayer = (direction) => {
        if (playerName && ws) {
            const currentPosition = playerPositions[playerName] || {
                left: 0,
                top: 0,
            };

            let newTop = currentPosition.top;
            let newLeft = currentPosition.left;

            if (direction === "left") {
                newLeft -= 2;
            } else if (direction === "right") {
                newLeft += 2;
            } else if (direction === "up") {
                newTop -= 2;
            } else if (direction === "down") {
                newTop += 2;
            }

            if (newTop < 0) newTop = 0;
            if (newTop > 86) newTop = 86;
            if (newLeft < 0) newLeft = 0;
            if (newLeft > 91) newLeft = 91;

            setPlayerPositions((prevPositions) => ({
                ...prevPositions,
                [playerName]: { left: newLeft, top: newTop },
            }));

            sendCoord({
                username: playerName,
                coord: { left: newLeft, top: newTop },
            });
        }
    };

    const [peerConnection, setPeerConnection] = useState(null);

    const createPeerConnection = (stream) => {
        const pc = new RTCPeerConnection();

        // Agregar las pistas de audio al objeto RTCPeerConnection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Manejar el evento cuando se recibe un stream remoto
        pc.ontrack = (event) => {
            const remoteStream = new MediaStream(event.streams[0].getTracks());
            console.log("Stream remoto recibido:", remoteStream);

            // Crear un elemento de audio y reproducir el stream remoto
            const audioElement = new Audio();
            audioElement.srcObject = remoteStream;
            audioElement.play();
        };

        setPeerConnection(pc);
        return pc;
    };

    const initPeerConnection = async () => {
        const stream = await startAudioStream();
        if (stream) {
            createPeerConnection(stream);
        }
    };

    useEffect(() => {
        initPeerConnection();
    }, []);

    const startCall = async () => {
        const stream = await startAudioStream();
        if (!stream) return;

        const pc = createPeerConnection(stream);

        // Crear una oferta para iniciar la conexión
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Enviar la oferta al servidor
        ws.send(
            JSON.stringify({
                type: "offer",
                sdp: pc.localDescription,
                target: "<target_player_name>", // Reemplaza con el nombre del destinatario.
            })
        );

        // Manejar las respuestas del servidor WebSocket
        ws.addEventListener("message", async (e) => {
            const message = JSON.parse(e.data);

            if (message.type === "answer") {
                // Configurar la descripción remota
                const remoteDesc = new RTCSessionDescription(message.sdp);
                await pc.setRemoteDescription(remoteDesc);
            }

            if (message.type === "ice-candidate") {
                try {
                    await pc.addIceCandidate(message.candidate);
                } catch (e) {
                    console.error("Error al agregar ICE Candidate:", e);
                }
            }
        });

        // Manejar candidatos ICE
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(
                    JSON.stringify({
                        type: "ice-candidate",
                        candidate: event.candidate,
                        target: username, // Reemplaza con el nombre del destinatario.
                    })
                );
            }
        };
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!playerName) return;
            switch (event.key) {
                case "a":
                case "ArrowLeft":
                    movePlayer("left");
                    break;
                case "d":
                case "ArrowRight":
                    movePlayer("right");
                    break;
                case "w":
                case "ArrowUp":
                    movePlayer("up");
                    break;
                case "s":
                case "ArrowDown":
                    movePlayer("down");
                    break;
                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [playerName, playerPositions]);

    return (
        <div className="App">
            <section id="chatSection">
                <h1>Chat con WebSockets</h1>
                <p>{status}</p>
                <div id="chatContainer">
                    {messages.map((message, index) => (
                        <p key={index}>
                            <b>{message.username}</b>: {message.message}
                        </p>
                    ))}
                </div>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje"
                />
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresa tu nombre de usuario"
                />
                <button
                    onClick={() => {
                        sendMessage(newMessage);
                        setNewMessage("");
                    }}
                >
                    Enviar
                </button>
                <button onClick={startCall}>Iniciar Chat de Voz</button>
                <div
                    id="ledChatOn"
                    style={{
                        backgroundColor: "red",
                        height: "2%",
                        width: "2%",
                    }}
                ></div>
            </section>
            <section id="playersSection">
                <h2>Jugadores</h2>
                <ul>
                    {players.map((player, index) => (
                        <div
                            className="contenedorJugador"
                            key={index}
                            style={{
                                position: "absolute",
                                left: `${playerPositions[player]?.left || 0}%`,
                                top: `${playerPositions[player]?.top || 0}%`,
                            }}
                        >
                            <p>{player}</p>
                        </div>
                    ))}
                </ul>
                <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ingresa tu nombre de jugador"
                />
                <button onClick={joinGame}>Unirse a partida</button>
                <div id="seccionMovimientos">
                    <button onClick={() => movePlayer("left")}>
                        Izquierda
                    </button>
                    <button onClick={() => movePlayer("right")}>Derecha</button>
                    <button onClick={() => movePlayer("up")}>Arriba</button>
                    <button onClick={() => movePlayer("down")}>Abajo</button>
                </div>
            </section>
        </div>
    );
}

export default App;
