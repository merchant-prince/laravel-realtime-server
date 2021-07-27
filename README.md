# Laravel Realtime (server library)

## Preamble

**Laravel Realtime** is a set of libraries that facilitate the integration of **websockets** in [Laravel](https://laravel.com) applications through [Socket.io](https://socket.io). It consists of the following libraries:

* **laravel-realtime-server** - The websocket server library that interacts with the Laravel application's redis broadcasting server,
* [laravel-realtime-client](https://github.com/merchant-prince/laravel-realtime-client) - The client library that allows interaction with the **laravel-realtime-server** websocket server.

In this documentation, we will focus on the **laravel-realtime-server** library.

*You are encouraged to read the code. It is heavily commented and fairly easy to understand.*


## Installation

This library is used to create the websocket *server* which will retrieve **Events** & **Notifications** from Laravel via its redis broadcasting server, and broadcast/emit them to the websocket clients. It will also *broadcast* [client-events](https://laravel.com/docs/8.x/broadcasting#client-events) to websocket clients.

This library should be pulled into your project via ```yarn``` or ```npm```. It uses the [```socket.io```](https://socket.io/docs/v4/server-installation) library to communicate with the [websocket clients](https://github.com/merchant-prince/laravel-realtime-client); and [```ioredis```](https://github.com/luin/ioredis) to listen for events broadcasted on the Laravel application's redis broadcasting server and to store [```PresenceChannel```](https://github.com/merchant-prince/laravel-realtime-client#presence-channels) data.

```
yarn add @merchant-prince/laravel-realtime-server socket.io ioredis
```


## Usage

The following is the minimum initialization code needed to create a server with this library.

```js
import Redis from "ioredis";
import { Server as SocketIoServer } from "socket.io";
import { Realtime } from "@merchant-prince/laravel-realtime-server";

/**
 * The connection to the Laravel application's redis broadcasting server.
 * 
 * @see https://github.com/luin/ioredis#connect-to-redis
 */
const subscriberConnection = new Redis({
  host: "https://redis.laravel-application.local",
  port: 6379,
  db: 0
});

/**
 * The connection to the redis server responsible for holding data concerning presence channels.
 * 
 * @see https://github.com/luin/ioredis#connect-to-redis
 */
const databaseConnection = new Redis({
  host: "https://redis.laravel-realtime-server.local",
  port: 6379,
  db: 0
});

/**
 * The websocket server instance.
 * 
 * @see https://socket.io/docs/v4/server-initialization
 */
const io = new SocketIoServer(443, {
  /**
   * Since we use the `socket.io-client` library in `laravel-realtime-server`, we don't need to serve client files.
   * 
   * @see https://socket.io/docs/v4/server-api/#server-serveClient-value
   */
	serveClient: false,

  /**
   * CORS options (optional depending on whether the websocket client is served on a different domain).
   * 
   * @see https://socket.io/docs/v4/handling-cors
   */
	cors: {
    origin: "https://laravel-application.local",
    methods: ["GET", "POST"],
	},

  // any other relevant options...
});

/**
 * Initialize the realtime object.
 */
const realtime = new Realtime({
  database: {
    // the connection to the redis database holding the data concerning presence channels
    connection: databaseConnection,
  },
  subscriber: {
    // the connection to the Laravel application's redis broadcasting server.
    connection: subscriberConnection,

    // the database prefix of the Laravel application's redis server (see REDIS_PREFIX in laravel)
    prefix: 'laravel-application_database_',
  },
  websocket: {
    // the socket.io server
    connection: io,

    // the socket.io namespace to use
    namespace: '/'
  }
});
```
