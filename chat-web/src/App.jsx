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
    const [peerConnection, setPeerConnection] = useState(null);

    useEffect(() => {
        const websocket = new WebSocket(
            "wss://6a04-95-18-11-25.ngrok-free.app"
        );

        websocket.addEventListener("open", () => {
            setStatus("Usuario conectado");
        });

        websocket.addEventListener("message", (e) => {
            const message = JSON.parse(e.data);
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
            } else if (
                message.type === "offer" ||
                message.type === "answer" ||
                message.type === "ice-candidate"
            ) {
                handleSignal(message);
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

    // Función para controlar el movimiento con las teclas WASD
    const handleKeyPress = (e) => {
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
            movePlayer("up");
        } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
            movePlayer("left");
        } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
            movePlayer("down");
        } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
            movePlayer("right");
        }
    };

    // Escuchar las teclas presionadas al cargar el componente
    useEffect(() => {
        window.addEventListener("keydown", handleKeyPress);

        return () => {
            window.removeEventListener("keydown", handleKeyPress);
        };
    }, [playerPositions]);

    const startAudioStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            return stream;
        } catch (error) {
            console.error("Error al obtener el audio del micrófono:", error);
            return null;
        }
    };

    const createPeerConnection = (stream) => {
        const pc = new RTCPeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
            const remoteStream = new MediaStream(event.streams[0].getTracks());
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

    const startVoiceChat = async () => {
        if (!playerName || !ws) return;

        // Enviar al servidor la señal de que el jugador desea unirse al chat de voz
        const message = {
            type: "start-voice-chat",
            playerName: playerName,
            sdp: null, // Puedes agregar una oferta SDP si ya la tienes
        };

        ws.send(JSON.stringify(message));

        // Inicializar Peer Connection y gestionar la señal de los otros jugadores
        const stream = await startAudioStream();
        if (!stream) return;

        const pc = new RTCPeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
            const remoteStream = new MediaStream(event.streams[0].getTracks());
            const audioElement = new Audio();
            audioElement.srcObject = remoteStream;
            audioElement.play();
        };

        setPeerConnection(pc);
    };

    const handleSignal = async (message) => {
        if (!peerConnection) return;

        if (message.type === "offer") {
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(message.sdp)
            );
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            ws.send(
                JSON.stringify({
                    type: "answer",
                    sdp: peerConnection.localDescription,
                    target: message.username,
                })
            );
        } else if (message.type === "answer") {
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(message.sdp)
            );
        } else if (message.type === "ice-candidate") {
            try {
                await peerConnection.addIceCandidate(message.candidate);
            } catch (e) {
                console.error("Error al agregar ICE Candidate:", e);
            }
        }
    };

    const startCall = async () => {
        const stream = await startAudioStream();
        if (!stream) return;

        const pc = createPeerConnection(stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(
            JSON.stringify({
                type: "offer",
                sdp: pc.localDescription,
                target: "<target_player_name>", // Reemplaza con el nombre del destinatario.
            })
        );

        ws.addEventListener("message", async (e) => {
            const message = JSON.parse(e.data);
            if (message.type === "answer") {
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

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(
                    JSON.stringify({
                        type: "ice-candidate",
                        candidate: event.candidate,
                        target: "<target_player_name>", // Reemplaza con el nombre del destinatario.
                    })
                );
            }
        };
    };

    useEffect(() => {
        initPeerConnection();
    }, []);

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
            </section>

            {/* Sección de jugadores */}
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
