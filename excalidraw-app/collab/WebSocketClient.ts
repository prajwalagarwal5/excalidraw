export type WSEventType = "state" | "error" | "open" | "message" | "close";

export interface WebSocketClient {
  addListener: (event: WSEventType, fn: Function) => void;
  removeListener: (event: WSEventType, fn: Function) => void;
  close: () => void;
  getClient: () => WebSocket;
  isConnected: () => boolean;
  send: (data: string | ArrayBuffer) => void;
}

export default function reconnectingWebSocket(
  url: string,
  retryLimit: number = 0,
  room: string,
): WebSocketClient {
  let client: WebSocket;
  let isConnected: boolean = false;
  let reconnectOnClose: boolean = true;
  let stateChangeListeners: Function[] = [];
  let onErrorListeners: Function[] = [];
  let onOpenListeners: Function[] = [];
  let onMessageListeners: Function[] = [];
  let onCloseListeners: Function[] = [];
  let retryCount: number = 0;

  function addListener(event: WSEventType, fn: Function) {
    if (event === "state") {
      stateChangeListeners.push(fn);
    } else if (event === "error") {
      onErrorListeners.push(fn);
    } else if (event === "open") {
      onOpenListeners.push(fn);
    } else if (event === "message") {
      onMessageListeners.push(fn);
    } else if (event === "close") {
      onCloseListeners.push(fn);
    }
  }

  function removeListener(event: WSEventType, fn: Function) {
    if (event === "state") {
      stateChangeListeners = stateChangeListeners.filter((l) => l !== fn);
    } else if (event === "error") {
      onErrorListeners = onErrorListeners.filter((l) => l !== fn);
    } else if (event === "open") {
      onOpenListeners = onOpenListeners.filter((l) => l !== fn);
    } else if (event === "message") {
      onMessageListeners = onMessageListeners.filter((l) => l !== fn);
    } else if (event === "close") {
      onCloseListeners = onCloseListeners.filter((l) => l !== fn);
    }
  }

  function start() {
    client = new WebSocket(url);

    client.onopen = () => {
      console.log("ws opened");
      isConnected = true;
      stateChangeListeners.forEach((fn) => fn(true));
      onOpenListeners.forEach((fn) => fn());
      client.send(
        JSON.stringify({
          action: "excalidraw",
          message_type: "init_room",
          room,
        }),
      );
    };

    const close = client.close;

    // Close without reconnecting;
    client.close = () => {
      reconnectOnClose = false;
      close.call(client);
    };

    client.onmessage = (event) => {
      onMessageListeners.forEach((fn) => fn(event.data));
    };

    client.onerror = (e) => {
      onErrorListeners.forEach((fn) => fn(e));
    };

    client.onclose = () => {
      isConnected = false;
      stateChangeListeners.forEach((fn) => fn(false));
      onCloseListeners.forEach((fn) => fn());

      if (!reconnectOnClose) {
        console.log("ws closed by app");
        return;
      }

      if (retryCount >= retryLimit) {
        console.log("ws retry limit reached");
        return;
      }

      console.log("ws closed by server");

      retryCount++;
      setTimeout(start, 2000);
    };
  }

  start();

  return {
    addListener,
    removeListener,
    close: () => client.close(),
    getClient: () => client,
    isConnected: () => isConnected,
    send: (data: string | ArrayBuffer) => {
      if (isConnected) {
        client.send(data);
      }
    },
  };
}
