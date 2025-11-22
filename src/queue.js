// src/queue.js
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
});

export const convertQueue = new Queue("convertQueue", {
  connection,
});

export const redisConnection = connection;
