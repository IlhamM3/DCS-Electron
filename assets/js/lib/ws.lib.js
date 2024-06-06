const eventEmitter = require("events");

let _token = undefined;

class __ws extends eventEmitter {
  constructor(url, debug) {
    super();

    this._url = url.replace(/http/i, "ws");
    this._ws = undefined;
    this.debug = debug;
  }

  /**
   *	emit data if only there is at least 1 listener
   *	@private
   *	@param {string} eventName - event name to be emitted
   *	@param {*} value - event data, any datatype can be emitted
   * */
  _emit(eventName, value) {
    const self = this;
    if (self.listenerCount(eventName) > 0) {
      self.emit(eventName, value);
      return true;
    }

    return false;
  }

  setToken(token) {
    _token = token;
  }

  _registerListener() {
    const self = this;

    if (!self._ws) {
      return false;
    }

    self._ws.onopen = function (data) {
      const text = `Connection to ${self._url} has been established`;
      self._emit("open", text);

      if (self.debug) {
        console.log(text);
      }
    };

    self._ws.onmessage = function (received) {
      const { data } = received;
      
      try {
        const message = JSON.parse(data);
        const { status, code, event } = message;
        if(message.event){
          if (message.event === 'battery') {
            const { data } = message;
            const databaterai = data.data
            gEvents.emit("databaterai", databaterai)
          } else if(message.event === 'cycle'){
            const {data} = message
            const datacycle = data.data
            gEvents.emit("datacycle", datacycle)
          } 
        }
        switch (code) {
          case 331:
            const sentData = { token: _token };
            self._ws.send(JSON.stringify(sentData));
            break;

          case 231:
            self._emit("ws-valid", message);

            if (self.debug) {
              console.log("ws-valid", message);
            }
            break;

          default:
            self._emit("ws-message", message);

            if (self.debug) {
              // console.log("ws-message", message);
            }
            break;
        }
      } catch (error) {
        self._emit("ws-raw-message", received);

        if (self.debug) {
          console.error("ws-message", error);
          console.log("ws-raw-message", received);
        }
      }
    };

    self._ws.onclose = function (error) {
      self._emit("ws-close", error);
      setTimeout(() => {
        self.connect();
      }, 500);

      if (self.debug) {
        console.log("ws-close", error);
      }
    };

    self._ws.onerror = function (error) {
      self._emit("ws-error", error);
      self._ws.close();

      if (self.debug) {
        console.log("ws-error", error);
      }
    };

    return true;
  }

  connect() {
    const self = this;
    self._ws = new WebSocket(self._url);
    self._registerListener();
  }

  send(data) {
    const self = this;

    if (self._ws) {
      self._ws.send(JSON.stringify(data));
      return;
    }

    if (self.debug) {
      console.error("ws Error: websocket is not intialized yet");
    }
  }
}

module.exports = __ws;
