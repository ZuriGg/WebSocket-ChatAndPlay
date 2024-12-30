import express from "express";

const messages = express.Router();

messages.get("/", controller);

export default messages;
