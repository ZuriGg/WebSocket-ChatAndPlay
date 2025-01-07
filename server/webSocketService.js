import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8082 });

let players = [];
let voiceSessionPlayers = []; // Array para los jugadores en la sesión de voz

wss.on("connection", (ws) => {
    console.log("Cliente conectado");

    ws.on("message", (data) => {
        console.log(`Mensaje entrante: ${data}`);
        const parsedData = JSON.parse(data);

        // Manejar mensaje de chat
        if (parsedData.type === "chat") {
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(parsedData));
                    console.log(`Mensaje enviado a todos: ${data}`);
                }
            });
        }

        // Manejar unirse a la sala
        if (parsedData.type === "join") {
            ws.playerName = parsedData.playerName;

            if (!players.includes(parsedData.playerName)) {
                players.push(parsedData.playerName);
            }

            const playersData = {
                type: "players",
                players: players,
            };

            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(playersData));
                }
            });

            console.log(`${parsedData.playerName} se unió a la partida.`);
        }

        // Manejo del movimiento de jugadores
        if (parsedData.type === "move") {
            const moveData = {
                type: "move",
                username: parsedData.username,
                coord: parsedData.coord,
            };

            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(moveData));
                }
            });
        }

        // Manejo de la conexión de voz
        if (
            parsedData.type === "offer" ||
            parsedData.type === "answer" ||
            parsedData.type === "ice-candidate"
        ) {
            // Si el mensaje es de un participante que está en la sesión de voz, lo enviamos a todos
            if (voiceSessionPlayers.includes(ws.playerName)) {
                wss.clients.forEach((client) => {
                    if (
                        client.readyState === ws.OPEN &&
                        voiceSessionPlayers.includes(client.playerName)
                    ) {
                        client.send(JSON.stringify(parsedData));
                    }
                });
            }
        }

        // Si un jugador hace clic en "Iniciar Chat de Voz"
        if (parsedData.type === "start-voice-chat") {
            // Añadir al jugador a la sesión de voz
            if (!voiceSessionPlayers.includes(ws.playerName)) {
                voiceSessionPlayers.push(ws.playerName);
            }

            // Enviar a todos los participantes de la sesión la señal de inicio de chat de voz
            const offerMessage = {
                type: "offer",
                username: ws.playerName,
                target: voiceSessionPlayers,
                sdp: parsedData.sdp, // La oferta inicial
            };

            wss.clients.forEach((client) => {
                if (
                    client.readyState === ws.OPEN &&
                    voiceSessionPlayers.includes(client.playerName)
                ) {
                    client.send(JSON.stringify(offerMessage));
                }
            });
        }
    });

    // Manejo de desconexión
    ws.on("close", () => {
        if (ws.playerName) {
            players = players.filter((player) => player !== ws.playerName);

            // Si el jugador se desconecta de la sesión de voz, eliminarlo
            voiceSessionPlayers = voiceSessionPlayers.filter(
                (player) => player !== ws.playerName
            );

            const playersData = {
                type: "players",
                players: players,
            };

            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(playersData));
                }
            });

            console.log(`${ws.playerName} se desconectó de la partida.`);
        }
    });
});

console.log("Servidor WebSocket escuchando en el puerto 8082");
