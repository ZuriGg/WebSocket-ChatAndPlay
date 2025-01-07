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
