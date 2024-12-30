import { useEffect, useState } from "react";
import "./App.css";

function App() {
    const [messages, setMessages] = useState([]); // Chat
    const [newMessage, setNewMessage] = useState(""); // Nuevo mensaje del chat
    const [status, setStatus] = useState(""); // Estado de conexión
    const [username, setUsername] = useState(""); // Nombre de usuario del chat
    const [playerName, setPlayerName] = useState(""); // Nombre de jugador para el juego
    const [players, setPlayers] = useState([]); // Jugadores en la partida
    const [ws, setWs] = useState(null); // WebSocket
    const [playerPositions, setPlayerPositions] = useState({}); // Posiciones de los jugadores

    useEffect(() => {
        // Establecer la conexión WebSocket al cargar la app
        const websocket = new WebSocket("ws://localhost:8082");

        websocket.addEventListener("open", () => {
            setStatus("Usuario conectado");
        });

        websocket.addEventListener("message", (e) => {
            const msgData = e.data; // El mensaje ya es texto, no es necesario usar await o text()
            const message = JSON.parse(msgData);

            console.log(`Mensaje recibido: ${message}`);

            if (message.type === "chat") {
                setMessages((prevMessages) => [...prevMessages, message]);
            } else if (message.type === "players") {
                // Actualizar la lista de jugadores
                setPlayers(message.players);

                // Actualizar las posiciones de los jugadores sin sobrescribir las anteriores
                setPlayerPositions((prevPositions) => {
                    // Mantener las posiciones de los jugadores existentes
                    const updatedPositions = { ...prevPositions };
                    message.players.forEach((player) => {
                        if (!updatedPositions[player]) {
                            updatedPositions[player] = { left: 0, top: 0 }; // Inicializamos al nuevo jugador en la posición (0, 0)
                        }
                    });
                    return updatedPositions;
                });
            } else if (message.type === "move") {
                // Actualizar la posición del jugador sin sobrescribir otros jugadores
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
            websocket.close(); // Cerrar WebSocket al desmontar el componente
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

            // Asegurarse de que las posiciones no se salgan del rango
            if (newTop < 0) newTop = 0;
            if (newTop > 86) newTop = 86; // Limitar al 91%
            if (newLeft < 0) newLeft = 0;
            if (newLeft > 91) newLeft = 91; // Limitar al 91%

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

    // Manejar eventos del teclado
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!playerName) return; // No mover si no hay jugador

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
                                top: `${playerPositions[player]?.top || 0}%`, // Usamos top para el movimiento vertical
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
