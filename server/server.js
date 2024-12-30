import express from "express";
import messageRoutes from "./src/routes/messageRoutes.js";

const app = express();

app.use(messageRoutes);

app.get("/", (req, res) => {
    res.send("¡Hola, mundo!");
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
