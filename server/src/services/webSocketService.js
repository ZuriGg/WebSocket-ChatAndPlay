import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8082 });

let players = [];

wss.on("connection", (ws) => {
    console.log("Cliente conectado");

    ws.on("message", (data) => {
        console.log(`Mensaje entrante: ${data}`);

        const parsedData = JSON.parse(data);

        if (parsedData.type === "chat") {
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(parsedData));
                    console.log(`Mensaje enviado a todos: ${data}`);
                }
            });
        }

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

        if (parsedData.type === "offer" || parsedData.type === "answer") {
            wss.clients.forEach((client) => {
                if (
                    client.readyState === ws.OPEN &&
                    client.playerName === parsedData.target
                ) {
                    client.send(JSON.stringify(parsedData));
                }
            });

            console.log(
                `Mensaje ${parsedData.type} enviado a ${parsedData.target}`
            );
        }

        if (parsedData.type === "ice-candidate") {
            wss.clients.forEach((client) => {
                if (
                    client.readyState === ws.OPEN &&
                    client.playerName === parsedData.target
                ) {
                    client.send(JSON.stringify(parsedData));
                }
            });

            console.log(`Candidato ICE enviado a ${parsedData.target}`);
        }
    });

    ws.on("close", () => {
        if (ws.playerName) {
            players = players.filter((player) => player !== ws.playerName);

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
